import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSupportRequest,supportEmailContent} from '../support-request.js';
import {sendShopEmail} from '../email-delivery.js';

const valid={
 name:'Test Customer',email:'customer@example.com',subject:'Purchase or receipt',
 product:'STR Grinder',order:'cs_test_12345',message:'My verified order does not show up in my library.',
 website:''
};

test('legitimate support forms validate without ever accepting a customer-chosen recipient',()=>{
 const parsed=validateSupportRequest({...valid,to:'attacker@external.test'});
 assert.equal(parsed.ok,true);
 assert.equal(parsed.email,'customer@example.com');
 assert.equal(Object.hasOwn(parsed,'to'),false);
 const message=supportEmailContent(parsed,'ZBS-A1B2C3');
 assert.match(message.subject,/ZBS-A1B2C3/);
 assert.match(message.text,/My verified order does not show up/);
 assert.match(message.text,/customer@example.com/);
});

test('reject invalid content, oversized fields and fake topics',()=>{
 for(const patch of [
  {email:'not-an-email'},{name:'Hi\nBcc:bad@example.com'},
  {subject:'billing; send money'},{message:'short'},
  {message:'a'.repeat(4001)},{product:'x'.repeat(141)},
  {order:'a\nb'}
 ]){
  const parsed=validateSupportRequest({...valid,...patch});
  assert.equal(parsed.ok,false,JSON.stringify(patch).slice(0,75));
 }
});

test('honeypot discards bot messages before any email is sent',()=>{
 const parsed=validateSupportRequest({...valid,website:'https://spambot.example'});
 assert.equal(parsed.ok,true);
 assert.equal(parsed.discard,true);
});

test('shop email supports reply-to without changing fixed recipient',async()=>{
 let sent=null;
 const fetchImpl=async (_url,options)=>{
  sent=JSON.parse(options.body);
  return {ok:true,status:201};
 };
 const env={BREVO_API_KEY:'test-provider-key-not-real',BREVO_FROM_EMAIL:'support-fixture@example.com',BREVO_FROM_NAME:"Zebra's Shop"};
 const ret=await sendShopEmail({to:'support-fixture@example.com',replyTo:'customer@example.com',
   subject:'Test customer support',text:'Customer support request',env,fetchImpl});
 assert.equal(ret.accepted,true);
 assert.equal(sent.to[0].email,'support-fixture@example.com');
 assert.equal(sent.sender.email,'support-fixture@example.com');
 assert.equal(sent.replyTo.email,'customer@example.com');
});

test('first-party support form has accessible required fields, API and mail-provider fallbacks',()=>{
 const html=readFileSync(new URL('../public/support/index.html',import.meta.url),'utf8');
 const script=readFileSync(new URL('../public/support-form.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 const chat=readFileSync(new URL('../public/zebra-support-chat.js',import.meta.url),'utf8');
 for(const field of ['name','email','subject','message']){
  assert.ok(html.includes('name="'+field+'"'));
 }
 assert.match(html,/id="zebra-support-form"/);
 assert.doesNotMatch(html,/Compose directly in Gmail|mailto:|@gmail\.com|mail\.google\.com/);
 assert.match(html,/customer-support chat in the lower corner/);
 assert.match(script,/fetch\('\/api\/support\/request'/);
 assert.match(script,/response\.ok/);
 assert.match(server,/app\.post\('\/api\/support\/request',supportFormLimiter/);
 assert.match(server,/sendShopEmail\(\{to:destination,replyTo:input\.email/);
 assert.match(chat,/const supportUrl='\/support\/#contact'/);
});


test('every storefront email-contact button has a working form href without JS',()=>{
 const paths=['../public/index.html','../public/scripts/index.html',
   '../public/account/index.html','../public/zflag/index.html',
   '../public/support/index.html','../public/privacy/index.html',
   '../public/terms/index.html'];
 for(const path of paths){
  const html=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.ok(html.includes('href="/support/#contact"'),path+' must link to support form');
  const links=[...html.matchAll(/<a\b[^>]*>/gi)].map(x=>x[0]);
  const bad=links.filter(tag=>/href="mailto:zebrablshopofficial@gmail\.com/i.test(tag)&&!/data-zebra-email-client/.test(tag));
  assert.equal(bad.length,0,path+' must not rely on mailto except explicit fallback');
 }
});
