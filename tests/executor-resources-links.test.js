import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const scripts=read('scripts/index.html'),home=read('index.html'),support=read('support/index.html'),css=read('executor-resources.css');
const expected=[
 'https://rcheatz.com/',
 'https://shop.fluxmarket.to/',
 'https://wyv.gg/',
 'https://lunor.wtf/',
 'https://buyrealest.xyz/',
 'https://vaderhug.net/'
];

test('all six seller-provided third-party destinations appear exactly once with safe external links',()=>{
 const section=scripts.split('<section id="executors"')[1]?.split('<section id="faq"')[0];
 assert.ok(section,'independent-store section missing');
 const urls=[...section.matchAll(/<a class="exec-store-link" href="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(urls,expected);
 assert.equal(new Set(urls).size,6);
 const links=[...section.matchAll(/<a class="exec-store-link" [^>]+>/g)].map(m=>m[0]);
 assert.equal(links.length,6);
 for(const link of links){
  assert.match(link,/target="_blank"/);
  assert.match(link,/rel="noopener noreferrer nofollow external"/);
  assert.match(link,/aria-label="Visit [^"]+ \(opens in a new tab\)"/);
 }
 assert.match(section,/Need an/);
 assert.match(section,/executor\?/);
 assert.match(section,/We create and sell the BL Scripts collection, not Roblox executors/);
 assert.match(section,/independent third-party stores/);
 assert.doesNotMatch(section,/Recommended|Official partner|Verified reseller|Official seller/);
 assert.doesNotMatch(section,/<(?:script|iframe|img)\b/);
});

test('source does not imply partnership or guarantee trust/compatibility, and unreleased ZFLAG stays separate',()=>{
 const section=scripts.split('<section id="executors"')[1]?.split('<section id="faq"')[0];
 assert.match(section,/None of these stores is owned, operated, certified, or endorsed/);
 assert.match(section,/No partnership, reseller status, compatibility, software safety, or purchase protection is implied/);
 assert.match(section,/not an executor offered here/);
 assert.match(section,/buyrealest\.xyz/);
 assert.match(section,/could not be independently accessed/);
 assert.match(scripts,/Are the executor stores officially partnered with BL Scripts/);
 assert.match(support,/Do I need an executor for BL Scripts/);
 assert.match(support,/href="\/scripts\/#executors"/);
 assert.doesNotMatch(scripts,/https:\/\/(?:rcheatz|wyv|lunor|vaderhug)\.[^\s"]+\/[^"<>]*(?:\.js|\.css)"/);
});

test('executor directory is easy to navigate from homepage, main/mobile nav and footer',()=>{
 assert.match(scripts,/id="executors"/);
 const jumpLinks=[...scripts.matchAll(/href="#executors"/g)];
 assert.ok(jumpLinks.length>=4,'desktop nav, mobile nav, FAQ and footer anchor expected');
 assert.match(home,/href="\/scripts\/#executors"[^>]*>Need an executor\?/);
 assert.match(home,/href="\/scripts\/#executors">Executor stores/);
 assert.match(scripts,/href="\/executor-resources\.css\?v=20261123-v1"/);
});

test('new section preserves the original monochrome branding, keyboard focus and reduced-motion preference',()=>{
 assert.match(css,/#executors/);
 assert.match(css,/background:#000/);
 assert.match(css,/\.exec-store-grid/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-columns:1fr/);
 assert.match(css,/\.exec-store-link:focus-visible/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/zebra-z-mark\.svg/);
 assert.doesNotMatch(css,/#(?:ff00ff|800080|a020f0)|magenta|purple|violet/i);
});
