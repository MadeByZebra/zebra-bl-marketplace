// True PostgreSQL integration for paid Checkout -> order -> license eligibility
// -> receipt idempotency -> refund/dispute revocation. NO Stripe network calls,
// buyer card charges, real Neon connections, or production customer records.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import Stripe from 'stripe';
import {marketplaceSchema} from '../marketplace-schema.js';
import {verifyAndGrantStripeOrder,revokeForStripeChargeEvent} from '../stripe-fulfillment.js';
import {includedIds,byId} from '../catalog.js';

const adminUrl=process.env.TEST_POSTGRES_ADMIN_URL;
const integration=adminUrl?test:test.skip;
let pool,admin;
const buyer='e2e-buyer',other='e2e-other',day=Date.UTC(2026,10,22);
const query=async(sql,values=[])=> (await pool.query(sql,values)).rows;
const unique='zebra_fulfillment_e2e_20261122';
const sessionId=(label,mode='test')=>'cs_'+mode+'_'+label+'123456789ABCDEF';
const newOrder=async(id,amount=999,sku='str-grinder',userId=buyer)=>{
 await query("INSERT INTO purchases(session_id,user_id,sku,amount,status,created_at) VALUES ($1,$2,$3,$4,'pending',$5)",[id,userId,sku,amount,day]);
};
function fixture(id,amount=999,sku='str-grinder',userId=buyer,mode='test'){
 const livemode=mode==='live';
 const charge={id:'ch_'+id,payment_intent:'pi_'+id,livemode,paid:true,status:'succeeded',refunded:false,amount_refunded:0,disputed:false};
 const intent={id:'pi_'+id,livemode,status:'succeeded',amount_received:amount,currency:'usd',latest_charge:charge};
 const session={id,mode:'payment',livemode,status:'complete',payment_status:'paid',
  currency:'usd',amount_total:amount,payment_intent:intent.id,client_reference_id:userId,
  metadata:{sku,user_id:userId,free_promo:'no'}};
 const stripe={paymentIntents:{retrieve:async paymentIntentId=>{
  assert.equal(paymentIntentId,intent.id);return intent;
 }},charges:{retrieve:async chargeId=>{assert.equal(chargeId,charge.id);return charge;}}};
 return {session,intent,charge,stripe};
}
const grant=async(session,stripe,configuredMode='test')=>verifyAndGrantStripeOrder({
 session,stripe,configuredMode,query,now:()=>day+4000
});
const orderState=async id=>(await query('SELECT status,payment_intent,paid_at FROM purchases WHERE session_id=$1',[id]))[0];
before(async()=>{
 if(!adminUrl)return;
 admin=new Pool({connectionString:adminUrl});
 await admin.query('CREATE DATABASE '+unique);
 const u=new URL(adminUrl);u.pathname='/'+unique;
 pool=new Pool({connectionString:u.toString()});
 for(const sql of marketplaceSchema)await query(sql);
 for(const [id,email] of [[buyer,'safe-integration-buyer@example.invalid'],[other,'safe-integration-other@example.invalid']]){
  await query('INSERT INTO users(id,email,password_hash,created_at) VALUES($1,$2,$3,$4)',[id,email,'salt:hash',day]);
 }
});
after(async()=>{if(pool)await pool.end();if(admin)await admin.end();});

integration('a paid verified Stripe session produces one paid entitlement, not a browser-issued license',async()=>{
 const id=sessionId('paid');await newOrder(id);
 const {session,stripe}=fixture(id);
 assert.equal((await orderState(id)).status,'pending');
 assert.equal(await grant(session,stripe),true);
 assert.equal((await orderState(id)).status,'paid');
 assert.equal((await orderState(id)).payment_intent,'pi_'+id);
 assert.equal(await grant(session,stripe),true,'completed Stripe webhook replay stays idempotent');
 assert.equal((await query("SELECT count(*)::int AS count FROM purchases WHERE user_id=$1 AND status='paid'",[buyer]))[0].count,1);
 assert.ok(includedIds(byId['class-a-duo']).includes('str-grinder'));
 // A full purchased bundle contains two SKU entitlements; pricing is checked
 // against the original immutable order, never client-provided numbers.
});

