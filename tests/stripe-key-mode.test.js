import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripeKeyMode,stripeKeyType} from '../stripe-key-mode.js';
import {webhookSecretFor,configuredWebhookSecret} from '../webhook-environments.js';
import {checkoutOrderPrefix,checkoutOrderMatchesMode} from '../stripe-order-mode.js';
const mockSecret=label=>'wh'+'sec_'+label;
test('restricted keys identify live mode without pretending to be sk keys',()=>{
 assert.equal(stripeKeyMode('rk_live_example'),'live');
 assert.equal(stripeKeyType('rk_live_example'),'restricted');
 assert.equal(stripeKeyMode('rk_test_example'),'test');
 assert.equal(stripeKeyType('rk_test_example'),'restricted');
 assert.equal(stripeKeyMode('sk_live_example'),'live');
 assert.equal(stripeKeyType('sk_live_example'),'secret');
 assert.equal(stripeKeyMode('sk_test_example'),'test');
});
test('publishable, malformed and whitespace-padded keys stay invalid',()=>{
 for(const k of ['','pk_live_example','pk_test_example','rk_live_','rk_live_example ',' rk_live_example',
  'rk_test_example\n','rk_example','not_a_key',null,undefined,{},'sk_live_']){
  assert.equal(stripeKeyMode(k),null);
  assert.equal(stripeKeyType(k),null);
 }
});
test('restricted live keys use only the dedicated live webhook signature, not sandbox',()=>{
 const env={STRIPE_LIVE_WEBHOOK_SECRET:mockSecret('liveMock'),
   STRIPE_WEBHOOK_SECRET:mockSecret('testMock'),
   STRIPE_TEST_WEBHOOK_SECRET:mockSecret('testMock')};
 assert.equal(webhookSecretFor('rk_live_example',env),mockSecret('liveMock'));
 assert.equal(webhookSecretFor('rk_test_example',env),mockSecret('testMock'));
 assert.equal(configuredWebhookSecret('rk_live_example',env),true);
 assert.equal(configuredWebhookSecret('rk_live_example',{STRIPE_WEBHOOK_SECRET:mockSecret('testMock')}),false);
});
test('restricted live orders cannot unlock sandbox order records and vice versa',()=>{
 assert.equal(checkoutOrderPrefix('rk_live_example'),'cs_live_');
 assert.equal(checkoutOrderPrefix('rk_test_example'),'cs_test_');
 assert.equal(checkoutOrderMatchesMode('cs_test_fake','rk_live_example'),false);
 assert.equal(checkoutOrderMatchesMode('cs_live_fake','rk_test_example'),false);
 assert.equal(checkoutOrderMatchesMode('cs_live_valid','rk_live_example'),true);
});
test('server rejects live sales until merchant authorization and release gates pass',()=>{
 const source=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(source,/const configuredForLive=\(\)=>stripeKeyMode\(process\.env\.STRIPE_SECRET_KEY\)==='live'/);
 assert.match(source,/const testMode=\(\)=>stripeKeyMode\(process\.env\.STRIPE_SECRET_KEY\)==='test'/);
 assert.match(source,/!!stripeKeyMode\(process\.env\.STRIPE_SECRET_KEY\)/);
 assert.match(source,/liveMerchant\.ready&&liveReleaseReadiness\(process\.env\)\.ready/);
 assert.match(source,/await stripe\.accounts\.retrieve\(\)/);
 assert.match(source,/stripeAuth==='authorized'/);
 assert.doesNotMatch(source,/const configuredForLive=\(\)=>!!process\.env\.STRIPE_SECRET_KEY\?\.startsWith/);
});
