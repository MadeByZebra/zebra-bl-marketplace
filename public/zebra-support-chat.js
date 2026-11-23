/* Zebra's Shop first-party support widget. No third-party chat iframe or attribution. */
(()=>{
  'use strict';
  if(document.getElementById('zebra-chat-launcher'))return;
  // Stripe returns to /account with a verification code. Don't mount any
  // floating support UI while purchases and receipts are being confirmed.
  const checkoutReturn=/^\/account(?:\/|$)/.test(location.pathname)
    &&/^(success|cancel)$/.test(new URLSearchParams(location.search).get('checkout')||'');
  if(checkoutReturn)document.documentElement.classList.add('zebra-payment-return');
  const STORE_KEY='zebra_shop_support_chat_v1';
  const supportUrl='/support/#contact';
  let session=null,opened=false,busy=false,tick=null,seenCount=0,panelMotion=null;
  let renderedSignatures=[];
  const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  try{const v=JSON.parse(localStorage.getItem(STORE_KEY)||'null');if(v&&/^[a-f0-9-]{36}$/.test(v.id)&&/^[a-f0-9]{64}$/.test(v.token))session=v;}catch(_e){}
  const el=(tag,className,text)=>{
    const v=document.createElement(tag);if(className)v.className=className;
    if(text!==undefined)v.textContent=String(text);return v;
  };
  const launcher=el('button','zebra-support-trigger');
  launcher.type='button';launcher.id='zebra-chat-launcher';
  launcher.setAttribute('aria-expanded','false');
  launcher.setAttribute('aria-controls','zebra-owned-chat');
  launcher.setAttribute('aria-label','Open Zebra Support chat');
  const icon=el('span','zebra-support-icon','Z');
  const copy=el('span','zebra-support-copy');
  copy.append(el('strong','', 'ZEBRA SUPPORT'),el('span','zebra-support-caption','CHAT WITH US'));
  launcher.append(icon,copy,el('span','zebra-support-light'));
  const emailLink=el('a','zebra-support-email');
  emailLink.href=supportUrl;emailLink.title='Send Zebra Support an email request';
  emailLink.setAttribute('aria-label','Email Zebra Support');
  emailLink.append(el('span','zebra-mail-symbol','✉'),el('span','', 'EMAIL SUPPORT'));

  const panel=el('section','zebra-owned-chat');
  panel.id='zebra-owned-chat';panel.hidden=true;panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','Zebra Support chat');
  const header=el('header','zebra-owned-chat-header');
  const headBrand=el('div','zebra-owned-chat-brand');
  headBrand.append(el('span','zebra-owned-chat-mark','Z'));
  const names=el('div','zebra-owned-chat-names');
  names.append(el('strong','', 'Zebra Support'),el('span','','AUTOMATED HELP  •  HUMAN HANDOFF'));
  headBrand.append(names);
  const close=el('button','zebra-owned-icon-button','×');
  close.type='button';close.title='Close chat';close.setAttribute('aria-label','Close chat');
  header.append(headBrand,close);
  const feed=el('div','zebra-owned-chat-feed');
  feed.setAttribute('role','log');feed.setAttribute('aria-live','polite');
  feed.setAttribute('aria-relevant','additions');
  const state=el('div','zebra-owned-chat-state','Connecting to Zebra Support…');
  const form=el('form','zebra-owned-chat-compose');
  const input=el('textarea','zebra-owned-chat-input');
  input.rows=1;input.maxLength=1200;input.placeholder='Ask about a product or purchase…';
  input.setAttribute('aria-label','Type your support message');
  const send=el('button','zebra-owned-send','➤');
  send.type='submit';send.title='Send message';send.setAttribute('aria-label','Send message');
  form.append(input,send);
  const tools=el('div','zebra-owned-chat-actions');
  const human=el('button','zebra-owned-link','Request a human');
  human.type='button';
  const mail=el('a','zebra-owned-link','Email support');
  mail.href=supportUrl;
  const newChat=el('button','zebra-owned-link','New chat');newChat.type='button';
  tools.append(human,mail,newChat);
  panel.append(header,feed,state,form,tools);
  const showState=(v,isError=false)=>{state.textContent=v;state.classList.toggle('is-error',isError);state.classList.toggle('is-pending',!isError&&/connecting|sending|loading|checking/i.test(v));};
  async function api(url,options={}){
    const headers={'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{})};
    if(session)headers['X-Zebra-Chat-Token']=session.token;
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{...headers,...options.headers}});
    let data={};try{data=await response.json();}catch(_e){}
    if(!response.ok)throw new Error(data.error||'Support temporarily unavailable.');
    return data;
  }
  const withLinks=(node,text)=>{
    const rx=/https:\/\/zebra-bl-marketplace\.onrender\.com\/[^\s<>"]+/g;
    let i=0,m;
    while((m=rx.exec(text))!==null){
      if(m.index>i)node.append(document.createTextNode(text.slice(i,m.index)));
      const link=el('a','zebra-owned-inline-url',m[0]);
      link.href=m[0];link.target='_blank';link.rel='noopener noreferrer';
      node.append(link);i=m.index+m[0].length;
    }
    if(i<text.length)node.append(document.createTextNode(text.slice(i)));
  };
  // Polling must not destroy and recreate messages every five seconds:
  // that reset keyboard links, scroll position, and any entrance animation.
  function render(messages,status){
    const list=Array.isArray(messages)?messages:[];
    const signatures=list.map(msg=>JSON.stringify([
      msg.id??null,msg.sender??null,msg.created_at??null,msg.text??''
    ]));
    const incremental=signatures.length>=renderedSignatures.length
      &&renderedSignatures.every((sig,index)=>signatures[index]===sig);
    const nearEnd=feed.scrollHeight-feed.scrollTop-feed.clientHeight<90;
    if(!incremental)feed.replaceChildren();
    const begin=incremental?renderedSignatures.length:0;
    for(let i=begin;i<list.length;i++){
      const msg=list[i];
      const item=el('article','zebra-owned-bubble '+(msg.sender==='visitor'?'from-visitor':msg.sender==='human'?'from-owner':msg.sender==='system'?'from-system':'from-assistant'));
      const who=msg.sender==='visitor'?'You':msg.sender==='human'?'Zebra (human)':msg.sender==='system'?'System':'Zebra Assistant';
      item.append(el('div','zebra-owned-bubble-label',who));
      const txt=el('div','zebra-owned-bubble-text');withLinks(txt,String(msg.text||''));item.append(txt);
      if(!reducedMotion()&&i>=list.length-4)item.classList.add('is-new');
      feed.append(item);
    }
    if(nearEnd||seenCount===0)feed.scrollTop=feed.scrollHeight;
    renderedSignatures=signatures;
    seenCount=list.length;
    if(status==='human'){showState('A human team member has joined this chat.');human.disabled=true;}
    else if(status==='waiting'){showState('Human assistance requested • We will notify the owner.');human.disabled=true;}
    else if(status==='closed'){showState('Conversation closed. You can start a new chat.');input.disabled=true;send.disabled=true;human.disabled=true;}
    else {showState('Automated FAQ replies • For account-specific issues, request a human.');input.disabled=false;send.disabled=false;human.disabled=false;}
  }
  async function load(){
    if(!session)return;
    try{
      const data=await api('/api/zebra-chat/'+encodeURIComponent(session.id));
      render(data.messages||[],data.status);
    }catch(e){
      if(/not found|denied/i.test(e.message)){session=null;try{localStorage.removeItem(STORE_KEY);}catch(_e){}}
      showState(e.message+' Email support is always available.',true);
    }
  }
  async function start(){
    const data=await api('/api/zebra-chat/start',{method:'POST',body:'{}'});
    session={id:data.id,token:data.token};
    try{localStorage.setItem(STORE_KEY,JSON.stringify(session));}catch(_e){}
    render(data.messages||[],data.status);
  }
  async function ensureSession(){
    if(session){await load();if(session)return;}
    await start();
  }
  function animatePanel(entering){
    if(panelMotion){panelMotion.cancel();panelMotion=null;}
    panel.classList.toggle('is-closing',!entering);
    if(reducedMotion()||typeof panel.animate!=='function'){
      if(!entering)panel.hidden=true;
      return;
    }
    const frames=entering
      ?[{opacity:0,transform:'translateY(20px) scale(.965)'},{opacity:1,transform:'translateY(0) scale(1)'}]
      :[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(13px) scale(.98)'}];
    const animation=panel.animate(frames,{
      duration:entering?310:185,easing:entering?'cubic-bezier(.22,1,.36,1)':'ease-in',fill:'forwards'
    });
    panelMotion=animation;
    animation.onfinish=()=>{
      if(panelMotion!==animation)return;
      panelMotion=null;
      if(!entering&&!opened){panel.hidden=true;panel.classList.remove('is-closing');}
      // Remove WAAPI fill after the final frame: prevent accumulating
      // animations when a visitor opens and closes chat repeatedly.
      animation.cancel();
    };
  }
  async function open(){
    if(opened)return;
    opened=true;panel.hidden=false;animatePanel(true);
    launcher.classList.add('is-open');
    launcher.setAttribute('aria-expanded','true');
    document.documentElement.classList.add('zebra-chat-scroll-locked');
    showState('Connecting to Zebra Support…');
    try{await ensureSession();}catch(e){showState(e.message+' You can use Email support.',true);}
    if(!opened)return;
    if(tick)clearInterval(tick);
    tick=setInterval(()=>{if(opened&&session&&!busy)load();},5000);
    input.focus();
  }
  function hide(restoreFocus=true){
    if(!opened)return;
    opened=false;animatePanel(false);
    launcher.classList.remove('is-open');
    launcher.setAttribute('aria-expanded','false');
    document.documentElement.classList.remove('zebra-chat-scroll-locked');
    if(tick)clearInterval(tick);tick=null;if(restoreFocus)launcher.focus();
  }
  launcher.addEventListener('click',()=>opened?hide():open());
  close.addEventListener('click',hide);
  document.addEventListener('keydown',event=>{if(opened&&event.key==='Escape')hide();});
  document.addEventListener('pointerdown',event=>{
    if(opened&&event.target&&!panel.contains(event.target)&&!launcher.contains(event.target))hide(false);
  });
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit();}
  });
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();const value=input.value.trim();
    if(!value||busy)return;
    busy=true;send.disabled=true;showState('Sending securely…');
    try{
      if(!session)await start();
      await api('/api/zebra-chat/'+encodeURIComponent(session.id)+'/message',{
        method:'POST',body:JSON.stringify({message:value})
      });
      input.value='';await load();
    }catch(e){showState(e.message,true);}
    finally{busy=false;send.disabled=false;}
  });
  human.addEventListener('click',async()=>{
    if(busy)return;busy=true;human.disabled=true;
    try{
      if(!session)await start();
      await api('/api/zebra-chat/'+encodeURIComponent(session.id)+'/human',{method:'POST',body:'{}'});
      await load();
    }catch(e){showState(e.message,true);human.disabled=false;}
    finally{busy=false;}
  });
  newChat.addEventListener('click',async()=>{
    if(busy)return;
    session=null;seenCount=0;renderedSignatures=[];feed.replaceChildren();
    try{localStorage.removeItem(STORE_KEY);}catch(_e){}
    input.disabled=false;send.disabled=false;human.disabled=false;
    try{await start();}catch(e){showState(e.message,true);}
  });
  document.addEventListener('click',event=>{
    const a=event.target instanceof Element?event.target.closest('a[data-zebra-email-support]'):null;
    if(a&&!a.hasAttribute('data-zebra-email-client'))a.href=supportUrl;
  },true);
  function mount(){
    if(checkoutReturn)return;
    document.body.append(launcher,emailLink,panel);
    // Product/payment dialogs are top-level interactive controls. Suspend an
    // already-open support panel so it cannot lock scrolling or steal focus.
    const observer=new MutationObserver(()=>{
      if(opened&&document.querySelector('dialog[open]'))hide(false);
    });
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
  window.addEventListener('pagehide',()=>{if(tick)clearInterval(tick);});
  window.addEventListener('pageshow',()=>{if(!opened)document.documentElement.classList.remove('zebra-chat-scroll-locked');});
})();
