import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const brand=readFileSync(new URL('../public/brand.css',import.meta.url),'utf8');
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const luminance=hex=>{
 const rgb=(hex.match(/[A-Fa-f0-9]{2}/g)||[]).map(part=>parseInt(part,16)/255);
 const linear=rgb.map(v=>v<=0.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
 return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
};
const contrast=(a,b)=>{
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};

test('light-mode text palette meets normal text contrast on main light surfaces',()=>{
 for(const [foreground,background] of [
  ['#171717','#f2f2ef'], // primary text / preview cards
  ['#525252','#fafaf9'], // secondary labels / studio header
  ['#505050','#f2f2ef'], // tab labels and receipt metadata
  ['#484848','#ececea'], // left sidebar navigation
  ['#111111','#e0e0dc']  // selected tabs
 ]){
  assert.ok(contrast(foreground,background)>=4.5,foreground+' vs '+background+' falls below 4.5:1');
 }
});
test('fixes near-white labels on light previews without changing dark-theme rules',()=>{
 assert.match(brand,/Light-mode contrast audit \(2026-11-23\)/);
 for(const selector of [
  '.preview-row-copy strong',
  '.visual-content-top h3',
  '.studio-toolbar .crumb b',
  '.preview-tabs button.is-active',
  '.preview-row:hover',
  '.visual-sidebar button.visual-sidebar-item:not(.active):hover',
  '.account-side-list b'
 ])assert.ok(brand.includes('html[data-theme="light"]')&&brand.includes(selector),'Missing light-only fix: '+selector);
 assert.match(brand,/background:#e5e5e1!important/);
 assert.match(brand,/background:#dadad6!important/);
 assert.match(brand,/intentionally dark, even while the surrounding account page is light/);
});
test('new contrast stylesheet version is loaded on all shopper and support pages',()=>{
 const pages=[
  'index.html','scripts/index.html','checkout/index.html','account/index.html','order/index.html',
  'zflag/index.html','support/index.html','privacy/index.html','terms/index.html','support/inbox/index.html'
 ];
 for(const page of pages)assert.match(read(page),/\/brand\.css\?v=20261123-light-contrast2/,page);
});
