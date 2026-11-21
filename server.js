import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import { Pool } from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual, randomInt } from 'node:crypto';
import fs from 'node:fs';
import {readSealed,hasSealed} from './vault.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products, bundles, extraProducts, byId, includedIds, publicCatalog } from './catalog.js';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const SITE=new URL(process.env.PUBLIC_URL||`http://localhost:${PORT}`);
const LIVE=process.env.NODE_ENV==='production';
const SCRIPT_DIR=path.resolve(ROOT,process.env.SCRIPT_STORAGE_DIR||'sealed-payloads');
const stripe=process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):null;
const webSecret=process.env.STRIPE_WEBHOOK_SECRET;
const usingPostgres=!!process.env.DATABASE_URL;
let pool,sqlite;
if(usingPostgres){pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='require'?{rejectUnauthorized:true}:undefined});}
else {sqlite=new DatabaseSync(path.join(ROOT,process.env.LOCAL_DB_PATH||'marketplace.sqlite'));sqlite.exec('PRAGMA journal_mode = WAL;PRAGMA foreign_keys = ON;');}
const schema=[
 `CREATE TABLE IF NOT EXISTS email_codes (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires_at BIGINT NOT NULL, sent_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS purchases (session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), sku TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', payment_intent TEXT, created_at BIGINT NOT NULL, paid_at BIGINT)`,
 `CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), sku TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL, revoked_at BIGINT, last_used_at BIGINT)`,
 `CREATE UNIQUE INDEX IF NOT EXISTS licenses_one_active_per_product ON licenses (user_id,sku) WHERE revoked_at IS NULL`
];
async function query(sql,values=[]){
 if(pool){const r=await pool.query(sql,values);return r.rows;}
 const stmt=sqlite.prepare(sql.replace(/\$\d+/g,'?'));
 return /^\s*(SELECT|WITH)\b/i.test(sql)?stmt.all(...values):(stmt.run(...values),[]);
}
async function init(){for(const sql of schema)await query(sql);}
const sha=s=>createHash('sha256').update(s).digest('hex');
const emailValid = email => email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const codeHash=(email,code)=>sha(`${process.env.OTP_SECRET||'UNCONFIGURED'}:${email}:${code}`);
const mailReady=()=>!!(process.env.RESEND_API_KEY&&process.env.MAIL_FROM&&process.env.OTP_SECRET&&process.env.OTP_SECRET.length>=32);
const emailAuthLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false});
const now=()=>Date.now();
const makeHash=password=>{const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;};
const checkHash=(password,stored)=>{
 const [salt,expected]=stored.split(':');if(!salt||!expected)return false;
 const a=scryptSync(password,salt,64),b=Buffer.from(expected,'hex');return a.length===b.length&&timingSafeEqual(a,b);
};
const parseCookie=(header,key)=>{const match=(header||'').split(';').map(p=>p.trim()).find(p=>p.startsWith(key+'='));return match?decodeURIComponent(match.slice(key.length+1)):null;};
const cookieOptions=[`Path=/`,'HttpOnly','SameSite=Lax',`Max-Age=${60*60*24*30}`,...(LIVE?['Secure']:[])].join('; ');
function clearCookie(res){res.setHeader('Set-Cookie',`bl_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${LIVE?'; Secure':''}`);}
const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:'],connectSrc:["'self'"],frameSrc:['https://www.youtube-nocookie.com','https://player.vimeo.com'],objectSrc:["'none'"],baseUri:["'self'"],formAction:["'self'",'https://checkout.stripe.com'],upgradeInsecureRequests:LIVE?[]:null}},crossOriginEmbedderPolicy:false}));
app.use('/api',(_,res,next)=>{res.set('Cache-Control','no-store');next();});
const authLimiter=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-7',legacyHeaders:false});
const checkoutLimiter=rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:'draft-7',legacyHeaders:false});
const downloadLimiter=rateLimit({windowMs:60*60*1000,limit:35,standardHeaders:'draft-7',legacyHeaders:false});
const testMode=()=>!!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
const paymentReady=()=>!!(stripe&&/^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY||'')&&/^whsec_/.test(webSecret||'')&&process.env.DISABLE_CHECKOUT!=='1'&&usingPostgres&&mailReady()&&emailValid(process.env.SUPPORT_EMAIL||'')&&(!LIVE||!!process.env.PUBLIC_URL));
const checkoutReady=()=>paymentReady()&&(testMode()||process.env.ALLOW_LIVE_SALES==='1');
const testCheckoutReady=()=>checkoutReady()&&testMode()&&process.env.ENABLE_TEST_CHECKOUT==='1';
function publicState(){const catalog=publicCatalog();catalog.extras=catalog.extras.map(p=>p.id==='checkout-test'?{...p,unavailable:!testCheckoutReady()}:p.id==='zflag-injector'?{...p,unavailable:!hasSealed(SCRIPT_DIR,'zflag-setup.exe')||!checkoutReady()}:p);return {checkout_ready:checkoutReady(),test_checkout_ready:testCheckoutReady(),mode:process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')?'live':testMode()?'test':'unconfigured',email_login_ready:mailReady()&&usingPostgres,support_email:process.env.SUPPORT_EMAIL||null,catalog};}
function safeError(res,err,code=500){console.error(err);return res.status(code).json({error:'Request could not be completed.'});}
async function fetchUser(req){
 const token=parseCookie(req.headers.cookie,'bl_session');if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const rows=await query(`SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=$1 AND sessions.expires_at>$2`,[sha(token),now()]);return rows[0]||null;
}
async function requireUser(req,res,next){try{req.user=await fetchUser(req);if(!req.user)return res.status(401).json({error:'Sign in to continue.'});next();}catch(e){safeError(res,e);}}
function validateOrigin(req,res,next){const origin=req.get('origin');if(origin&&origin!==SITE.origin)return res.status(403).json({error:'Invalid request origin.'});next();}
async function grantFromStripe(session){
 if(!session||session.payment_status!=='paid'||session.currency!=='usd')return false;
 const order=(await query('SELECT * FROM purchases WHERE session_id=$1',[session.id]))[0];
 if(!order||!byId[order.sku]||order.status==='revoked')return false;
 if(session.client_reference_id!==order.user_id||session.metadata?.user_id!==order.user_id||session.metadata?.sku!==order.sku)return false;
 if(Number(session.amount_total)!==Number(order.amount)||Number(order.amount)!==byId[order.sku].price)return false;
 // Verify the charge has not already been refunded or disputed before granting access.
 if(!session.payment_intent)return false;
 const intent=await stripe.paymentIntents.retrieve(typeof session.payment_intent==='object'?session.payment_intent.id:session.payment_intent,{expand:['latest_charge']});
 if(intent.status!=='succeeded'||intent.amount_received!==order.amount||intent.currency!=='usd')return false;
 const charge=intent.latest_charge;
 if(!charge||typeof charge==='string'||charge.refunded||Number(charge.amount_refunded)>0||charge.disputed)return false;
 await query(`UPDATE purchases SET status='paid',payment_intent=$1,paid_at=$2 WHERE session_id=$3 AND status!='revoked'`,[intent.id,now(),session.id]);
 return true;
}
// Registered BEFORE JSON parser: Stripe signatures require the untouched raw body.
app.post('/api/stripe/webhook',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
 if(!stripe||!webSecret)return res.sendStatus(503);
 let evt;try{evt=stripe.webhooks.constructEvent(req.body,req.get('stripe-signature'),webSecret);}catch(e){return res.status(400).send('Invalid Stripe signature');}
 try{
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(evt.type)){
    const s=evt.data.object;if(s.payment_status==='paid')await grantFromStripe(await stripe.checkout.sessions.retrieve(s.id));
  }
  if(['charge.refunded','charge.dispute.created'].includes(evt.type)){
    const ch=evt.type==='charge.refunded'?evt.data.object:evt.data.object.charge;
    const paymentIntent=typeof ch==='object'?ch?.payment_intent:evt.data.object.payment_intent;
    if(paymentIntent)await query(`UPDATE purchases SET status='revoked' WHERE payment_intent=$1`,[paymentIntent]);
  }
  res.sendStatus(200);
 }catch(e){console.error('Stripe webhook failure',e);res.sendStatus(500);}
});
app.use(express.json({limit:'20kb'}));app.use('/api',validateOrigin);
app.get('/api/store',(_req,res)=>res.json(publicState()));
app.get('/api/me',async(req,res)=>{try{const u=await fetchUser(req);res.json({user:u});}catch(e){safeError(res,e);}});
// Passwordless sign-in. 6-digit email codes are single-use, valid for 10 minutes,
// rate-limited by both IP and email, and are never returned in HTTP responses.
app.post('/api/auth/request-code',emailAuthLimiter,async(req,res)=>{
 const email=String(req.body?.email||'').trim().toLowerCase();
 if(!emailValid(email))return res.status(400).json({error:'Enter a valid email address.'});
 if(!mailReady()||!usingPostgres)return res.status(503).json({error:'Email sign-in is not configured yet.'});
 try{
  const existing=(await query('SELECT sent_at FROM email_codes WHERE email=$1',[email]))[0];
  if(existing&&now()-Number(existing.sent_at)<60000)return res.status(429).json({error:'Please wait one minute before requesting another code.'});
  const code=String(randomInt(0,1000000)).padStart(6,'0');
  const time=now();
  await query(`INSERT INTO email_codes (email,code_hash,attempts,expires_at,sent_at) VALUES ($1,$2,0,$3,$4) ON CONFLICT(email) DO UPDATE SET code_hash=EXCLUDED.code_hash,attempts=0,expires_at=EXCLUDED.expires_at,sent_at=EXCLUDED.sent_at`,[email,codeHash(email,code),time+10*60*1000,time]);
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM,to:[email],subject:'Your Zebra sign-in code',text:`Your Zebra sign-in code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`}),signal:AbortSignal.timeout(10000)});
  if(!response.ok){await query('DELETE FROM email_codes WHERE email=$1',[email]);return res.status(503).json({error:'Email could not be sent. Please try again later.'});}
  res.json({ok:true,message:'Check your email for a six-digit code.',expires_in:600});
 }catch(e){safeError(res,e);}
});
app.post('/api/auth/verify-code',emailAuthLimiter,async(req,res)=>{
 const email=String(req.body?.email||'').trim().toLowerCase(),code=String(req.body?.code||'');
 if(!emailValid(email)||!/^\d{6}$/.test(code))return res.status(400).json({error:'Enter the six-digit email code.'});
 try{
  const row=(await query('SELECT * FROM email_codes WHERE email=$1',[email]))[0];
  if(!row||Number(row.expires_at)<=now()||Number(row.attempts)>=5)return res.status(401).json({error:'Code expired or invalid. Request a new one.'});
  await query('UPDATE email_codes SET attempts=attempts+1 WHERE email=$1 AND attempts<5',[email]);
  const a=Buffer.from(row.code_hash,'hex'),b=Buffer.from(codeHash(email,code),'hex');
  if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(401).json({error:'Code expired or invalid. Request a new one.'});
  await query('DELETE FROM email_codes WHERE email=$1',[email]);
  const id=randomUUID(),disabledPassword=makeHash(randomBytes(32).toString('hex'));
  await query('INSERT INTO users(id,email,password_hash,created_at) VALUES ($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING',[id,email,disabledPassword,now()]);
  const user=(await query('SELECT id,email FROM users WHERE email=$1',[email]))[0];
  const token=randomBytes(32).toString('hex');await query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,$3)',[sha(token),user.id,now()+30*86400000]);
  res.set('Set-Cookie',`bl_session=${token}; ${cookieOptions}`);res.json({user});
 }catch(e){safeError(res,e);}
});
app.post('/api/register',(_req,res)=>res.status(410).json({error:'Use email code sign-in.'}));
app.post('/api/login',(_req,res)=>res.status(410).json({error:'Use email code sign-in.'}));
app.post('/api/logout',requireUser,async(req,res)=>{
 try{const token=parseCookie(req.headers.cookie,'bl_session');await query('DELETE FROM sessions WHERE token_hash=$1',[sha(token)]);clearCookie(res);res.json({ok:true});}catch(e){safeError(res,e);}
});
app.post('/api/checkout',checkoutLimiter,requireUser,async(req,res)=>{
 if(!checkoutReady())return res.status(503).json({error:'Checkout is not configured. No payment was taken.'});
 if(req.body?.accepted_terms!==true)return res.status(400).json({error:'Please accept store terms before purchase.'});
 const sku=String(req.body?.sku||''),item=byId[sku];if(!item||!Number.isInteger(item.price)||item.price<50||item.unavailable&&sku!=='checkout-test'||sku==='checkout-test'&&!testCheckoutReady()||sku!=='checkout-test'&&includedIds(item).some(id=>{const entry=byId[id];return !entry?.file||!hasSealed(SCRIPT_DIR,entry.file);}))return res.status(400).json({error:'Product is not available for paid checkout yet.'});
 try{
  const session=await stripe.checkout.sessions.create({
   mode:'payment',customer_email:req.user.email,client_reference_id:req.user.id,
   line_items:[{price_data:{currency:'usd',unit_amount:item.price,product_data:{name:item.title,description:item.description.slice(0,400)}},quantity:1}],
   metadata:{sku,user_id:req.user.id},payment_intent_data:{metadata:{sku,user_id:req.user.id}},
   success_url:`${SITE.origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${SITE.origin}/?checkout=cancel`,
   expires_at:Math.floor(Date.now()/1000)+60*60
  });
  await query('INSERT INTO purchases (session_id,user_id,sku,amount,status,created_at) VALUES ($1,$2,$3,$4,$5,$6)',[session.id,req.user.id,sku,item.price,'pending',now()]);
  res.json({url:session.url});
 }catch(e){safeError(res,e);}
});
app.post('/api/confirm',checkoutLimiter,requireUser,async(req,res)=>{
 const sessionId=String(req.body?.session_id||'');if(!/^cs_(test_|live_)[A-Za-z0-9_]{10,200}$/.test(sessionId))return res.status(400).json({error:'Invalid checkout reference.'});
 if(!stripe)return res.status(503).json({error:'Payments not configured.'});
 try{
  const order=(await query('SELECT * FROM purchases WHERE session_id=$1 AND user_id=$2',[sessionId,req.user.id]))[0];
  if(!order)return res.status(404).json({error:'Purchase not found for this account.'});
  if(order.status==='revoked')return res.status(403).json({error:'This purchase is no longer active.'});
  const session=await stripe.checkout.sessions.retrieve(sessionId);
  const paid=await grantFromStripe(session);res.json({paid});
 }catch(e){safeError(res,e);}
});
app.get('/api/library',requireUser,async(req,res)=>{
 try{
  const orders=await query(`SELECT sku,paid_at,session_id FROM purchases WHERE user_id=$1 AND status='paid' ORDER BY paid_at DESC`,[req.user.id]);
  const owned=[...new Set(orders.flatMap(o=>includedIds(byId[o.sku]||{id:o.sku})))];res.json({owned,orders:orders.map(({sku,paid_at})=>({sku,paid_at}))});
 }catch(e){safeError(res,e);}
});
// Every paid item receives one active secret. The public launcher and source are different assets.
const licenseLimiter=rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-7',legacyHeaders:false});
const loaderLimiter=rateLimit({windowMs:60*1000,limit:50,standardHeaders:'draft-7',legacyHeaders:false});
async function entitlementIsPaid(userId,sku){
 const orders=await query(`SELECT * FROM purchases WHERE user_id=$1 AND status='paid' ORDER BY paid_at DESC`,[userId]);
 for(const order of orders){
  if(!includedIds(byId[order.sku]||{id:order.sku}).includes(sku))continue;
  if(!stripe)return false;
  const session=await stripe.checkout.sessions.retrieve(order.session_id);
  if(await grantFromStripe(session))return true;
 }
 return false;
}
// Buyer rotates license as needed; full key is deliberately never kept in our database.
app.post('/api/license/:sku',licenseLimiter,requireUser,async(req,res)=>{
 const sku=String(req.params.sku);
 if(!products.some(p=>p.id===sku&&!p.unavailable))return res.sendStatus(404);
 try{
  if(!await entitlementIsPaid(req.user.id,sku))return res.status(403).json({error:'Verified purchase required. No license was issued.'});
  const key='ZBL_'+randomBytes(28).toString('hex');
  await query('UPDATE licenses SET revoked_at=$1 WHERE user_id=$2 AND sku=$3 AND revoked_at IS NULL',[now(),req.user.id,sku]);
  await query('INSERT INTO licenses (id,user_id,sku,token_hash,created_at) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),req.user.id,sku,sha(key),now()]);
  const url=new URL(`/api/loader/${encodeURIComponent(sku)}`,SITE.origin);url.searchParams.set('key',key);
  res.json({loadstring:`loadstring(game:HttpGet(${JSON.stringify(url.toString())}))()`,note:'Personal license URL. Keep it private; rotating revokes earlier keys.'});
 }catch(e){safeError(res,e);}
});
// Runtime licenses do not use browser cookies. Every delivery verifies the paid account.
app.get('/api/loader/:sku',loaderLimiter,async(req,res)=>{
 const sku=String(req.params.sku),key=String(req.query.key||'');
 if(!products.some(p=>p.id===sku&&!p.unavailable)||!/^ZBL_[a-f0-9]{56}$/.test(key))return res.sendStatus(403);
 try{
  const found=(await query('SELECT * FROM licenses WHERE token_hash=$1 AND sku=$2 AND revoked_at IS NULL',[sha(key),sku]))[0];
  if(!found||!await entitlementIsPaid(found.user_id,sku))return res.sendStatus(403);
  const item=products.find(p=>p.id===sku);
  if(!hasSealed(SCRIPT_DIR,item.file))return res.sendStatus(503);
  const payload=readSealed(SCRIPT_DIR,item.file);
  await query('UPDATE licenses SET last_used_at=$1 WHERE id=$2',[now(),found.id]);
  res.set({'Referrer-Policy':'no-referrer','Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','Content-Disposition':'inline'});
  res.send(payload);
 }catch(e){safeError(res,e);}
});
// Paid installer is never publicly exposed by the web server.
app.get('/api/injector/download',downloadLimiter,requireUser,async(req,res)=>{
 try{
  if(!await entitlementIsPaid(req.user.id,'zflag-injector'))return res.status(403).json({error:'Verified ZFLAG purchase required.'});
  if(!hasSealed(SCRIPT_DIR,'zflag-setup.exe'))return res.status(503).json({error:'Updated installer has not been supplied yet.'});
  const binary=readSealed(SCRIPT_DIR,'zflag-setup.exe');
  res.set({'Cache-Control':'private,no-store','Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="ZFLAG_Setup.exe"','X-Robots-Tag':'noindex','Content-Length':String(binary.length)});
  res.end(binary);
 }catch(e){safeError(res,e);}
});
// Legacy direct downloads are intentionally disabled: buyers receive loaders only.
app.get('/api/download/:sku',(_req,res)=>res.status(410).json({error:'Raw downloads are disabled. Open My Library and generate your licensed loadstring.'}));
app.get('/api/health',(_req,res)=>res.json({ok:true,service:'zebra-store',checkout:checkoutReady()?'configured':'disabled',vault_ready:!!process.env.ZEBRA_PAYLOAD_KEY}));
app.use(express.static(path.join(ROOT,'public'),{index:'index.html',dotfiles:'deny',setHeaders:r=>r.setHeader('Cache-Control','public,max-age=300')}));
app.get('*',(_req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));
init().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`BL Scripts Marketplace at ${SITE.origin}; checkout ${checkoutReady()?'READY':'LOCKED'}`))).catch(e=>{console.error('Database initialization failed',e);process.exit(1);});
export {app,checkoutReady,grantFromStripe};
