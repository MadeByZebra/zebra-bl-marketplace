import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const widget=read('public/zebra-support-chat.js');
const css=read('public/zebra-chat.css');
const htmlPages=['public/index.html','public/scripts/index.html','public/account/index.html',
'public/zflag/index.html','public/support/index.html','public/privacy/index.html','public/terms/index.html'];

test('all seven pages use only our Zebra-owned widget, never embed tawk.to',()=>{
 for(const page of htmlPages){
  const html=read(page);
  assert.equal((html.match(/src="\/zebra-support-chat\.js\?v=20261121v1"/g)||[]).length,1,page);
  assert.doesNotMatch(html,/src="\/tawk-chat\.js"|embed\.tawk\.to|Powered by tawk\.to/i,page);
  assert.match(html,/href="\/zebra-chat\.css"/);
 }
 assert.doesNotMatch(widget,/embed\.tawk\.to|Powered by tawk\.to|Tawk_API/i);
 assert.doesNotMatch(css,/Powered by tawk\.to/i);
});
test('widget supplies private chat and user-controlled human and email fallback',()=>{
 assert.match(widget,/id='zebra-chat-launcher'|launcher\.id='zebra-chat-launcher'/);
 assert.match(widget,/zebra-owned-chat-feed/);
 assert.match(widget,/zebra-owned-chat-compose/);
 assert.match(widget,/zebra-owned-chat-actions/);
 assert.match(widget,/zebra-owned-inline-url/);
 assert.match(widget,/\/api\/zebra-chat\/start/);
 assert.match(widget,/\/api\/zebra-chat\//);
 assert.match(widget,/\/human/);
 assert.match(widget,/localStorage/);
 assert.match(widget,/support\/#contact/);
});
test('own chat contains scroll without freezing nested conversation and restores on close',()=>{
 assert.match(widget,/classList\.add\('zebra-chat-scroll-locked'\)/);
 assert.match(widget,/classList\.remove\('zebra-chat-scroll-locked'\)/);
 assert.match(css,/\.zebra-owned-chat-feed/);
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/overscroll-behavior:contain/);
 assert.match(css,/html\.zebra-chat-scroll-locked/);
});
test('customer support forms and footer contacts stay directly accessible',()=>{
 for(const path of ['public/index.html','public/scripts/index.html','public/account/index.html','public/zflag/index.html']){
  const html=read(path);
  assert.match(html,/class="zebra-inline-support-cta"/);
  assert.match(html,/class="zebra-footer-email-link"/);
  assert.match(html,/href="\/support\/#contact"/);
 }
 const support=read('public/support/index.html');
 assert.match(support,/id="zebra-support-form"/);
 assert.match(support,/Compose in Gmail/);
 assert.match(support,/Use default email app/);
 const terms=read('public/terms/index.html');
 assert.match(terms,/email Zebra Support/);
});
test('operator inbox is first-party and blocks crawlers',()=>{
 const html=read('public/support/inbox/index.html');
 const app=read('public/zebra-inbox.js');
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/src="\/zebra-inbox\.js"/);
 assert.match(app,/api\/zebra-chat\/admin\/threads/);
 assert.match(app,/Notification\.requestPermission/);
 assert.match(html,/Join chat/);
});
