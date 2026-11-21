import { checkoutModeMatches } from './stripe-integrity.js';
// A free order is NOT a credit-card payment. Grant it only after Stripe
// confirms a completed, fully discounted Checkout Session that matches the
// server-created order and the reserved account redemption.
export function validFreeCheckout(session,order,claim,configuredMode='test'){
 if(!session||!order||!claim||!checkoutModeMatches(session,configuredMode))return false;
 if(!Number.isSafeInteger(Number(order.amount))||Number(order.amount)!==0)return false;
 if(session.status!=='complete'||!['paid','no_payment_required'].includes(session.payment_status))return false;
 if(session.currency!=='usd'||Number(session.amount_total)!==0||session.payment_intent)return false;
 if(!Number.isSafeInteger(session.amount_subtotal)||session.amount_subtotal<50)return false;
 if(Number(session.total_details?.amount_discount)!==session.amount_subtotal)return false;
 if(session.metadata?.free_promo!=='v1'||session.metadata?.sku!==order.sku||session.metadata?.user_id!==order.user_id)return false;
 if(session.client_reference_id!==order.user_id)return false;
 if(claim.session_id!==session.id||claim.user_id!==order.user_id||claim.sku!==order.sku)return false;
 return true;
}
