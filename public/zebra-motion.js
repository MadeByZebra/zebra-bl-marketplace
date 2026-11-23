/* Progressive motion for semantic FAQ accordions and native dialogs.
 * The DOM remains usable without JS; animations never replace native
 * purchase/authentication behavior or change authorization. */
(()=>{
 'use strict';
 const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 const easing='cubic-bezier(.22,1,.36,1)';
 const running=new WeakMap();
 function installAccordions(){
  document.querySelectorAll('.faq-list details, .help-faq details').forEach(details=>{
   const summary=details.querySelector(':scope > summary');
   if(!summary)return;
   summary.addEventListener('click',event=>{
    if(reduce()||typeof details.animate!=='function')return;
    if(event.target instanceof Element&&event.target.closest('a,button,input,select'))return;
    event.preventDefault();
    const old=running.get(details);
    const current=details.getBoundingClientRect().height;
    const opening=old?details.dataset.motionTarget!=='open':!details.open;
    if(old)old.cancel();
    details.dataset.motionTarget=opening?'open':'closed';
    details.style.height=current+'px';
    details.style.overflow='hidden';
    if(opening)details.open=true;
    const end=opening?details.scrollHeight:summary.getBoundingClientRect().height;
    if(!Number.isFinite(end)||end<=0){
     details.open=opening;
     details.style.removeProperty('height');details.style.removeProperty('overflow');
     details.removeAttribute('data-motion-target');
     running.delete(details);
     return;
    }
    const animation=details.animate([
     {height:current+'px'},
     {height:end+'px'}
    ],{duration:360,easing,fill:'forwards'});
    running.set(details,animation);
    animation.onfinish=()=>{
     if(running.get(details)!==animation)return;
     details.open=opening;
     details.style.removeProperty('height');
     details.style.removeProperty('overflow');
     details.removeAttribute('data-motion-target');
     running.delete(details);
    };
   });
  });
 }
 function installDialogs(){
  document.querySelectorAll('.scripts-page dialog').forEach(dialog=>{
   let outgoing=null;
   const dismiss=()=>{
    if(!dialog.open||outgoing)return;
    if(reduce()||typeof dialog.animate!=='function'){dialog.close();return;}
    dialog.classList.add('z-motion-closing');
    outgoing=dialog.animate([
     {opacity:1,transform:'translateY(0) scale(1)'},
     {opacity:0,transform:'translateY(12px) scale(.982)'}
    ],{duration:185,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    const reset=()=>{
     outgoing=null;dialog.classList.remove('z-motion-closing');
    };
    outgoing.onfinish=()=>{
     if(dialog.open)dialog.close();
     reset();
    };
    outgoing.oncancel=reset;
   };
   dialog.addEventListener('cancel',event=>{
    if(!dialog.open)return;
    event.preventDefault();
    dismiss();
   });
   dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dismiss();
   },true);
   // Existing product/auth controls use delegated document clicks.
   // Capture only explicit dialog dismissal, not purchase/sign-in actions.
   document.addEventListener('click',event=>{
    if(!(event.target instanceof Element))return;
    const trigger=event.target.closest('[data-close-dialog]');
    if(!trigger||!dialog.contains(trigger)||!dialog.open)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dismiss();
   },true);
   dialog.addEventListener('close',()=>{
    if(outgoing){outgoing.cancel();outgoing=null;}
    dialog.classList.remove('z-motion-closing');
   });
  });
 }
 function installMobileMenu(){
  const button=document.getElementById('mobileMenuBtn');
  const menu=document.getElementById('mobileNav');
  if(!button||!menu)return;
  const close=()=>{
   menu.classList.remove('show');
   button.setAttribute('aria-expanded','false');
   button.setAttribute('aria-label','Open navigation');
  };
  document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&menu.classList.contains('show')){
    close();button.focus();
   }
  });
  document.addEventListener('click',event=>{
   if(!menu.classList.contains('show')||!event.target)return;
   if(menu.contains(event.target)||button.contains(event.target))return;
   close();
  });
  document.addEventListener('focusin',event=>{
   if(menu.classList.contains('show')&&event.target&&!menu.contains(event.target)&&event.target!==button){
    // Keep the menu state synchronized when focus leaves the open dropdown.
    close();
   }
  });
 }
 function init(){installAccordions();installDialogs();installMobileMenu();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
