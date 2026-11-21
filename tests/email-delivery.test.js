import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMailer,mailerMode,sendShopEmail,receiptEmail} from '../email-delivery.js';
const send=async(url,args)=>({ok:true,status:201,json:async()=>({id:'queued'})});
test('prefer activated Brevo configuration over Resend sandbox',()=>{
 const env={BREVO_API_KEY:'test-key',BREVO_FROM_EMAIL:'seller@gmail.com',
  RESEND_API_KEY:'test-only',MAIL_FROM:'Zebra <onboarding@resend.dev>'};
 assert.equal(activeMailer(env),'brevo');assert.equal(mailerMode(env),'brevo_configured');
});
test('send a Brevo transaction with correct authenticated server-only transport',async()=>{
 const env={BREVO_API_KEY:'test-key',BREVO_FROM_EMAIL:'seller@gmail.com'};
 let actual;
 await sendShopEmail({to:'buyer@example.com',subject:'Login',text:'123456',env,
  fetchImpl:async(url,init)=>{actual={url,...init};return {ok:true,status:201}}});
 assert.equal(actual.url,'https://api.brevo.com/v3/smtp/email');
 assert.equal(actual.headers['api-key'],'test-key');
 const b=JSON.parse(actual.body);
 assert.deepEqual(b.sender,{name:"Zebra's Shop",email:'seller@gmail.com'});
 assert.deepEqual(b.to,[{email:'buyer@example.com'}]);
 assert.equal(b.textContent,'123456');
 assert.ok(!actual.body.includes('onboarding@resend.dev'));
});
test('the Resend test-sender limitation is correctly identified',async()=>{
 const env={RESEND_API_KEY:'secret',MAIL_FROM:"Zebra's Shop <onboarding@resend.dev>"};
 assert.equal(mailerMode(env),'resend_test_only');
 await assert.rejects(()=>sendShopEmail({
  to:'other@example.com',subject:'Login',text:'code',env,
  fetchImpl:async()=>({ok:false,status:403})
 }),/still using Resend testing mode/);
});
test('verified domain Resend emails use Idempotency-Key for purchase notices',async()=>{
 let actual;await sendShopEmail({
  to:'buyer@example.com',subject:'Purchase',text:'confirmed',
  env:{RESEND_API_KEY:'private',MAIL_FROM:'Zebra <login@owned.example>'},
  idempotencyKey:'zebra-shop-order-cs_test_123',
  fetchImpl:async(url,init)=>{actual={url,...init};return {ok:true,status:200}}
 });
 assert.equal(actual.headers['Idempotency-Key'],'zebra-shop-order-cs_test_123');
 assert.equal(JSON.parse(actual.body).to[0],'buyer@example.com');
});
test('purchase confirmation contains paid amount and account URL but no sensitive code',()=>{
 const m=receiptEmail({name:'Control Center',totalCents:1800,orderId:'cs_test_demo',
  storeUrl:'https://zebra-bl-marketplace.onrender.com',receiptUrl:'https://pay.stripe.com/receipts/demo'});
 assert.match(m,/\$18\.00 USD/);
 assert.match(m,/\/account\//);
 assert.match(m,/pay\.stripe\.com\/receipts/);
 assert.doesNotMatch(m,/sk_live_|ZEBRA_PAYLOAD_KEY|123456/);
});
