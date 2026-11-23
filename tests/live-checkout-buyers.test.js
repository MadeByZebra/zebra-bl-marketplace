import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {liveBuyerAllowed} from '../live-checkout-buyers.js';

test('unapproved live buyers are denied by default even after ALLOW_LIVE_SALES is set',()=>{
 const env={ALLOW_LIVE_SALES:'1',LIVE_VERIFIED_SKUS:'fps-optimizer'};
 assert.equal(liveBuyerAllowed('anyone@example.com',env),false);
 assert.equal(liveBuyerAllowed('',env),false);
});
test('seller-only pilot only allows exact normalized email, without exposing other accounts',()=>{
 const env={LIVE_BUYER_TEST_ONLY:'1',LIVE_TEST_BUYER_EMAILS:' Owner@Example.com,other@example.net '};
 assert.equal(liveBuyerAllowed('owner@example.com',env),true);
 assert.equal(liveBuyerAllowed('OTHER@example.net',env),true);
 assert.equal(liveBuyerAllowed('fakeowner@example.com',env),false);
 assert.equal(liveBuyerAllowed('owner@example.com.evil.test',env),false);
 assert.equal(liveBuyerAllowed(null,env),false);
 assert.equal(liveBuyerAllowed(undefined,{LIVE_BUYER_TEST_ONLY:'1'}),false);
});
test('pilot overrides public approval until pilot flag is turned off deliberately',()=>{
 const env={LIVE_BUYER_TEST_ONLY:'1',LIVE_PUBLIC_SALES_APPROVED:'1',LIVE_TEST_BUYER_EMAILS:'owner@example.com'};
 assert.equal(liveBuyerAllowed('other@example.com',env),false);
 assert.equal(liveBuyerAllowed('owner@example.com',env),true);
 assert.equal(liveBuyerAllowed('anyone@example.com',{LIVE_BUYER_TEST_ONLY:'0',LIVE_PUBLIC_SALES_APPROVED:'1'}),true);
 assert.equal(liveBuyerAllowed('anyone@example.com',{LIVE_BUYER_TEST_ONLY:'0',LIVE_PUBLIC_SALES_APPROVED:'yes'}),false);
});
test('server applies buyer allowlist to both public catalog and the payment endpoint',()=>{
 const s=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(s,/liveBuyerAllowed\(user\?\.email,process\.env\)/);
 assert.match(s,/!liveBuyerPermitted\(user\)/);
 assert.match(s,/!liveBuyerPermitted\(req\.user\)/);
 assert.match(s,/state\.catalog\.products=state\.catalog\.products\.map\(p=>\(\{\.\.\.p,unavailable:true\}\)\)/);
});
