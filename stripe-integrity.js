// Verified paid-checkout invariants. This is security-sensitive code: neither a
// customer-controlled price quote nor the browser success URL grants access.
export function checkoutModeMatches(session,configuredMode){
 if(!session||!['test','live'].includes(configuredMode))return false;
 const prefix=configuredMode==='test'?'cs_test_':'cs_live_';
 return typeof session.id==='string'&&session.id.startsWith(prefix)&&
   session.livemode===(configuredMode==='live')&&session.mode==='payment';
}
export function paymentIntentMatches(session,order,intent,charge,configuredMode){
 if(!checkoutModeMatches(session,configuredMode)||!order||!intent||!charge)return false;
 const amount=Number(order.amount);
 if(!Number.isSafeInteger(amount)||amount<50)return false;
 if(session.status!=='complete'||session.payment_status!=='paid'||session.currency!=='usd')return false;
 if(Number(session.amount_total)!==amount)return false;
 const intentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
 if(!intentId||intentId!==intent.id)return false;
 if(intent.livemode!==(configuredMode==='live')||intent.status!=='succeeded'||
    Number(intent.amount_received)!==amount||intent.currency!=='usd')return false;
 const chargeId=typeof intent.latest_charge==='string'?intent.latest_charge:intent.latest_charge?.id;
 const chargeIntent=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;
 if(!chargeId||chargeId!==charge.id||chargeIntent!==intent.id||charge.livemode!==(configuredMode==='live'))return false;
 if(charge.paid!==true||charge.status!=='succeeded'||charge.refunded===true||
    Number(charge.amount_refunded)!==0||charge.disputed===true)return false;
 return true;
}
