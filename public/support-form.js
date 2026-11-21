// Customer email contact form. Works without a local mail handler.
(function(){
 const form=document.getElementById('zebra-support-form');
 if(!form)return;
 const result=document.getElementById('zebra-support-result');
 const button=form.querySelector('[type="submit"]');
 function show(message,ok){
  result.textContent=message;
  result.hidden=false;
  result.classList.toggle('is-success',!!ok);
  result.classList.toggle('is-error',!ok);
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  result.hidden=true;
  if(!form.reportValidity())return;
  const fields=Object.fromEntries(new FormData(form).entries());
  // Never send card details, passwords or one-time codes intentionally.
  button.disabled=true;
  button.textContent='SENDING…';
  try{
   const response=await fetch('/api/support/request',{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify(fields)
   });
   let data={};
   try{data=await response.json();}catch(_e){}
   if(!response.ok||!data.ok)throw Error(data.error||'Support email could not be submitted.');
   const reference=String(data.reference||'');
   show('Request accepted for email delivery. Reference: '+reference+'. Keep this reference for follow-up. Replies are not instant.',true);
   form.reset();
  }catch(err){
   show((err?.message||'Support email could not be submitted.')+
    ' Use the Compose in Gmail link below, or check your browser connection and retry.',false);
  }finally{
   button.disabled=false;
   button.textContent='Send support request ↗';
  }
 });
})();
