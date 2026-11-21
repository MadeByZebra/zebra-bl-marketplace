import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {products} from '../catalog.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE=path.join(ROOT,'private-scripts');
const TARGET=path.join(ROOT,'protected-payloads');
// Light compatibility-oriented reversible byte concealment, NOT cryptographic protection.
// A determined user can recover Lua once their client receives executable bytes.
export function encodePayload(buffer,key=randomBytes(24)){
 const encoded=Buffer.alloc(buffer.length);
 for(let i=0;i<buffer.length;i++)encoded[i]=buffer[i]^key[i%key.length];
 const b64=encoded.toString('base64');
 const parts=b64.match(/.{1,3700}/g)||[];
 const literal=parts.map(chunk=>JSON.stringify(chunk)).join(',\n ');
 const keyLiteral=[...key].join(',');
 const runtime=`-- ZEBRA LICENSED LUA PAYLOAD — encoded source, not plaintext.\nlocal _D=table.concat({\n ${literal}\n})\nlocal _K={${keyLiteral}}\nlocal _M={}\nlocal _A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"\nfor _i=1,64 do _M[string.byte(_A,_i)]=_i-1 end\nlocal _O={}\nlocal _n=0\nfor _i=1,#_D,4 do\n local _x=_M[string.byte(_D,_i)] or 0\n local _y=_M[string.byte(_D,_i+1)] or 0\n local _z=_M[string.byte(_D,_i+2)] or 0\n local _w=_M[string.byte(_D,_i+3)] or 0\n local _v=_x*262144+_y*4096+_z*64+_w\n local _b1=math.floor(_v/65536)%256\n local _b2=math.floor(_v/256)%256\n local _b3=_v%256\n _n=_n+1\n _O[_n]=string.char(bit32.bxor(_b1,_K[(_n-1)%#_K+1]))\n if string.byte(_D,_i+2)~=61 then\n  _n=_n+1;_O[_n]=string.char(bit32.bxor(_b2,_K[(_n-1)%#_K+1]))\n end\n if string.byte(_D,_i+3)~=61 then\n  _n=_n+1;_O[_n]=string.char(bit32.bxor(_b3,_K[(_n-1)%#_K+1]))\n end\nend\nlocal _f,_e=loadstring(table.concat(_O))\nif not _f then error("Zebra payload incompatible: "..tostring(_e)) end\nreturn _f()\n`;
 return {runtime, encoded: b64, key};
}
export function reverseForTest(encoded,key){const bytes=Buffer.from(encoded,'base64');for(let i=0;i<bytes.length;i++)bytes[i]^=key[i%key.length];return bytes;}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
 fs.mkdirSync(TARGET,{recursive:true});
 for(const p of products.filter(x=>!x.unavailable)){
  const src=path.join(SOURCE,p.file);if(!fs.existsSync(src))throw Error(`Missing private seller source: ${p.file}`);
  const buf=fs.readFileSync(src),obj=encodePayload(buf);
  if(!reverseForTest(obj.encoded,obj.key).equals(buf))throw Error('Payload roundtrip failed');
  fs.writeFileSync(path.join(TARGET,p.file),obj.runtime,{mode:0o600});
  console.log(`Encoded ${p.id}: ${buf.length} bytes → ${Buffer.byteLength(obj.runtime)} bytes`);
 }
 console.log('Private encoded payloads created. NEVER place this folder in public git or a CDN.');
}
