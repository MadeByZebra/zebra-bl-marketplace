// Checkout Session lifecycle controls. Never expose a live Checkout URL until
// the matching order is durably persisted and any promo claim is linked.
export function shouldRetryUnrecordedCheckout(session,records){
 return !!session&&['paid','no_payment_required'].includes(session.payment_status)
  &&Array.isArray(records)&&records.length===0
  &&typeof session.metadata?.sku==='string'&&session.metadata.sku.length>0
  &&typeof session.metadata?.user_id==='string'&&session.metadata.user_id.length>0;
}
export async function expireIncompleteCheckout(stripe,sessionId,report=console.error){
 if(!sessionId)return true;
 try{
  await stripe.checkout.sessions.expire(sessionId);
  return true;
 }catch(error){
  report('Failed to expire incomplete Checkout Session:',error?.code||'unknown');
  return false;
 }
}
