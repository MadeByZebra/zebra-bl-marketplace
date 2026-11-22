import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runUnpaidLiveCheckoutPreflight} from '../live-launch-preflight.js';

function mockStripe({readError=null,createError=null,expireError=null,live=true}={}){
 const state={created:[],expired:[],called:[]};
 const stripe={
  checkout:{sessions:{
   list:async o=>{state.called.push('checkout_list');if(readError)throw readError;return {data:[]};},
   create:async args=>{
    state.created.push(args);
    if(createError)throw createError;
    return {id:'cs_live_fake_unpaid',livemode:live,status:'open'};
   },
   expire:async id=>{
    state.expired.push(id);
    if(expireError)throw expireError;
    return {id,status:'expired'};
   }
  }},
  paymentIntents:{list:async()=>{state.called.push('pi_list');return {data:[]};}},
  charges:{list:async()=>{state.called.push('charge_list');return {data:[]};}}
 };
 return {stripe,state};
}

test('creates and immediately expires an INTERNAL unpaid live checkout, never exposing a link',async()=>{
 const {stripe,state}=mockStripe();const mails=[];
 const result=await runUnpaidLiveCheckoutPreflight({
  stripe,sendMail:async mail=>{mails.push(mail);return {accepted:true}},
  supportEmail:'seller@domain.test',siteUrl:'https://example.test/',now:()=>1_800_000_000_000
 });
 assert.equal(result.checkout_create,true);
 assert.equal(result.checkout_expire,true);
 assert.equal(result.checkout_read,true);
 assert.equal(result.payment_intents_read,true);
 assert.equal(result.charges_read,true);
 assert.equal(result.email_provider_accepted,true);
 assert.deepEqual(result.issues,[]);
 assert.deepEqual(state.expired,['cs_live_fake_unpaid']);
 assert.equal(state.created[0].line_items[0].price_data.unit_amount,50);
 assert.equal(state.created[0].mode,'payment');
 assert.match(state.created[0].cancel_url,/^https:\/\/example\.test\/account/);
 assert.equal(state.created[0].metadata.internal_preflight,'1');
 assert.equal(mails.length,1);
 assert.match(mails[0].subject,/NO PURCHASE/);
 assert.equal(JSON.stringify(result).includes('cs_live_fake_unpaid'),false);
 assert.equal(JSON.stringify(result).includes('seller@domain.test'),false);
});
test('restricted key 403 keeps preflight marked as failed without requesting payment',async()=>{
 const {stripe,state}=mockStripe({createError:{statusCode:403}});
 const result=await runUnpaidLiveCheckoutPreflight({
  stripe,sendMail:async()=>({accepted:true}),supportEmail:'seller@domain.test',siteUrl:'https://example.test'
 });
 assert.equal(result.checkout_create,false);
 assert.equal(result.checkout_expire,false);
 assert.deepEqual(state.expired,[]);
 assert.ok(result.issues.includes('checkout_create:permission_denied'));
});
test('if Checkout cannot be expired, report the issue, never claim a completed preflight',async()=>{
 const {stripe,state}=mockStripe({expireError:{statusCode:403}});
 const result=await runUnpaidLiveCheckoutPreflight({
  stripe,sendMail:async()=>({accepted:true}),supportEmail:'seller@domain.test',siteUrl:'https://example.test'
 });
 assert.equal(state.created.length,1);
 assert.equal(state.expired.length,1);
 assert.equal(result.checkout_create,true);
 assert.equal(result.checkout_expire,false);
 assert.ok(result.issues.includes('checkout_expire:permission_denied'));
});
test('misconfigured email cannot be silently accepted as verified',async()=>{
 const {stripe}=mockStripe();let mailCalls=0;
 const result=await runUnpaidLiveCheckoutPreflight({
  stripe,sendMail:async()=>{mailCalls++;return {accepted:true}},
  supportEmail:'bad',siteUrl:'https://example.test'
 });
 assert.equal(mailCalls,0);
 assert.equal(result.email_provider_accepted,false);
 assert.ok(result.issues.includes('email:support_contact_missing'));
});
test('test-mode checkout is never considered a passing live preflight',async()=>{
 const {stripe,state}=mockStripe({live:false});
 const r=await runUnpaidLiveCheckoutPreflight({
  stripe,sendMail:async()=>({accepted:true}),supportEmail:'seller@domain.test',siteUrl:'https://example.test'
 });
 assert.equal(r.checkout_create,false);
 assert.equal(r.checkout_expire,true);
 assert.ok(r.issues.includes('checkout_create:unexpected_mode'));
 assert.equal(state.expired.length,1);
});
test('server requires owner-only single-shot flag and locked charges for diagnostics',()=>{
 const s=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(s,/RUN_UNPAID_PREFLIGHT==='1'/);
 assert.match(s,/process\.env\.ALLOW_LIVE_SALES!=='1'/);
 assert.match(s,/providerAuth==='authorized'/);
 assert.match(s,/runUnpaidLiveCheckoutPreflight/);
});
