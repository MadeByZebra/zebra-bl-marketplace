// Read-only Lua loaders can be requested outside a browser origin.
// Valid license tokens also share a separate request limit independent of IP.
// The original per-IP limiter stays active, so neither limit can replace it.
// This only deters bulk sharing; possession of the token remains bearer access.
import {createHash} from 'node:crypto';
const LICENSE_PATTERN=/^ZBL_[a-f0-9]{56}$/;
export function requiresSameOrigin(method){
 return !['GET','HEAD','OPTIONS'].includes(String(method||'').toUpperCase());
}
export function validLicenseKey(rawKey){
 return typeof rawKey==='string'&&LICENSE_PATTERN.test(rawKey);
}
export function licenseRateLimitKey(rawKey){
 if(!validLicenseKey(rawKey))return null;
 return createHash('sha256').update('license:'+rawKey).digest('hex');
}
