const $=sel=>document.querySelector(sel);
const $$=sel=>[...document.querySelectorAll(sel)];
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>c==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
let state={catalog:{products:[],bundles:[]},checkout_ready:false,mode:'unconfigured',user:null,owned:[],filter:'All',query:'',authMode:'login',pendingProduct:null};
let toastTimer;
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),4700);}
async function api(url,options={}){
 const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
 let data={};try{data=await r.json();}catch{}if(!r.ok)throw Error(data.error||`Server returned ${r.status}`);return data;
}
const allItems=()=>[...state.catalog.products,...state.catalog.bundles,...(state.catalog.extras||[])];
const findItem=id=>allItems().find(p=>p.id===id);

function productCard(p){const featured=p.featured,unavailable=p.unavailable;
 const features=(p.features||[]).slice(0,featured?3:2).map(f=>`<li>${escapeHtml(f)}</li>`).join('');
 return `<article class="product-card ${featured?'featured':''}" data-sku="${escapeHtml(p.id)}">
  <div class="product-copy"><div class="product-head"><span class="micro-label">${escapeHtml(p.category.toUpperCase())} / ${escapeHtml(p.platform.toUpperCase())}</span><span class="product-badge ${unavailable?'review':''}">${escapeHtml(p.label)}</span></div>
  <h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p><ul class="product-highlights">${features}</ul>
  <div class="product-footer"><div class="price-block"><strong>${unavailable?'ON HOLD':money(p.price)}</strong><span>${unavailable?'SOURCE REVIEW':'ONE-TIME'}</span></div><div class="product-actions"><button class="outline-button" data-view="${escapeHtml(p.id)}">Details ↗</button>${unavailable?'':`<button class="buy-button" data-buy="${escapeHtml(p.id)}">Buy ↗</button>`}</div></div></div>
  ${featured?'<div class="featured-art" aria-hidden="true"><div class="featured-ui-title"><span>BL / CONTROL CENTER</span><span>V7.5</span></div><div class="featured-ui-body"><div class="featured-ui-kicker">YOUR WORKSPACE / AT A GLANCE</div><div class="featured-ui-head">Control your toolkit.</div><div class="featured-ui-metrics"><div><small>WORKSPACE</small><b>Ready</b></div><div><small>MODULES</small><b>Custom</b></div></div><div class="featured-ui-list"><span>Profile management <i>Available</i></span><span>Session utilities <i>Configurable</i></span><span>Interface settings <i>Built in</i></span></div></div><div class="featured-art-note"><span>CONCEPT INTERFACE</span><span>BY ZEBRA ©</span></div></div>':''}
 </article>`;
}
function renderProducts(){const p=state.catalog.products.filter(p=>{
 const matchesCategory=state.filter==='All'||p.category===state.filter;
 const text=`${p.title} ${p.description} ${p.platform} ${(p.features||[]).join(' ')}`.toLowerCase();return matchesCategory&&text.includes(state.query.toLowerCase());
 });$('#productGrid').innerHTML=p.length?p.map(productCard).join(''):`<div class="empty-state" style="grid-column:1/-1"><strong>No matching tools.</strong><p>Try another search or filter.</p></div>`;animateCards('#productGrid .product-card');}
