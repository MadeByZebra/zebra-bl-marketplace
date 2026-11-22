import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requiresSameOrigin,validLicenseKey,licenseRateLimitKey} from '../loader-security.mjs';
const license='ZBL_'+'a'.repeat(56);
const otherLicense='ZBL_'+'b'.repeat(56);
test('read-only game-client loader requests bypass browser-origin checks',()=>{
 for(const method of ['GET','HEAD','OPTIONS','get'])assert.equal(requiresSameOrigin(method),false);
});
test('checkout and license mutations still require same-origin validation',()=>{
 for(const method of ['POST','PUT','PATCH','DELETE',undefined])assert.equal(requiresSameOrigin(method),true);
});
test('one license has a hashed stable request bucket separate from other licenses',()=>{
 assert.equal(validLicenseKey(license),true);
 assert.equal(licenseRateLimitKey(license),licenseRateLimitKey(license));
 assert.notEqual(licenseRateLimitKey(license),licenseRateLimitKey(otherLicense));
 assert.ok(!licenseRateLimitKey(license).includes(license));
});
test('invalid and missing keys have no license bucket (base IP limiter remains active)',()=>{
 for(const x of [undefined,'bad','ZBL_short',{key:license}]){
  assert.equal(validLicenseKey(x),false);
  assert.equal(licenseRateLimitKey(x),null);
 }
});
test('server retains per-IP limits and also adds independent per-license limits',()=>{
 const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(server,/import \{requiresSameOrigin,validLicenseKey,licenseRateLimitKey\} from '\.\/loader-security\.mjs'/);
 assert.match(server,/if\(!requiresSameOrigin\(req\.method\)\)return next\(\)/);
 assert.match(server,/const loaderLimiter=rateLimit\(\{windowMs:60\*1000,limit:50,standardHeaders:'draft-7'/);
 assert.match(server,/const licenseLoaderLimiter=rateLimit\(\{windowMs:60\*1000,limit:50/);
 assert.match(server,/skip:req=>!validLicenseKey\(req\.query\?\.key\)/);
 assert.match(server,/keyGenerator:req=>licenseRateLimitKey\(req\.query\.key\)/);
 assert.match(server,/app\.get\('\/api\/loader\/:sku',loaderLimiter,licenseLoaderLimiter/);
});
