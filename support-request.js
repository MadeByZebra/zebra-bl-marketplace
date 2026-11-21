// Incoming customer support mail. Never let a public request choose our recipient.
const TOPICS=new Set([
  'Purchase or receipt','Account sign-in','Software / compatibility',
  'Refund or billing','Product question','Other'
]);
const validEmail=s=>typeof s==='string'&&s.length<=254&&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
const safeText=(v,max)=>typeof v==='string'?v.trim().slice(0,max+1):'';

export function validateSupportRequest(value){
  const v=value&&typeof value==='object'?value:{};
  // Hidden honeypot. Treat as successfully handled, without sending mail.
  if(safeText(v.website,100))return {ok:true,discard:true};
  const name=safeText(v.name,100);
  const email=safeText(v.email,254).toLowerCase();
  const subject=safeText(v.subject,80);
  const product=safeText(v.product,140);
  const order=safeText(v.order,120);
  const message=safeText(v.message,4000);
  if(!name||name.length>100||/[\r\n<>]/.test(name))
    return {ok:false,error:'Enter your name (up to 100 characters).'};
  if(!validEmail(email)||/[\r\n]/.test(email))
    return {ok:false,error:'Enter a valid email address for our reply.'};
  if(!TOPICS.has(subject))
    return {ok:false,error:'Choose a support topic.'};
  if(product.length>140||/[\r\n<>]/.test(product))
    return {ok:false,error:'Product name is too long.'};
  if(order.length>120||/[\r\n<>]/.test(order))
    return {ok:false,error:'Order reference is too long.'};
  if(message.length<15||message.length>4000||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(message))
    return {ok:false,error:'Describe your issue in 15 to 4,000 characters.'};
  return {ok:true,name,email,subject,product,order,message,discard:false};
}

export function supportEmailContent(data,reference){
  return {
    subject:"Zebra's Shop support | "+reference+' | '+data.subject,
    text:[
      "ZEBRA'S SHOP — CUSTOMER SUPPORT",
      'Reference: '+reference,
      'Topic: '+data.subject,
      'Customer: '+data.name,
      'Reply-to: '+data.email,
      'Product: '+(data.product||'Not supplied'),
      'Order reference: '+(data.order||'Not supplied'),
      '',
      'CUSTOMER MESSAGE',
      data.message,
      '',
      'Reply directly to this email to respond to the customer.',
      'Do not request passwords, one-time codes or full card numbers.'
    ].join('\n')
  };
}
