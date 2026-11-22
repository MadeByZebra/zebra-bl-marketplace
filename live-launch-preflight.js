// A non-chargeable prelaunch diagnostic for the site's own restricted Stripe key.
// Never returns, stores or logs the Checkout URL or Stripe identifiers. Always
// expires the unpaid Checkout Session it creates. Does NOT imply actual payment
// acceptance, webhook delivery, buyer receipt or license functionality.
const clean=error=>error?.statusCode===403?'permission_denied':
 error?.statusCode===401?'unauthorized':
 error?.code==='resource_missing'?'not_found':'api_unavailable';

export async function runUnpaidLiveCheckoutPreflight({
 stripe,sendMail,supportEmail,siteUrl,priceCents=50,now=()=>Date.now()
}){
 const status={
  mode:'unpaid_live_preflight',
  checkout_create:false,checkout_expire:false,
  checkout_read:false,payment_intents_read:false,charges_read:false,
  email_provider_accepted:false,issues:[]
 };
 if(!stripe||typeof stripe.checkout?.sessions?.create!=='function'){
  status.issues.push('stripe_not_configured');return status;
 }
 // Optional queries contain no customer records and prove restricted key read
 // rights needed by confirmation, My Library and Stripe receipt links.
 for(const [label,method] of [
  ['checkout_read',()=>stripe.checkout.sessions.list({limit:1})],
  ['payment_intents_read',()=>stripe.paymentIntents.list({limit:1})],
  ['charges_read',()=>stripe.charges.list({limit:1})]
 ]){
  try{await method();status[label]=true;}
  catch(e){status.issues.push(label+':'+clean(e));}
 }
 let session;
 try{
  // An internal-only Checkout link is never presented to anybody.
  // Creating an unpaid session is not a charge or purchase.
  session=await stripe.checkout.sessions.create({
   mode:'payment',
   line_items:[{price_data:{
    currency:'usd',
    unit_amount:priceCents,
    product_data:{name:'BL Scripts internal prelaunch checkout diagnostic — not a sale'}
   },quantity:1}],
   success_url:String(siteUrl).replace(/\\/$/,'')+'/account/?preflight=complete',
   cancel_url:String(siteUrl).replace(/\\/$/,'')+'/account/?preflight=cancelled',
   expires_at:Math.floor(now()/1000)+1800,
   metadata:{internal_preflight:'1'}
  });
  if(!session?.id||session.livemode!==true){
   status.issues.push('checkout_create:unexpected_mode');
  }else status.checkout_create=true;
 }catch(e){status.issues.push('checkout_create:'+clean(e));}
 finally{
  if(session?.id){
   try{
    const expired=await stripe.checkout.sessions.expire(session.id);
    if(expired?.status==='expired')status.checkout_expire=true;
    else status.issues.push('checkout_expire:unexpected_status');
   }catch(e){status.issues.push('checkout_expire:'+clean(e));}
  }
 }
 if(typeof sendMail==='function'&&/^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$/.test(String(supportEmail||''))){
  try{
   const r=await sendMail({
    to:supportEmail,subject:'BL Scripts — launch email diagnostic (NO PURCHASE)',
    text:'The BL Scripts server can contact the transactional email provider. This is not a purchase, receipt, or confirmation of delivery to any customer. No payment was made.',
    idempotencyKey:'zebra-owner-live-preflight-20261122'
   });
   status.email_provider_accepted=r?.accepted===true;
   if(!status.email_provider_accepted)status.issues.push('email:provider_not_confirmed');
  }catch(e){status.issues.push('email:'+clean(e));}
 }else status.issues.push('email:support_contact_missing');
 return status;
}
