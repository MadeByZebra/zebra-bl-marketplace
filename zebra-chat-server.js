import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import rateLimit from 'express-rate-limit';
import {faqReply,isHumanRequest,cleanChatMessage,HUMAN_REPLY} from './zebra-chat-logic.js';

export const zebraChatSchema=[
 'CREATE TABLE IF NOT EXISTS zebra_chat_threads (id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT \'bot\',created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL,last_alert_at BIGINT NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS zebra_chat_messages (id TEXT PRIMARY KEY,thread_id TEXT NOT NULL REFERENCES zebra_chat_threads(id),sender TEXT NOT NULL,text TEXT NOT NULL,created_at BIGINT NOT NULL)',
 'CREATE INDEX IF NOT EXISTS zebra_chat_messages_by_thread ON zebra_chat_messages(thread_id,created_at)'
];
const sha=text=>createHash('sha256').update(text).digest('hex');
const validId=v=>typeof v==='string'&&/^[0-9a-f-]{36}$/.test(v);
const fail=(res,status,message)=>res.status(status).json({error:message});
const GREETING="Hi! I'm Zebra's Shop automated FAQ assistant. Ask about BL Scripts, ZFLAG, My Library or purchases. Type “human” to request the owner.";
export function registerZebraChat({app,query,fetchUser,sendShopEmail,supportEmail}){
 const limited=rateLimit({windowMs:15*60*1000,limit:35,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many chat requests. Try again later.'}});
 const startLimiter=rateLimit({windowMs:60*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many new chats from this connection.'}});
 const adminLimiter=rateLimit({windowMs:60*1000,limit:60,standardHeaders:'draft-7',legacyHeaders:false});
 async function visitor(req,res,next){
  const token=String(req.get('x-zebra-chat-token')||''),id=req.params.id;
  if(!validId(id)||!/^[a-f0-9]{64}$/.test(token))return fail(res,403,'Chat access denied.');
  try{
   const row=(await query('SELECT id,status,token_hash FROM zebra_chat_threads WHERE id=$1',[id]))[0];
   if(!row)return fail(res,404,'Conversation not found.');
   const a=Buffer.from(row.token_hash,'hex'),b=Buffer.from(sha(token),'hex');
   if(a.length!==b.length||!timingSafeEqual(a,b))return fail(res,403,'Chat access denied.');
   req.thread=row;next();
  }catch(_e){fail(res,503,'Chat temporarily unavailable.');}
 }
 async function owner(req,res,next){
  try{
   const u=await fetchUser(req),expected=String(supportEmail()||'').toLowerCase().trim();
   if(!u)return fail(res,401,'Sign in to My Library using the Zebra Support email.');
   if(!expected||u.email.toLowerCase()!==expected)return fail(res,403,'Only the Zebra Support account can open this inbox.');
   req.owner=u;next();
  }catch(_e){fail(res,503,'Inbox temporarily unavailable.');}
 }
 async function add(id,sender,text,ts=Date.now()){
  await query('INSERT INTO zebra_chat_messages(id,thread_id,sender,text,created_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,sender,text,ts]);
  await query('UPDATE zebra_chat_threads SET updated_at=$1 WHERE id=$2',[ts,id]);
 }
 async function notifyOwner(id,ts){
  const address=String(supportEmail()||'');
  if(!address)return;
  const marker=(await query('SELECT last_alert_at FROM zebra_chat_threads WHERE id=$1',[id]))[0];
  if(!marker||Number(marker.last_alert_at)>0)return;
  await query('UPDATE zebra_chat_threads SET last_alert_at=$1 WHERE id=$2 AND last_alert_at=0',[ts,id]);
  try{
   await sendShopEmail({
    to:address,subject:'[Zebra chat] Human assistance requested',
    text:'A visitor requested human support on Zebra’s Shop.\n\nOpen your private support inbox:\nhttps://zebra-bl-marketplace.onrender.com/support/inbox/\n\nConversation: '+id+'\n\nDo not reply to this automated notification. Open the inbox to respond.',
    idempotencyKey:'zebra-chat-human-'+id
   });
  }catch(_e){console.warn('Zebra chat email notification unavailable');}
 }
 app.post('/api/zebra-chat/start',startLimiter,async(req,res)=>{
  const token=randomBytes(32).toString('hex'),id=randomUUID(),ts=Date.now();
  try{
   await query('INSERT INTO zebra_chat_threads(id,token_hash,status,created_at,updated_at,last_alert_at) VALUES($1,$2,$3,$4,$5,$6)',[id,sha(token),'bot',ts,ts,0]);
   await add(id,'assistant',GREETING,ts);
   res.status(201).json({id,token,status:'bot',messages:[{sender:'assistant',text:GREETING,created_at:ts}]});
  }catch(_e){fail(res,503,'Support chat temporarily unavailable. Use the email support form.');}
 });
 app.get('/api/zebra-chat/:id',limited,visitor,async(req,res)=>{
  try{
   const messages=await query('SELECT id,sender,text,created_at FROM zebra_chat_messages WHERE thread_id=$1 ORDER BY created_at ASC,id ASC LIMIT 160',[req.thread.id]);
   const status=(await query('SELECT status FROM zebra_chat_threads WHERE id=$1',[req.thread.id]))[0]?.status||req.thread.status;
   res.json({id:req.thread.id,status,messages});
  }catch(_e){fail(res,503,'Unable to load conversation.');}
 });
 app.post('/api/zebra-chat/:id/message',limited,visitor,async(req,res)=>{
  const text=cleanChatMessage(req.body?.message);
  if(!text)return fail(res,400,'Message must be under 1,200 characters.');
  try{
   const count=(await query('SELECT COUNT(*) AS count FROM zebra_chat_messages WHERE thread_id=$1 AND sender=$2',[req.thread.id,'visitor']))[0];
   if(Number(count?.count||0)>=60)return fail(res,429,'Conversation limit reached. Please email support.');
   const latest=(await query('SELECT status FROM zebra_chat_threads WHERE id=$1',[req.thread.id]))[0]?.status;
   if(latest==='closed')return fail(res,409,'This chat was closed. Start a new conversation.');
   await add(req.thread.id,'visitor',text);
   if(isHumanRequest(text)&&latest!=='human'){
    if(latest==='bot')await query('UPDATE zebra_chat_threads SET status=$1 WHERE id=$2',['waiting',req.thread.id]);
    if(latest==='bot')await add(req.thread.id,'assistant',HUMAN_REPLY);
    await notifyOwner(req.thread.id,Date.now());
   }else if(latest==='bot')await add(req.thread.id,'assistant',faqReply(text));
   res.json({ok:true});
  }catch(_e){fail(res,503,'Message could not be delivered. Try again.');}
 });
 app.post('/api/zebra-chat/:id/human',limited,visitor,async(req,res)=>{
  try{
   if(req.thread.status==='closed')return fail(res,409,'Start a new chat to request a human.');
   if(req.thread.status==='bot'){
    await query('UPDATE zebra_chat_threads SET status=$1 WHERE id=$2',['waiting',req.thread.id]);
    await add(req.thread.id,'assistant',HUMAN_REPLY);
   }
   await notifyOwner(req.thread.id,Date.now());
   res.json({ok:true,status:'waiting'});
  }catch(_e){fail(res,503,'Could not request a human right now.');}
 });
 app.get('/api/zebra-chat/admin/threads',owner,async(_req,res)=>{
  try{
   const rows=await query([
    'SELECT t.id,t.status,t.created_at,t.updated_at,',
    '(SELECT m.text FROM zebra_chat_messages m WHERE m.thread_id=t.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message,',
    '(SELECT COUNT(*) FROM zebra_chat_messages m WHERE m.thread_id=t.id AND m.sender=\'visitor\') AS visitor_messages',
    'FROM zebra_chat_threads t ORDER BY t.updated_at DESC LIMIT 100'
   ].join(' '));
   res.json({threads:rows});
  }catch(_e){fail(res,503,'Inbox unavailable.');}
 });
 app.get('/api/zebra-chat/admin/threads/:id',owner,async(req,res)=>{
  if(!validId(req.params.id))return fail(res,400,'Invalid conversation.');
  try{
   const row=(await query('SELECT id,status,created_at,updated_at FROM zebra_chat_threads WHERE id=$1',[req.params.id]))[0];
   if(!row)return fail(res,404,'Conversation not found.');
   const messages=await query('SELECT id,sender,text,created_at FROM zebra_chat_messages WHERE thread_id=$1 ORDER BY created_at ASC,id ASC LIMIT 160',[req.params.id]);
   res.json({thread:row,messages});
  }catch(_e){fail(res,503,'Unable to open conversation.');}
 });
 app.post('/api/zebra-chat/admin/threads/:id/join',adminLimiter,owner,async(req,res)=>{
  if(!validId(req.params.id))return fail(res,400,'Invalid conversation.');
  try{
   const row=(await query('SELECT status FROM zebra_chat_threads WHERE id=$1',[req.params.id]))[0];
   if(!row)return fail(res,404,'Conversation not found.');
   if(row.status==='closed')return fail(res,409,'Conversation already closed.');
   await query('UPDATE zebra_chat_threads SET status=$1,updated_at=$2 WHERE id=$3',['human',Date.now(),req.params.id]);
   if(row.status!=='human')await add(req.params.id,'system','Zebra Support joined the conversation.');
   res.json({ok:true,status:'human'});
  }catch(_e){fail(res,503,'Could not join this chat.');}
 });
 app.post('/api/zebra-chat/admin/threads/:id/reply',adminLimiter,owner,async(req,res)=>{
  if(!validId(req.params.id))return fail(res,400,'Invalid conversation.');
  const message=cleanChatMessage(req.body?.message);
  if(!message)return fail(res,400,'Reply must be under 1,200 characters.');
  try{
   const row=(await query('SELECT status FROM zebra_chat_threads WHERE id=$1',[req.params.id]))[0];
   if(!row)return fail(res,404,'Conversation not found.');
   if(row.status==='closed')return fail(res,409,'Conversation closed.');
   if(row.status!=='human')await query('UPDATE zebra_chat_threads SET status=$1 WHERE id=$2',['human',req.params.id]);
   await add(req.params.id,'human',message);
   res.json({ok:true,status:'human'});
  }catch(_e){fail(res,503,'Unable to send reply.');}
 });
 app.post('/api/zebra-chat/admin/threads/:id/close',adminLimiter,owner,async(req,res)=>{
  if(!validId(req.params.id))return fail(res,400,'Invalid conversation.');
  try{
   const row=(await query('SELECT status FROM zebra_chat_threads WHERE id=$1',[req.params.id]))[0];
   if(!row)return fail(res,404,'Conversation not found.');
   if(row.status!=='closed'){
    await query('UPDATE zebra_chat_threads SET status=$1,updated_at=$2 WHERE id=$3',['closed',Date.now(),req.params.id]);
    await add(req.params.id,'system','Conversation closed by Zebra Support.');
   }
   res.json({ok:true,status:'closed'});
  }catch(_e){fail(res,503,'Unable to close chat.');}
 });
}
