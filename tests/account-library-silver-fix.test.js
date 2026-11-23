import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('public/account/index.html');
const js=read('public/account/account.js');
const css=read('public/commerce.css');
const checkout=read('public/checkout/index.html');
const order=read('public/order/index.html');
const server=read('server.js');

test('account support is outside two-column commerce grid, not a third grid item',()=>{
 const end=html.indexOf('</main>');
 const support=html.indexOf('class="zebra-inline-support-cta"');
 const footer=html.indexOf('<footer class="footer">');
 assert.ok(end>0&&support>end&&footer>support);
 assert.match(html,/class="commerce-account-support wrap"/);
 assert.match(html,/href="\/support\/#contact"/);
 assert.match(html,/class="zebra-footer-email-link"/);
 assert.doesNotMatch(html,/class="commerce-steps"/);
 assert.match(html,/class="commerce-account-nav"/);
});
test('checkout, order, and account match black white silver without purple marketing accents',()=>{
 for(const file of [html,checkout,order])assert.match(file,/commerce\.css\?v=20261122-silver2/);
 for(const file of [html,css,checkout,order]){
  assert.doesNotMatch(file,/#(?:b8a3fc|c8afff|bf9fff|c7b9f8|d7c8ff|bfaeff|c0b1e2|bcabef|c9b8ec|c4b0f3|bba9ec)/i);
  assert.doesNotMatch(file,/rgba\(145,110,240/i);
 }
 assert.match(css,/--commerce-accent:var\(--text/);
 assert.match(css,/\.commerce-account-support/);
 assert.match(css,/@media\(max-width:620px\)/);
});
test('library shows owned products, paid orders and per-product licensed output',()=>{
 assert.match(js,/new Set\(\(owned\|\|\[\]\)\)/);
 assert.match(js,/header\('Your products',licensedItems\.length\)/);
 assert.match(js,/header\('Order history',orders\.length\)/);
 assert.match(js,/commerce-loader-card/);
 assert.match(js,/row\.insertBefore\(controls,output\)/);
 assert.match(js,/data\.loadstring/);
 assert.match(js,/navigator\.clipboard\.writeText\(area\.value\)/);
 assert.match(js,/Download \.txt/);
 assert.match(js,/window\.confirm\(/);
 assert.match(js,/this REVOKES the previous command even if it works/);
 assert.match(js,/\/api\/receipt\//);
 assert.match(js,/\/order\/\?session_id=/);
 assert.doesNotMatch(js,/localStorage|sessionStorage/);
 assert.doesNotMatch(js,/innerHTML/);
});
test('account state and credentials are not shown after signout',()=>{
 assert.match(js,/\$\('libraryItems'\)\.replaceChildren\(\)/);
 assert.match(js,/\$\('loaderResult'\)\.replaceChildren\(\)/);
 assert.match(js,/\$\('loginArea'\)\.hidden=true/);
 assert.match(js,/\$\('signedIn'\)\.hidden=false/);
 assert.match(js,/cache:'no-store'/);
 assert.match(html,/aria-live="polite"/);
});
test('the account, checkout and order HTML pages bypass stale caches',()=>{
 assert.match(server,/\['account','order','checkout'\]\.some/);
 assert.match(server,/filePath\.endsWith\(path\.join\('public',dir,'index\.html'\)\)/);
 assert.match(server,/'no-store, max-age=0'/);
 assert.match(html,/account\.js\?v=20261123-all6/);
});
