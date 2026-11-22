import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldRetryUnrecordedCheckout,expireIncompleteCheckout} from '../checkout-consistency.js';
const paid={id:'cs_test_example',payment_status:'paid',metadata:{sku:'str-grinder',user_id:'user-123'}};
test('retry early paid webhook when the order record has not arrived yet',()=>{
 assert.equal(shouldRetryUnrecordedCheckout(paid,[]),true);
 assert.equal(shouldRetryUnrecordedCheckout({...paid,payment_status:'no_payment_required'},[]),true);
 assert.equal(shouldRetryUnrecordedCheckout(paid,[{session_id:paid.id}]),false);
});
test('ignore unrelated or unpaid sessions that lack a corresponding shop order',()=>{
 assert.equal(shouldRetryUnrecordedCheckout({...paid,payment_status:'unpaid'},[]),false);
 assert.equal(shouldRetryUnrecordedCheckout({...paid,metadata:{}},[]),false);
 assert.equal(shouldRetryUnrecordedCheckout(null,[]),false);
});
test('expire an incomplete Stripe Checkout Session after order persistence fails',async()=>{
 const called=[];const fake={checkout:{sessions:{expire:async id=>{called.push(id)}}}};
 assert.equal(await expireIncompleteCheckout(fake,'cs_test_example'),true);
 assert.deepEqual(called,['cs_test_example']);
 assert.equal(await expireIncompleteCheckout(fake,null),true);
 assert.equal(called.length,1);
});
test('expiry failures are reported without revealing Stripe secrets or hiding DB errors',async()=>{
 const reported=[];const fake={checkout:{sessions:{expire:async()=>{throw Object.assign(Error('secret'),{code:'resource_missing'})}}}};
 assert.equal(await expireIncompleteCheckout(fake,'cs_test_example',(...parts)=>reported.push(parts)),false);
 assert.deepEqual(reported,[['Failed to expire incomplete Checkout Session:','resource_missing']]);
});
test('server uses the retry-and-expire helpers in the payment lifecycle',()=>{
 const code=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(code,/shouldRetryUnrecordedCheckout\(session,recorded\)/);
 assert.match(code,/expireIncompleteCheckout\(stripe,unfinishedSessionId\)/);
 assert.match(code,/unfinishedSessionId=session\.id/);
 assert.match(code,/unfinishedSessionId=null/);
 assert.match(code,/await query\('INSERT INTO purchases/);
 assert.match(code,/stripe\.webhooks\.constructEvent/);
});
