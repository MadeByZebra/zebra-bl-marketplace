import fs from 'node:fs';
import path from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const MAGIC='ZEBRA-SEALED-V1';
export const keyBuffer=(raw)=>{
 if(!raw)throw Error('ZEBRA_PAYLOAD_KEY is required for protected products');
 if(!/^[0-9a-fA-F]{64}$/.test(raw))throw Error('ZEBRA_PAYLOAD_KEY must be exactly 64 hex characters');
 return Buffer.from(raw,'hex');
};
export const seal=(plaintext,key)=>{
 const nonce=randomBytes(12);
 const aes=createCipheriv('aes-256-gcm',keyBuffer(key),nonce);
 aes.setAAD(Buffer.from(MAGIC));
 const content=Buffer.concat([aes.update(gzipSync(plaintext)),aes.final()]);
 return Buffer.from(JSON.stringify({type:MAGIC,iv:nonce.toString('base64'),tag:aes.getAuthTag().toString('base64'),data:content.toString('base64')}),'utf8');
};
export const unseal=(sealed,key)=>{
 const doc=JSON.parse(sealed.toString('utf8'));
 if(doc.type!==MAGIC)throw Error('Invalid protected payload format');
 const aes=createDecipheriv('aes-256-gcm',keyBuffer(key),Buffer.from(doc.iv,'base64'));
 aes.setAAD(Buffer.from(MAGIC));
 aes.setAuthTag(Buffer.from(doc.tag,'base64'));
 const gz=Buffer.concat([aes.update(Buffer.from(doc.data,'base64')),aes.final()]);
 return gunzipSync(gz,{maxOutputLength:12*1024*1024});
};
const safeName=name=>{if(!/^[a-z0-9-]+\.(?:lua|exe)$/.test(name))throw Error('Invalid asset name');return name+'.sealed';};
export function hasSealed(dir,name){return fs.existsSync(path.join(dir,safeName(name)));}
export function readSealed(dir,name){return unseal(fs.readFileSync(path.join(dir,safeName(name))),process.env.ZEBRA_PAYLOAD_KEY);}
export function contentSha(content){return createHash('sha256').update(content).digest('hex');}
