// Retry pending purchase confirmations without changing payment state.
// Only query orders in the configured Stripe environment; never turn a test
// charge into a live entitlement or resend already-recorded notifications.
export function retryablePurchaseEmailQuery(){
 return `SELECT p.session_id
 FROM purchases p
 LEFT JOIN purchase_notifications n ON n.session_id=p.session_id
 WHERE p.status='paid' AND n.session_id IS NULL
   AND SUBSTR(p.session_id,1,8)=$1
 ORDER BY p.paid_at ASC
 LIMIT $2`;
}

export async function retryPendingPurchaseEmails({
 query,send,modePrefix,limit=10,report=()=>{}
}){
 if(!['cs_test_','cs_live_'].includes(modePrefix))return {attempted:0,skipped:'unknown_payment_mode'};
 const batch=Number.isSafeInteger(limit)?Math.max(1,Math.min(limit,20)):10;
 const candidates=await query(retryablePurchaseEmailQuery(),[modePrefix,batch]);
 let attempted=0,errors=0;
 for(const entry of candidates){
  if(typeof entry?.session_id!=='string'||!entry.session_id.startsWith(modePrefix))continue;
  attempted++;
  try{
   await send(entry.session_id);
  }catch(error){
   errors++;
   report('Purchase receipt retry failed:',error?.code||'unknown');
  }
 }
 return {attempted,errors};
}
