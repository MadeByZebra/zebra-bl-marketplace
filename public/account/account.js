(()=>{'use strict';
const $=id=>document.getElementById(id);
const status=(message,error=false)=>{$('accountStatus').textContent=message;$('accountStatus').classList.toggle('error',error)};
const api=async(url,options={})=>{const res=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});let data={};try{data=await res.json()}catch{}if(!res.ok)throw Error(data.error||'Request failed');return data};
let email='';
let pendingCheckoutId=null;
async function verifyCheckout(user){if(!pendingCheckoutId)return;const id=pendingCheckoutId;pendingCheckoutId=null;try{const data=await api('/api/confirm',{method:'POST',body:JSON.stringify({session_id:id})});await showAccount(user,data.paid);if(!data.paid)status('Stripe payment is still pending verification. No access has been issued.');}catch(e){status(e.message,true)}history.replaceState(null,'',location.pathname);}
const setBusy=(button,busy)=>{button.disabled=busy};
const showLogin=()=>{$('loginArea').hidden=false;$('signedIn').hidden=true;$('emailForm').hidden=false;$('verifyForm').hidden=true;$('panelTitle').textContent='Sign in by email.'};
function renderLibrary(items,catalog,orders=[]){
 $('libraryItems').replaceChildren();
 if(!items?.length){const p=document.createElement('p');p.className='account-status';p.textContent='No purchases yet. Your verified products will appear here.';$('libraryItems').append(p);return}
 for(const sku of items){const product=[...(catalog.products||[]),...(catalog.extras||[]),...(catalog.bundles||[])].find(p=>p.id===sku);
  if(!product||product.testOnly)continue;
  const row=document.createElement('div');row.className='library-item';
  const info=document.createElement('div'),name=document.createElement('strong'),desc=document.createElement('span');
  name.textContent=product.title;desc.textContent=product.kind==='download'?'Protected installer':'Licensed loadstring';
  info.append(name,desc);row.append(info);
  if(product.kind==='download'){const a=document.createElement('a');a.className='btn';a.href='/api/injector/download';a.textContent='Download installer ↗';row.append(a);}
  else{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Generate loader ↗';b.addEventListener('click',async()=>{
    b.disabled=true;status('Generating your personal license…');
    try{const d=await api('/api/license/'+encodeURIComponent(sku),{method:'POST',body:'{}'});
      const output=$('loaderResult');output.replaceChildren();
      const pre=document.createElement('pre');pre.className='loader-output';pre.textContent=d.loadstring;
      const copy=document.createElement('button');copy.className='btn';copy.textContent='Copy loadstring';
      copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(d.loadstring);status('Loadstring copied. Do not share your personal key.')}catch{status('Clipboard permission denied. Copy the text manually.',true)}});
      output.append(pre,copy);status('New loader generated. Older keys for this product have been revoked.');
    }catch(e){status(e.message,true)}finally{b.disabled=false;}
  });row.append(b);}
 $('libraryItems').append(row)}
 if(orders.length){
  const heading=document.createElement('h3');heading.textContent='Order history & receipts';
  heading.style.cssText='font-size:18px;letter-spacing:-.04em;margin:35px 0 8px';$('libraryItems').append(heading);
  for(const order of orders){
   const product=[...(catalog.products||[]),...(catalog.extras||[]),...(catalog.bundles||[])].find(p=>p.id===order.sku);
   if(!product||product.testOnly)continue;
   const row=document.createElement('div');row.className='library-item';
   const item=document.createElement('div'),name=document.createElement('strong'),description=document.createElement('span');
   name.textContent=product.title;
   const cents=Number(order.amount),price=Number.isFinite(cents)?'
async function showAccount(user,confirmed=false){
 $('loginArea').hidden=true;$('signedIn').hidden=false;$('panelTitle').textContent='Your private library.';$('signedInEmail').textContent=user.email;
 try{const [lib,store]=await Promise.all([api('/api/library'),api('/api/store')]);renderLibrary(lib.owned,store.catalog,lib.orders||[]);status(confirmed?'Payment verified. Your account library is up to date.':'Signed in. Your verified purchases appear below.');}
 catch(e){status(e.message,true)}
}
$('emailForm').addEventListener('submit',async e=>{e.preventDefault();email=$('loginEmail').value.trim().toLowerCase();
 const button=$('sendCode');setBusy(button,true);status('Sending a one-time code…');
 try{await api('/api/auth/request-code',{method:'POST',body:JSON.stringify({email})});
 $('emailForm').hidden=true;$('verifyForm').hidden=false;$('loginCode').focus();status('Check your inbox for the six-digit code. It expires in ten minutes.');
 }catch(e){status(e.message,true)}finally{setBusy(button,false)}});
$('verifyForm').addEventListener('submit',async e=>{e.preventDefault();const button=$('verifyCode');setBusy(button,true);
 try{const d=await api('/api/auth/verify-code',{method:'POST',body:JSON.stringify({email,code:$('loginCode').value.trim()})});await showAccount(d.user);await verifyCheckout(d.user);}
 catch(e){status(e.message,true)}finally{setBusy(button,false)}});
$('changeEmail').addEventListener('click',showLogin);
$('signOut').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST',body:'{}'});showLogin();status('Signed out.')}catch(e){status(e.message,true)}});
async function startup(){
 try{const [me,store]=await Promise.all([api('/api/me'),api('/api/store')]);if(me.user)await showAccount(me.user);else if(!store.email_login_ready)status('Email sign-in is not configured yet. No sign-in email can be sent.',true);
 const url=new URL(location.href);if(url.searchParams.get('checkout')==='success'&&url.searchParams.get('session_id')){
  pendingCheckoutId=url.searchParams.get('session_id');
  if(me.user)await verifyCheckout(me.user);
  else status('Sign in using the same email used for checkout to verify your purchase.');
 }else if(url.searchParams.get('checkout')==='cancel'){status('Checkout canceled. No purchase was made.');history.replaceState(null,'',location.pathname);}
 }catch(e){status('Unable to connect to Zebra’s Shop: '+e.message,true)}
}startup();
})();+(cents/100).toFixed(2):'';
   description.textContent=new Date(Number(order.paid_at)).toLocaleDateString()+' · '+price+' · Paid';
   item.append(name,description);row.append(item);
   if(typeof order.session_id==='string'&&/^cs_(test_|live_)[A-Za-z0-9_]{10,200}$/.test(order.session_id)){
    const link=document.createElement('a');link.className='btn';
    link.href='/api/receipt/'+encodeURIComponent(order.session_id);
    link.target='_blank';link.rel='noopener noreferrer';
    link.textContent='Stripe receipt ↗';row.append(link);
   }
   $('libraryItems').append(row);
  }
 }
}
async function showAccount(user,confirmed=false){
 $('loginArea').hidden=true;$('signedIn').hidden=false;$('panelTitle').textContent='Your private library.';$('signedInEmail').textContent=user.email;
 try{const [lib,store]=await Promise.all([api('/api/library'),api('/api/store')]);renderLibrary(lib.owned,store.catalog);status(confirmed?'Payment verified. Your account library is up to date.':'Signed in. Your verified purchases appear below.');}
 catch(e){status(e.message,true)}
}
$('emailForm').addEventListener('submit',async e=>{e.preventDefault();email=$('loginEmail').value.trim().toLowerCase();
 const button=$('sendCode');setBusy(button,true);status('Sending a one-time code…');
 try{await api('/api/auth/request-code',{method:'POST',body:JSON.stringify({email})});
 $('emailForm').hidden=true;$('verifyForm').hidden=false;$('loginCode').focus();status('Check your inbox for the six-digit code. It expires in ten minutes.');
 }catch(e){status(e.message,true)}finally{setBusy(button,false)}});
