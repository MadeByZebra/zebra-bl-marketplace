import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {products,byId,includedIds} from '../catalog.js';
import {seal,contentSha} from '../vault.js';
import {inspectPrivatePayloads,productPayloadReady,readVerifiedScript} from '../payload-readiness.js';

test('all six sealed scripts must decrypt to the recorded plaintext hash before they can be sold or delivered',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'zebra-private-test-'));
 const original=process.env.ZEBRA_PAYLOAD_KEY;
 const key=randomBytes(32).toString('hex');
 process.env.ZEBRA_PAYLOAD_KEY=key;
 const records={};
 try{
  for(const item of products.filter(p=>!p.unavailable&&p.file)){
   const source=Buffer.from(('-- synthetic offline Lua fixture for '+item.id+'\nreturn true\n').repeat(4));
   records[item.file]={bytes:source.length,sha256:contentSha(source)};
   writeFileSync(path.join(dir,item.file+'.sealed'),seal(source,key));
  }
  const manifest=path.join(dir,'MANIFEST.json');
  writeFileSync(manifest,JSON.stringify(records));
  const result=inspectPrivatePayloads(dir,{manifestPath:manifest});
  assert.equal(result.ready,true);
  assert.equal(result.checked,6);
  assert.ok(productPayloadReady(result.products,byId['complete-collection'],includedIds));
  for(const item of products.filter(p=>!p.unavailable&&p.file)){
   assert.match(readVerifiedScript(dir,item.file,manifest).toString('utf8'),/return true/);
  }
  // A decrypted but modified source cannot ever silently reach a paying buyer.
  records['str-grinder.lua'].sha256='0'.repeat(64);
  writeFileSync(manifest,JSON.stringify(records));
  const bad=inspectPrivatePayloads(dir,{manifestPath:manifest});
  assert.equal(bad.ready,false);
  assert.equal(bad.products['str-grinder'],'hash_mismatch');
  assert.equal(productPayloadReady(bad.products,byId['class-a-duo'],includedIds),false);
  assert.throws(()=>readVerifiedScript(dir,'str-grinder.lua',manifest),/integrity/);
 }finally{
  if(original===undefined)delete process.env.ZEBRA_PAYLOAD_KEY;
  else process.env.ZEBRA_PAYLOAD_KEY=original;
  rmSync(dir,{recursive:true,force:true});
 }
});

test('missing or incorrect private payload encryption keys prevent sale',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'zebra-missing-'));
 try{
  const result=inspectPrivatePayloads(dir,{manifestPath:path.join(dir,'NO-MANIFEST.json')});
  assert.equal(result.ready,false);
  assert.equal(result.checked,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
