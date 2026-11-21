(()=>{'use strict';const r=document.documentElement,button=document.getElementById('themeToggle');
const sync=()=>{if(button)button.textContent=r.dataset.theme==='light'?'◑':'◐';};
try{const saved=localStorage.getItem('zebra-shop-theme');if(saved==='light'||saved==='dark')r.dataset.theme=saved;}catch{}
sync();button?.addEventListener('click',()=>{r.dataset.theme=r.dataset.theme==='light'?'dark':'light';try{localStorage.setItem('zebra-shop-theme',r.dataset.theme)}catch{}sync()});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
if('IntersectionObserver' in window&&!reduced){const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting){target.classList.add('in');observer.unobserve(target)}}),{threshold:.1,rootMargin:'0px 0px -15px 0px'});document.querySelectorAll('.reveal').forEach(x=>observer.observe(x));}else document.querySelectorAll('.reveal').forEach(x=>x.classList.add('in'));
const w=document.querySelector('.window');if(w&&!reduced&&matchMedia('(pointer:fine)').matches){w.addEventListener('pointermove',e=>{const b=w.getBoundingClientRect(),x=(e.clientX-b.left)/b.width-.5,y=(e.clientY-b.top)/b.height-.5;w.style.transform='rotateY('+(-3+x*5)+'deg) rotateX('+(2-y*4)+'deg)';});w.addEventListener('pointerleave',()=>{w.style.transform='rotateY(-3deg) rotateX(2deg)';});}
addEventListener('scroll',()=>document.querySelector('.nav-shell')?.classList.toggle('scrolled',scrollY>24),{passive:true});
})();