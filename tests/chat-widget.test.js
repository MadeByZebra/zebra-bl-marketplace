import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const loader=readFileSync(new URL('../public/tawk-chat.js',import.meta.url),'utf8');

test('custom chat hides native tawk widget before it renders to prevent flash',()=>{
  assert.match(loader,/api\.onBeforeLoad\s*=\s*function\s*\(\)\s*\{/);
  assert.match(loader,/api\.onBeforeLoad\s*=\s*function[\s\S]*?api\.hideWidget\(\)/);
  assert.ok(loader.indexOf('api.onBeforeLoad')<loader.indexOf('api.onLoad'));
  assert.match(loader,/api\.showWidget\(\)/);
  assert.match(loader,/api\.maximize\(\)/);
  assert.match(loader,/api\.onChatMinimized/);
});
test('store uses only its own branded launcher with one official tawk loader',()=>{
  assert.equal((loader.match(/embed\.tawk\.to\/6b020888c09bf83cda5bd06c\/1k7vv2l1g/g)||[]).length,1);
  for(const path of ['../public/index.html','../public/scripts/index.html','../public/account/index.html','../public/zflag/index.html']){
    const html=readFileSync(new URL(path,import.meta.url),'utf8');
    assert.match(html,/<script src="\/tawk-chat\.js" defer><\/script>/);
    assert.match(html,/href="\/zebra-chat\.css"/);
  }
});
test('the branded launcher is not hidden until chat is opened',()=>{
  const css=readFileSync(new URL('../public/zebra-chat.css',import.meta.url),'utf8');
  assert.match(css,/\.zebra-support-trigger\.is-open\s*\{[^}]*visibility:hidden/);
  assert.match(loader,/api\.onChatHidden/);
});


test('chat locks storefront scrolling when maximized and restores on minimize/close',()=>{
  const css=readFileSync(new URL('../public/zebra-chat.css',import.meta.url),'utf8');
  const smoothScroll=readFileSync(new URL('../public/smooth-scroll.js',import.meta.url),'utf8');
  assert.match(loader,/classList\.toggle\('zebra-chat-scroll-locked',\s*isOpen\)/);
  assert.match(loader,/api\.onChatMaximized\s*=\s*function/);
  assert.match(loader,/api\.onChatMinimized\s*=\s*function/);
  assert.match(loader,/api\.onChatHidden\s*=\s*function/);
  assert.match(css,/html\.zebra-chat-scroll-locked[^}]*overflow-y:\s*hidden\s*!important/);
  assert.match(smoothScroll,/zebra-chat-scroll-locked/g);
  assert.match(smoothScroll,/if\(e\.cancelable\)e\.preventDefault\(\)/);
});
test('the same support button provides separate free email support',()=>{
  const css=readFileSync(new URL('../public/zebra-chat.css',import.meta.url),'utf8');
  assert.match(loader,/zebra-support-email/);
  assert.match(loader,/mailto:/);
  assert.match(loader,/zebrablshopofficial@gmail\.com/);
  assert.match(css,/\.zebra-support-email/);
});



test('email support composes a prefilled message through the visitor mail app',()=>{
  assert.ok(loader.includes("const supportEmail = 'zebrablshopofficial@gmail.com'"));
  assert.ok(loader.includes("const supportComposeLink = 'mailto:' + supportEmail"));
  assert.ok(loader.includes('encodeURIComponent(supportSubject)'));
  assert.ok(loader.includes('encodeURIComponent(supportBody)'));
  assert.ok(loader.includes('emailLink.href = supportComposeLink'));
  assert.ok(loader.includes('String.fromCharCode(13, 10)'));
});
test('support center offers Gmail compose as an alternative to default mail apps',()=>{
  const html=readFileSync(new URL('../public/support/index.html',import.meta.url),'utf8');
  assert.ok(html.includes('Email via your mail app'));
  assert.ok(html.includes('Compose in Gmail'));
  assert.ok(html.includes('mail.google.com/mail/?view=cm'));
  assert.ok(html.includes('to=zebrablshopofficial%40gmail.com'));
});
