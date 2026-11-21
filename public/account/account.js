(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const alert = (message, isError=false) => {
    const node=$('accountStatus');
    if(!node)return;
    node.textContent=message;
    node.classList.toggle('error',Boolean(isError));
  };
  async function api(url,options={}) {
    const response=await fetch(url,{
      credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      ...options
    });
    let result={};
    try{result=await response.json();}catch(_ignored){}
    if(!response.ok)throw new Error(result.error||'The request could not be completed.');
    return result;
  }
  let email='';
  let pendingCheckoutId=null;
  let resendAllowedAt=0;
  const dateLabel = value => {
    const dt=new Date(Number(value));
    return Number.isFinite(dt.getTime())?dt.toLocaleDateString():'Date unavailable';
  };
  const priceLabel = value => {
    const cents=Number(value);
    return Number.isSafeInteger(cents)&&cents>=0?'$'+(cents/100).toFixed(2):'Price unavailable';
  };
  function catalogItem(catalog,sku){
    return [...(catalog.products||[]),...(catalog.extras||[]),...(catalog.bundles||[])]
      .find(product=>product.id===sku);
  }
  function element(tag,text,cls){
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=String(text);
    if(cls)node.className=cls;
    return node;
  }
  function link(url,label){
    const node=element('a',label,'btn');
    node.href=url;
    return node;
  }
  function showLogin(){
    $('loginArea').hidden=false;
    $('signedIn').hidden=true;
    $('emailForm').hidden=false;
    $('verifyForm').hidden=true;
    $('panelTitle').textContent='Sign in by email.';
    $('loginCode').value='';
  }
  function renderLibrary(owned,catalog,orders=[]){
    const container=$('libraryItems');
    container.replaceChildren();
    if(!owned?.length)container.append(element('p','No purchases yet. Your verified products will appear here.','account-status'));
    for(const sku of owned||[]){
      const product=catalogItem(catalog,sku);
      if(!product||product.testOnly)continue;
      const row=element('div',undefined,'library-item');
      const info=element('div');
      info.append(element('strong',product.title),element('span',product.kind==='download'?'Protected installer':'Licensed loadstring'));
      row.append(info);
      if(product.kind==='download'){
        row.append(link('/api/injector/download','Download installer ↗'));
      }else{
        const generate=element('button','Generate loader ↗','btn');
        generate.type='button';
        generate.addEventListener('click',async()=>{
          generate.disabled=true;
          alert('Generating your personal license…');
          try{
            const data=await api('/api/license/'+encodeURIComponent(sku),{method:'POST',body:'{}'});
            const destination=$('loaderResult');
            destination.replaceChildren();
            const code=element('pre',data.loadstring,'loader-output');
            const copy=element('button','Copy loadstring','btn');
            copy.type='button';
            copy.addEventListener('click',async()=>{
              try{
                await navigator.clipboard.writeText(data.loadstring);
                alert('Copied. Keep your personal license private.');
              }catch(_error){alert('Clipboard access denied. Copy the text manually.',true);}
            });
            destination.append(code,copy);
            alert('New personal loader generated. The old key for this product is revoked.');
          }catch(error){alert(error.message,true);}
          finally{generate.disabled=false;}
        });
        row.append(generate);
      }
      container.append(row);
    }
    if(!orders.length)return;
    const heading=element('h3','Order history & receipts');
    heading.style.cssText='font-size:18px;letter-spacing:-.04em;margin:35px 0 8px';
    container.append(heading);
    for(const order of orders){
      const product=catalogItem(catalog,order.sku);
      if(!product||product.testOnly)continue;
      const row=element('div',undefined,'library-item');
      const info=element('div');
      info.append(
        element('strong',product.title),
        element('span',dateLabel(order.paid_at)+' · '+priceLabel(order.amount)+(Number(order.amount)===0?' · Free promotional order':' · Paid'))
      );
      row.append(info);
      if(Number(order.amount)>0&&typeof order.session_id==='string'&&/^cs_(test_|live_)[A-Za-z0-9_]{10,200}$/.test(order.session_id)){
        const receipt=link('/api/receipt/'+encodeURIComponent(order.session_id),'Stripe receipt ↗');
        receipt.target='_blank';
        receipt.rel='noopener noreferrer';
        row.append(receipt);
      }
      container.append(row);
    }
  }
  async function showAccount(user,confirmed=false){
    $('loginArea').hidden=true;
    $('signedIn').hidden=false;
    $('panelTitle').textContent='Your private library.';
    $('signedInEmail').textContent=user.email;
    try{
      const [library,store]=await Promise.all([api('/api/library'),api('/api/store')]);
      renderLibrary(library.owned,store.catalog,library.orders||[]);
      alert(confirmed?'Your payment was verified; your library is up to date.':'Signed in. Your verified purchases appear below.');
    }catch(error){alert(error.message,true);}
  }
  async function verifyCheckout(user){
    if(!pendingCheckoutId)return;
    const id=pendingCheckoutId;
    pendingCheckoutId=null;
    try{
      const data=await api('/api/confirm',{method:'POST',body:JSON.stringify({session_id:id})});
      await showAccount(user,Boolean(data.paid));
      if(!data.paid)alert('Payment is pending verification. No product access has been issued.');
    }catch(error){alert(error.message,true);}
    history.replaceState(null,'',location.pathname);
  }
  async function sendCode(isResend=false){
    email=$('loginEmail').value.trim().toLowerCase();
    if(!email){alert('Enter an email address.',true);return;}
    const button=$(isResend?'resendCode':'sendCode');
    if(button)button.disabled=true;
    alert('Requesting your six-digit code…');
    try{
      await api('/api/auth/request-code',{method:'POST',body:JSON.stringify({email})});
      $('emailForm').hidden=true;
      $('verifyForm').hidden=false;
      resendAllowedAt=Date.now()+60_000;
      const again=$('resendCode');
      if(again){
        again.disabled=true;
        setTimeout(()=>{again.disabled=Date.now()<resendAllowedAt;},60_100);
      }
      alert('Email accepted by the provider. Check your inbox and spam folder; the code expires in 10 minutes.');
      if(!isResend)$('loginCode').focus();
    }catch(error){alert(error.message,true);}
    finally{if(button&&(!isResend||Date.now()>=resendAllowedAt))button.disabled=false;}
  }
  $('emailForm').addEventListener('submit',event=>{
    event.preventDefault();
    sendCode(false);
  });
  $('resendCode')?.addEventListener('click',()=>{
    if(Date.now()<resendAllowedAt){
      alert('Wait one minute before requesting another code.');
      return;
    }
    sendCode(true);
  });
  $('verifyForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const button=$('verifyCode');
    button.disabled=true;
    try{
      const data=await api('/api/auth/verify-code',{
        method:'POST',
        body:JSON.stringify({email,code:$('loginCode').value.trim()})
      });
      await showAccount(data.user);
      await verifyCheckout(data.user);
    }catch(error){alert(error.message,true);}
    finally{button.disabled=false;}
  });
  $('changeEmail').addEventListener('click',()=>{showLogin();alert('Enter an email to request a code.');});
  $('signOut').addEventListener('click',async()=>{
    try{
      await api('/api/logout',{method:'POST',body:'{}'});
      $('loaderResult').replaceChildren();
      showLogin();
      alert('Signed out.');
    }catch(error){alert(error.message,true);}
  });
  async function start(){
    try{
      const [me,store]=await Promise.all([api('/api/me'),api('/api/store')]);
      if(me.user)await showAccount(me.user);
      else if(store.email_provider_auth==='unauthorized')alert('Sign-in emails are temporarily unavailable because the email provider rejected this shop\'s credentials. The owner has been notified.',true);
      else if(store.email_provider_auth==='forbidden')alert('Sign-in emails are temporarily unavailable while the email provider reviews or authorizes this shop.',true);
      else if(!store.email_login_ready)alert('Email sign-in is temporarily unavailable. Please try again later.',true);
      else if(store.email_sender_mode==='resend_test_only')
        alert('Testing mode: this sender can only email the address registered with Resend. Other customers cannot receive codes until a public sender is activated.');
      const locationUrl=new URL(location.href);
      if(locationUrl.searchParams.get('checkout')==='success'&&locationUrl.searchParams.get('session_id')){
        pendingCheckoutId=locationUrl.searchParams.get('session_id');
        if(me.user)await verifyCheckout(me.user);
        else alert('Sign in with the same email used at checkout to verify the purchase.');
      }else if(locationUrl.searchParams.get('checkout')==='cancel'){
        alert('Checkout canceled. No payment was taken.');
        history.replaceState(null,'',location.pathname);
      }
    }catch(error){alert('Unable to connect to the shop: '+error.message,true);}
  }
  start();
})();