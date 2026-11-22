import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifiedLiveSkuIds,verifiedLiveProduct,liveReleaseReadiness} from '../live-sales-release-gates.js';

const str={id:'str-grinder'};
const end={id:'end-grinder'};
const bundle={id:'class-a-duo',items:['str-grinder','end-grinder']};
const zflag={id:'zflag-injector'};

test('live sales fail closed without durable production database confirmation',()=>{
 assert.equal(liveReleaseReadiness().ready,false);
 assert.ok(liveReleaseReadiness().reasons.includes('persistent_database_unconfirmed'));
 assert.equal(liveReleaseReadiness({LIVE_VERIFIED_SKUS:'str-grinder'}).ready,false);
 assert.equal(liveReleaseReadiness({LIVE_DATABASE_CONFIRMED:'1'}).ready,false);
 assert.equal(liveReleaseReadiness({LIVE_DATABASE_CONFIRMED:'1',LIVE_VERIFIED_SKUS:'str-grinder'}).ready,true);
 assert.equal(liveReleaseReadiness({LIVE_DATABASE_CONFIRMED:'true',LIVE_VERIFIED_SKUS:'str-grinder'}).ready,false);
});
test('a product may only be offered in live mode after explicit runtime verification',()=>{
 assert.equal(verifiedLiveProduct(str,{}),false);
 assert.equal(verifiedLiveProduct(str,{LIVE_VERIFIED_SKUS:'str-grinder'}),true);
 assert.equal(verifiedLiveProduct(end,{LIVE_VERIFIED_SKUS:'str-grinder'}),false);
 assert.equal(verifiedLiveProduct(str,{LIVE_VERIFIED_SKUS:'class-a-duo'}),false);
 assert.equal(verifiedLiveProduct({...str,unavailable:true},{LIVE_VERIFIED_SKUS:'str-grinder'}),false);
});
test('bundle delivery requires all its components to be individually reviewed',()=>{
 assert.equal(verifiedLiveProduct(bundle,{LIVE_VERIFIED_SKUS:'str-grinder'}),false);
 assert.equal(verifiedLiveProduct(bundle,{LIVE_VERIFIED_SKUS:'str-grinder,end-grinder'}),true);
 assert.equal(verifiedLiveProduct(bundle,{LIVE_VERIFIED_SKUS:'str-grinder, end-grinder'}),true);
});
test('reject unknown and third-party SKUs from an operator approval list',()=>{
 assert.deepEqual([...verifiedLiveSkuIds({LIVE_VERIFIED_SKUS:'external-loader,zflag-injector,random'})],[]);
 assert.equal(verifiedLiveProduct({id:'class-s-joiner'},{LIVE_VERIFIED_SKUS:'class-s-joiner'}),false);
 assert.equal(verifiedLiveProduct({id:'checkout-test'},{LIVE_VERIFIED_SKUS:'checkout-test'}),false);
});
test('ZFLAG is separately gated by an explicit reviewed Windows runtime test',()=>{
 assert.equal(verifiedLiveProduct(zflag,{}),false);
 assert.equal(verifiedLiveProduct(zflag,{LIVE_ZFLAG_VERIFIED:'yes'}),false);
 assert.equal(verifiedLiveProduct(zflag,{LIVE_ZFLAG_VERIFIED:'1'}),true);
 assert.equal(liveReleaseReadiness({LIVE_ZFLAG_VERIFIED:'1',LIVE_DATABASE_CONFIRMED:'1'}).ready,true);
 // server also requires a separately checksum-approved sealed installer.
});
test('server enforces these gates in checkout readiness and per-product catalog',()=>{
 const s=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(s,/liveMerchant\.ready&&liveReleaseReadiness\(process\.env\)\.ready/);
 assert.match(s,/!testMode\(\)&&!verifiedLiveProduct\(item,process\.env,includedIds\)/);
 assert.match(s,/if\(!checkoutReady\(\)\)return res\.status\(503\)/);
 assert.match(s,/if\(!item\|\|!Number\.isInteger\(item\.price\)\|\|item\.price<50\|\|!itemReadyForSale\(item\)\)/);
 assert.match(s,/if\(item\.id==='zflag-injector'\)return zflagInstallerReady&&checkoutReady\(\)/);
});
