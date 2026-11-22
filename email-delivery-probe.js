// Safe opt-in delivery probe. Tests one inbox without changing the public
// support address, issuing a checkout, revealing an OTP, or touching orders.
export const DELIVERY_PROBE_SUBJECT='BL Scripts - owner email delivery diagnostic (NO PURCHASE)';
const validRecipient=s=>typeof s==='string'&&s.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
export async function runEmailDeliveryProbe({enabled=false,recipient='',sendMail,providerAuthorized=false}={}){
 if(!enabled)return {status:'disabled'};
 if(!providerAuthorized||typeof sendMail!=='function')return {status:'blocked',reason:'provider_unavailable'};
 if(!validRecipient(recipient))return {status:'blocked',reason:'invalid_recipient'};
 try{
  const result=await sendMail({
   to:recipient,
   subject:DELIVERY_PROBE_SUBJECT,
   text:'BL Scripts marketplace email delivery test. This is not an order, a payment, a receipt, or a one-time sign-in code. No real or test payment was made. You can ignore this message.',
   idempotencyKey:'bl-scripts-delivery-probe-20261122'
  });
  return result?.accepted===true?{status:'provider_accepted'}:{status:'failed',reason:'provider_unconfirmed'};
 }catch(error){
  return {status:'failed',reason:'provider_rejected'};
 }
}
