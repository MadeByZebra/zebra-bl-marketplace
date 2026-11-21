import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMailer,mailerMode,verifyEmailProvider,sendShopEmail,receiptEmail} from '../email-delivery.js';
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

test('Brevo credential check does not send mail or disclose account details',async()=>{
 let method=null,url=null;
 const status=await verifyEmailProvider({BREVO_API_KEY:'dummy',BREVO_FROM_EMAIL:'owner@example.com'},async(u,init)=>{
  method=init.method;url=u;
  return {ok:true,status:200,json:async()=>{throw new Error('account response should never be inspected');}};
 });
 assert.equal(method,'GET');
 assert.equal(url,'https://api.brevo.com/v3/account');
 assert.deepEqual(status,{provider:'brevo',auth:'authorized'});
});
test('Brevo unauthorized, forbidden, or network errors produce safe statuses',async()=>{
 const env={BREVO_API_KEY:'dummy',BREVO_FROM_EMAIL:'owner@example.com'};
 const denied=await verifyEmailProvider(env,async()=>({ok:false,status:401}));
 assert.deepEqual(denied,{provider:'brevo',auth:'unauthorized',detail:'unclassified'});
 const blocked=await verifyEmailProvider(env,async()=>({ok:false,status:403}));
 assert.equal(blocked.auth,'forbidden');
 const offline=await verifyEmailProvider(env,async()=>{throw new Error('network timeout')});
 assert.equal(offline.auth,'network_error');
});
test('Brevo 401 send failure provides actionable message without exposing the API key',async()=>{
 const env={BREVO_API_KEY:'private-key-do-not-expose',BREVO_FROM_EMAIL:'owner@example.com'};
 await assert.rejects(sendShopEmail({
  to:'buyer@example.com',subject:'Code',text:'code',env,
  fetchImpl:async()=>({ok:false,status:401})
 }),err=>{
  assert.match(err.message,/API key \(401\)/);
  assert.ok(!err.message.includes(env.BREVO_API_KEY));
  return true;
 });
});

test('Brevo 401 classifications do not expose provider error messages',async()=>{
 const env={BREVO_API_KEY:'dummy',BREVO_FROM_EMAIL:'owner@example.com'};
 const cases=[
  ['Unauthorized: Key not found','invalid_key'],
  ['IP address not authorized','ip_restricted'],
  ['Access denied for resource','permission_denied'],
  ['Account under validation','account_not_approved']
 ];
 for(const [message,detail] of cases){
  const result=await verifyEmailProvider(env,async()=>({
   ok:false,status:401,json:async()=>({code:'unauthorized',message})
  }));
  assert.deepEqual(result,{provider:'brevo',auth:'unauthorized',detail});
  assert.ok(!JSON.stringify(result).includes(message));
 }
});
