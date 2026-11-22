// A live Stripe secret key alone is NOT evidence that the merchant may charge.
// Treat account activation as a mandatory server-side precondition.
export function liveMerchantReadiness(account,expectedAccountId=''){
 const issues=[];
 if(!account||typeof account!=='object')return {ready:false,issues:['not_verified']};
 if(expectedAccountId&&account.id!==expectedAccountId)issues.push('wrong_stripe_account');
 if(account.charges_enabled!==true)issues.push('charges_disabled');
 if(account.payouts_enabled!==true)issues.push('payouts_disabled');
 if(account.capabilities?.card_payments!=='active')issues.push('card_payments_inactive');
 if(account.requirements?.disabled_reason)issues.push('verification_required');
 return {ready:issues.length===0,issues};
}
