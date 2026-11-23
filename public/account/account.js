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
        const generate=element('button','Generate / replace loadstring ↗','btn');
        generate.type='button';
        const view=element('button','View my loadstring ↗','btn primary');
        view.type='button';view.disabled=true;
        const result=element('section',undefined,'commerce-loader-card');
        result.hidden=true;
        // A failed request must never hide its ONLY message inside the hidden
        // output panel (which is what made the prior behavior look broken).
        const generationStatus=element('p','Checking your paid license…','account-alert commerce-generation-status');
        generationStatus.setAttribute('role','status');
        generationStatus.setAttribute('aria-live','polite');
        const label=element('strong','PERSONAL LOADSTRING — KEEP PRIVATE');
        label.className='commerce-eyebrow';
        const explanation=element('p','This is your private purchased command. You can view it again from your signed-in account without generating or paying again. A separate key replacement is only for a lost or leaked key. Your approved installation works with Roblox main and alt accounts.','commerce-muted');
        const area=element('textarea');
        area.readOnly=true;area.spellcheck=false;area.rows=4;area.setAttribute('autocomplete','off');
        area.setAttribute('aria-label',product.title+' private loadstring');
        const actions=element('div',undefined,'commerce-actions');
        const copy=element('button','Copy loadstring','btn'),download=element('button','Download .txt','btn');
        copy.type='button';download.type='button';
        const feedback=element('p',undefined,'account-alert');
        actions.append(copy,download);
        result.append(label,explanation,area,actions,feedback);
        let generating=false;
        let currentInfo=null;
        const showGenerationMessage=(message,isError=false)=>{
          generationStatus.textContent=message;
          generationStatus.classList.toggle('error',Boolean(isError));
        };
        const showCommand=async(data,note)=>{
          if(typeof data.loadstring!=='string'||!data.loadstring.includes('ZebraLicense'))
            throw new Error('The server did not return a valid personal loader.');
          area.value=data.loadstring;
          result.hidden=false;
          feedback.textContent=note||'This is your current purchased command. Keep it private.';
          let copied=false;
          try{
            if(navigator.clipboard?.writeText){
              await navigator.clipboard.writeText(data.loadstring);
              copied=true;
            }
          }catch(_ignored){/* Copy and Download remain available. */}
          result.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
          area.focus({preventScroll:true});
          showGenerationMessage(copied
            ?'Your personal loadstring is shown below and copied to your clipboard.'
            :'Your personal loadstring is shown below. Click Copy loadstring or Download .txt.');
        };
        const refreshQuota=async()=>{
          const info=await api('/api/license-status/'+encodeURIComponent(sku));
          currentInfo=info;
          const remaining=Math.max(0,Number(info.max_keys_per_7_days)-Number(info.keys_issued_last_7_days));
          if(!generating)generate.disabled=remaining===0;
          generate.textContent=remaining===0?'Replacement limit reached':'Replace key (only if leaked) ↗';
          view.disabled=false;
          view.textContent=!info.issued?'Create first command ↗':
            info.current_command_retrievable?'View my loadstring ↗':'Recover purchased loadstring ↗';
          pairing.hidden=Boolean(info.device_approval_enabled&&info.device_approved);
          if(info.device_approval_enabled&&info.device_approved){
            approvedStatus.hidden=false;
          }else approvedStatus.hidden=true;
          if(info.current_command_retrievable){
            showGenerationMessage('Paid license active. View your loadstring any time without another purchase, replacement, or activation code.'+
              (remaining===0?' The weekly limit affects NEW replacement keys only.':''));
          }else if(info.legacy_recovery_available){
            showGenerationMessage('Paid license active'+(info.device_approved?' and installation already approved':'')+
              '. Your older command predates permanent retrieval. Select Recover purchased loadstring once; this preserves installation approval and does not use a replacement.');
          }else if(info.issued){
            showGenerationMessage('Purchased license active. Select View my loadstring to retrieve the command.');
          }else{
            showGenerationMessage('Purchase verified. Create your first command to get started.');
            generate.disabled=true;
          }
          return remaining;
        };
        // This read-only request never issues or rotates a buyer key.
        view.addEventListener('click',async()=>{
          if(generating)return;
          generating=true;view.disabled=true;generate.disabled=true;
          showGenerationMessage('Checking paid ownership and fetching your personal command…');
          try{
            const info=currentInfo||await api('/api/license-status/'+encodeURIComponent(sku));
            let data;
            if(!info.issued){
              data=await api('/api/license/'+encodeURIComponent(sku),{method:'POST',body:'{}'});
            }else if(info.current_command_retrievable){
              data=await api('/api/license/'+encodeURIComponent(sku)+'/current');
            }else{
              if(!window.confirm('Your older paid key cannot be displayed again. Recover it once? This changes the OLD loadstring but keeps your approved installation and does not consume a weekly key replacement.'))return;
              data=await api('/api/license/'+encodeURIComponent(sku)+'/recover',{method:'POST',body:'{}'});
            }
            await showCommand(data,data.recovered
              ?'Recovered! Your former command is invalid, but your approved installation is preserved. This command can be viewed again any time.'
              :'Current paid command retrieved — no new purchase, no key rotation, and no new activation.');
          }catch(error){
            showGenerationMessage('Could not show your command: '+error.message,true);
            alert('Could not show loadstring: '+error.message,true);
          }finally{
            generating=false;
            await refreshQuota().catch(()=>{view.disabled=false;generate.disabled=false;});
          }
        });
        refreshQuota().catch(()=>showGenerationMessage('Could not check the current license. Try View my loadstring or contact Support.',true));
        generate.addEventListener('click',async()=>{
          if(!window.confirm('Generate a NEW personal loadstring for '+product.title+'? IMPORTANT: this REVOKES the previous command even if it works. If you already have your newest command saved, press Cancel and use it instead. You do not have to buy again.'))return;
          generating=true;generate.disabled=true;
          showGenerationMessage('Verifying your purchase and replacing your key…');
          try{
            const data=await api('/api/license/'+encodeURIComponent(sku),{method:'POST',body:'{}'});
            await showCommand(data,'New personal command created. The previous command is revoked. You can view this one again without rotating.');
            alert('New private loadstring created. Copy it from below.');
          }catch(error){
            showGenerationMessage('Generation failed: '+error.message,true);
            alert('Could not replace your key: '+error.message,true);
          }finally{
            generating=false;
            await refreshQuota().catch(()=>{generate.disabled=false;});
          }
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
        // Buyer approval happens in this signed-in browser, never in Roblox.
        const pairing=element('section',undefined,'commerce-loader-card commerce-device-pairing');
        const approvedStatus=element('section',
          'INSTALLATION APPROVED  •  One-time activation complete. No code is needed on each Roblox launch or auto-execute. Your main and alt accounts can use this approved installation, provided its local installation file stays intact and the paid license remains valid.',
          'commerce-approved-installation');
        approvedStatus.hidden=true;
        const heading=element('strong','ACTIVATE YOUR PURCHASED INSTALLATION');
        heading.className='commerce-eyebrow';
        const pairHelp=element('p','The 10-character activation code is NOT emailed and does NOT appear automatically in My Library. It appears in the Roblox F9 Developer Console (Client log) when your executor supports it, and in the executor console/output after you run your newest personal loadstring. The loader displays a black-and-white activation panel inside Roblox with the code and a Copy Code button, if your client allows custom UI. Closing that panel will not close Roblox. F9 and executor output remain backups. Enter the code below within 10 minutes. Your main and alt accounts can use the same approved installation.','commerce-muted');
        const steps=element('ol',undefined,'commerce-activation-steps');
        for(const message of [
          'Use your saved newest personal loadstring. Only click Generate / replace if you lost it, because generating again revokes the old key.',
          'Run the command in-game. The BL Scripts activation panel should show the code. Click Copy Code, enter it below, and close only that panel. If it does not appear, press F9 > Client or check the executor output for “[BL Scripts] ACTIVATION CODE”.',
          'Copy the code into the box below, choose Approve installation, then run the SAME personal loadstring again.'
        ])steps.append(element('li',message));
        const noCode=element('p','No activation panel or code? Check the F9 Client log or your executor console. Some executors block custom UI or do not forward messages to F9. Avoid closing an external CMD window, since it may also close Roblox. If you see an error, contact Support with the error text only. Never post your personal license or activation code publicly.','commerce-muted');
        const form=element('form',undefined,'commerce-form');
        const codeLabel=element('label','Activation code (10 characters)');
        const codeInput=element('input');
        const codeId='zebraPair_'+sku;
        codeLabel.htmlFor=codeId;codeInput.id=codeId;
        codeInput.type='text';codeInput.maxLength=10;codeInput.minLength=10;codeInput.required=true;
        codeInput.placeholder='A1B2C3D4E5';codeInput.autocomplete='off';
        codeInput.spellcheck=false;codeInput.setAttribute('autocapitalize','characters');
        const pairButton=element('button','Approve installation ↗','btn primary');
        pairButton.type='submit';
        const pairFeedback=element('p',undefined,'account-status commerce-activation-feedback');pairFeedback.setAttribute('role','status');
        form.append(codeLabel,codeInput,pairButton);
        form.addEventListener('submit',async event=>{
          event.preventDefault();pairButton.disabled=true;
          pairFeedback.textContent='Verifying your paid account and installation code…';
          try{
            const code=codeInput.value.trim().toUpperCase();
            if(!/^[A-F0-9]{10}$/.test(code))throw new Error('Enter the 10-character code shown in your game console.');
            const result=await api('/api/approve-device/'+encodeURIComponent(sku),
              {method:'POST',body:JSON.stringify({code})});
            pairFeedback.textContent=result.message||'Approved! You can now run your newest personal command again, including through auto-execute.';
            codeInput.value='';
            await refreshQuota();
          }catch(error){pairFeedback.textContent='Approval failed: '+error.message;}
          finally{pairButton.disabled=false;}
        });
        pairing.append(heading,steps,pairHelp,form,noCode,pairFeedback);
        // Buyer-facing status only. Server never exposes raw IPs or fingerprints.
        const checkStatus=element('button','Check license security ↗','btn');
        checkStatus.type='button';
        const securityNote=element('p','','account-status');
        checkStatus.addEventListener('click',async()=>{
          checkStatus.disabled=true;
          securityNote.textContent='Checking your current license…';
          try{
            const details=await api('/api/license-status/'+encodeURIComponent(sku));
            const available=Math.max(0,details.max_keys_per_7_days-details.keys_issued_last_7_days);
            securityNote.textContent=(details.issued
              ?details.device_approval_enabled
                ?details.device_approved?'Active: installation approved. Your main and alt Roblox accounts can use the newest loadstring on this installation.':'Activation still pending. Run your newest personal loadstring in-game to see its in-game panel or F9 activation code, then approve it here.'
                :details.network_bound?'Active: one network locked to this license.':'Issued: first use will bind your network.'
              :'No personal license issued yet.')+
              ' Replacement keys available in the next seven-day window: '+available+'.'+
              (details.blocked_network_attempts>0?' Blocked other-network requests: '+details.blocked_network_attempts+'.':'')+
              (details.device_approval_enabled
                ?(details.blocked_unapproved_installations>0?' Blocked requests from other installations: '+details.blocked_unapproved_installations+'.':'')
                :!details.protection_enabled?' Network protection is not yet enabled.':'');
          }catch(err){securityNote.textContent='Could not retrieve license status: '+err.message;}
          finally{checkStatus.disabled=false;}
        });
        controls.append(view,generate,checkStatus);
        row.append(generationStatus,result,approvedStatus,pairing,securityNote);
      }
      row.prepend(info);
      const output=row.querySelector('.commerce-generation-status')||row.querySelector('.commerce-loader-card');
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