function renderBundles(){$('#bundleGrid').innerHTML=state.catalog.bundles.map(b=>`<article class="bundle-card ${b.featured?'best':''}"><div class="bundle-tag"><span>BUNDLE / ${escapeHtml(b.items.length)}+ TOOLS</span><span>${escapeHtml(b.label)}</span></div><h3>${escapeHtml(b.title)}</h3><p>${escapeHtml(b.description)}</p><div class="bundle-price">${money(b.price)}</div><button class="bundle-action" data-view="${escapeHtml(b.id)}"><span>View bundle & purchase</span><span>↗</span></button></article>`).join('');animateCards('#bundleGrid .bundle-card');}
function openDialog(el){if(el?.open)return;el?.showModal();}
function closeDialogs(){ $$('dialog[open]').forEach(d=>d.close());}
function videoMarkup(p){const u=p.video;if(u){try{const url=new URL(u);if((url.hostname==='www.youtube-nocookie.com'&&url.pathname.startsWith('/embed/'))||(url.hostname==='player.vimeo.com'&&url.pathname.startsWith('/video/'))){return `<iframe title="${escapeHtml(p.title)} showcase" src="${escapeHtml(url.toString())}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;}}catch{}}
 return `<strong>VIDEO SHOWCASE PENDING</strong><span>Gameplay footage will be added once supplied.</span>`;}
function viewProduct(id){const p=findItem(id);if(!p)return;
 const featureList=(p.features||[]).map(f=>`<div class="feature-row">${escapeHtml(f)}</div>`).join('');
 const owns=state.owned.includes(id);
 const buyLabel=p.unavailable?'NOT FOR SALE':owns?'ALREADY IN YOUR LIBRARY':'PURCHASE SECURELY ↗';
 $('#productDialogBody').innerHTML=`<div class="dialog-product-top"><span>ZEBRA / BL SCRIPTS / ${escapeHtml(p.category.toUpperCase())}</span><span>${escapeHtml(p.label)} · ${escapeHtml(p.platform)}</span></div><h2 class="dialog-product-title">${escapeHtml(p.title)}</h2><p class="dialog-product-desc">${escapeHtml(p.description)}</p><div class="dialog-detail-grid"><div><h4>FEATURES / WHAT'S INCLUDED</h4>${featureList}</div><div><h4>HOW THE TOOL WORKS</h4><p class="dialog-product-desc">${escapeHtml(p.details)}</p><h4>DELIVERY & COMPATIBILITY</h4><p class="dialog-product-desc">${p.kind==='download'?'The updated ZFLAG installer is downloaded from a server-verified account library after payment.':p.kind==='test'?'This is a Stripe test-mode verification purchase with no files included.':'After verified payment, generate a personalized, license-keyed loadstring. Raw source is not sold; game compatibility is not guaranteed.'}</p></div></div><div class="detail-video">${videoMarkup(p)}</div><div class="dialog-buy"><div><strong>${p.unavailable?'ON HOLD':money(p.price)}</strong><div class="micro-label" style="margin-top:5px">${p.unavailable?'SOURCE REVIEW REQUIRED':'ONE-TIME PURCHASE / USD'}</div></div><div>
 <label class="discount-label" for="discountCode">DISCOUNT CODE (OPTIONAL)</label>
 <div class="discount-row"><input id="discountCode" type="text" maxlength="32" placeholder="Enter promo code" autocomplete="off" spellcheck="false"/><button type="button" class="outline-button" id="applyDiscount">Apply</button></div>
 <p class="discount-feedback" id="discountFeedback" aria-live="polite">Discounts are applied before Stripe Checkout.</p>
 <label><input id="agreeTerms" type="checkbox"/> I agree to the <a href="#" data-policy-inline="terms"><u>terms, compatibility and refund policy</u></a>.</label>
 <button style="margin-top:12px" class="primary-button" id="purchaseNow" ${p.unavailable?'disabled':''}>${buyLabel}</button></div></div>`;
 openDialog($('#productDialog'));
 const promoField=$('#discountCode'),promoFeedback=$('#discountFeedback');
 if(state.pendingDiscount){promoField.value=state.pendingDiscount;state.pendingDiscount='';}
 promoField?.addEventListener('input',()=>{promoFeedback.textContent='Apply to preview your discounted total.';});
 $('#applyDiscount')?.addEventListener('click',async()=>{
  const button=$('#applyDiscount');button.disabled=true;
  try{
   const q=await api('/api/discount/quote?sku='+encodeURIComponent(p.id)+'&code='+encodeURIComponent(promoField.value.trim()));
   promoFeedback.textContent=q.saved>0?q.code+' applied — '+money(q.total)+' (you save '+money(q.saved)+').':'Regular price: '+money(q.total);
  }catch(e){promoFeedback.textContent=e.message;}finally{button.disabled=false;}
 });
 $('#purchaseNow')?.addEventListener('click',()=>{
  if(owns&&!p.items){closeDialogs();openLibrary();return;}
  if(!$('#agreeTerms').checked){toast('Please review and accept the store terms first.');return;}
  purchase(p.id);
 });
}
async function purchase(id){const p=findItem(id);if(!p||p.unavailable)return;
 const discountCode=String($('#discountCode')?.value||'').trim().toUpperCase();
 if(!state.checkout_ready){toast('Checkout is not configured. No payment was taken.');return;}
 if(!state.user){state.pendingProduct=id;state.pendingDiscount=discountCode;closeDialogs();openAuth();toast('Sign in by email to purchase.');return;}
 const b=$('#purchaseNow');if(b){b.disabled=true;b.textContent='VERIFYING TOTAL...';}
 try{
  const quote=await api('/api/discount/quote?sku='+encodeURIComponent(id)+'&code='+encodeURIComponent(discountCode));
  if(quote.saved>0)$('#discountFeedback').textContent=quote.code+' applied · Total: '+money(quote.total);
  const {url}=await api('/api/checkout',{method:'POST',body:JSON.stringify({sku:id,accepted_terms:true,discount_code:discountCode})});
  window.location.assign(url);
 }catch(e){toast(e.message);if(b){b.disabled=false;b.textContent='PURCHASE SECURELY ↗';}}
}
function openAuth(){state.authStep='email';$('#authError').textContent='';$('#email').disabled=false;$('#email').hidden=false;$('#emailCode').hidden=true;$('#emailCodeLabel').hidden=true;$('#requestAgain').hidden=true;$('#authSubmit').textContent='Send sign-in code ↗';openDialog($('#authDialog'));}
function renderAccount(){$('#accountBtn').textContent=state.user?'My account':'Sign in';}
async function refreshOwned(){if(!state.user){state.owned=[];return;}
 try{const d=await api('/api/library');state.owned=d.owned||[];}catch(e){if(/Sign in/.test(e.message))state.user=null;state.owned=[];}}
async function openLibrary(){if(!state.user){openAuth('login');return;}
 await refreshOwned();const items=state.owned.map(findItem).filter(Boolean);
 $('#libraryContents').innerHTML=`<div style="border-bottom:1px solid var(--line);padding:18px 0;color:var(--muted);font:10px var(--mono)">${escapeHtml(state.user.email)} · ${items.length} OWNED PRODUCTS</div>${items.length?items.map(p=>`<div class="library-row"><div><strong>${escapeHtml(p.title)}</strong><small>${p.kind==='download'?'PROTECTED INSTALLER / VERIFIED PURCHASE':p.kind==='test'?'TEST PAYMENT CONFIRMED':'LICENSED LOADSTRING / ACCOUNT VERIFIED'}</small></div>${p.kind==='download'?'<a class="outline-button" href="/api/injector/download">Download ZFLAG ↗</a>':p.kind==='test'?'<span class="micro-label">TEST PASSED</span>':`<button data-license="${escapeHtml(p.id)}">Generate loader ↗</button>`}</div>`).join(''):`<div class="empty-state"><strong>Your library is empty.</strong><p>Purchased products appear here once Stripe verifies payment.</p><button class="outline-button" data-close-dialog>Explore store ↗</button></div>`}<button class="outline-button" id="signOut" style="margin-top:22px">Sign out</button>`;
 closeDialogs();openDialog($('#libraryDialog'));
}
async function generateLicense(sku){
 const p=findItem(sku);if(!p)return;
 const button=document.querySelector(`[data-license="${CSS.escape(sku)}"]`);
 if(button){button.disabled=true;button.textContent='GENERATING...';}
 try{
  const response=await api(`/api/license/${encodeURIComponent(sku)}`,{method:'POST',body:'{}'});
  const tokenBlock=document.createElement('div');tokenBlock.className='license-output';
  tokenBlock.innerHTML=`<div class="micro-label">PRIVATE LOADER FOR ${escapeHtml(p.title.toUpperCase())}</div><p>Copy this command. It includes your personal license key, so keep it private. Creating another command disables your previous key.</p><textarea readonly aria-label="Your licensed loadstring" spellcheck="false"></textarea><button class="outline-button" type="button">Copy loadstring ↗</button>`;
  tokenBlock.querySelector('textarea').value=response.loadstring;
  tokenBlock.querySelector('button').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(response.loadstring);toast('Licensed loadstring copied. Keep it private.');}catch{tokenBlock.querySelector('textarea').select();toast('Select and copy your loadstring.');}});
  button?.parentElement?.parentElement?.after(tokenBlock);button.textContent='Rotate license ↗';
  toast('License issued. Previous loader revoked.');
 }catch(err){toast(err.message);}finally{if(button){button.disabled=false;if(button.textContent==='GENERATING...')button.textContent='Generate loader ↗';}}
}
function policyMarkup(kind){const support=state.support_email?`Contact <strong>${escapeHtml(state.support_email)}</strong> for support or requests.`:'Seller support contact must be configured before checkout opens.';
 if(kind==='privacy')return `<span class="eyebrow">STORE / PRIVACY</span><h2>PRIVACY POLICY</h2><p>Accounts store your email address, a salted password hash, signed-in session identifiers, and purchase records so digital purchases can be delivered. Card details are entered on Stripe's hosted checkout and are not collected by this website.</p><p>Payment status is checked with Stripe before issuing or using licensed loadstrings. Sessions use HttpOnly cookies. Server logs may include ordinary operational metadata such as request timestamps and IP addresses.</p><p>Do not submit other personal information in support requests. You can ask the seller about access or data deletion. ${support}</p>`;
 return `<span class="eyebrow">STORE / TERMS</span><h2>PURCHASE TERMS & REFUNDS</h2><p><strong>Digital goods.</strong> Purchases provide access to the specifically listed license-keyed executable tool(s) for personal use. Raw source is not sold. Redistribution, resale and unauthorized sharing are not permitted. Buying a bundle includes only the items explicitly listed at checkout.</p><p><strong>Compatibility.</strong> Software is sold as described, without a guarantee of perpetual functionality or performance gains. Class A STR / END support is current; Class B / C is a future intention, not included. Third-party game changes can break scripts. The store is independent and not affiliated with or endorsed by Roblox or Boxing League; usage may violate third-party rules and carries an account risk.</p><p><strong>Refund requests.</strong> Contact the seller if a file is missing, faulty, or substantially not as described. Requests will be reviewed and refunds provided where required by applicable law; access may be revoked on refunds or disputes. Do not assume all digital purchases are categorically non-refundable.</p><p><strong>Support.</strong> ${support}</p>`;}
function showPolicy(kind){$('#policyBody').innerHTML=policyMarkup(kind);openDialog($('#policyDialog'));}

// Design fidelity: reveal-on-scroll, ZFLAG's easing, and stage interactions.
let motionObserver;
function setupMotion(){
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduced||!('IntersectionObserver' in window)){$$('.reveal').forEach(el=>el.classList.add('in'));return;}
 document.body.classList.add('motion-ready');
 motionObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('in');motionObserver.unobserve(entry.target);}}
 },{threshold:.09,rootMargin:'0px 0px -28px 0px'});
 $$('.reveal').forEach(el=>motionObserver.observe(el));
}
function animateCards(selector){
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 $$(selector).forEach((el,i)=>{el.classList.add('entry');el.style.setProperty('--enter-delay',`${Math.min(i,8)*55}ms`);
  el.addEventListener('animationend',()=>{el.classList.remove('entry');el.style.removeProperty('--enter-delay')},{once:true});
 });
}
const previewModes={
 modules:[['⌘','Control modules','Tools and profiles in one place','Available'],['◎','Class A training','STR and END compatibility','Class A'],['◇','DEX utility','Desktop + mobile editions','2 editions']],
 library:[['↗','Your scripts','Your paid purchases in one place','Private'],['✓','Verified access','Server-side purchase verification','Protected'],['□','Licensed loader','Copy after payment confirmation','Protected']],
 settings:[['◐','Appearance','Understated dark and light themes','2 themes'],['☷','Product details','Features, compatibility, and pricing','Clear'],['⌕','Search and filter','Explore by category or keyword','Instant']]
};
function updatePreview(mode){
 const list=previewModes[mode];if(!list)return;
 $$('#product-stage [data-preview-tab]').forEach(b=>{const on=b.dataset.previewTab===mode;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));});
 $('#previewRows').innerHTML=list.map(([icon,title,desc,pill])=>`<div class="preview-row"><div class="preview-row-symbol">${icon}</div><div class="preview-row-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(desc)}</span></div><span class="preview-row-pill">${escapeHtml(pill)}</span></div>`).join('');
}
function setupDesignInteractions(){
 setupMotion();
 $$('#product-stage [data-preview-tab]').forEach(b=>b.addEventListener('click',()=>updatePreview(b.dataset.previewTab)));
 const showcase={control:['BL CONTROL CENTER / WALKTHROUGH','Gameplay preview coming soon'],classa:['STR + END / CLASS A TRAINING','Class A demonstration coming soon'],dex:['DEX GRINDER / DESKTOP + MOBILE','DEX showcase coming soon']};
 $$('[data-showcase]').forEach(b=>b.addEventListener('click',()=>{
  $$('[data-showcase]').forEach(x=>x.classList.toggle('active',x===b));
  const [name,title]=showcase[b.dataset.showcase]||showcase.control;
  $('#showcaseVideoTitle').textContent=name;$('#showcaseHeading').textContent=title;
 }));
 const stage=$('#tiltWindow');
 if(stage&&window.matchMedia('(pointer:fine) and (min-width:981px)').matches&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  stage.addEventListener('pointermove',e=>{
   const rect=stage.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width-.5,y=(e.clientY-rect.top)/rect.height-.5;
   stage.style.transform=`rotateY(${-3+x*5}deg) rotateX(${1.5-y*4}deg) translateZ(0)`;
  });
  stage.addEventListener('pointerleave',()=>stage.style.transform='rotateY(-3deg) rotateX(1.5deg) translateZ(0)');
 }
 const header=$('.site-header');const links=$$('.nav-links a');
 const navUpdate=()=>{header?.classList.toggle('is-scrolled',window.scrollY>34);
  const ids=['store','bundles','preview','how','faq'];let active='';
  for(const id of ids){const n=document.getElementById(id);if(n?.getBoundingClientRect().top<innerHeight*.38)active=id;}
  links.forEach(a=>a.classList.toggle('is-active',a.getAttribute('href')===`#${active}`));
 };
 addEventListener('scroll',navUpdate,{passive:true});navUpdate();
}

