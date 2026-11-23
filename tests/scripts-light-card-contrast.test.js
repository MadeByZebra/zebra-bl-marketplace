import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/brand.css',import.meta.url),'utf8');
const blackCss=readFileSync(new URL('../public/zebra-true-black-v8.css',import.meta.url),'utf8');
const shop=readFileSync(new URL('../public/scripts/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

function luminance(hex){
 const c=hex.slice(1).match(/.{2}/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
function contrast(a,b){
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

test('black surfaces have at least 4.5:1 contrast even when website theme is light',()=>{
 for(const [foreground,bg] of [
  ['#f7f7f7','#080808'], // product title / modal title
  ['#c2c2c2','#080808'], // descriptions, features, labels
  ['#a9a9a9','#080808'], // muted price caption and metadata
  ['#101010','#f2f2ef'], // white purchase action
  ['#b9b9b9','#1b1b1b'], // coupon placeholder
  ['#181818','#f8f8f6']  // featured pale UI preview
 ])assert.ok(contrast(foreground,bg)>=4.5,foreground+' on '+bg+' contrast only '+contrast(foreground,bg).toFixed(2)+':1');
});

test('theme palette is local to dark copy column, not the featured pale artwork',()=>{
 assert.match(blackCss,/\.zebra-v8 \.card,\.zebra-v8 \.product-card,\.zebra-v8 \.bundle-card\{background:#080808!important/);
 assert.match(css,/html\[data-theme="light"\] body\.scripts-page \.product-card \.product-copy/);
 assert.match(css,/html\[data-theme="light"\] body\.scripts-page \.bundle-card/);
 assert.match(css,/html\[data-theme="light"\] body\.scripts-page \.promo-notice/);
 assert.match(css,/html\[data-theme="light"\] body\.scripts-page \.dialog/);
 assert.match(css,/--text:#f7f7f7/);
 assert.match(css,/--muted:#c2c2c2/);
 assert.match(css,/html\[data-theme="light"\] body\.scripts-page \.product-card \.featured-art/);
 assert.match(css,/--text:#181818/);
 assert.match(app,/class="product-copy"/);
 assert.match(app,/class="featured-art"/);
});

test('dark product popup and purchase buttons keep legible light-mode labels',()=>{
 for(const target of [
  '.product-dialog .dialog-product-title',
  '.product-dialog .dialog-buy strong',
  '.product-dialog .feature-row',
  '.product-dialog input::placeholder',
  '.product-dialog .discount-feedback',
  '.product-dialog .detail-video',
  '.product-dialog>.dialog-x',
  '.product-card .product-badge',
  '.product-card .product-actions',
  '.bundle-card .bundle-action'
 ])assert.ok(css.includes(target)||(target.startsWith('.product-dialog .')&&css.includes('.product-dialog :is(')&&css.includes(target.replace('.product-dialog ',''))),'Missing accessible contrast override for '+target);
 assert.match(css,/color:#f7f7f7!important/);
 assert.match(css,/color:#c2c2c2!important/);
 assert.match(css,/background:#f2f2ef!important/);
 assert.match(shop,/\/brand\.css\?v=20261123-dark-card-contrast4/);
});

test('contrast correction does not change checkout and retains theme separation',()=>{
 assert.match(shop,/src="\/app\.js\?v=20261123-theme-bridge"/);
 assert.match(app,/localStorage\.setItem\('zebra-shop-theme',requestedTheme\)/);
 assert.doesNotMatch(css,/\.product-card\{background:#ffffff/);
});
