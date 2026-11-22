// Preserve same-origin checks for browser mutations without blocking
// read-only licensed Lua fetches from game-client HTTP runtimes.
// A valid license has ONE rate-limit bucket even if requests come from
// different IP addresses. This is abuse mitigation, not copy-proof DRM.
import {createHash} from 'node:crypto';
const LICENSE_PATTERN=/^ZBL_[a-f0-9]{56}$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
export function requiresSameOrigin(method){
 return !['GET','HEAD','OPTIONS'].includes(String(method||'').toUpperCase());
}
export function loaderRateLimitKey(rawKey,clientIp){
 const key=typeof rawKey==='string'&&LICENSE_PATTERN.test(rawKey)
  ?'license:'+rawKey
  :'ip:'+String(clientIp||'unknown');
 return hash(key);
}
