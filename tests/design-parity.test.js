import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = relative => fs.readFileSync(new URL('../'+relative, import.meta.url),'utf8');
const home=read('public/index.html');
const scripts=read('public/scripts/index.html');
const zflag=read('public/zflag/index.html');
const account=read('public/account/index.html');
const css=read('public/zebra-true-black-v8.css');
const studio=read('public/shop-studio-v8.js');
test('every shop page loads same true-black design system',()=>{
 for(const [name,html] of Object.entries({home,scripts,zflag,account})){
  assert.match(html,/class="zebra-v8/);
  assert.match(html,/zebra-true-black-v8\.css/);
  assert.match(html,/class="brand-logo" src="\/assets\/bl-scripts-logo\.svg\?v=1"/);
 }
});
test('premium layout retains centered hero, full-width studio and content depth',()=>{
 assert.match(home,/class="studio-stage reveal"/);
 assert.match(home,/class="window studio-window"/);
 assert.match(home,/class="quality-strip reveal"/);
 assert.match(home,/class="editorial-grid reveal"/);
 assert.match(scripts,/class="product-stage reveal"/);
 assert.match(scripts,/class="studio-toolbar"/);
 assert.match(scripts,/class="editorial-grid reveal"/);
});
test('studio navigation is interactive, not inert decorative tabs',()=>{
 assert.match(home,/data-studio-tab="overview"/);
 assert.match(home,/data-studio-panel="library"/);
 assert.match(studio,/addEventListener\('click'/);
 assert.match(scripts,/data-preview-tab="modules"/);
 assert.match(scripts,/data-preview-tab="settings"/);
});
test('actual True Black V6 parity, not a generic charcoal split layout',()=>{
 assert.match(css,/--bg:#000!important/);
 assert.match(css,/font-size:clamp\(74px,9\.4vw,148px\)/);
 assert.match(css,/flex-direction:column!important/);
 assert.match(css,/max-width:1190px!important/);
 assert.match(css,/--glass:rgba\(0,0,0,\.94\)/);
});
test('scripts retain required interactive storefront elements',()=>{
 for(const id of ['productGrid','bundleGrid','accountBtn','authDialog','libraryDialog','searchInput','testCheckoutBtn','productDialog']){
  assert.ok(scripts.includes('id="'+id+'"'),id+' missing');
 }
});
test('one account domain, ZFLAG cross links and no exposed source at top level',()=>{
 assert.match(home,/href="\/account\/"/);
 assert.match(zflag,/href="\/scripts\/\?product=zflag-injector"/);
 assert.match(account,/src="\/account\/account\.js/);
 assert.doesNotMatch(home,/ZEBRA_PAYLOAD_KEY|STRIPE_SECRET_KEY|sk_(?:live|test)_/);
});
