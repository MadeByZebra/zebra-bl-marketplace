import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requiresSameOrigin,loaderRateLimitKey} from '../loader-security.mjs';
const license='ZBL_'+'a'.repeat(56);
const otherLicense='ZBL_'+'b'.repeat(56);
test('game-client read-only loader requests do not fail browser-origin validation',()=>{
 for(const method of ['GET','HEAD','OPTIONS','get'])assert.equal(requiresSameOrigin(method),false);
});
test('checkout and license mutations keep browser-origin protection',()=>{
 for(const method of ['POST','PUT','PATCH','DELETE',undefined])assert.equal(requiresSameOrigin(method),true);
});
test('all uses of one personal license share a rate-limit bucket regardless of IP',()=>{
 assert.equal(loaderRateLimitKey(license,'192.0.2.1'),loaderRateLimitKey(license,'2001:db8::1'));
 assert.notEqual(loaderRateLimitKey(license,'192.0.2.1'),loaderRateLimitKey(otherLicense,'192.0.2.1'));
 assert.ok(!loaderRateLimitKey(license,'192.0.2.1').includes(license));
});
test('invalid or missing license falls back to per-IP limits',()=>{
 assert.equal(loaderRateLimitKey('bad','192.0.2.1'),loaderRateLimitKey(undefined,'192.0.2.1'));
 assert.notEqual(loaderRateLimitKey('bad','192.0.2.1'),loaderRateLimitKey('bad','192.0.2.2'));
 assert.equal(loaderRateLimitKey({key:license},'192.0.2.1'),loaderRateLimitKey(undefined,'192.0.2.1'));
});
test('server wires both safety checks into the correct routes',()=>{
 const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(server,/import \{requiresSameOrigin,loaderRateLimitKey\} from '\.\/loader-security\.mjs'/);
 assert.match(server,/if\(!requiresSameOrigin\(req\.method\)\)return next\(\)/);
 assert.match(server,/keyGenerator:req=>loaderRateLimitKey\(req\.query\?\.key,req\.ip\)/);
 assert.match(server,/app\.get\('\/api\/loader\/:sku',loaderLimiter/);
});
