import test from 'node:test';
import assert from 'node:assert/strict';
import {validFreeCheckout} from '../free-checkout.js';
const order={user_id:'user-1',sku:'control-center',amount:0};
const claim={user_id:'user-1',sku:'control-center',session_id:'cs_test_free_123'};
const session={
 id:'cs_test_free_123',livemode:false,mode:'payment',status:'complete',payment_status:'no_payment_required',
 client_reference_id:'user-1',currency:'usd',amount_total:0,amount_subtotal:1999,
 total_details:{amount_discount:1999},payment_intent:null,
 metadata:{user_id:'user-1',sku:'control-center',free_promo:'v1'}
};
test('a verified Stripe 100%-off order grants exactly one matching account',()=>{
 assert.equal(validFreeCheckout(session,order,claim),true);
 assert.equal(validFreeCheckout({...session,payment_status:'paid'},order,claim),true);
});
test('incomplete, unpaid or fabricated $0 checkouts cannot grant a license',()=>{
 const invalid=[
  {...session,status:'open'}, {...session,payment_status:'unpaid'},
  {...session,payment_intent:'pi_fake'}, {...session,amount_total:100},
  {...session,amount_subtotal:0}, {...session,total_details:{amount_discount:100}},
  {...session,metadata:{...session.metadata,free_promo:'no'}},
  {...session,client_reference_id:'another-user'},
  {...session,currency:'eur'}, {...session,livemode:true}, {...session,mode:'setup'},
  {...session,id:'cs_live_fake'}, {...session,metadata:{...session.metadata,user_id:'attacker'}}
 ];
 for(const candidate of invalid)assert.equal(validFreeCheckout(candidate,order,claim),false,JSON.stringify(candidate));
});
test('wrong account, wrong SKU or different checkout session cannot claim reserved free order',()=>{
 assert.equal(validFreeCheckout(session,order,{...claim,session_id:'cs_test_other'}),false);
 assert.equal(validFreeCheckout(session,order,{...claim,user_id:'attacker'}),false);
 assert.equal(validFreeCheckout(session,order,{...claim,sku:'dex-desktop'}),false);
 assert.equal(validFreeCheckout(session,{...order,amount:100},claim),false);
 assert.equal(validFreeCheckout(session,order,null),false);
});

test('valid completed free orders work only in the matching Stripe environment',()=>{
 const live={...session,id:'cs_live_example_123',livemode:true};
 const liveClaim={...claim,session_id:live.id};
 assert.equal(validFreeCheckout(live,order,liveClaim,'live'),true);
 assert.equal(validFreeCheckout(live,order,liveClaim,'test'),false);
 assert.equal(validFreeCheckout(session,order,claim,'live'),false);
});
