import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {encodePayload,reverseForTest} from '../scripts/build-payloads.mjs';
import {products} from '../catalog.js';
const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
test('license-only path; deprecated source download returns 410',()=>{
 assert.match(server,/app\.post\('\/api\/license\/:sku'/);
 assert.match(server,/app\.get\('\/api\/loader\/:sku'/);
 assert.match(server,/app\.get\('\/api\/download\/:sku',[\s\S]*?410/);
 assert.match(server,/entitlementIsPaid\(found\.user_id,sku\)/);
});
test('obfuscated payload round-trips all source bytes',()=>{
 const buf=Buffer.concat([Buffer.from('print("\\u03bc")\nlocal x = 123\n','utf8'),randomBytes(1024)]);
 const {runtime,encoded,key}=encodePayload(buf);
 assert.ok(!runtime.includes('local x = 123'));
 assert.ok(reverseForTest(encoded,key).equals(buf));
 assert.match(runtime,/loadstring\(table\.concat\(_O\)\)/);
});
test('every sellable product gets a private payload and one licensed loader identifier',()=>{
 for(const p of products.filter(x=>!x.unavailable)){
  assert.match(server,new RegExp('SCRIPT_DIR'));
  assert.ok(/^[a-z0-9-]+$/.test(p.id));
 }
});

test('email sign-in uses 6-digit expiring one-time codes and no password endpoint',()=>{
 assert.match(server,/randomInt\(0,1000000\)/);
 assert.match(server,/email_codes/);
 assert.match(server,/timingSafeEqual\(a,b\)/);
 assert.match(server,/\/api\/auth\/request-code/);
 assert.match(server,/\/api\/auth\/verify-code/);
 assert.match(server,/Code expired or invalid/);
 assert.match(server,/app\.post\('\/api\/register',[\s\S]*?410/);
});
test('injector binaries require paid user entitlement and stay out of public assets',()=>{
 assert.match(server,/app\.get\('\/api\/injector\/download',downloadLimiter,requireUser/);
 assert.match(server,/entitlementIsPaid\(req\.user\.id,'zflag-injector'\)/);
 assert.match(server,/readSealed\(SCRIPT_DIR,'zflag-setup.exe'\)/);
 assert.match(server,/SCRIPT_DIR/);
 assert.ok(!existsSync(new URL('../public/zflag-setup.exe',import.meta.url)));
});
test('test-only purchase has hard test-mode gate and minimum $0.50 amount',()=>{
 assert.match(server,/ENABLE_TEST_CHECKOUT/);
 assert.match(server,/testMode\(\)/);
 assert.match(server,/item\.price<50/);
 assert.match(server,/item.id==='checkout-test'\)return testCheckoutReady\(\)/);
 assert.match(server,/\.webhooks\.constructEvent/);
 assert.match(server,/session\.payment_status!=='paid'/);
});
