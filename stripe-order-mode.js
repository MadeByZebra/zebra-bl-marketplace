// Stripe Checkout IDs encode the payment environment. This allows a safe
// test-to-live migration without treating simulated purchases as paid live orders.
export function checkoutOrderPrefix(secretKey){
 const key=String(secretKey||'');
 if(key.startsWith('sk_live_'))return 'cs_live_';
 if(key.startsWith('sk_test_'))return 'cs_test_';
 return null;
}
export function checkoutOrderMatchesMode(sessionId,secretKey){
 const prefix=checkoutOrderPrefix(secretKey);
 return !!prefix&&typeof sessionId==='string'&&sessionId.startsWith(prefix);
}
