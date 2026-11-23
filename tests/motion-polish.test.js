import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Script} from 'node:vm';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const routes=[
 'index.html','scripts/index.html','zflag/index.html','account/index.html',
 'checkout/index.html','order/index.html','terms/index.html','privacy/index.html',
 'support/index.html','support/inbox/index.html'
];
test('smooth motion styles and interactions load on all public shop pages without removing brand layer',()=>{
 for(const name of routes){
  const s=read(name);
  assert.match(s,/href="\/brand\.css\?v=20261123-(?:light-contrast2|dark-card-contrast4)"/,name);
  assert.match(s,/href="\/zebra-motion\.css\?v=20261123a"/,name);
  assert.match(s,/src="\/zebra-motion\.js\?v=20261123a" defer/,name);
  const css=s.indexOf('/brand.css'),motion=s.indexOf('/zebra-motion.css');
  assert.ok(css<motion,'Motion CSS must override brand layer, '+name);
  for(const match of s.matchAll(/(?:src|href)="(\/[^\s"?#]+)(?:\?[^"]*)?"/g)){
   if(!/\.(?:js|css|svg|png|webp|jpg|ico)$/.test(match[1]))continue;
   assert.ok(existsSync(new URL('../public'+match[1],import.meta.url)),name+' missing '+match[1]);
  }
 }
});
test('FAQ accordions keep native details semantics with accessible, reversible height and opacity motion',()=>{
 const s=read('zebra-motion.js'),css=read('zebra-motion.css');
 assert.doesNotThrow(()=>new Script(s));
 assert.match(s,/\.faq-list details, \.help-faq details/);
 assert.match(s,/summary\.addEventListener\('click'/);
 assert.match(s,/details\.animate\(/);
 assert.match(s,/details\.open=opening/);
 assert.match(s,/old\.cancel\(\)/);
 assert.match(s,/fadesByDetail/);
 assert.match(s,/prefers-reduced-motion: reduce/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/summary:focus-visible/);
 assert.match(css,/z-answer-enter/);
 assert.match(read('support/index.html'),/<details data-faq>/);
 assert.match(read('scripts/index.html'),/<summary>Do scripts keep working after every game update/);
});
test('product dialogs retain native focus behavior while introducing smooth dismiss animations',()=>{
 const s=read('zebra-motion.js'),css=read('zebra-motion.css');
 assert.match(s,/dialog\.addEventListener\('cancel'/);
 assert.match(s,/dialog\.addEventListener\('close'/);
 assert.match(s,/\[data-close-dialog\]/);
 assert.match(s,/event\.stopImmediatePropagation\(\)/);
 assert.match(css,/dialog\[open\]/);
 assert.match(css,/@keyframes z-dialog-enter/);
 assert.match(css,/@keyframes z-backdrop-enter/);
 assert.doesNotMatch(s,/\/api\/(?:checkout|license|stripe)/);
});
test('support chat preserves old bubbles during polling and animates only actual new messages',()=>{
 const s=read('zebra-support-chat.js');
 assert.doesNotThrow(()=>new Script(s));
 assert.match(s,/const incremental=signatures\.length>=renderedSignatures\.length/);
 assert.match(s,/if\(!incremental\)feed\.replaceChildren\(\)/);
 assert.match(s,/const begin=incremental\?renderedSignatures\.length:0/);
 assert.match(s,/item\.classList\.add\('is-new'\)/);
 assert.match(s,/animatePanel\(true\)/);
 assert.match(s,/animatePanel\(false\)/);
 assert.match(s,/launcher\.classList\.add\('is-open'\)/);
 assert.match(s,/launcher\.classList\.remove\('is-open'\)/);
 assert.match(s,/AUTOMATED HELP/);
 assert.match(s,/request a human/i);
 assert.doesNotMatch(s,/fakeTyping|simulatedAi|generatingFake/i);
});
test('mobile dropdown retains Escape and outside dismissal, and support answers reflect real live pilot',()=>{
 const js=read('zebra-motion.js'),css=read('zebra-motion.css'),html=read('support/index.html');
 assert.match(js,/event\.key==='Escape'/);
 assert.match(js,/button\.setAttribute\('aria-expanded','false'\)/);
 assert.match(css,/\.scripts-page \.mobile-nav\.show/);
 assert.match(html,/six BL Scripts products and eligible bundles/);
 assert.match(html,/Roblox alt accounts/);
 assert.doesNotMatch(html,/<strong>Stripe Sandbox<\/strong> checkout is a simulation, not a real charge\. Public sales remain disabled/);
});