$('verifyForm').addEventListener('submit',async e=>{e.preventDefault();const button=$('verifyCode');setBusy(button,true);
 try{const d=await api('/api/auth/verify-code',{method:'POST',body:JSON.stringify({email,code:$('loginCode').value.trim()})});await showAccount(d.user);await verifyCheckout(d.user);}
 catch(e){status(e.message,true)}finally{setBusy(button,false)}});
$('changeEmail').addEventListener('click',showLogin);
$('signOut').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST',body:'{}'});showLogin();status('Signed out.')}catch(e){status(e.message,true)}});
async function startup(){
 try{const [me,store]=await Promise.all([api('/api/me'),api('/api/store')]);if(me.user)await showAccount(me.user);else if(!store.email_login_ready)status('Email sign-in is not configured yet. No sign-in email can be sent.',true);
 const url=new URL(location.href);if(url.searchParams.get('checkout')==='success'&&url.searchParams.get('session_id')){
  pendingCheckoutId=url.searchParams.get('session_id');
  if(me.user)await verifyCheckout(me.user);
  else status('Sign in using the same email used for checkout to verify your purchase.');
 }else if(url.searchParams.get('checkout')==='cancel'){status('Checkout canceled. No purchase was made.');history.replaceState(null,'',location.pathname);}
 }catch(e){status('Unable to connect to Zebra’s Shop: '+e.message,true)}
}startup();
})();