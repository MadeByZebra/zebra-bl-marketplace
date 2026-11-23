import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

const pageFiles=[
 'index.html','scripts/index.html','zflag/index.html','account/index.html',
 'checkout/index.html','order/index.html','terms/index.html','privacy/index.html',
 'support/index.html','support/inbox/index.html'
];
const read=(name)=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('every storefront HTML page uses the approved Z favicon and global branding styles',()=>{
 for(const name of pageFiles){
  const s=read(name);
  assert.match(s,/<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="\/assets\/zebra-z-mark\.svg\?v=1">/,name);
  assert.match(s,/<link\s+rel="stylesheet"\s+href="\/brand\.css\?v=20261123a">/,name);
  assert.doesNotMatch(s,/<link\s+rel="icon"\s+href="data:,">/,name);
  assert.equal((s.match(/<\/head>/g)||[]).length,1,name);
  assert.equal((s.match(/<\/body>/g)||[]).length,1,name);
 }
 const wordmark=readFileSync(new URL('../public/assets/bl-scripts-logo.svg',import.meta.url),'utf8');
 const icon=readFileSync(new URL('../public/assets/zebra-z-mark.svg',import.meta.url),'utf8');
 assert.match(wordmark,/viewBox="0 0 1345 367"/);
 assert.match(wordmark,/aria-label="BL Scripts by Zebra"/);
 assert.match(icon,/viewBox="0 0 498 497"/);
 for(const src of [wordmark,icon]){
  assert.match(src,/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(src,/fill="#f8f8f8"/);
  assert.doesNotMatch(src,/purple|violet|magenta|neon/i);
 }
});
test('all main headers and footers with a brand link display the approved wordmark',()=>{
 for(const name of [...pageFiles.slice(0,6),'terms/index.html','privacy/index.html','support/index.html']){
  const s=read(name);
  const brands=[...s.matchAll(/<a\b[^>]*class="(?:brand|help-brand)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.ok(brands.length>0,name);
  for(const b of brands)assert.match(b[1],/class="brand-logo"\s+src="\/assets\/bl-scripts-logo\.svg\?v=1"/,name);
 }
});
test('skip links are hidden until keyboard focus and retain functioning section targets',()=>{
 const css=read('brand.css');
 assert.match(css,/\.skip-link:focus,\.skip-link:focus-visible/);
 assert.match(css,/transform:translateY\(calc\(-100% - 25px\)\)!important/);
 assert.match(css,/visibility:hidden!important/);
 assert.match(css,/visibility:visible!important/);
 for(const name of pageFiles){
  const html=read(name),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
  for(const jump of html.matchAll(/href="#([^"]+)"/g)){
   const target=jump[1];
   if(target&&target!=='#')assert.ok(ids.has(target),'Missing #'+target+' in '+name);
  }
  assert.equal(new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1])).size,
   [...html.matchAll(/\bid="([^"]+)"/g)].length,'Duplicate HTML ID '+name);
 }
});
test('product cards show approved emblem and STR END DEX monochrome UI previews',()=>{
 const app=read('app.js'),css=read('brand.css'),account=read('account/index.html');
 assert.match(app,/class="product-identity"/);
 assert.match(app,/src="\/assets\/zebra-z-mark\.svg\?v=1"/);
 for(const sku of ['str-grinder','end-grinder','dex-desktop','dex-mobile'])assert.ok(app.includes("'"+sku+"'"),sku);
 assert.match(app,/BLACK UI \/ BRAND CONCEPT/);
 assert.match(css,/\.product-visual-identity/);
 assert.match(css,/\.commerce-brandmark/);
 assert.match(account,/id="my-library"/);
 assert.match(read('checkout/index.html'),/id="checkout-main"/);
 assert.match(read('order/index.html'),/id="order-main"/);
});
test('public site asset links resolve to checked-in local files',()=>{
 for(const name of pageFiles){
  const html=read(name);
  for(const match of html.matchAll(/(?:src|href)="(\/[^"#?]+)(?:\?[^"]*)?"/g)){
   const relative=match[1];
   if(!/\.(?:svg|png|jpg|webp|ico|js|css)$/.test(relative))continue;
   assert.ok(existsSync(new URL('../public'+relative,import.meta.url)),'Missing '+relative+' referenced by '+name);
  }
 }
});
test('privacy and license terms accurately disclose network binding and reset limits',()=>{
 assert.match(read('privacy/index.html'),/hashed network identifier/);
 assert.match(read('terms/index.html'),/three keys per product/);
});
