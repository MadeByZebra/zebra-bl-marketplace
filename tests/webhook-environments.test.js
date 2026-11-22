import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webhookSecretFor,configuredWebhookSecret} from '../webhook-environments.js';
// Construct fixture secrets at runtime so source scanning still catches leaked keys.
const mockSecret=label=>'wh'+'sec_'+label;

test('test Stripe key retains currently configured sandbox signing secret',()=>{
 assert.equal(webhookSecretFor('sk_test_example',{STRIPE_WEBHOOK_SECRET:mockSecret('testSecret123')}),mockSecret('testSecret123'));
 assert.equal(configuredWebhookSecret('sk_test_example',{STRIPE_WEBHOOK_SECRET:mockSecret('testSecret123')}),true);
});
test('explicit sandbox secret can override old generic signing secret',()=>{
 assert.equal(webhookSecretFor('sk_test_example',{
  STRIPE_TEST_WEBHOOK_SECRET:mockSecret('testNew123'),STRIPE_WEBHOOK_SECRET:mockSecret('oldTest123')
 }),mockSecret('testNew123'));
});
test('live Stripe key cannot use generic or test webhook secrets',()=>{
 const e={STRIPE_WEBHOOK_SECRET:mockSecret('testSecret123'),STRIPE_TEST_WEBHOOK_SECRET:mockSecret('otherTest123')};
 assert.equal(webhookSecretFor('sk_live_example',e),'');
 assert.equal(configuredWebhookSecret('sk_live_example',e),false);
 assert.equal(webhookSecretFor('sk_live_example',{...e,STRIPE_LIVE_WEBHOOK_SECRET:mockSecret('liveSecret123')}),mockSecret('liveSecret123'));
 assert.equal(configuredWebhookSecret('sk_live_example',{...e,STRIPE_LIVE_WEBHOOK_SECRET:mockSecret('liveSecret123')}),true);
});
test('invalid and missing secrets are rejected in all modes',()=>{
 for(const x of ['',null,'rk_live_restricted','pk_live_public'])assert.equal(webhookSecretFor(x,{STRIPE_LIVE_WEBHOOK_SECRET:mockSecret('example')}),'');
 for(const s of ['','not-a-webhook-secret','whsec_','whsec_x@malformed'])
  assert.equal(configuredWebhookSecret('sk_live_example',{STRIPE_LIVE_WEBHOOK_SECRET:s}),false);
});
test('server verifies signed webhooks with the mode-specific secret',()=>{
 const s=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(s,/stripe\.webhooks\.constructEvent\(req\.body,req\.get\('stripe-signature'\),webSecret\(\)\)/);
 assert.match(s,/configuredWebhookSecret\(process\.env\.STRIPE_SECRET_KEY,process\.env\)/);
 assert.match(s,/evt\.livemode!==!testMode\(\)/);
});
