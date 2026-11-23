(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const sessionId=new URLSearchParams(location.search).get('session_id')||'';
 const validId=/^cs_(test_|live_)[A-Za-z0-9_]{10,200}$/.test(sessionId);
 const state={user:null,order:null,email:'',secretCache:new Map()};
 const money=c=>Number.isSafeInteger(Number(c))&&Number(c)>=0?'$'+(Number(c)/100).toFixed(2):'—';
 const txt=(id,value)=>{if($(id))$(id).textContent=String(value??'');};
 const note=(id,value,bad=false)=>{const e=$(id);if(!e)return;e.textContent=value;e.classList.toggle('is-error',!!bad);};
 const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
 async function api(path,options={}){
  const res=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Unable to complete this request.');
  return data;
 }
 const signedIn=()=>Boolean(state.user);
 function showLogin(){
  $('orderSignIn').hidden=signedIn();
  $('orderEmailForm').hidden=signedIn()||!!state.email;
  $('orderCodeForm').hidden=signedIn()||!state.email;
 }
 function showStatus(title,description,message,isError=false){
  txt('resultTitle',title);txt('resultDescription',description);
  txt('resultSymbol',isError?'!':'◌');
  note('orderNotice',message,isError);
 }
 function setOrderDetails(order){
  txt('orderTotal',money(order.amount));txt('orderDue',money(order.amount));txt('detailTotal',money(order.amount));
  txt('summaryItemName',order.title);txt('summaryItemPrice',money(order.amount));
  txt('orderItemCount',String(order.items?.length||0));
  txt('orderPaymentStatus',order.status==='paid'?'Verified':order.status==='revoked'?'Revoked':'Pending');
  txt('orderSubnote',order.status==='paid'?'Completed purchase · USD':order.status==='revoked'?'Refunded or disputed':'Awaiting verification');
  txt('detailOrderId',order.session_id);
  txt('detailEmail',state.user?.email||'');
  txt('detailStatus',order.status==='paid'?'Completed':order.status==='revoked'?'Access revoked':'Pending');
  const when=Number(order.paid_at||order.created_at);
  txt('detailDate',Number.isFinite(when)&&when>0?new Date(when).toLocaleString():'Not available');
  $('orderDetailsCard').hidden=false;
  $('receiptLink').hidden=!(order.status==='paid'&&Number(order.amount)>0);
  if(!$('receiptLink').hidden)$('receiptLink').href='/api/receipt/'+encodeURIComponent(order.session_id);
 }
 async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
  throw Error('Copy not available. Select the text in the field and copy manually.');
 }
 function addDeliveredProduct(item){
  const row=element('article',undefined,'commerce-delivered-item');
  const head=element('div',undefined,'commerce-delivered-head');
  const icon=element('span','⌘','commerce-product-icon');
  const info=element('div');
  info.append(element('strong',item.title),element('small',item.kind==='download'?'Protected Windows installer':'Individual licensed loadstring'));
  const badge=element('span','✓ Delivered','commerce-pill commerce-pill-success');
  head.append(icon,info,badge);
  const body=element('div',undefined,'commerce-delivered-body');
  const msg=item.kind==='download'
   ?'Your installer is available only while this account has an active, verified entitlement.'
   :'View your existing paid personal command below. Viewing never rotates the key or requires another payment. New-installation activation happens only once.';
  body.append(element('p',msg));
  if(item.kind==='download'){
   const a=element('a','Download verified installer ↗','commerce-button commerce-secondary');
   a.href='/api/injector/download';body.append(a);
  }else if(item.testOnly){
   body.append(element('p','Diagnostic purchase only. No software is included.'));
  }else{
   const gen=element('button','View my purchased loadstring ↗','commerce-button commerce-secondary');
   gen.type='button';
   const output=element('div',undefined,'commerce-license-output');
   output.hidden=true;
   const label=element('label','PRIVATE LOADSTRING — KEEP THIS SECRET');
   const area=element('textarea');area.readOnly=true;area.spellcheck=false;area.rows=3;area.setAttribute('aria-label',item.title+' personal loadstring');
   const controls=element('div',undefined,'commerce-actions');
   const copy=element('button','Copy loadstring','commerce-button commerce-secondary');copy.type='button';
   const download=element('button','Download .txt','commerce-button commerce-secondary');download.type='button';
   const feedback=element('p',undefined,'commerce-inline-status');
   controls.append(copy,download);
   output.append(label,area,controls,feedback,element('p','If the script asks you to approve this installation, sign in to My Library and enter the activation code. Main and alt Roblox accounts can share an approved installation. Do not share this personal command.','commerce-muted'));

   gen.addEventListener('click',async()=>{
    gen.disabled=true;gen.textContent='Verifying your paid purchase…';
    try{
     const status=await api('/api/license-status/'+encodeURIComponent(item.id));
     let d;
     if(!status.issued){
      d=await api('/api/license/'+encodeURIComponent(item.id),{method:'POST',body:'{}'});
     }else if(status.current_command_retrievable){
      d=await api('/api/license/'+encodeURIComponent(item.id)+'/current');
     }else{
      if(!confirm('Your older command is not retrievable. Recover the paid key once? The old command stops working, but approval remains and no replacement is consumed.'))return;
      d=await api('/api/license/'+encodeURIComponent(item.id)+'/recover',{method:'POST',body:'{}'});
     }
     if(typeof d.loadstring!=='string'||!d.loadstring.includes('ZebraLicense'))throw Error('Invalid private command response.');
     state.secretCache.set(item.id,d.loadstring);
     area.value=d.loadstring;output.hidden=false;
     noteInner(feedback,d.recovered
      ?'Recovered your purchased command. Approved installation preserved. You can view this command again from My Library.'
      :'Current purchased command retrieved. No new payment, key rotation or repeated installation approval.');
     output.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});
    }catch(error){note('orderNotice',error.message,true);}
    finally{gen.disabled=false;gen.textContent='View my purchased loadstring ↗';}
   });
   copy.addEventListener('click',async()=>{
    try{await copyText(area.value);noteInner(feedback,'Copied. Do not share your license.');}
    catch(err){area.focus();area.select();noteInner(feedback,err.message,true);}
   });
   download.addEventListener('click',()=>{
    if(!area.value)return;
    const blob=new Blob([area.value+'\n'],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='ZBL_'+item.id+'_personal_loadstring.txt';
    document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
    noteInner(feedback,'Saved locally. Keep your personal license private.');
   });
   body.append(gen,output);
  }
  row.append(head,body);return row;
 }
 function noteInner(el,msg,bad=false){el.textContent=msg;el.classList.toggle('is-error',bad);}
 function renderDelivered(order){
  const dest=$('deliveredItems');dest.replaceChildren();
  if(!Array.isArray(order.items)||!order.items.length){dest.append(element('p','No deliverable software is associated with this order.','commerce-muted'));return;}
  for(const item of order.items)dest.append(addDeliveredProduct(item));
  $('deliveriesCard').hidden=false;
  $('reviewCard').hidden=order.testOnly===true;
  if(order.feedback){$('reviewRating').value=String(order.feedback.rating);$('reviewMessage').value=order.feedback.comment||'';note('reviewStatus','Your previous feedback is saved. You can update it.');}
 }
 async function load(){
  if(!validId){showStatus('Open your private library.','Select a completed order to view its delivered items.','No valid order reference was provided. Open My Library for your order history.',true);return;}
  try{
   const me=await api('/api/me');state.user=me.user||null;showLogin();
   if(!state.user){
    showStatus('Sign in to continue.','Only the account that bought the product can view its order.','A checkout reference alone never unlocks a license.');
    return;
   }
   showStatus('Verifying your purchase…','Checking your account and Stripe payment status.','Validating ownership and payment with the server.');
   const confirmed=await api('/api/confirm',{method:'POST',body:JSON.stringify({session_id:sessionId})});
   const order=await api('/api/order/'+encodeURIComponent(sessionId));
   state.order=order;
   setOrderDetails(order);
   if(order.status==='revoked'){
    showStatus('This order is no longer active.','The payment was refunded or disputed, so software access is unavailable.','Contact support if you believe this is incorrect.',true);return;
   }
   if(!confirmed.paid||order.status!=='paid'){
    showStatus('Payment verification pending.','No license is available until Stripe confirms the order.','Your order is recorded. Refresh to check again, or contact support if payment appears complete.');
    return;
   }
   $('paymentStep').classList.add('completed');
   $('paymentStep').querySelector('i').textContent='✓';
   $('deliveryStep').classList.add('active');
   txt('resultSymbol','✓');
   txt('resultTitle','Order completed.');
   txt('resultDescription','Your purchase has been verified. Your items are ready below.');
   note('orderNotice','Verified payment and account ownership. Personal licenses are generated on demand.');
   renderDelivered(order);
  }catch(err){
   showStatus('We could not verify this order.','No software is released until the account and payment are verified.',err.message+' If you paid, try again or contact support with your order reference.',true);
  }
 }
 $('copyAllLoadstrings').addEventListener('click',async()=>{
  if(!state.secretCache.size){
   note('orderNotice','Generate at least one personal loader first, then use Copy generated loaders.');
   return;
  }
  const value=[...state.secretCache.entries()].map(([sku,code])=>sku+':\n'+code).join('\n\n');
  try{await copyText(value);note('orderNotice','Copied generated loadstrings. Keep all personal license keys private.');}
  catch(err){note('orderNotice',err.message,true);}
 });
 $('orderEmailForm').addEventListener('submit',async e=>{
  e.preventDefault();state.email=$('orderEmail').value.trim().toLowerCase();$('orderSend').disabled=true;
  try{await api('/api/auth/request-code',{method:'POST',body:JSON.stringify({email:state.email})});showLogin();note('orderAuthStatus','Code sent. Check your email inbox and spam folder.');}
  catch(err){state.email='';note('orderAuthStatus',err.message,true);}
  finally{$('orderSend').disabled=false;}
 });
 $('orderCodeForm').addEventListener('submit',async e=>{
  e.preventDefault();$('orderVerify').disabled=true;
  try{const d=await api('/api/auth/verify-code',{method:'POST',body:JSON.stringify({email:state.email,code:$('orderCode').value.trim()})});state.user=d.user;state.email='';$('orderCode').value='';showLogin();await load();}
  catch(err){note('orderAuthStatus',err.message,true);}
  finally{$('orderVerify').disabled=false;}
 });
 $('orderChange').addEventListener('click',()=>{state.email='';showLogin();note('orderAuthStatus','Enter a different email address.');});
 $('reviewForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!state.order||state.order.status!=='paid')return;
  const btn=$('submitReview');btn.disabled=true;
  try{
   const rating=Number($('reviewRating').value),comment=$('reviewMessage').value.trim();
   if(!Number.isInteger(rating)||rating<1||rating>5)throw Error('Choose a rating first.');
   const saved=await api('/api/order/'+encodeURIComponent(sessionId)+'/feedback',{method:'POST',body:JSON.stringify({rating,comment})});
   if(saved.ok)note('reviewStatus','Feedback saved privately. Thank you for helping improve BL Scripts.');
  }catch(err){note('reviewStatus',err.message,true);}finally{btn.disabled=false;}
 });
 load();
})();