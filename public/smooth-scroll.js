/** Zebra's Shop shared smooth-wheel engine (v2.1) for every public page.
 * Never fight account content updates, native nested scrolling or reduced-motion. */
(() => {
 'use strict';
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const root=document.scrollingElement||document.documentElement;
 if(typeof requestAnimationFrame!=='function')return;
 let goal=scrollY,frame=null,lastTime=0,easing=100;
 const limit=()=>Math.max(0,root.scrollHeight-innerHeight);
 const clamp=y=>Math.max(0,Math.min(limit(),y));
 const cancel=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=0;goal=scrollY};
 function tick(now){
   // The support chat is a separate scrolling surface. Stop any in-flight
   // smooth-scrolling animation when the visitor opens it.
   if(document.documentElement.classList.contains('zebra-chat-scroll-locked')){cancel();return;}
   const dt=lastTime?Math.min(64,Math.max(1,now-lastTime)):16.67;lastTime=now;goal=clamp(goal);
   const current=scrollY;
   if(Math.abs(goal-current)<=2){scrollTo({top:goal,behavior:'instant'});frame=null;lastTime=0;return}
   scrollTo({top:current+(goal-current)*(1-Math.exp(-dt/easing)),behavior:'instant'});
   frame=requestAnimationFrame(tick);
 }
 function nested(target){
   if(!(target instanceof Element))return false;
   if(target.closest('[data-native-scroll], [contenteditable], textarea, select, input[type="number"], input[type="range"], [role="dialog"], dialog'))return true;
   if(document.querySelector('dialog[open]'))return true;
   for(let n=target;n&&n!==document.documentElement&&n!==document.body;n=n.parentElement){
     if(n instanceof HTMLElement){let st=getComputedStyle(n);if(/^(auto|scroll|overlay)$/.test(st.overflowY)&&n.scrollHeight>n.clientHeight+2)return true}
   }
   return false;
 }
 addEventListener('wheel',e=>{
  // Do not scroll the storefront beneath an expanded support conversation.
  if(document.documentElement.classList.contains('zebra-chat-scroll-locked')){
    cancel();
    if(e.cancelable)e.preventDefault();
    return;
  }
  if(reduced.matches||e.defaultPrevented||!e.cancelable||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)*1.3||nested(e.target)){cancel();return}
  let d=e.deltaY;if(e.deltaMode===1)d*=20;else if(e.deltaMode===2)d*=innerHeight*.9;
  if(!Number.isFinite(d)||d===0||!limit())return;
  if(frame===null)goal=scrollY;
  easing=e.deltaMode===0&&Math.abs(e.deltaY)<48?55:100;
  goal=clamp(goal+Math.max(-680,Math.min(680,d)));
  e.preventDefault();if(frame===null)frame=requestAnimationFrame(tick);
 },{passive:false});
 // Pointer input intentionally interrupts active animation, including scrollbar drags.
 document.addEventListener('pointerdown',cancel,{capture:true});
 addEventListener('keydown',cancel,{capture:true});addEventListener('touchstart',cancel,{passive:true});addEventListener('popstate',cancel);addEventListener('hashchange',cancel);addEventListener('pageshow',cancel);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel()});
 addEventListener('scroll',()=>{if(frame===null)goal=scrollY},{passive:true});reduced.addEventListener?.('change',cancel);
 Object.defineProperty(window,'__blScroll',{value:Object.freeze({version:'2.1',isAnimating:()=>frame!==null,maximum:limit,position:()=>scrollY,goal:()=>goal}),configurable:false});
})();
