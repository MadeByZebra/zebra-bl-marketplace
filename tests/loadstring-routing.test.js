import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {products} from '../catalog.js';
import {buyerLoadstring,githubLoaderUrl} from '../github-loader.js';

const read=name=>readFileSync(new URL('../loaders/'+name+'.lua',import.meta.url),'utf8');

test('every paid Lua loadstring points to a private authorized server endpoint',()=>{
 const key='ZBL_'+'1'.repeat(56);
 for(const item of products.filter(p=>!p.unavailable)){
  const s=read(item.id);
  const values=s.match(/local _a=\{([^}]+)\}/)?.[1].split(',').map(Number);
  const offset=Number(s.match(/_a\[_i\]-(\d+)-_i/)?.[1]);
  assert.ok(values?.length>25&&Number.isInteger(offset),item.id+' bootstrap URL malformed');
  const target=String.fromCharCode(...values.map((v,i)=>(v-offset-(i+1)+256)%256));
  assert.equal(target,'https://zebra-bl-marketplace.onrender.com/api/loader/'+item.id+'?key=');
  assert.match(s,/_e\.ZebraLicense=nil/);
  assert.match(s,/loadstring\(_src\)/);
  assert.match(s,/game:HttpGet/);
  const cmd=buyerLoadstring(item.id,key);
  assert.match(cmd,/ZebraLicense/);
  assert.ok(cmd.includes(githubLoaderUrl(item.id)));
  assert.ok(!s.includes(key),'No buyer key should be shipped publicly');
  assert.doesNotMatch(s,/class="product"|<html/i);
 }
});

test('unlisted products and invalid keys never produce buyer loadstrings',()=>{
 assert.throws(()=>buyerLoadstring('not-a-real-product','ZBL_'+'2'.repeat(56)));
 assert.throws(()=>buyerLoadstring('str-grinder','ZBL_BAD'));
});
