(()=>{'use strict';const tabs=[...document.querySelectorAll('[data-studio-tab]')];const panels=[...document.querySelectorAll('[data-studio-panel]')];const crumb=document.getElementById('studio-crumb');if(!tabs.length||!panels.length)return;
function show(tab){let found=false;for(const panel of panels){const active=panel.dataset.studioPanel===tab;panel.hidden=!active;if(active)found=true;}if(!found)return;
 tabs.forEach(b=>{const active=b.dataset.studioTab===tab;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 if(crumb)crumb.textContent=tab.toUpperCase().replaceAll('-',' ');}
tabs.forEach(b=>b.addEventListener('click',()=>show(b.dataset.studioTab)));show('overview');})();