// Stripe supports both unrestricted secret keys (sk_*) and API-restricted
// server keys (rk_*). A restricted key is appropriate only if its Dashboard
// permissions authorize every required operation; never bypass the mandatory
// merchant authorization check if an operation returns 403.
// Publishable (pk_*) keys, placeholders, and whitespace are never accepted.
export function stripeKeyMode(secretKey){
 const key=String(secretKey||'');
 const match=/^(?:sk|rk)_(live|test)_[A-Za-z0-9]+$/.exec(key);
 return match?match[1]:null;
}
export function stripeKeyType(secretKey){
 const key=String(secretKey||'');
 if(!stripeKeyMode(key))return null;
 return key.startsWith('rk_')?'restricted':'secret';
}
