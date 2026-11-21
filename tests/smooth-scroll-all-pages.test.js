import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const publicPages=[
 'public/index.html',
 'public/scripts/index.html',
 'public/account/index.html',
 'public/zflag/index.html',
 'public/support/index.html',
 'public/privacy/index.html',
 'public/terms/index.html'
];
const engine=read('public/smooth-scroll.js');
const shared=read('public/zebra-chat.css');

test('every public page includes exactly one identical version of smooth wheel scroll',()=>{
 for(const page of publicPages){
  const html=read(page);
  const matches=[...html.matchAll(/<script\s+src="(\/smooth-scroll\.js(?:\?[^"]*)?)"\s+defer><\/script>/g)];
  assert.equal(matches.length,1,'Missing or duplicated scrolling engine on '+page);
  assert.equal(matches[0][1],'/smooth-scroll.js?v=20261121v21',
    'Mismatched cached engine version on '+page);
  assert.ok(html.includes('href="/zebra-chat.css"'),
    'Missing shared anchor smooth scroll CSS on '+page);
 }
});

test('smooth wheel system preserves nested scrolling, accessible controls, and reduced motion',()=>{
 assert.match(engine,/prefers-reduced-motion:\s*reduce/);
 assert.match(engine,/reduced\.matches/);
 assert.match(engine,/e\.ctrlKey\|\|e\.metaKey/);
 assert.match(engine,/nested\(e\.target\)/);
 assert.match(engine,/\[role="dialog"\], dialog/);
 assert.match(engine,/textarea, select/);
 assert.match(engine,/overflowY/);
 assert.match(engine,/passive:false/);
 assert.match(engine,/zebra-chat-scroll-locked/);
 assert.match(engine,/addEventListener\('touchstart',cancel/);
 assert.match(engine,/addEventListener\('keydown',cancel/);
 assert.match(engine,/addEventListener\('popstate',cancel/);
 assert.match(engine,/addEventListener\('hashchange',cancel/);
});

test('all pages have smooth in-page anchors and respect reduced-motion preference',()=>{
 assert.match(shared,/html\s*\{\s*scroll-behavior:smooth/);
 assert.match(shared,/@media\s*\(prefers-reduced-motion:reduce\)/);
 assert.match(shared,/html\s*\{\s*scroll-behavior:auto!important/);
});

test('support form retains a working anchor link with the global scroll engine',()=>{
 const support=read('public/support/index.html');
 assert.match(support,/id="contact"/);
 assert.match(support,/id="zebra-support-form"/);
 assert.match(support,/href="#contact"/);
 assert.match(support,/href="#zebra-support-form"/);
});
