// Fail-closed gates that are independent of Stripe authorization and payload hashes.
// Runtime compatibility and data durability require seller-reviewed evidence.
export const VERIFIED_LIVE_IDS=Object.freeze([
 'control-center','str-grinder','end-grinder','dex-desktop','dex-mobile','fps-optimizer'
]);
const APPROVED_SET=new Set(VERIFIED_LIVE_IDS);
export function verifiedLiveSkuIds(env={}){
 const raw=String(env.LIVE_VERIFIED_SKUS||'');
 return new Set(raw.split(',').map(s=>s.trim()).filter(s=>APPROVED_SET.has(s)));
}
export function verifiedLiveProduct(item,env={},getIncluded=item=>item.items||[item.id]){
 if(!item||typeof item.id!=='string'||item.unavailable)return false;
 // Installer is checked separately for a SHA-verified native binary; the
 // original unverified Windows injector is intentionally not included here.
 if(item.id==='zflag-injector')return env.LIVE_ZFLAG_VERIFIED==='1';
 if(item.id==='class-s-joiner'||item.id==='checkout-test')return false;
 const ids=getIncluded(item),allowed=verifiedLiveSkuIds(env);
 return Array.isArray(ids)&&ids.length>0&&ids.every(id=>allowed.has(id));
}
export function liveReleaseReadiness(env={}){
 const reasons=[];
 if(env.LIVE_DATABASE_CONFIRMED!=='1')reasons.push('persistent_database_unconfirmed');
 if(!verifiedLiveSkuIds(env).size&&env.LIVE_ZFLAG_VERIFIED!=='1')reasons.push('no_runtime_verified_products');
 return {ready:reasons.length===0,reasons};
}
