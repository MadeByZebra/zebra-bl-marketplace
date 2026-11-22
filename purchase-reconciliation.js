// Recover after a Stripe webhook or buyer redirect fails. Read actual Stripe
// Checkout state, then call the same verified grant handler used by webhooks.
// This function NEVER creates payments or grants access from a client callback.
export function pendingPurchaseReconciliationSql(){
 return `SELECT session_id FROM purchases
  WHERE status='pending'
    AND SUBSTR(session_id,1,8)=$1
    AND created_at >=$2 AND created_at <=$3
  ORDER BY created_at DESC LIMIT $4`;
}
export async function reconcilePendingPurchases({
 query,fetchSession,confirmPaid,notify,prefix,nowMs=Date.now(),limit=10,report=()=>{}
}={}){
 if(!['cs_test_','cs_live_'].includes(prefix))
  return {scanned:0,confirmed:0,skipped:'unrecognized_stripe_mode'};
 if(!Number.isSafeInteger(nowMs)||nowMs<0)
  return {scanned:0,confirmed:0,skipped:'invalid_time'};
 const batch=Number.isSafeInteger(limit)?Math.max(1,Math.min(limit,20)):10;
 // Only recent pending sessions, after initial checkout persistence has settled.
 const oldest=nowMs-7*24*60*60*1000,newest=nowMs-45*1000;
 const pending=await query(pendingPurchaseReconciliationSql(),[prefix,oldest,newest,batch]);
 let scanned=0,confirmed=0,errors=0;
 for(const row of pending){
  const id=row?.session_id;
  if(typeof id!=='string'||!id.startsWith(prefix))continue;
  scanned++;
  try{
   const session=await fetchSession(id);
   if(session?.id!==id||!['paid','no_payment_required'].includes(session.payment_status))
    continue;
   // confirmPaid must perform the complete persisted-order and Stripe payment
   // integrity checks. This runner does not trust payment_status alone.
   if(await confirmPaid(session)){
    confirmed++;
    try{await notify(id)}catch(err){
     errors++;report('Confirmed order email retry required:',err?.code||'unknown');
    }
   }
  }catch(err){
   errors++;report('Pending Stripe order reconciliation failed:',err?.code||'unknown');
  }
 }
 return {scanned,confirmed,errors};
}
