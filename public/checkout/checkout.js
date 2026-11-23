(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const params=new URLSearchParams(location.search);
 const sku=params.get('sku')||'';
 const state={item:null,store:null,user:null,email:'',quote:null,busy:false};
 const validSku=/^[a-z0-9-]{2,60}$/.test(sku);
 const money=c=>Number.isSafeInteger(Number(c))&&Number(c)>=0?'$'+(Number(c)/100).toFixed(2):'—';
 const set=(id,value)=>{const el=$(id);if(el)el.textContent=String(value??'');};
 const status=(id,message,bad=false)=>{const el=$(id);if(!el)return;el.textContent=message;el.classList.toggle('is-error',bad);};
 async function api(url,options={}){
  const res=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json'},cache:'no-store',...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'Request could not be completed.');
  return data;
 }
 const all=c=>[...(c?.products||[]),...(c?.extras||[]),...(c?.bundles||[])];
 function syncButtons(){
  $('signedInPanel').hidden=!state.user;
  $('emailForm').hidden=!!state.user;
  $('verifyForm').hidden=!!state.user||!state.email;
  if(state.user)set('signedInEmail',state.user.email);
  $('completeCheckout').disabled=state.busy||!state.user||!state.store?.checkout_ready||!state.item||state.item.unavailable||!$('acceptTerms').checked;
 }
 function renderItem(){
  const p=state.item;if(!p)return;
  set('summaryName',p.title);set('summaryPlatform',(p.platform||'Digital access')+' · Personal license');
  set('productTitle',p.title);set('productDescription',p.description);
  set('productBadge',(p.label||'DIGITAL PRODUCT')+' · '+(p.platform||'ONLINE'));
  const ul=$('productFeatures');ul.replaceChildren();
  for(const feat of (p.features||[]).slice(0,5)){const li=document.createElement('li');li.textContent=feat;ul.append(li);}
  if(!ul.children.length){const li=document.createElement('li');li.textContent='Account-linked digital delivery';ul.append(li);}
  set('productCompatibility',p.details||'Read the supported platform and compatibility information before purchase.');
  const quote=state.quote||{total:p.price,saved:0};
  set('summaryTotal',money(quote.total));set('summaryPrice',money(p.price));
  set('summarySubtotal',money(p.price));set('summaryDiscount',quote.saved>0?'−'+money(quote.saved):money(0));set('summaryDue',money(quote.total));
 }
 async function updateQuote(code=''){
  if(!state.item)return;
  try{
   state.quote=await api('/api/discount/quote?sku='+encodeURIComponent(sku)+'&code='+encodeURIComponent(code));
   if(!state.quote.ok)throw new Error(state.quote.error||'Discount not available');
   const applied=Number(state.quote.saved||0)>0;
   status('promoStatus',applied?'Promo applied. Your total is '+money(state.quote.total)+'.':'No discount applied. Your total is '+money(state.quote.total)+'.');
  }catch(error){state.quote=null;status('promoStatus',error.message,true);}
  renderItem();
 }
 async function refresh(){
  if(!validSku){status('checkoutNotice','Choose a product from the BL Scripts catalog.',true);return;}
  try{
   const [store,me]=await Promise.all([api('/api/store'),api('/api/me')]);
   state.store=store;state.user=me.user||null;
   state.item=all(store.catalog).find(p=>p.id===sku)||null;
   if(!state.item){status('checkoutNotice','This product is not listed. Return to the catalog.',true);return;}
   state.quote={total:state.item.price,saved:0};
   renderItem();
   const prefilled=(params.get('code')||'').slice(0,32);
   if(prefilled){$('promoCode').value=prefilled;await updateQuote(prefilled);}
   if(state.item.unavailable||!store.checkout_ready){
    status('checkoutNotice',store.checkout_message||'Purchasing is paused until this product is verified. No charge will be taken.',true);
   }else{status('checkoutNotice','Your product is available. Confirm your account and review the terms to continue.');}
   if(params.get('canceled')==='1')status('checkoutStatus','Checkout canceled. No payment was made.');
   if(!store.email_login_ready&&!state.user)status('authStatus','Email sign-in is currently unavailable. Please use Support if you need help.',true);
   syncButtons();
  }catch(e){status('checkoutNotice','Unable to load the current store: '+e.message,true);}
 }
 async function sendCode(e){
  e.preventDefault();state.email=$('checkoutEmail').value.trim().toLowerCase();
  const b=$('sendCode');b.disabled=true;status('authStatus','Requesting your code…');
  try{
   await api('/api/auth/request-code',{method:'POST',body:JSON.stringify({email:state.email})});
   $('emailForm').hidden=true;$('verifyForm').hidden=false;
   status('authStatus','Code sent. Check your inbox or spam folder; it expires in 10 minutes.');
   $('checkoutOtp').focus();
  }catch(err){state.email='';status('authStatus',err.message,true);}
  finally{b.disabled=false;}
 }
 async function verifyCode(e){
  e.preventDefault();const b=$('verifyCode');b.disabled=true;
  try{
   const result=await api('/api/auth/verify-code',{method:'POST',
    body:JSON.stringify({email:state.email,code:$('checkoutOtp').value.trim()})});
   state.user=result.user;state.email='';$('checkoutOtp').value='';
   // Refresh after account verification. Payment rights and product availability
   // still come from the server, not from this page.
   await refresh();
   if($('promoCode').value.trim())await updateQuote($('promoCode').value.trim());
   status('authStatus','Email verified. Your purchase will be attached to this account.');
   syncButtons();
  }catch(err){status('authStatus',err.message,true);}
  finally{b.disabled=false;}
 }
 async function pay(){
  if(state.busy)return;
  if(!state.user){status('checkoutStatus','Verify your account before proceeding.',true);return;}
  if(!state.store?.checkout_ready||!state.item||state.item.unavailable){
   status('checkoutStatus','Checkout is not available. No payment was taken.',true);return;
  }
  if(!$('acceptTerms').checked){status('checkoutStatus','Read and accept the purchase terms first.',true);return;}
  state.busy=true;syncButtons();set('completeCheckout','Opening secure Stripe checkout…');
  try{
   const quoteCode=$('promoCode').value.trim();
   const data=await api('/api/checkout',{method:'POST',
    body:JSON.stringify({sku,accepted_terms:true,discount_code:quoteCode})});
   const url=new URL(data.url);
   if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Unexpected payment provider address. No card information was entered.');
   window.location.assign(url.toString());
  }catch(e){status('checkoutStatus',e.message,true);}
  finally{state.busy=false;set('completeCheckout','Continue to Stripe ↗');syncButtons();}
 }
 $('emailForm').addEventListener('submit',sendCode);
 $('verifyForm').addEventListener('submit',verifyCode);
 $('changeEmail').addEventListener('click',()=>{
  state.email='';$('checkoutOtp').value='';$('verifyForm').hidden=true;$('emailForm').hidden=false;status('authStatus','You can request a code for a different email.');
 });
 $('applyPromo').addEventListener('click',()=>updateQuote($('promoCode').value.trim()));
 $('acceptTerms').addEventListener('change',syncButtons);
 $('completeCheckout').addEventListener('click',pay);
 refresh();
})();