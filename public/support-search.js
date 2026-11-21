// Client-side FAQ search — no network calls and no visitor data collection.
(function(){
  const field = document.getElementById('faq-search');
  if(!field)return;
  const entries = Array.from(document.querySelectorAll('[data-faq]'));
  const empty = document.getElementById('faq-empty');
  field.addEventListener('input', () => {
    const query = field.value.trim().toLocaleLowerCase();
    let count=0;
    for(const entry of entries){
      const match=entry.textContent.toLocaleLowerCase().includes(query);
      entry.hidden=!match; 
      if(match)count++;
    }
    if(empty)empty.style.display=count?'none':'block';
  });
})();
