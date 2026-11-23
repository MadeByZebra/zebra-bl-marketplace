import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all storefront entry paths accept cross-origin ZFLAG theme and persist it',()=>{
 const shared=read('public/shop.js');
 const catalog=read('public/app.js');
 for(const js of [shared,catalog]){
  assert.match(js,/new URLSearchParams\(location\.search\)\.get\('theme'\)/);
  assert.match(js,/requestedTheme==='light'\|\|requestedTheme==='dark'/);
  assert.match(js,/localStorage\.setItem\('zebra-shop-theme',requestedTheme\)/);
  assert.match(js,/localStorage\.setItem\('bl-theme',requestedTheme\)/);
 }
 assert.match(catalog,/document\.body\.dataset\.theme=selected/);
 assert.match(catalog,/document\.documentElement\.dataset\.theme=selected/);
});

test('page asset versions force browsers to refresh the theme handoff and checkout script',()=>{
 const entries=['index.html','account/index.html','order/index.html','zflag/index.html','checkout/index.html'];
 for(const entry of entries)assert.match(read('public/'+entry),/\/shop\.js\?v=20261123-theme-bridge/);
 const checkout=read('public/checkout/index.html');
 assert.match(checkout,/\/checkout\/checkout\.js\?v=20261123-theme-checkout/);
 assert.match(read('public/scripts/index.html'),/\/app\.js\?v=20261123-theme-bridge/);
});

test('new Stripe Sessions retain a diagnostic copy of the whitelisted appearance',()=>{
 const server=read('server.js');
 assert.match(server,/const checkoutTheme=req\.body\?\.theme==='light'\?'light':'dark'/);
 assert.match(server,/checkout_theme:checkoutTheme/);
 assert.match(server,/branding_settings:checkoutBrandingForTheme\(checkoutTheme\)/);
 assert.match(server,/session\.branding_settings\?\.background_color/);
 assert.match(server,/console\.warn\('Stripe Checkout did not return the requested '/);
 assert.doesNotMatch(server,/console\.warn\('Stripe Checkout did not return the requested '[^\n]*session\.url/);
});
