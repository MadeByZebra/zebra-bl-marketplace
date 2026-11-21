// Transactional email transport, hosted independently from the Render web app.
// The Resend onboarding@resend.dev sender is test-only; Brevo can use an
// activated, verified sender without requiring us to migrate the website.
// Do not put provider keys, OTPs, or receipt secrets in public files.
export function activeMailer(env=process.env){
 if(env.BREVO_API_KEY&&env.BREVO_FROM_EMAIL)return 'brevo';
 if(env.RESEND_API_KEY&&env.MAIL_FROM)return 'resend';
 return null;
}
export function mailerMode(env=process.env){
 const p=activeMailer(env);
 if(p==='brevo')return 'brevo_configured';
 if(p==='resend')return /onboarding@resend\.dev\b/i.test(env.MAIL_FROM||'')?'resend_test_only':'resend_custom';
 return 'unconfigured';
}
function fromAddress(raw){
 const s=String(raw||'').trim();
 const match=s.match(/^(.+?)\s*<([^<>]+@[^<>]+)>$/);
 return match?{name:match[1].trim().replace(/^["']|["']$/g,''),email:match[2].trim()}:
 {name:"Zebra's Shop",email:s};
}
export async function sendShopEmail({to,subject,text,html,idempotencyKey,env=process.env,fetchImpl=fetch}){
 const type=activeMailer(env);
 if(!type)throw Object.assign(new Error('Email provider not configured.'),{code:'MAIL_NOT_CONFIGURED'});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to||'')))throw new Error('Invalid recipient.');
 let url,headers,body;
 if(type==='brevo'){
  url='https://api.brevo.com/v3/smtp/email';
  headers={'Content-Type':'application/json','api-key':env.BREVO_API_KEY,'accept':'application/json'};
  const name=String(env.BREVO_FROM_NAME||"Zebra's Shop").slice(0,80);
  body={sender:{name,email:env.BREVO_FROM_EMAIL},to:[{email:to}],subject,textContent:text};
  if(html)body.htmlContent=html;
 }else{
  url='https://api.resend.com/emails';
  headers={'Content-Type':'application/json','Authorization':'Bearer '+env.RESEND_API_KEY};
  if(idempotencyKey)headers['Idempotency-Key']=String(idempotencyKey).slice(0,160);
  body={from:env.MAIL_FROM,to:[to],subject,text};
  if(html)body.html=html;
 }
 const response=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!response.ok){
  const error=new Error(type==='resend'&&response.status===403&&
    mailerMode(env)==='resend_test_only'?
    'This shop is still using Resend testing mode. Other email addresses cannot receive sign-in codes until a public mail provider is enabled.':
    'The email provider rejected the send request. Check sender verification and transactional sending status.');
  error.code='MAIL_DELIVERY_FAILED';error.status=response.status;throw error;
 }
 return {accepted:true,provider:type};
}
export function receiptEmail({name,totalCents,orderId,storeUrl,receiptUrl}){
 const price='$'+(Number(totalCents)/100).toFixed(2);
 const safeTitle=String(name||'your purchase').slice(0,160);
 const lines=[
  'Thank you for your Zebra\'s Shop purchase.',
  '',
  'Item: '+safeTitle,
  'Paid: '+price+' USD',
  'Order reference: '+orderId,
  '',
  'Your purchased items are available in your private library:',
  String(storeUrl).replace(/\/$/,'')+'/account/'
 ];
 if(receiptUrl&&/^https:\/\//.test(receiptUrl))lines.push('Official Stripe receipt: '+receiptUrl);
 lines.push('','If you did not make this purchase, please contact support.','This is an order confirmation, not a tax invoice.');
 return lines.join('\n');
}
