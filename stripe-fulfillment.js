// Same code used by the live Checkout verification and the disposable
// PostgreSQL integration suite. All inputs are server-owned or loaded from
// Stripe; this module never accepts a browser's payment-success claim.
import {validFreeCheckout} from './free-checkout.js';
import {checkoutModeMatches,paymentIntentMatches} from './stripe-integrity.js';

export async function verifyAndGrantStripeOrder({
 session,configuredMode,query,stripe,now=()=>Date.now()
}={}){
 if(typeof query!=='function'||!stripe)return false;
 if(!checkoutModeMatches(session,configuredMode)||
    !['paid','no_payment_required'].includes(session.payment_status)||
    session.currency!=='usd')return false;
 const order=(await query('SELECT * FROM purchases WHERE session_id=$1',[session.id]))[0];
 if(!order||order.status==='revoked')return false;
 if(session.client_reference_id!==order.user_id||
    session.metadata?.user_id!==order.user_id||
    session.metadata?.sku!==order.sku)return false;
 // Immutable server-recorded price; the client never supplies an entitled sum.
 if(!Number.isSafeInteger(Number(order.amount))||Number(order.amount)<0||
    Number(session.amount_total)!==Number(order.amount))return false;
 if(Number(order.amount)===0){
  const claimed=(await query(
   'SELECT * FROM free_promo_redemptions WHERE user_id=$1 AND session_id=$2 AND sku=$3',
   [order.user_id,session.id,order.sku]))[0];
  if(!validFreeCheckout(session,order,claimed,configuredMode))return false;
  await query(`UPDATE purchases SET status='paid',paid_at=COALESCE(paid_at,$1)
    WHERE session_id=$2 AND status!='revoked'`,[now(),session.id]);
  await query('UPDATE free_promo_redemptions SET redeemed_at=$1 WHERE user_id=$2 AND session_id=$3 AND redeemed_at IS NULL',
    [now(),order.user_id,session.id]);
  // Re-fetch the status: a concurrent refund must never return paid=true.
  const final=(await query('SELECT status FROM purchases WHERE session_id=$1',[session.id]))[0];
  return final?.status==='paid';
 }
 if(Number(order.amount)<50||session.payment_status!=='paid'||!session.payment_intent)return false;
 const intent=await stripe.paymentIntents.retrieve(
  typeof session.payment_intent==='object'?session.payment_intent.id:session.payment_intent,
  {expand:['latest_charge']});
 const charge=intent.latest_charge;
 if(!charge||typeof charge==='string'||
    !paymentIntentMatches(session,order,intent,charge,configuredMode))return false;
 await query(`UPDATE purchases SET status='paid',payment_intent=$1,
    paid_at=COALESCE(paid_at,$2) WHERE session_id=$3 AND status!='revoked'`,
  [intent.id,now(),session.id]);
 const final=(await query('SELECT status FROM purchases WHERE session_id=$1',[session.id]))[0];
 return final?.status==='paid';
}

// A signed charge refund/dispute event must invalidate live licenses as well
// as future loader downloads; product access queries require status='paid'.
// The calling HTTP route verifies the Stripe signature and matching livemode
// before invoking this helper. The function itself never initiates a refund.
export async function revokeForStripeChargeEvent({event,stripe,query}={}){
 if(!event||!stripe||typeof query!=='function'||
    !['charge.refunded','charge.dispute.created'].includes(event.type))return false;
 const obj=event.data?.object;
 if(!obj)return false;
 let charge;
 if(event.type==='charge.refunded'){
  charge=obj;
 }else{
  const chargeId=typeof obj.charge==='string'?obj.charge:obj.charge?.id;
  if(!chargeId)return false;
  charge=await stripe.charges.retrieve(chargeId);
 }
 const intentId=typeof charge?.payment_intent==='string'
  ?charge.payment_intent:charge?.payment_intent?.id;
 if(!intentId)return false;
 await query("UPDATE purchases SET status='revoked' WHERE payment_intent=$1",[intentId]);
 return true;
}
