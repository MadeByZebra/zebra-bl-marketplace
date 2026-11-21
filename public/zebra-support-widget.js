import {getSupportReply,supportTopics} from '/support-knowledge.js';

// First-party Zebra Support: no tawk.to embed, badge, AI API or per-message cost.
// Replies are deterministic FAQs. Human help is reached via saved support tickets.
const supportEmail='zebrablshopofficial@gmail.com';
const launcher=document.createElement('button');
launcher.className='zebra-support-trigger';
launcher.type='button';
launcher.setAttribute('aria-label','Open Zebra Support');
launcher.setAttribute('aria-expanded','false');
launcher.setAttribute('aria-controls','zebra-support-panel');
launcher.innerHTML='<span class="zebra-support-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a7.9 7.9 0 0 1-8.3 8.1 8 8 0 0 1-3.4-.9L4 20l1.3-4.3a8 8 0 1 1 14.7-4.2Z"/><path d="M8.5 12h7"/></svg></span><span class="zebra-support-copy"><strong>ZEBRA SUPPORT</strong><span class="zebra-support-caption">HELP &amp; ORDERS</span></span><span class="zebra-support-light" aria-hidden="true"></span>';

const panel=document.createElement('section');
panel.id='zebra-support-panel';
panel.className='zebra-chat-panel';
panel.setAttribute('role','dialog');
panel.setAttribute('aria-label','Zebra Support');
panel.setAttribute('aria-modal','false');
panel.hidden=true;
panel.innerHTML=`
  <div class="zebra-chat-header">
    <div class="zebra-chat-monogram" aria-hidden="true">Z</div>
    <div class="zebra-chat-title"><strong>ZEBRA SUPPORT</strong><span>INSTANT HELP · PRIVATE TICKETS</span></div>
    <button type="button" class="zebra-chat-close" aria-label="Close support chat">&times;</button>
  </div>
  <div class="zebra-chat-banner"><span class="zebra-status-dot"></span> Free automated FAQ support <span class="zebra-chat-sep">/</span> No login needed</div>
  <div class="zebra-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
  <div class="zebra-chat-suggest" aria-label="Suggested support topics"></div>
  <div class="zebra-chat-bottom">
    <form class="zebra-chat-send"><label class="zebra-sr-only" for="zebra-chat-input">Your support question</label><input id="zebra-chat-input" type="text" maxlength="1200" placeholder="Ask about a purchase, account, or script…" autocomplete="off" required/><button type="submit" aria-label="Send question">↗</button></form>
    <div class="zebra-chat-footer"><a href="/support/">HELP CENTER</a><span>·</span><button type="button" class="zebra-contact-open">CONTACT SUPPORT ↗</button></div>
  </div>
  <div class="zebra-chat-ticket" hidden>
    <div class="zebra-chat-ticket-top"><button type="button" class="zebra-chat-back">← BACK</button><span>PRIVATE SUPPORT TICKET</span></div>
    <p>Describe your issue so the shop can follow up. Do not send card numbers, passwords, or sign-in codes.</p>
    <form class="zebra-chat-ticket-form">
      <label>YOUR EMAIL<input type="email" name="email" maxlength="254" autocomplete="email" placeholder="you@example.com" required></label>
      <label>TOPIC<select name="subject" required><option value="">Choose a topic</option><option>Purchase or receipt</option><option>Account sign-in</option><option>Software / compatibility</option><option>Refund request</option><option>Other</option></select></label>
      <label>WHAT HAPPENED?<textarea name="message" rows="4" minlength="15" maxlength="3000" placeholder="What happened? Include a product name and order reference if known." required></textarea></label>
      <label class="zebra-support-trap" aria-hidden="true" tabindex="-1">Website<input name="website" autocomplete="off" tabindex="-1"></label>
      <button type="submit" class="zebra-chat-submit">SEND SUPPORT REQUEST ↗</button>
    </form>
    <div class="zebra-chat-result" role="status"></div>
    <p class="zebra-chat-privacy">Requests are saved in the shop's private support inbox. Human replies are not instant. <a href="/privacy/">Privacy</a> · <a href="mailto:zebrablshopofficial@gmail.com">Email us</a></p>
  </div>
`;
document.body.appendChild(panel);
document.body.appendChild(launcher);
const msgList=panel.querySelector('.zebra-chat-messages');
const suggestions=panel.querySelector('.zebra-chat-suggest');
const chatInput=panel.querySelector('#zebra-chat-input');
const contactScreen=panel.querySelector('.zebra-chat-ticket');
const ticketResult=panel.querySelector('.zebra-chat-result');
let opened=false;
function openChat(){
  panel.hidden=false;launcher.classList.add('is-open');launcher.setAttribute('aria-expanded','true');
  opened=true;chatInput.focus();
}
function closeChat(){
  panel.hidden=true;launcher.classList.remove('is-open');launcher.setAttribute('aria-expanded','false');
  opened=false;launcher.focus();
}
function textElement(tag,cls,text){
  const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=text;return el;
}
function appendMessage(role,text,links=[]){
  const wrap=textElement('div','zebra-message zebra-message-'+role,'');
  wrap.append(textElement('div','zebra-message-label',role==='assistant'?'ZEBRA · AUTOMATED HELP':'YOU'));
  wrap.append(textElement('p','zebra-message-bubble',text));
  if(links.length){
    const line=textElement('div','zebra-message-links','');
    links.forEach(([name,href])=>{
      const a=textElement('a','',name+' ↗');a.href=href;
      if(href.startsWith('http')){a.target='_blank';a.rel='noopener noreferrer';}
      line.appendChild(a);
    });
    wrap.appendChild(line);
  }
  msgList.appendChild(wrap);msgList.scrollTop=msgList.scrollHeight;
}
function showTicket(){
  panel.querySelector('.zebra-chat-messages').hidden=true;
  panel.querySelector('.zebra-chat-suggest').hidden=true;
  panel.querySelector('.zebra-chat-bottom').hidden=true;
  contactScreen.hidden=false;
  contactScreen.querySelector('[name=email]').focus();
}
function showFAQ(){
  panel.querySelector('.zebra-chat-messages').hidden=false;
  panel.querySelector('.zebra-chat-suggest').hidden=false;
  panel.querySelector('.zebra-chat-bottom').hidden=false;
  contactScreen.hidden=true;chatInput.focus();
}
function replyTo(message){
  const text=String(message||'').trim();if(!text)return;
  appendMessage('visitor',text);
  const answer=getSupportReply(text);appendMessage('assistant',answer.answer,answer.links);
  suggestions.replaceChildren();
  const btn=textElement('button','zebra-chat-chip','NEED MORE HELP?');
  btn.type='button';btn.addEventListener('click',showTicket);suggestions.appendChild(btn);
}
launcher.addEventListener('click',()=>opened?closeChat():openChat());
panel.querySelector('.zebra-chat-close').addEventListener('click',closeChat);
panel.querySelector('.zebra-contact-open').addEventListener('click',showTicket);
panel.querySelector('.zebra-chat-back').addEventListener('click',showFAQ);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.preventDefault();closeChat();}});
panel.querySelector('.zebra-chat-send').addEventListener('submit',e=>{
  e.preventDefault();replyTo(chatInput.value);chatInput.value='';
});
appendMessage('assistant',"Welcome to Zebra's Shop. I'm an automated FAQ assistant, not a person or generative AI. I can help with orders, receipts, login, script compatibility and refunds. If you still need help, send a private support ticket.",[['Help Center','/support/']]);
for(const topic of supportTopics.slice(0,6)){
  const btn=textElement('button','zebra-chat-chip',topic.label);
  btn.type='button';btn.addEventListener('click',()=>replyTo(topic.label));suggestions.appendChild(btn);
}
panel.querySelector('.zebra-chat-ticket-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const form=e.currentTarget,button=form.querySelector('[type=submit]');
  const data=Object.fromEntries(new FormData(form));
  button.disabled=true;button.textContent='SENDING…';ticketResult.textContent='';
  try{
    const response=await fetch('/api/support/tickets',{
      method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
      body:JSON.stringify({email:data.email,subject:data.subject,message:data.message,website:data.website})
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Unable to send this request.');
    ticketResult.textContent='Request saved. Reference: '+result.ticket+'. Keep this reference. Our team will review the message; immediate replies are not guaranteed.';
    form.reset();
  }catch(err){
    ticketResult.textContent=String(err?.message||'Unable to submit a request.')+' You can also email '+supportEmail+'.';
  }finally{button.disabled=false;button.textContent='SEND SUPPORT REQUEST ↗';}
});
