import test from 'node:test';
import assert from 'node:assert/strict';
import {sandboxEmails,isSandboxTester,mayCheckoutSandbox,mayDeliverSandboxScript} from '../stripe-sandbox.js';
test('sandbox access is denied by default, even for a valid email address',()=>{
 const env={ENABLE_TEST_CHECKOUT:'1',ENABLE_TEST_SOFTWARE_DELIVERY:'1'};
 assert.deepEqual(sandboxEmails(env),[]);
 assert.equal(mayCheckoutSandbox({email:'buyer@example.com',sku:'checkout-test',env}),false);
 assert.equal(mayDeliverSandboxScript('buyer@example.com',env),false);
});
test('only exact owner email can pay with test cards, without real script delivery',()=>{
 const env={STRIPE_TEST_ALLOWED_EMAILS:' Owner@Example.com , backup@example.com ',
  ENABLE_TEST_CHECKOUT:'1',ENABLE_TEST_SOFTWARE_DELIVERY:'0'};
 assert.equal(isSandboxTester('OWNER@example.com',env),true);
 assert.equal(isSandboxTester('notowner@example.com',env),false);
 assert.equal(mayCheckoutSandbox({email:'owner@example.com',sku:'checkout-test',env}),true);
 assert.equal(mayCheckoutSandbox({email:'owner@example.com',sku:'control-center',env}),false);
 assert.equal(mayCheckoutSandbox({email:'buyer@example.com',sku:'checkout-test',env}),false);
 assert.equal(mayDeliverSandboxScript('owner@example.com',env),false);
});
test('sandbox script entitlement requires both trusted email and explicit test delivery flag',()=>{
 const env={STRIPE_TEST_ALLOWED_EMAILS:'owner@example.com',
  ENABLE_TEST_CHECKOUT:'1',ENABLE_TEST_SOFTWARE_DELIVERY:'1'};
 assert.equal(mayCheckoutSandbox({email:'owner@example.com',sku:'complete-collection',env}),true);
 assert.equal(mayDeliverSandboxScript('owner@example.com',env),true);
 assert.equal(mayCheckoutSandbox({email:'public@example.com',sku:'complete-collection',env}),false);
 assert.equal(mayDeliverSandboxScript('public@example.com',env),false);
});
test('missing test checkout toggle blocks even trusted testers',()=>{
 const env={STRIPE_TEST_ALLOWED_EMAILS:'owner@example.com',ENABLE_TEST_SOFTWARE_DELIVERY:'1'};
 assert.equal(mayCheckoutSandbox({email:'owner@example.com',sku:'checkout-test',env}),false);
});
test('sandbox email list never treats wildcards or partial addresses as authorization',()=>{
 const env={STRIPE_TEST_ALLOWED_EMAILS:'*,@example.com,boss@example.com'};
 assert.equal(isSandboxTester('new@example.com',env),false);
 assert.equal(isSandboxTester('boss@example.com.attacker.com',env),false);
 assert.equal(isSandboxTester('boss@example.com',env),true);
});
