import test from 'node:test';
import assert from 'node:assert/strict';
import {liveMerchantReadiness} from '../merchant-readiness.js';

const active=()=>({
 id:'acct_live_example',
 charges_enabled:true,
 payouts_enabled:true,
 capabilities:{card_payments:'active'},
 requirements:{disabled_reason:null,currently_due:[]}
});

test('live checkout is forbidden when Stripe has not activated card payments',()=>{
 const a=active();a.capabilities.card_payments='inactive';
 assert.equal(liveMerchantReadiness(a).ready,false);
 assert.ok(liveMerchantReadiness(a).issues.includes('card_payments_inactive'));
});

test('live checkout is forbidden when bank payouts are not activated',()=>{
 const a=active();a.payouts_enabled=false;
 assert.equal(liveMerchantReadiness(a).ready,false);
 assert.ok(liveMerchantReadiness(a).issues.includes('payouts_disabled'));
});

test('live checkout is forbidden while Stripe requires account verification',()=>{
 const a=active();a.charges_enabled=false;a.requirements.disabled_reason='requirements.past_due';
 const result=liveMerchantReadiness(a);
 assert.equal(result.ready,false);
 assert.ok(result.issues.includes('charges_disabled'));
 assert.ok(result.issues.includes('verification_required'));
});

test('live checkout is forbidden if a secret key belongs to the wrong Stripe account',()=>{
 assert.equal(liveMerchantReadiness(active(),'acct_another').ready,false);
 assert.ok(liveMerchantReadiness(active(),'acct_another').issues.includes('wrong_stripe_account'));
});

test('merchant is eligible only when Stripe has explicitly enabled charges and bank payouts',()=>{
 assert.equal(liveMerchantReadiness(active(),'acct_live_example').ready,true);
 assert.equal(liveMerchantReadiness(undefined).ready,false);
});
