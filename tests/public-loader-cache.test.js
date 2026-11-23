import test from 'node:test';
import assert from 'node:assert/strict';
import {githubLoaderUrl,buyerLoadstring} from '../github-loader.js';
test('new personal commands fetch the latest device-aware public bootstrap without caching',()=>{
 const key='ZBL_'+'a'.repeat(56);
 for(const sku of ['fps-optimizer','control-center','str-grinder','end-grinder','dex-desktop','dex-mobile']){
  const url=githubLoaderUrl(sku);
  assert.match(url,/\.lua\?v=device-approval-20261123-v1$/);
  assert.ok(url.startsWith('https://raw.githubusercontent.com/MadeByZebra/zebra-bl-marketplace/main/loaders/'));
  const loader=buyerLoadstring(sku,key);
  assert.match(loader,/game:HttpGet\(/);
  assert.match(loader,/,true\)\)\(\)$/);
  assert.ok(loader.includes(url));
 }
 assert.throws(()=>githubLoaderUrl('not-a-product'));
 assert.throws(()=>buyerLoadstring('fps-optimizer','BAD'));
});
