import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {githubLoaderUrl,buyerLoadstring} from '../github-loader.js';
const skus=['control-center','str-grinder','end-grinder','dex-desktop','dex-mobile','fps-optimizer'];
const personalKey='ZBL_'+ 'a1'.repeat(28);
test('all six GitHub loaders are present and contain no complete paid script',()=>{
 for(const sku of skus){
  const file=readFileSync(new URL('../loaders/'+sku+'.lua',import.meta.url),'utf8');
  assert.ok(file.length<4000,sku+' should be a thin bootstrap');
  assert.match(file,/ZebraLicense/);
  assert.match(file,/game:HttpGet/);
  assert.match(file,/loadstring/);
  assert.match(file,/_e\.ZebraLicense=nil/);
  assert.ok(!file.includes(personalKey));
  const encoded=file.match(/local _a=\{([0-9,]+)\}/);
  const shiftMatch=file.match(/_a\[_i\]-(\d+)-_i/);
  assert.ok(encoded&&shiftMatch,'reversible URL encoder missing: '+sku);
  const shift=Number(shiftMatch[1]);
  const numbers=encoded[1].split(',').map(Number);
  const endpoint=String.fromCharCode(...numbers.map((value,i)=>((value-shift-(i+1))%256+256)%256));
  assert.equal(endpoint,'https://zebra-bl-marketplace.onrender.com/api/loader/'+sku+'?key=');
 }
});
test('buyer commands fetch GitHub raw loaders and carry a personal license privately',()=>{
 for(const sku of skus){
  const url=githubLoaderUrl(sku);
  assert.equal(url,'https://raw.githubusercontent.com/MadeByZebra/zebra-bl-marketplace/main/loaders/'+sku+'.lua?v=device-approval-f9-20261123-v2');
  const command=buyerLoadstring(sku,personalKey);
  assert.match(command,/local fn,reason=loadstring\(src\)/);
  assert.ok(command.includes(url));
  assert.ok(command.includes(personalKey));
  assert.ok(!url.includes(personalKey));
 }
});
test('unsupported products and malformed license keys cannot generate GitHub commands',()=>{
 assert.throws(()=>githubLoaderUrl('zflag-injector'),/no public bootstrap/);
 assert.throws(()=>githubLoaderUrl('../server.js'),/no public bootstrap/);
 assert.throws(()=>buyerLoadstring('dex-desktop','fake'),/Invalid private license/);
 assert.throws(()=>buyerLoadstring('anywhere',personalKey),/no public bootstrap/);
});
