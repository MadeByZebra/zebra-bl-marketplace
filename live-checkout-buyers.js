// Live checkout must never silently become public after a seller-only pilot.
// A live checkout requires either an explicit pilot account or a separate
// public-release approval, in addition to the existing Stripe/product gates.
export function liveBuyerAllowed(email,env={}){
 if(env.LIVE_BUYER_TEST_ONLY==='1'){
  const normalized=typeof email==='string'?email.trim().toLowerCase():'';
  if(!normalized)return false;
  const approved=new Set(String(env.LIVE_TEST_BUYER_EMAILS||'')
   .split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
  return approved.has(normalized);
 }
 return env.LIVE_PUBLIC_SALES_APPROVED==='1';
}
