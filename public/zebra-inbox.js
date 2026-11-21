(()=>{
'use strict';
const $=id=>document.getElementById(id),ui={
 list:$('threadList'),messages:$('messages'),session:$('sessionStatus'),
 title:$('threadTitle'),status:$('threadStatus'),reply:$('reply'),
 form:$('replyForm'),join:$('join'),close:$('close'),send:$('send'),feedback:$('feedback'),
 alerts:$('enableAlerts')
};
let threads=[],selected=null,busy=false,lastWaiting=new Set(),hadFirstLoad=false;
let soundEnabled=false,soundContext=null;
function chime(){
 if(!soundEnabled||!soundContext)return;
 try{
  const start=soundContext.currentTime;
  for(const [offset,frequency] of [[0,790],[0.2,620],[0.4,790]]){
   const osc=soundContext.createOscillator(),gain=soundContext.createGain();
   osc.type='sine';osc.frequency.value=frequency;
   gain.gain.setValueAtTime(0.0001,start+offset);
   gain.gain.exponentialRampToValueAtTime(0.075,start+offset+0.025);
   gain.gain.exponentialRampToValueAtTime(0.0001,start+offset+0.16);
   osc.connect(gain);gain.connect(soundContext.destination);
   osc.start(start+offset);osc.stop(start+offset+0.18);
  }
 }catch(_error){/* Audio permission or hardware is optional. */}
}

function feedback(text,isError=false){ui.feedback.textContent=text||'';ui.feedback.classList.toggle('error',isError);}
async function api(url,options={}){
 const headers={Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})};
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{...headers,...options.headers}});
 let data={};try{data=await response.json();}catch(_e){}
 if(!response.ok)throw Error(data.error||'Request failed.');
 return data;
}
function elem(tag,name,text){const v=document.createElement(tag);if(name)v.className=name;if(text!==undefined)v.textContent=String(text);return v;}
function dateLabel(ts){const d=new Date(Number(ts));return Number.isFinite(d.getTime())?d.toLocaleString():'Unknown time';}
function notifyNew(rows){
 const ids=new Set(rows.filter(r=>r.status==='waiting').map(r=>r.id));
 if(hadFirstLoad){
  const additions=[...ids].filter(id=>!lastWaiting.has(id));
  if(additions.length&&'Notification' in window&&Notification.permission==='granted'){
   new Notification("Zebra Support — customer requests a human",{body:additions.length+' conversation(s) waiting for you',tag:'zebra-support-handoff'});
  }
  if(additions.length)chime();
  if(additions.length)feedback('A customer is requesting human assistance.');
 }
 hadFirstLoad=true;lastWaiting=ids;
}
function renderList(){
 ui.list.replaceChildren();
 if(!threads.length){ui.list.append(elem('p','no-threads','No customer chats yet.'));return;}
 for(const row of threads){
  const b=elem('button','thread-item'+(row.id===selected?' selected':'')+(row.status==='waiting'?' waiting':''));
  b.type='button';b.setAttribute('role','listitem');
  b.append(elem('span','thread-top',row.status==='waiting'?'● HUMAN REQUEST':row.status==='human'?'LIVE WITH ZEBRA':row.status==='closed'?'CLOSED':'AUTOMATED'));
  b.append(elem('strong','',String(row.last_message||'New conversation').slice(0,85)));
  b.append(elem('small','',dateLabel(row.updated_at)));
  b.addEventListener('click',()=>choose(row.id));ui.list.append(b);
 }
}
function renderMessages(messages){
 const nearEnd=ui.messages.scrollHeight-ui.messages.scrollTop-ui.messages.clientHeight<90;
 ui.messages.replaceChildren();
 for(const msg of messages){
  const item=elem('article','msg '+(msg.sender==='visitor'?'visitor':msg.sender==='human'?'owner':msg.sender==='system'?'system':'automated'));
  item.append(elem('span','msg-who',msg.sender==='visitor'?'Visitor':msg.sender==='human'?'Zebra (you)':msg.sender==='system'?'System':'Zebra Assistant'));
  item.append(elem('p','',msg.text));item.append(elem('time','',dateLabel(msg.created_at)));
  ui.messages.append(item);
 }
 if(nearEnd)ui.messages.scrollTop=ui.messages.scrollHeight;
}
function updateControls(row){
 const closed=!row||row.status==='closed';
 ui.status.textContent=row?row.status.toUpperCase():'No conversation';
 ui.title.textContent=row?'Conversation '+row.id.slice(0,8):'Select a conversation';
 ui.join.disabled=closed||row.status==='human';
 ui.close.disabled=closed;ui.reply.disabled=closed;ui.send.disabled=closed;
 ui.reply.placeholder=closed?'Select an active conversation':'Write a message to the customer…';
}
async function loadCurrent(){
 if(!selected)return;
 try{
  const data=await api('/api/zebra-chat/admin/threads/'+encodeURIComponent(selected));
  renderMessages(data.messages||[]);updateControls(data.thread);
 }catch(e){feedback(e.message,true);}
}
async function choose(id){selected=id;feedback('');renderList();await loadCurrent();}
async function refresh(){
 try{
  const data=await api('/api/zebra-chat/admin/threads');
  threads=data.threads||[];ui.session.textContent='Signed in as Zebra Support';
  notifyNew(threads);
  if(!selected&&threads.length)selected=threads[0].id;
  if(selected&&!threads.some(t=>t.id===selected))selected=null;
  renderList();await loadCurrent();
 }catch(e){
  if(!hadFirstLoad){ui.session.textContent=e.message;
   if(/sign in/i.test(e.message)){
    const a=elem('a','signin','Sign in using your support email →');a.href='/account/';
    ui.session.append(document.createTextNode(' '),a);
   }
  }
  feedback(e.message,true);
 }
}
async function change(action,body){
 if(!selected||busy)return false;busy=true;feedback('');
 try{
  await api('/api/zebra-chat/admin/threads/'+encodeURIComponent(selected)+'/'+action,{method:'POST',body:JSON.stringify(body||{})});
  await refresh();
  return true;
 }catch(e){feedback(e.message,true);return false;}
 finally{busy=false;}
}
ui.join.addEventListener('click',()=>change('join'));
ui.close.addEventListener('click',()=>{if(confirm('Close this conversation for the visitor?'))change('close')});
ui.form.addEventListener('submit',async(e)=>{
 e.preventDefault();const value=ui.reply.value.trim();if(!value||busy)return;
 const sent=await change('reply',{message:value});if(sent)ui.reply.value='';
});
ui.reply.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ui.form.requestSubmit();}});
ui.alerts.addEventListener('click',async()=>{
 if(!('Notification' in window)){feedback('Desktop notifications are not available in this browser.',true);return;}
 const result=await Notification.requestPermission();
 if(result==='granted'){
  const AudioCtor=window.AudioContext||window.webkitAudioContext;
  if(AudioCtor){soundContext=new AudioCtor();await soundContext.resume().catch(()=>{});soundEnabled=true;}
 }
 feedback(result==='granted'?'Alerts enabled. Keep this inbox tab open for notifications and sound.':'Allow notifications in browser settings to receive alerts.',result!=='granted');
});
refresh();
setInterval(()=>{if(!busy)refresh();},5000);
})();
