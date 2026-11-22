import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/scripts/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/zebra-true-black-v8.css',import.meta.url),'utf8');
test('scripts page exposes persistent payment status without a fake Buy button',()=>{
 assert.match(html,/id="checkoutNotice"/);
 assert.match(html,/id="checkoutNoticeTitle"/);
 assert.match(html,/id="checkoutNoticeBody"/);
 assert.match(html,/href="\/support\/"/);
 assert.match(css,/#checkoutNotice\[hidden\]/);
});
test('banner follows API checkout readiness, not the URL or a client-controlled flag',()=>{
 assert.match(script,/checkoutNotice\.hidden=Boolean\(store\.checkout_ready\)/);
 assert.match(script,/store\.mode==='test'/);
 assert.match(script,/store\.checkout_message/);
 assert.match(script,/window\.location\.assign\(url\)/);
});
