/** BL Scripts v2 smooth wheel system adapted from owner's ZFLAG site.
 * Keeps nested scrolling, touch, keyboard and reduced-motion native. */
(() => {
 'use strict';
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const root=document.scrollingElement||document.documentElement;
 if(typeof requestAnimationFrame!=='function')return;
 let goal=scrollY,frame=null,lastTime=0,easing=100,lastSet=null;
 const limit=()=>Math.max(0,root.scrollHeight-innerHeight);
 const clamp=y=>Math.max(0,Math.min(limit(),y));
 const cancel=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=0;goal=scrollY;lastSet=null};
 function tick(now){
   // The support chat is a separate scrolling surface. Stop any in-flight
   // smooth-scrolling animation when the visitor opens it.
   if(document.documentElement.classList.contains('zebra-chat-scroll-locked')){cancel();return;}
   const dt=lastTime?Math.min(64,Math.max(1,now-lastTime)):16.67;lastTime=now;goal=clamp(goal);
   const current=scrollY;
   if(lastSet!==null&&Math.abs(current-lastSet)>4){cancel();return}
   if(Math.abs(goal-current)<=5){scrollTo({top:goal,behavior:'instant'});frame=null;lastSet=null;lastTime=0;return}
   scrollTo({top:current+(goal-current)*(1-Math.exp(-dt/easing)),behavior:'instant'});
   lastSet=scrollY;frame=requestAnimationFrame(tick);
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
  if(reduced.matches||e.defaultPrevented||!e.cancelable||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)||nested(e.target)){cancel();return}
  let d=e.deltaY;if(e.deltaMode===1)d*=20;else if(e.deltaMode===2)d*=innerHeight*.9;
  if(!Number.isFinite(d)||d===0||!limit())return;
  if(lastSet!==null&&Math.abs(scrollY-lastSet)>4)cancel();
  if(frame===null)goal=scrollY;
  easing=e.deltaMode===0&&Math.abs(e.deltaY)<48?55:100;
  goal=clamp(goal+Math.max(-680,Math.min(680,d)));
  e.preventDefault();if(frame===null)frame=requestAnimationFrame(tick);
 },{passive:false});
 document.addEventListener('pointerdown',e=>{if(e.target instanceof Element&&e.target.closest('a,button,input,[role="button"]'))cancel()},{capture:true});
 addEventListener('keydown',cancel,{capture:true});addEventListener('touchstart',cancel,{passive:true});addEventListener('popstate',cancel);addEventListener('hashchange',cancel);
 addEventListener('scroll',()=>{if(frame===null)goal=scrollY},{passive:true});reduced.addEventListener?.('change',cancel);
 Object.defineProperty(window,'__blScroll',{value:Object.freeze({version:'2.0',isAnimating:()=>frame!==null}),configurable:false});
})();