integration('wrong buyer, SKU, amount, environment, incomplete or disputed payments never unlock',async()=>{
 const id=sessionId('forged');await newOrder(id,799,'dex-desktop');
 const {session,intent,charge,stripe}=fixture(id,799,'dex-desktop');
 const cases=[
  {...session,metadata:{...session.metadata,user_id:other}},
  {...session,metadata:{...session.metadata,sku:'str-grinder'}},
  {...session,client_reference_id:other},
  {...session,amount_total:1},
  {...session,status:'open'},
  {...session,payment_status:'unpaid'},
  {...session,livemode:true},
  {...session,id:sessionId('forged','live')},
  {...session,currency:'eur'}
 ];
 for(const s of cases)assert.equal(await grant(s,stripe),false,'must reject '+JSON.stringify(s));
 for(const bad of [{...intent,amount_received:1},{...intent,status:'requires_payment_method'},{...intent,latest_charge:{...charge,refunded:true}},
  {...intent,latest_charge:{...charge,disputed:true}}]){
  assert.equal(await grant(session,{paymentIntents:{retrieve:async()=>bad}}),false);
 }
 assert.equal((await orderState(id)).status,'pending');
});

integration('a verified refund revokes the paid order; replay cannot resurrect access',async()=>{
 const id=sessionId('refunded');await newOrder(id);
 const {session,stripe,charge}=fixture(id);
 assert.equal(await grant(session,stripe),true);
 assert.equal(await revokeForStripeChargeEvent({event:{type:'charge.refunded',data:{object:{...charge,refunded:true}}},query,stripe}),true);
 assert.equal((await orderState(id)).status,'revoked');
 assert.equal(await grant(session,stripe),false);
 assert.equal((await query("SELECT count(*)::int AS count FROM purchases WHERE session_id=$1 AND status='paid'",[id]))[0].count,0);
});

integration('a signed disputed charge can revoke paid entitlement with charge-ID lookup',async()=>{
 const id=sessionId('dispute');await newOrder(id);
 const {session,stripe,charge}=fixture(id);
 assert.equal(await grant(session,stripe),true);
 assert.equal(await revokeForStripeChargeEvent({
  event:{type:'charge.dispute.created',data:{object:{charge:charge.id}}},
  stripe,query
 }),true);
 assert.equal((await orderState(id)).status,'revoked');
 assert.equal(await grant(session,stripe),false);
});

integration('free coupon requires matching user, original order, complete Stripe session and reserved claim',async()=>{
 const id=sessionId('complimentary');await newOrder(id,0,'str-grinder');
 const free={id,mode:'payment',livemode:false,status:'complete',payment_status:'no_payment_required',
  currency:'usd',amount_total:0,amount_subtotal:999,total_details:{amount_discount:999},
  payment_intent:null,client_reference_id:buyer,metadata:{sku:'str-grinder',user_id:buyer,free_promo:'v1'}};
 await query('INSERT INTO free_promo_redemptions(user_id,sku,session_id,created_at) VALUES($1,$2,$3,$4)',[buyer,'str-grinder',id,day]);
 assert.equal(await grant({...free,metadata:{...free.metadata,user_id:other}},{paymentIntents:{}}),false);
 assert.equal((await orderState(id)).status,'pending');
 assert.equal(await grant(free,{paymentIntents:{}}),true);
 assert.equal((await orderState(id)).status,'paid');
 const redeemed=(await query('SELECT redeemed_at FROM free_promo_redemptions WHERE user_id=$1',[buyer]))[0];
 assert.ok(Number(redeemed.redeemed_at)>0);
 assert.equal(await grant(free,{paymentIntents:{}}),true,'replay does not repeat the coupon redemption');
});

integration('paid receipt notification claims are unique even after webhook replay',async()=>{
 const id=sessionId('paid');
 const sql='INSERT INTO purchase_notifications(session_id,sent_at) VALUES($1,$2) ON CONFLICT(session_id) DO NOTHING RETURNING session_id';
 assert.equal((await query(sql,[id,day+10000])).length,1);
 assert.equal((await query(sql,[id,day+20000])).length,0);
 assert.equal((await query('SELECT count(*)::int AS count FROM purchase_notifications WHERE session_id=$1',[id]))[0].count,1);
});

integration('invalid Stripe signatures cannot become verified events',async()=>{
 const sdk=new Stripe('sk_test_fake_for_tests_only');
 const payload=JSON.stringify({id:'evt_fake',object:'event',type:'checkout.session.completed',livemode:false,data:{object:{id:sessionId('forged')}}});
 const secret='whsec_test_fixture';
 const signature=sdk.webhooks.generateTestHeaderString({payload,secret});
 assert.equal(sdk.webhooks.constructEvent(Buffer.from(payload),signature,secret).type,'checkout.session.completed');
 assert.throws(()=>sdk.webhooks.constructEvent(Buffer.from(payload.replace('forged','paid')),signature,secret),/signature/i);
});
