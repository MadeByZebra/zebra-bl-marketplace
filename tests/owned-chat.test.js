import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {faqReply,isHumanRequest,cleanChatMessage} from '../zebra-chat-logic.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=x=>createHash('sha256').update(x).digest('hex');

test('free Zebra FAQ engine is honest about payment sandbox and human availability',()=>{
 assert.match(faqReply('Can I get a refund?'),/terms/i);
 assert.match(faqReply('Where is my purchase?'),/My Library/i);
 assert.match(faqReply('Do you sell ZFLAG?'),/not currently available/i);
 assert.match(faqReply('Does the STR grinder support class B?'),/Class A only/i);
 assert.match(faqReply('Can I pay with my card?'),/sandbox/i);
 assert.equal(isHumanRequest('I need to speak to a real person'),true);
 assert.equal(isHumanRequest('Can I see your terms?'),false);
 assert.equal(cleanChatMessage('a'.repeat(1201)),null);
 assert.equal(cleanChatMessage('Hello'), 'Hello');
});

async function freePort(){
 return await new Promise((resolve,reject)=>{
  const server=createServer();
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{
   const p=server.address().port;
   server.close(err=>err?reject(err):resolve(p));
  });
 });
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function json(url,options={}){
 const res=await fetch(url,{headers:{'Content-Type':'application/json',...options.headers},...options});
 const data=await res.json();
 return {res,data};
}

test('owned chat supports guest FAQ, private access, human takeover and closing', {timeout:25000}, async()=>{
 const port=await freePort();
 const db='zebra-chat-test-'+randomUUID()+'.sqlite',dbPath=path.join(ROOT,db);
 const child=spawn(process.execPath,['server.js'],{
  cwd:ROOT,
  env:{...process.env,PORT:String(port),PUBLIC_URL:'http://127.0.0.1:'+port,
    LOCAL_DB_PATH:db,STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',DATABASE_URL:'',
    SUPPORT_EMAIL:'support-owner@example.com',
    NODE_ENV:'test'},
  stdio:['ignore','pipe','pipe']
 });
 let logs='';child.stdout.on('data',d=>{logs+=d.toString();});
 child.stderr.on('data',d=>{logs+=d.toString();});
 const base='http://127.0.0.1:'+port;
 try{
  let ready=false;
  for(let i=0;i<90;i++){
   if(child.exitCode!==null)break;
   try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break;}}catch(_e){}
   await sleep(90);
  }
  assert.equal(ready,true,'Server failed to start: '+logs.slice(-2500));
  const start=await json(base+'/api/zebra-chat/start',{method:'POST',body:'{}'});
  assert.equal(start.res.status,201);
  const {id,token}=start.data;
  assert.match(id,/^[0-9a-f-]{36}$/);
  assert.match(token,/^[a-f0-9]{64}$/);
  const h={'X-Zebra-Chat-Token':token};
  const denied=await json(base+'/api/zebra-chat/'+id,{headers:{'X-Zebra-Chat-Token':'0'.repeat(64)}});
  assert.equal(denied.res.status,403);
  const faq=await json(base+'/api/zebra-chat/'+id+'/message',{
   method:'POST',headers:h,body:JSON.stringify({message:'Where is my purchase?'})
  });
  assert.equal(faq.res.status,200);
  const conversation=await json(base+'/api/zebra-chat/'+id,{headers:h});
  assert.ok(conversation.data.messages.some(m=>m.sender==='assistant'&&m.text.includes('My Library')));
  const handoff=await json(base+'/api/zebra-chat/'+id+'/message',{
   method:'POST',headers:h,body:JSON.stringify({message:'I want to speak with a real person'})
  });
  assert.equal(handoff.res.status,200);
  const waiting=await json(base+'/api/zebra-chat/'+id,{headers:h});
  assert.equal(waiting.data.status,'waiting');
  const anonymousAdmin=await json(base+'/api/zebra-chat/admin/threads');
  assert.equal(anonymousAdmin.res.status,401);
  const dbConn=new DatabaseSync(dbPath);
  const uid=randomUUID(),session=randomBytes(32).toString('hex'),now=Date.now();
  try{
   dbConn.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(uid,'support-owner@example.com','locked',now);
   dbConn.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(sha(session),uid,now+3600000);
  }finally{dbConn.close();}
  const owner={Cookie:'bl_session='+session};
  const listing=await json(base+'/api/zebra-chat/admin/threads',{headers:owner});
  assert.equal(listing.res.status,200);
  assert.ok(listing.data.threads.some(t=>t.id===id&&t.status==='waiting'));
  const joined=await json(base+'/api/zebra-chat/admin/threads/'+id+'/join',{method:'POST',headers:owner,body:'{}'});
  assert.equal(joined.data.status,'human');
  const reply=await json(base+'/api/zebra-chat/admin/threads/'+id+'/reply',{
   method:'POST',headers:owner,body:JSON.stringify({message:'Hi, this is Zebra. How can I help?'})
  });
  assert.equal(reply.res.status,200);
  const final=await json(base+'/api/zebra-chat/'+id,{headers:h});
  assert.equal(final.data.status,'human');
  assert.ok(final.data.messages.some(m=>m.sender==='human'&&m.text.includes('Hi, this is Zebra')));
  const closed=await json(base+'/api/zebra-chat/admin/threads/'+id+'/close',{method:'POST',headers:owner,body:'{}'});
  assert.equal(closed.data.status,'closed');
  const rejected=await json(base+'/api/zebra-chat/'+id+'/message',{
   method:'POST',headers:h,body:JSON.stringify({message:'Are you still there?'})
  });
  assert.equal(rejected.res.status,409);
 }finally{
  child.kill('SIGTERM');
  await sleep(100);
  for(const ext of ['','-shm','-wal']){
   try{fs.unlinkSync(dbPath+ext);}catch(_e){}
  }
 }
});
