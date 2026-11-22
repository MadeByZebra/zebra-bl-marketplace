import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runEmailDeliveryProbe,DELIVERY_PROBE_SUBJECT} from '../email-delivery-probe.js';
test('probe refuses to send by default or without provider authorization',async()=>{
 let sends=0;const sendMail=async()=>{sends++;return {accepted:true};};
 assert.deepEqual(await runEmailDeliveryProbe({recipient:'buyer@example.com',sendMail,providerAuthorized:true}),{status:'disabled'});
 assert.deepEqual(await runEmailDeliveryProbe({enabled:true,recipient:'buyer@example.com',sendMail}),{status:'blocked',reason:'provider_unavailable'});
 assert.equal(sends,0);
});
test('invalid inbox destinations rejected without a provider call',async()=>{
 let sends=0;const sendMail=async()=>{sends++;};
 const r=await runEmailDeliveryProbe({enabled:true,recipient:'NOT AN ADDRESS',sendMail,providerAuthorized:true});
 assert.equal(r.status,'blocked');assert.equal(sends,0);
});
test('provider accepted is not confused with confirmed inbox delivery',async()=>{
 let sent=null;
 const r=await runEmailDeliveryProbe({enabled:true,recipient:'owner@example.net',
  providerAuthorized:true,sendMail:async x=>{sent=x;return {accepted:true};}});
 assert.deepEqual(r,{status:'provider_accepted'});
 assert.equal(sent.to,'owner@example.net');
 assert.equal(sent.subject,DELIVERY_PROBE_SUBJECT);
 assert.match(sent.text,/not an order, a payment, a receipt/i);
 assert.equal(sent.text.includes('code is'),false);
});
test('provider rejection produces safe generic status',async()=>{
 const r=await runEmailDeliveryProbe({enabled:true,recipient:'owner@example.net',
  providerAuthorized:true,sendMail:async()=>{throw Object.assign(new Error('secret API details'),{code:'AUTH_401'});}});
 assert.deepEqual(r,{status:'failed',reason:'provider_rejected'});
});
test('server probes only when explicit environment switch is enabled',()=>{
 const text=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(text,/process\.env\.RUN_EMAIL_DELIVERY_PROBE==='1'/);
 assert.match(text,/recipient:process\.env\.EMAIL_DELIVERY_PROBE_RECIPIENT/);
 assert.match(text,/providerAuthorized:providerAuth==='authorized'/);
 assert.match(text,/Email inbox probe:/);
});
