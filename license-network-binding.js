// Best-effort anti-sharing for Lua source delivered to a game client.
// No Roblox executor or IP address can provide unforgeable device attestation.
// We use a one-network lease per active key, with no raw client IP stored.
import {createHash} from 'node:crypto';
import {isIP} from 'node:net';

export function canonicalNetwork(ip){
 if(typeof ip!=='string'||ip.length>100)return null;
 const value=ip.trim().toLowerCase().split('%')[0];
 const mapped=value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
 if(mapped&&isIP(mapped[1])===4)return 'ipv4:'+mapped[1];
 if(isIP(value)===4)return 'ipv4:'+value;
 if(isIP(value)!==6)return null;
 const pieces=value.split('::');
 const left=pieces[0]?pieces[0].split(':'):[];
 const right=pieces.length===2&&pieces[1]?pieces[1].split(':'):[];
 const zeros=8-left.length-right.length;
 if(pieces.length>2||zeros<0||pieces.length===1&&zeros!==0)return null;
 const full=[...left,...Array(zeros).fill('0'),...right];
 if(full.length!==8)return null;
 // IPv6 privacy addresses can change; use the /64 network, not device bits.
 return 'ipv6:'+full.slice(0,4).map(s=>Number.parseInt(s,16).toString(16).padStart(4,'0')).join(':');
}
export function hashedNetwork(ip,licenseId){
 if(typeof licenseId!=='string'||!/^[0-9a-f-]{20,64}$/i.test(licenseId))return null;
 const network=canonicalNetwork(ip);
 if(!network)return null;
 return createHash('sha256').update('zebra-license-v1|'+licenseId+'|'+network).digest('hex');
}

// First request wins: database PK + ON CONFLICT DO NOTHING serializes claims.
// Different networks cannot receive the same protected payload afterwards.
// The owner can generate a replacement key (within rotation limits).
export async function authorizeNetwork({pool,sqlite,licenseId,networkHash,at}={}){
 if(typeof licenseId!=='string'||!licenseId||
   typeof networkHash!=='string'||!/^[0-9a-f]{64}$/.test(networkHash)||
   !Number.isSafeInteger(at)||at<=0)throw Error('Invalid network authorization');
 if(pool){
  await pool.query(`INSERT INTO license_network_bindings
    (license_id,network_hash,first_seen_at,last_seen_at,blocked_attempts)
    VALUES($1,$2,$3,$3,0) ON CONFLICT(license_id) DO NOTHING`,
    [licenseId,networkHash,at]);
  const updated=await pool.query(`UPDATE license_network_bindings
    SET last_seen_at=$3 WHERE license_id=$1 AND network_hash=$2
    RETURNING license_id`,[licenseId,networkHash,at]);
  if(updated.rowCount===1)return true;
  await pool.query(`UPDATE license_network_bindings SET blocked_attempts=blocked_attempts+1
    WHERE license_id=$1`,[licenseId]);
  return false;
 }
 if(sqlite){
  sqlite.prepare(`INSERT INTO license_network_bindings
    (license_id,network_hash,first_seen_at,last_seen_at,blocked_attempts)
    VALUES (?,?,?,?,0) ON CONFLICT(license_id) DO NOTHING`)
   .run(licenseId,networkHash,at,at);
  const updated=sqlite.prepare(`UPDATE license_network_bindings SET last_seen_at=?
    WHERE license_id=? AND network_hash=?`).run(at,licenseId,networkHash);
  if(updated.changes===1)return true;
  sqlite.prepare(`UPDATE license_network_bindings SET blocked_attempts=blocked_attempts+1
    WHERE license_id=?`).run(licenseId);
  return false;
 }
 throw Error('Purchase database is not available');
}