function wire(){
 $('#themeBtn').addEventListener('click',()=>{const theme=document.body.dataset.theme==='dark'?'light':'dark';document.body.dataset.theme=theme;document.documentElement.dataset.theme=theme;try{localStorage.setItem('bl-theme',theme);localStorage.setItem('zebra-shop-theme',theme);}catch{}});
 $('#mobileMenuBtn').addEventListener('click',()=>{const open=$('#mobileNav').classList.toggle('show');$('#mobileMenuBtn').setAttribute('aria-expanded',String(open));$('#mobileMenuBtn').setAttribute('aria-label',open?'Close navigation':'Open navigation');});
 $$('#mobileNav a').forEach(a=>a.addEventListener('click',()=>{$('#mobileNav').classList.remove('show');$('#mobileMenuBtn').setAttribute('aria-expanded','false');}));
 $('#searchInput').addEventListener('input',e=>{state.query=e.target.value;renderProducts();});
 $$('.filter').forEach(f=>f.addEventListener('click',()=>{state.filter=f.dataset.filter;$$('.filter').forEach(x=>x.classList.toggle('active',x===f));renderProducts();}));
 $('#accountBtn').addEventListener('click',()=>state.user?openLibrary():openAuth('login'));
 $('#libraryBtn').addEventListener('click',openLibrary);
 $$('#footerTerms,#footerPrivacy').forEach(b=>b.addEventListener('click',()=>showPolicy(b.id==='footerTerms'?'terms':'privacy')));
  $('#authForm').addEventListener('submit',async e=>{e.preventDefault();const email=$('#email').value.trim(),submit=$('#authSubmit');submit.disabled=true;$('#authError').textContent='';
  try{
   if(state.authStep==='email'){
    await api('/api/auth/request-code',{method:'POST',body:JSON.stringify({email})});
    state.authStep='code';$('#email').disabled=true;$('#emailCodeLabel').hidden=false;$('#emailCode').hidden=false;$('#emailCode').required=true;$('#emailCode').focus();$('#requestAgain').hidden=false;submit.textContent='Verify code & sign in ↗';toast('Check your email for your six-digit code.');
   }else{
    const d=await api('/api/auth/verify-code',{method:'POST',body:JSON.stringify({email,code:$('#emailCode').value.trim()})});state.user=d.user;renderAccount();closeDialogs();toast('Email verified. Signed in.');await refreshOwned();const pending=state.pendingProduct;state.pendingProduct=null;if(pending)viewProduct(pending);
   }
  }catch(err){$('#authError').textContent=err.message;}finally{submit.disabled=false;}});
 $('#requestAgain').addEventListener('click',()=>{state.authStep='email';$('#email').disabled=false;$('#emailCodeLabel').hidden=true;$('#emailCode').hidden=true;$('#emailCode').required=false;$('#emailCode').value='';$('#requestAgain').hidden=true;$('#authSubmit').textContent='Send a new code ↗';});
 document.addEventListener('click',async e=>{
  const close=e.target.closest('[data-close-dialog]');if(close){closeDialogs();if(close.closest('.empty-state'))location.hash='#store';return;}
  const view=e.target.closest('[data-view]');if(view){viewProduct(view.dataset.view);return;}
  const buy=e.target.closest('[data-buy]');if(buy){viewProduct(buy.dataset.buy);return;}
  const licenseButton=e.target.closest('[data-license]');if(licenseButton){await generateLicense(licenseButton.dataset.license);return;}
  const inline=e.target.closest('[data-policy-inline]');if(inline){e.preventDefault();showPolicy(inline.dataset.policyInline);return;}
  if(e.target.id==='signOut'){try{await api('/api/logout',{method:'POST',body:'{}'});state.user=null;state.owned=[];renderAccount();closeDialogs();toast('Signed out.');}catch(err){toast(err.message);}}
 });
 $$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
}
async function startup(){try{const saved=localStorage.getItem('zebra-shop-theme')||localStorage.getItem('bl-theme');if(saved==='light'||saved==='dark'){document.body.dataset.theme=saved;document.documentElement.dataset.theme=saved;}}catch{}
 $('#year').textContent=String(new Date().getFullYear());wire();setupDesignInteractions();
 try{const [store,me]=await Promise.all([api('/api/store'),api('/api/me')]);state={...state,...store,user:me.user};renderProducts();renderBundles();renderAccount();
  $('#paymentStatus').textContent=store.checkout_ready?(store.mode==='test'?'STRIPE TEST CHECKOUT READY':'STRIPE CHECKOUT READY'):'CHECKOUT SETUP PENDING';
  if(store.test_checkout_ready){const btn=document.querySelector('#testCheckoutBtn');if(btn)btn.hidden=false;}if(!store.checkout_ready)toast('Store preview is live. Payments are disabled until configured.');
  await refreshOwned();const url=new URL(window.location.href);
  // ZFLAG's standalone site can link directly to its protected product panel.
  const linkedProduct=url.searchParams.get('product');
  if(linkedProduct && /^[a-z0-9-]{2,60}$/.test(linkedProduct) && findItem(linkedProduct)){
    viewProduct(linkedProduct);
    url.searchParams.delete('product');
    history.replaceState({},'',url.pathname+(url.search||'')+url.hash);
  }
  if(url.searchParams.get('checkout')==='success'&&url.searchParams.get('session_id')){
   if(state.user){try{const r=await api('/api/confirm',{method:'POST',body:JSON.stringify({session_id:url.searchParams.get('session_id')})});toast(r.paid?'Payment verified. Access is in My Library.':'Payment is pending verification. Check your library shortly.');if(r.paid)openLibrary();}catch(e){toast(e.message);}}
   else toast('Sign in to the account used at checkout to access your purchase.');
   history.replaceState({},'',location.pathname+location.hash);
  }else if(url.searchParams.get('checkout')==='cancel'){toast('Checkout canceled. No purchase was made.');history.replaceState({},'',location.pathname+location.hash);}
 }catch(e){toast('Unable to load the catalog. Refresh or contact the owner.');console.error(e);}
}
startup();
