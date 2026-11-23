// Anonymous installation enrollment. Buyers approve one local installation
// through a signed-in marketplace session, independent of Roblox usernames.
// The executor-generated local secret can be copied or spoofed: this prevents
// casual sharing, not determined code extraction or hardware spoofing.
import {createHash} from 'node:crypto';

export const validDeviceSecret=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export const validPairingCode=s=>typeof s==='string'&&/^[A-F0-9]{10}$/.test(s);
const sha=s=>createHash('sha256').update(s).digest('hex');
export function installationHash(licenseId,secret){
 if(typeof licenseId!=='string'||!/^[a-f0-9-]{20,64}$/i.test(licenseId)||!validDeviceSecret(secret))return null;
 return sha('Zebra-installation-v1|'+licenseId+'|'+secret);
}
export function deviceCode(secret){
 return validDeviceSecret(secret)?secret.slice(0,10).toUpperCase():null;
}
const pairingHash=(licenseId,code)=>sha('Zebra-install-pair-v1|'+licenseId+'|'+code);
const PAIR_MS=10*60*1000;
const MAX_PAIRINGS=3;

export async function requestDeviceApproval({query,licenseId,deviceSecret,at}){
 const hash=installationHash(licenseId,deviceSecret);
 if(!hash||typeof query!=='function'||!Number.isSafeInteger(at)||at<=0)
  return {status:'invalid'};
 const existing=(await query('SELECT device_hash FROM license_device_bindings WHERE license_id=$1',[licenseId]))[0];
 if(existing){
  if(existing.device_hash!==hash){
   await query('UPDATE license_device_bindings SET blocked_attempts=blocked_attempts+1 WHERE license_id=$1',[licenseId]);
   return {status:'different_device'};
  }
  await query('UPDATE license_device_bindings SET last_used_at=$1 WHERE license_id=$2',[at,licenseId]);
  return {status:'approved',deviceHash:hash};
 }
 await query('DELETE FROM license_device_pairings WHERE expires_at<$1',[at]);
 const existingPending=(await query('SELECT device_hash FROM license_device_pairings WHERE license_id=$1 AND device_hash=$2',[licenseId,hash]))[0];
 if(!existingPending){
  const total=(await query('SELECT COUNT(*) AS n FROM license_device_pairings WHERE license_id=$1',[licenseId]))[0];
  if(Number(total?.n)>=MAX_PAIRINGS)return {status:'too_many_requests'};
 }
 const code=deviceCode(deviceSecret);
 await query(`INSERT INTO license_device_pairings (license_id,device_hash,code_hash,requested_at,expires_at)
  VALUES ($1,$2,$3,$4,$5) ON CONFLICT(license_id,device_hash)
  DO UPDATE SET code_hash=EXCLUDED.code_hash,requested_at=EXCLUDED.requested_at,expires_at=EXCLUDED.expires_at`,
  [licenseId,hash,pairingHash(licenseId,code),at,at+PAIR_MS]);
 return {status:'pending',code};
}
export async function approveInstallation({query,licenseId,code,at}){
 if(!/^[a-f0-9-]{20,64}$/i.test(String(licenseId||''))||
   !validPairingCode(code)||!Number.isSafeInteger(at)||at<=0)
  return {status:'invalid'};
 const matches=await query(`SELECT device_hash FROM license_device_pairings
  WHERE license_id=$1 AND code_hash=$2 AND expires_at>$3`,
  [licenseId,pairingHash(licenseId,code),at]);
 if(matches.length!==1)return {status:'expired_or_invalid'};
 const hash=matches[0].device_hash;
 // The database primary key guarantees at most one approved installation
 // under concurrent approvals. No owner can silently approve a second device.
 await query(`INSERT INTO license_device_bindings
  (license_id,device_hash,approved_at,last_used_at,blocked_attempts)
  VALUES($1,$2,$3,$3,0) ON CONFLICT(license_id) DO NOTHING`,[licenseId,hash,at]);
 const bound=(await query('SELECT device_hash FROM license_device_bindings WHERE license_id=$1',[licenseId]))[0];
 if(bound?.device_hash!==hash)return {status:'already_approved_other_device'};
 await query('DELETE FROM license_device_pairings WHERE license_id=$1',[licenseId]);
 return {status:'approved'};
}
