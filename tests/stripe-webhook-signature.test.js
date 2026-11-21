import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

const stripe=new Stripe('sk_test_local_signature_check_only');
const secret='whsec_sandbox_local_fixture';
const event={
 id:'evt_test_checkout_completed_abc',object:'event',type:'checkout.session.completed',
 api_version:'2025-01-27.acacia',created:Math.floor(Date.now()/1000),
 livemode:false,pending_webhooks:1,
 data:{object:{id:'cs_test_local_fake_1234',object:'checkout.session',status:'complete',
   mode:'payment',livemode:false,payment_status:'paid'}}
};
const payload=JSON.stringify(event);
test('Stripe accepts a correctly signed raw JSON checkout event',()=>{
 const header=stripe.webhooks.generateTestHeaderString({payload,secret});
 const verified=stripe.webhooks.constructEvent(Buffer.from(payload),header,secret);
 assert.equal(verified.id,event.id);
 assert.equal(verified.type,'checkout.session.completed');
 assert.equal(verified.livemode,false);
});
test('modified Checkout payload is rejected even if the event ID is unchanged',()=>{
 const header=stripe.webhooks.generateTestHeaderString({payload,secret});
 assert.throws(()=>stripe.webhooks.constructEvent(
  Buffer.from(payload.replace('"paid"','"unpaid"')),header,secret
 ),/signature/i);
});
test('wrong webhook signing secret is rejected',()=>{
 const header=stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_wrong'});
 assert.throws(()=>stripe.webhooks.constructEvent(Buffer.from(payload),header,secret),/signature/i);
});
test('replayed old Stripe webhook signature is rejected by tolerance window',()=>{
 const timestamp=Math.floor(Date.now()/1000)-60*30;
 const header=stripe.webhooks.generateTestHeaderString({payload,secret,timestamp});
 assert.throws(()=>stripe.webhooks.constructEvent(Buffer.from(payload),header,secret),/tolerance|timestamp/i);
});
