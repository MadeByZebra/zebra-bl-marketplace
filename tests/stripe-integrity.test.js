import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutModeMatches,paymentIntentMatches} from '../stripe-integrity.js';
const session={
 id:'cs_test_valid_purchase_123',mode:'payment',livemode:false,status:'complete',
 payment_status:'paid',currency:'usd',amount_total:1800,payment_intent:'pi_mock_456',
 metadata:{user_id:'person-1',sku:'control-center'}
};
const order={user_id:'person-1',sku:'control-center',amount:1800};
const charge={id:'ch_mock_789',payment_intent:'pi_mock_456',livemode:false,status:'succeeded',
 paid:true,refunded:false,amount_refunded:0,disputed:false};
const intent={id:'pi_mock_456',livemode:false,status:'succeeded',amount_received:1800,
 currency:'usd',latest_charge:charge};
test('verified sandbox charge and Checkout session can satisfy a paid entitlement',()=>{
 assert.equal(checkoutModeMatches(session,'test'),true);
 assert.equal(paymentIntentMatches(session,order,intent,charge,'test'),true);
});
test('incomplete, underpaid, failed, disputed and refunded payments never validate',()=>{
 for(const fake of [
  {...session,status:'open'}, {...session,payment_status:'unpaid'},
  {...session,amount_total:1799}, {...session,mode:'setup'},
  {...session,livemode:true}, {...session,id:'cs_live_confused'},
  {...session,currency:'eur'}
 ])assert.equal(paymentIntentMatches(fake,order,intent,charge,'test'),false,JSON.stringify(fake));
 for(const fake of [
  {...intent,status:'requires_payment_method'}, {...intent,amount_received:1799},
  {...intent,id:'pi_not_ours'}, {...intent,livemode:true},
  {...intent,latest_charge:'ch_wrong'}, {...intent,currency:'eur'}
 ])assert.equal(paymentIntentMatches(session,order,fake,charge,'test'),false,JSON.stringify(fake));
 for(const fake of [
  {...charge,paid:false}, {...charge,status:'failed'}, {...charge,refunded:true},
  {...charge,amount_refunded:1}, {...charge,disputed:true},
  {...charge,livemode:true}, {...charge,id:'ch_wrong'},
  {...charge,payment_intent:'pi_another'}
 ])assert.equal(paymentIntentMatches(session,order,intent,fake,'test'),false,JSON.stringify(fake));
});
test('live-only payments cannot be mixed into the sandbox or vice versa',()=>{
 const ls={...session,id:'cs_live_real_purchase',livemode:true};
 const li={...intent,livemode:true,latest_charge:{...charge,livemode:true}};
 const lc={...charge,livemode:true};
 assert.equal(paymentIntentMatches(ls,order,li,lc,'live'),true);
 assert.equal(paymentIntentMatches(ls,order,li,lc,'test'),false);
 assert.equal(paymentIntentMatches(session,order,intent,charge,'live'),false);
});
test('no forged free amount passes a paid charge check',()=>{
 assert.equal(paymentIntentMatches(session,{...order,amount:0},intent,charge,'test'),false);
 assert.equal(paymentIntentMatches(session,{...order,amount:1},intent,charge,'test'),false);
 assert.equal(paymentIntentMatches(null,order,intent,charge,'test'),false);
});
