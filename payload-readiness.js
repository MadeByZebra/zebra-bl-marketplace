// Integrity gate for private encrypted products.
// Match plaintext SHA-256 against the seller's recorded build manifest.
// This verifies delivered bytes, not whether a Roblox client executes the Lua.
import fs from 'node:fs';
import path from 'node:path';
import {products} from './catalog.js';
import {contentSha,hasSealed,readSealed} from './vault.js';

export function inspectPrivatePayloads(directory,{
  manifestPath=path.resolve('sealed-payloads/MANIFEST.json'),
  available=hasSealed,
  decrypt=readSealed
}={}){
  let manifest={};
  try{manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));}
  catch(_e){return {ready:false,products:{},checked:0,reason:'manifest_unavailable'};}
  const statuses={};
  for(const item of products.filter(p=>!p.unavailable&&p.file)){
    const file=item.file,record=manifest[file];
    let status='not_found';
    if(record&&typeof record.sha256==='string'&&/^[a-f0-9]{64}$/.test(record.sha256)
       &&Number.isSafeInteger(record.bytes)&&record.bytes>100){
      if(available(directory,file)){
        try{
          const plaintext=decrypt(directory,file);
          status=Buffer.isBuffer(plaintext)&&plaintext.length===record.bytes
            &&contentSha(plaintext)===record.sha256?'verified':'hash_mismatch';
        }catch(_e){status='decryption_failed';}
      }
    }else status='manifest_invalid';
    statuses[item.id]=status;
  }
  const checked=Object.keys(statuses).length;
  return {ready:checked===6&&Object.values(statuses).every(s=>s==='verified'),
    products:statuses,checked,reason:null};
}
export function productPayloadReady(statuses,item,includedIds){
 if(!item||!item.id)return false;
 return includedIds(item).every(id=>statuses?.[id]==='verified');
}

export function readVerifiedScript(directory,file,manifestPath=path.resolve('sealed-payloads/MANIFEST.json')){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const record=manifest[file];
  if(!record||typeof record.sha256!=='string'||!/^[a-f0-9]{64}$/.test(record.sha256)
    ||!Number.isSafeInteger(record.bytes)||record.bytes<=100)
    throw new Error('Protected script manifest is missing or invalid.');
  const plain=readSealed(directory,file);
  if(plain.length!==record.bytes||contentSha(plain)!==record.sha256)
    throw new Error('Protected script failed integrity verification.');
  return plain;
}
