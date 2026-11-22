import {stripeKeyMode} from './stripe-key-mode.js';
// Stripe Checkout IDs encode the payment environment. This allows a safe
// test-to-live migration without treating simulated purchases as paid live orders.
export function checkoutOrderPrefix(secretKey){
 const mode=stripeKeyMode(secretKey);
 if(mode==='live')return 'cs_live_';
 if(mode==='test')return 'cs_test_';
 return null;
}
export function checkoutOrderMatchesMode(sessionId,secretKey){
 const prefix=checkoutOrderPrefix(secretKey);
 return !!prefix&&typeof sessionId==='string'&&sessionId.startsWith(prefix);
}
