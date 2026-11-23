// Short-lived, one-use runtime gate for delivered Lua code.
// Deterrence against casual redistribution, not tamper-proof DRM.
import {createHash,randomBytes} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const AGE_MS=2*60*1000;
const goodToken=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const goodId=s=>typeof s==='string'&&/^[a-f0-9-]{20,64}$/i.test(s);
const goodSku=s=>typeof s==='string'&&/^[a-z0-9-]{3,50}$/.test(s);
export async function issueExecutionTicket({query,licenseId,sku,at}){
 if(typeof query!=='function'||!goodId(licenseId)||!goodSku(sku)||
   !Number.isSafeInteger(at)||at<=0)throw Error('Invalid execution ticket request');
 const token=randomBytes(32).toString('hex');
 await query('DELETE FROM license_execution_tickets WHERE expires_at<$1',[at]);
 await query(`INSERT INTO license_execution_tickets
  (token_hash,license_id,sku,created_at,expires_at)
  VALUES($1,$2,$3,$4,$5)`,[sha(token),licenseId,sku,at,at+AGE_MS]);
 return token;
}
export async function redeemExecutionTicket({query,token,sku,at}){
 if(typeof query!=='function'||!goodToken(token)||!goodSku(sku)||
   !Number.isSafeInteger(at)||at<=0)return null;
 const tokenHash=sha(token);
 const matches=await query(`SELECT license_id FROM license_execution_tickets
  WHERE token_hash=$1 AND sku=$2 AND consumed_at IS NULL AND expires_at>$3`,
  [tokenHash,sku,at]);
 const id=matches[0]?.license_id;
 if(!goodId(id))return null;
 // Atomic compare-and-set ensures only one invocation can succeed.
 const consumed=await query(`UPDATE license_execution_tickets SET consumed_at=$1
  WHERE token_hash=$2 AND sku=$3
  AND consumed_at IS NULL AND expires_at>$1 RETURNING license_id`,
  [at,tokenHash,sku]);
 return consumed[0]?.license_id===id?id:null;
}
export function wrapLuaWithTicket(source,url,licenseId,sku){
 if(!Buffer.isBuffer(source)||!source.length||source.length>12*1024*1024||
   typeof url!=='string'||!/^https:\/\//.test(url)||!goodId(licenseId)||!goodSku(sku))
   throw Error('Invalid Lua delivery wrapper');
 const fingerprint=sha('Zebra-buyer-watermark-v1|'+licenseId+'|'+sku).slice(0,24);
 const header=`-- BL Scripts by Zebra | per-license delivery id ${fingerprint}\n`+
  `local _zok,_zresp=pcall(function() return game:HttpGet(${JSON.stringify(url)},true) end)\n`+
  `if not _zok or _zresp~="ZBL_OK" then error("Zebra: runtime license validation failed. Open My Library.",0) end\n`;
 return Buffer.concat([Buffer.from(header,'utf8'),source]);
}
