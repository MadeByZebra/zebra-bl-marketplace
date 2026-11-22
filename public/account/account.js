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
      cache:'no-store',
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
    $('authHint').textContent='We’ll send a six-digit, single-use code. No password required.';
    $('loginCode').value='';
  }
  function renderLibrary(owned,catalog,orders=[]){
    const container=$('libraryItems');
    container.replaceChildren();
    $('loaderResult').replaceChildren(); // Never keep a private loader from a previous account.
    const licensedItems=[...new Set((owned||[]))].filter(sku=>{
      const product=catalogItem(catalog,sku);
      return product&&!product.testOnly;
    });
    const header=(title,count)=>{
      const section=element('section',undefined,'commerce-library-group');
      const heading=element('div',undefined,'commerce-library-group-head');
      heading.append(element('h3',title),element('span',String(count)+' '+(count===1?'ITEM':'ITEMS'),'commerce-library-count'));
      section.append(heading);
      container.append(section);
      return section;
    };
    const productsSection=header('Your products',licensedItems.length);
    if(!licensedItems.length){
      productsSection.append(element('p',(orders||[]).some(o=>catalogItem(catalog,o.sku)?.testOnly)
        ?'Diagnostic checkout completed. No software license is attached to that test order.'
        :'No purchased products yet. Your verified tools will appear here after payment confirmation.','account-status'));
      const browse=link('/scripts/','Browse tools ↗');
      browse.className='btn';
      productsSection.append(browse);
    }
    for(const sku of licensedItems){
      const product=catalogItem(catalog,sku);
      const row=element('article',undefined,'library-item');
      const info=element('div');
      info.append(element('strong',product.title),element('span',product.kind==='download'?'Protected Windows installer · verified order only':'Private licensed loadstring · account protected'));
      const controls=element('div',undefined,'commerce-library-actions');
      if(product.kind==='download'){
        controls.append(link('/api/injector/download','Download installer ↗'));
      }else{
        const generate=element('button','Generate loadstring ↗','btn');
        generate.type='button';
        const result=element('section',undefined,'commerce-loader-card');
        result.hidden=true;
        const label=element('strong','PERSONAL LOADSTRING — KEEP PRIVATE');
        label.className='commerce-eyebrow';
        const explanation=element('p','Creating another key disables the previous one. Do not send your personal loadstring to others.','commerce-muted');
        const area=element('textarea');
        area.readOnly=true;area.spellcheck=false;
        area.setAttribute('aria-label',product.title+' private loadstring');
        const actions=element('div',undefined,'commerce-actions');
        const copy=element('button','Copy loadstring','btn'),download=element('button','Download .txt','btn');
        copy.type='button';download.type='button';
        const feedback=element('p',undefined,'account-alert');
        actions.append(copy,download);
        result.append(label,explanation,area,actions,feedback);
        generate.addEventListener('click',async()=>{
          if(!window.confirm('Generate a new personal loadstring for '+product.title+'? Any previously issued key for this product will stop working.'))return;
          generate.disabled=true;
          feedback.textContent='Verifying your purchase and rotating your private license…';
          feedback.classList.remove('error');
          try{
            const data=await api('/api/license/'+encodeURIComponent(sku),{method:'POST',body:'{}'});
            if(typeof data.loadstring!=='string'||!data.loadstring.includes('ZebraLicense'))throw new Error('The server did not return a valid personal loader.');
            area.value=data.loadstring;
            result.hidden=false;
            generate.textContent='Rotate license ↗';
            feedback.textContent='Personal loadstring ready. Your previous key was revoked.';
            alert('Personal loader created for '+product.title+'. Keep it private.');
          }catch(error){
            feedback.classList.add('error');feedback.textContent=error.message;
            alert(error.message,true);
          }finally{generate.disabled=false;}
        });
        copy.addEventListener('click',async()=>{
          if(!area.value)return;
          try{
            if(!navigator.clipboard?.writeText)throw new Error('Clipboard not available');
            await navigator.clipboard.writeText(area.value);
            feedback.classList.remove('error');feedback.textContent='Copied. Keep the license private.';
          }catch{
            area.focus();area.select();
            feedback.classList.remove('error');feedback.textContent='Select the highlighted text and copy manually.';
          }
        });
        download.addEventListener('click',()=>{
          if(!area.value)return;
          const blob=new Blob([area.value+'\n'],{type:'text/plain;charset=utf-8'});
          const url=URL.createObjectURL(blob);
          try{
            const a=element('a');a.href=url;a.download='ZBL_'+sku+'_personal_loadstring.txt';
            document.body.append(a);a.click();a.remove();
            feedback.textContent='Saved to your computer. Keep this file private.';
          }finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
        });
        controls.append(generate);
        row.append(result);
      }
      row.prepend(info);
      const output=row.querySelector('.commerce-loader-card');
      if(output)row.insertBefore(controls,output);
      else row.append(controls);
      productsSection.append(row);
    }
    const history=header('Order history',orders.length);
    if(!orders.length){
      history.append(element('p','No verified orders on this account yet.','account-status'));
    }
    for(const order of orders){
      const product=catalogItem(catalog,order.sku);
      const row=element('article',undefined,'library-item');
      const info=element('div');
      const title=product?.title||'Purchased product';
      const summary=Number(order.amount)===0?' · Promotional order':product?.testOnly?' · Sandbox diagnostic':' · Completed';
      info.append(element('strong',title),element('span',dateLabel(order.paid_at)+' · '+priceLabel(order.amount)+summary));
      const actions=element('div',undefined,'commerce-library-actions');
      if(typeof order.session_id==='string'&&/^cs_(test_|live_)[A-Za-z0-9_]{10,200}$/.test(order.session_id)){
        const detail=link('/order/?session_id='+encodeURIComponent(order.session_id),'Order details ↗');
        detail.setAttribute('aria-label','View private order details for '+title);
        actions.append(detail);
        if(Number(order.amount)>0&&!product?.testOnly){
          const receipt=link('/api/receipt/'+encodeURIComponent(order.session_id),'Stripe receipt ↗');
          receipt.target='_blank';receipt.rel='noopener noreferrer';
          actions.append(receipt);
        }
      }
      row.append(info,actions);
      history.append(row);
    }
  }
  async function showAccount(user,confirmed=false){
    $('loginArea').hidden=true;
    $('signedIn').hidden=false;
    $('panelTitle').textContent='Your private library.';
    $('authHint').textContent='Products and orders are linked to your verified email account.';
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
    try{
      const data=await api('/api/confirm',{method:'POST',body:JSON.stringify({session_id:id})});
      await showAccount(user,Boolean(data.paid));
      if(!data.paid){
        alert('Payment has not been confirmed yet. No license has been issued. Refresh this page to retry verification; your checkout reference is preserved.');
        return;
      }
      // A successful server-side verification is the ONLY reason to clear
      // the reference. If Stripe or the network is down, users can retry.
      pendingCheckoutId=null;
      history.replaceState(null,'',location.pathname);
    }catch(error){
      alert('Payment verification could not complete: '+error.message+
        '. Your order is not lost. Refresh this page to retry, or contact support if it remains pending.',true);
    }
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
      $('libraryItems').replaceChildren();
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