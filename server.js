import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import { Pool } from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual, randomInt } from 'node:crypto';
import fs from 'node:fs';
import {readSealed,hasSealed,contentSha} from './vault.js';
import {inspectPrivatePayloads,productPayloadReady,readVerifiedScript} from './payload-readiness.js';
import {liveMerchantReadiness} from './merchant-readiness.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products, bundles, extraProducts, byId, includedIds, publicCatalog } from './catalog.js';
import { discountQuote } from './discounts.js';
import { validFreeCheckout } from './free-checkout.js';
import { checkoutModeMatches, paymentIntentMatches } from './stripe-integrity.js';
import {shouldRetryUnrecordedCheckout,expireIncompleteCheckout} from './checkout-consistency.js';
import {webhookSecretFor,configuredWebhookSecret} from './webhook-environments.js';
import {verifiedLiveProduct,liveReleaseReadiness} from './live-sales-release-gates.js';
import { sandboxEmails, isSandboxTester, mayCheckoutSandbox, mayDeliverSandboxScript } from './stripe-sandbox.js';
import { buyerLoadstring } from './github-loader.js';
import {requiresSameOrigin,validLicenseKey,licenseRateLimitKey} from './loader-security.mjs';
import { getOtpKey,hashEmailOtp } from './email-otp.js';
import { activeMailer,mailerMode,verifyEmailProvider,sendShopEmail,receiptEmail } from './email-delivery.js';
import {validateSupportRequest,supportEmailContent} from './support-request.js';
import {registerZebraChat,zebraChatSchema} from './zebra-chat-server.js';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const SITE=new URL(process.env.PUBLIC_URL||`http://localhost:${PORT}`);
const LIVE=process.env.NODE_ENV==='production';
const SCRIPT_DIR=path.resolve(ROOT,process.env.SCRIPT_STORAGE_DIR||'sealed-payloads');
const PAYLOAD_MANIFEST=path.join(ROOT,'sealed-payloads','MANIFEST.json');
const payloadReadiness=inspectPrivatePayloads(SCRIPT_DIR,{manifestPath:PAYLOAD_MANIFEST});
// Do not sell an installer merely because a file exists. Require a Windows PE
// header, owner-approved SHA-256, and a successfully decrypted private asset.
function verifyZflagInstaller(){
 const expected=String(process.env.ZFLAG_APPROVED_SHA256||'').trim().toLowerCase();
 if(!/^[a-f0-9]{64}$/.test(expected)||!hasSealed(SCRIPT_DIR,'zflag-setup.exe'))return false;
 try{
  const bin=readSealed(SCRIPT_DIR,'zflag-setup.exe');
  return bin.length>100000&&bin[0]===77&&bin[1]===90&&contentSha(bin)===expected;
 }catch(_e){return false;}
}
const zflagInstallerReady=verifyZflagInstaller();
const stripe=process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):null;
const webSecret=()=>webhookSecretFor(process.env.STRIPE_SECRET_KEY,process.env);
let stripeAuth='not_checked'; // Only status, never keys or account identifiers.
let liveMerchant={ready:false,issues:['not_verified']};
let liveMerchantLastChecked=0;
let liveMerchantRequest=null;
const configuredForLive=()=>!!process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
// Stripe can suspend a merchant after activation. Cache short merchant checks
// instead of trusting the existence of a live secret key or a startup result.
async function refreshLiveMerchant(force=false){
 if(!configuredForLive()||!stripe)return;
 if(!force&&Date.now()-liveMerchantLastChecked<120000)return;
 if(liveMerchantRequest)return liveMerchantRequest;
 liveMerchantRequest=(async()=>{
  liveMerchantLastChecked=Date.now();
  try{
   const account=await stripe.accounts.retrieve();
   liveMerchant=liveMerchantReadiness(account,process.env.STRIPE_LIVE_ACCOUNT_ID||'');
  }catch(_error){
   liveMerchant={ready:false,issues:['merchant_check_unavailable']};
  }
 })().finally(()=>{liveMerchantRequest=null;});
 return liveMerchantRequest;
}
async function checkStripeOnStartup(){
 if(!stripe){stripeAuth='not_configured';return;}
 try{
  const account=await stripe.accounts.retrieve();
  stripeAuth='authorized';
  if(configuredForLive()){
   liveMerchant=liveMerchantReadiness(account,process.env.STRIPE_LIVE_ACCOUNT_ID||'');
   liveMerchantLastChecked=Date.now();
  }
 }catch(e){
  stripeAuth=e?.statusCode===401?'unauthorized':
    e?.statusCode===403?'forbidden':'temporarily_unavailable';
 }
 console.log('Stripe key diagnostic:',stripeAuth,'mode:',
   process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')?'sandbox':
   process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')?'live':'invalid');
 if(configuredForLive())console.log('Live Stripe merchant diagnostic:',liveMerchant.ready?'ready':'not_ready');
}
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
 `CREATE UNIQUE INDEX IF NOT EXISTS licenses_one_active_per_product ON licenses (user_id,sku) WHERE revoked_at IS NULL`,
 `CREATE TABLE IF NOT EXISTS purchase_notifications (session_id TEXT PRIMARY KEY REFERENCES purchases(session_id), sent_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS free_promo_redemptions (user_id TEXT PRIMARY KEY REFERENCES users(id), sku TEXT NOT NULL, session_id TEXT UNIQUE NOT NULL, created_at BIGINT NOT NULL, redeemed_at BIGINT)`
,
 ...zebraChatSchema
];
async function query(sql,values=[]){
 if(pool){const r=await pool.query(sql,values);return r.rows;}
 const stmt=sqlite.prepare(sql.replace(/\$\d+/g,'?'));
 return /^\s*(SELECT|WITH)\b/i.test(sql)?stmt.all(...values):(stmt.run(...values),[]);
}
async function init(){for(const sql of schema)await query(sql);}
const sha=s=>createHash('sha256').update(s).digest('hex');
const emailValid = email => email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const codeHash=(email,code)=>hashEmailOtp(email,code);
const mailReady=()=>!!(activeMailer()&&getOtpKey());
let providerAuth='not_checked'; // No secret or account data is retained.
async function checkProviderOnStartup(){
 const info=await verifyEmailProvider();
 providerAuth=info.auth;
 console.log('Email provider diagnostic:',info.provider,info.auth,info.detail||'none');
}
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
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'",'https://cdn.jsdelivr.net'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com','https://cdn.jsdelivr.net'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','https://cdn.jsdelivr.net','https://s3.amazonaws.com'],connectSrc:["'self'"],frameSrc:['https://www.youtube-nocookie.com','https://player.vimeo.com'],objectSrc:["'none'"],baseUri:["'self'"],formAction:["'self'",'https://checkout.stripe.com'],upgradeInsecureRequests:LIVE?[]:null}},crossOriginEmbedderPolicy:false}));
app.use('/api',(_,res,next)=>{res.set('Cache-Control','no-store');next();});
const authLimiter=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-7',legacyHeaders:false});
const checkoutLimiter=rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:'draft-7',legacyHeaders:false});
const downloadLimiter=rateLimit({windowMs:60*60*1000,limit:35,standardHeaders:'draft-7',legacyHeaders:false});
const supportFormLimiter=rateLimit({windowMs:60*60*1000,limit:4,standardHeaders:'draft-7',legacyHeaders:false});
const testMode=()=>!!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
const paymentReady=()=>!!(stripe&&stripeAuth==='authorized'&&/^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY||'')&&configuredWebhookSecret(process.env.STRIPE_SECRET_KEY,process.env)&&process.env.DISABLE_CHECKOUT!=='1'&&usingPostgres&&mailReady()&&(testMode()||emailValid(process.env.SUPPORT_EMAIL||''))&&(!LIVE||!!process.env.PUBLIC_URL));
const checkoutReady=()=>paymentReady()&&(
 testMode()?process.env.ENABLE_TEST_CHECKOUT==='1'&&sandboxEmails().length>0:
 process.env.ALLOW_LIVE_SALES==='1'&&mailerMode()!=='resend_test_only'&&liveMerchant.ready&&liveReleaseReadiness(process.env).ready
);
const testCheckoutReady=()=>checkoutReady()&&testMode()&&process.env.ENABLE_TEST_CHECKOUT==='1';
const quoteFor=(item,code)=>discountQuote(item,code,{freeCode:process.env.ZEBRA_FREE_PROMO_CODE||''});
// The 100%-off code is private and limited to five completed Stripe coupon
// redemptions across all accounts. The shop also permits one order per account.
const FREE_STRIPE_COUPON_ID='zebra-shop-private-free-2026-v1';
async function ensureFreeCoupon(){
 try{return await stripe.coupons.retrieve(FREE_STRIPE_COUPON_ID);}
 catch(err){
  if(err.code!=='resource_missing')throw err;
  try{
   return await stripe.coupons.create({
    id:FREE_STRIPE_COUPON_ID,name:'Zebra Shop: private complimentary order',
    percent_off:100,duration:'once',max_redemptions:5
   });
  }catch(inner){
   if(inner.code==='resource_already_exists')return await stripe.coupons.retrieve(FREE_STRIPE_COUPON_ID);
   throw inner;
  }
 }
}
async function reserveFreePromo(userId,sku){
 // Unfinished checkouts automatically expire; a user can then try again.
 await query('DELETE FROM free_promo_redemptions WHERE redeemed_at IS NULL AND created_at<$1',[now()-75*60*1000]);
 const reservation='pending-'+randomUUID();
 const rows=await query('INSERT INTO free_promo_redemptions (user_id,sku,session_id,created_at) VALUES ($1,$2,$3,$4) ON CONFLICT(user_id) DO NOTHING RETURNING user_id',[userId,sku,reservation,now()]);
 if(!rows.length)return null;
 return reservation;
}
function checkoutStatus(){
 if(process.env.DISABLE_CHECKOUT==='1')return 'Payments are currently paused. No charge was made.';
 if(!stripe)return 'Stripe is not connected. No charge was made.';
 if(configuredForLive()&&process.env.ALLOW_LIVE_SALES!=='1')return 'Live checkout has not been approved for launch. No charge was made.';
 if(stripeAuth==='unauthorized'||stripeAuth==='forbidden')return 'Stripe rejected the server payment key. No charge was made.';
 if(stripeAuth!=='authorized')return 'Stripe key verification has not completed. No charge was made.';
 if(configuredForLive()&&!liveMerchant.ready)return 'Stripe has not yet enabled this business for real customer payments and payouts. No charge was made.';
 if(testMode()&&(!sandboxEmails().length||process.env.ENABLE_TEST_CHECKOUT!=='1'))
  return 'Stripe sandbox is restricted until an approved tester email is configured. No charge was made.';
 if(!configuredWebhookSecret(process.env.STRIPE_SECRET_KEY,process.env))return 'The signed Stripe webhook for this payment environment is not connected yet. No charge was made.';
 if(!usingPostgres)return 'The purchase database is not configured. No charge was made.';
 if(!mailReady())return 'Customer email delivery is not configured. No charge was made.';
 if(mailerMode()==='resend_test_only'&&!testMode())return 'Customer email is restricted to testing; live checkout is unavailable.';
 if(!testMode()&&!emailValid(process.env.SUPPORT_EMAIL||''))return 'Shop support contact is not configured. No charge was made.';
 if(configuredForLive()){
  const gate=liveReleaseReadiness(process.env);
  if(gate.reasons.includes('persistent_database_unconfirmed'))return 'Production database durability and backup are not confirmed. No payment was taken.';
  if(gate.reasons.includes('no_runtime_verified_products'))return 'Products are awaiting real-client compatibility verification. No payment was taken.';
 }
 if(!checkoutReady())return 'Payments are not available yet. No charge was made.';
 return null;
}
function scriptReadyForSale(item){return productPayloadReady(payloadReadiness.products,item,includedIds);}
function itemReadyForSale(item){
 if(!item||item.unavailable)return false;
 if(item.id==='checkout-test')return testCheckoutReady();
 if(!testMode()&&!verifiedLiveProduct(item,process.env,includedIds))return false;
 if(item.id==='zflag-injector')return zflagInstallerReady&&checkoutReady();
 return scriptReadyForSale(item)&&checkoutReady();
}
function publicState(){
 const catalog=publicCatalog();
 catalog.products=catalog.products.map(p=>({...p,unavailable:!itemReadyForSale(byId[p.id])}));
 catalog.bundles=catalog.bundles.map(p=>({...p,unavailable:!itemReadyForSale(byId[p.id])}));
 catalog.extras=catalog.extras.map(p=>({...p,unavailable:!itemReadyForSale(byId[p.id])}));
 return {checkout_ready:checkoutReady(),test_checkout_ready:testCheckoutReady(),
  mode:process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')?'live':testMode()?'test':'unconfigured',
  stripe_key_status:stripeAuth,email_login_ready:mailReady()&&usingPostgres&&providerAuth!=='unauthorized'&&providerAuth!=='forbidden',
  email_sender_mode:mailerMode(),email_provider_auth:providerAuth,checkout_message:checkoutStatus(),
  support_email:process.env.SUPPORT_EMAIL||null,catalog};
}
function safeError(res,err,code=500){console.error(err);return res.status(code).json({error:'Request could not be completed.'});}
async function fetchUser(req){
 const token=parseCookie(req.headers.cookie,'bl_session');if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const rows=await query(`SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=$1 AND sessions.expires_at>$2`,[sha(token),now()]);return rows[0]||null;
}
async function requireUser(req,res,next){try{req.user=await fetchUser(req);if(!req.user)return res.status(401).json({error:'Sign in to continue.'});next();}catch(e){safeError(res,e);}}
function validateOrigin(req,res,next){
 if(!requiresSameOrigin(req.method))return next();
 const origin=req.get('origin');if(origin&&origin!==SITE.origin)return res.status(403).json({error:'Invalid request origin.'});
 next();
}
async function grantFromStripe(session){
 const configuredMode=testMode()?'test':process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')?'live':'unknown';
 if(!checkoutModeMatches(session,configuredMode)||!['paid','no_payment_required'].includes(session.payment_status)||session.currency!=='usd')return false;
 const order=(await query('SELECT * FROM purchases WHERE session_id=$1',[session.id]))[0];
 if(!order||!byId[order.sku]||order.status==='revoked')return false;
 if(session.client_reference_id!==order.user_id||session.metadata?.user_id!==order.user_id||session.metadata?.sku!==order.sku)return false;
 // Immutable purchase price: the order was created by our own server, so
 // later changes to catalog prices or retired coupons must not revoke buyers.
 if(!Number.isSafeInteger(Number(order.amount))||Number(order.amount)<0||
    Number(session.amount_total)!==Number(order.amount))return false;
 if(order.amount===0){
  // A zero-dollar order must be a completed Stripe Checkout with the exact
  // server-issued 100%-off coupon and a matching one-account reservation.
  const claimed=(await query('SELECT * FROM free_promo_redemptions WHERE user_id=$1 AND session_id=$2 AND sku=$3',
    [order.user_id,session.id,order.sku]))[0];
  if(!validFreeCheckout(session,order,claimed,configuredMode))return false;
  await query(`UPDATE purchases SET status='paid',paid_at=COALESCE(paid_at,$1)
    WHERE session_id=$2 AND status!='revoked'`,[now(),session.id]);
  await query('UPDATE free_promo_redemptions SET redeemed_at=$1 WHERE user_id=$2 AND session_id=$3 AND redeemed_at IS NULL',
    [now(),order.user_id,session.id]);
  return true;
 }
 if(order.amount<50||session.payment_status!=='paid')return false;
 // Verify the charge has not already been refunded or disputed before granting access.
 if(!session.payment_intent)return false;
 const intent=await stripe.paymentIntents.retrieve(typeof session.payment_intent==='object'?session.payment_intent.id:session.payment_intent,{expand:['latest_charge']});
 const charge=intent.latest_charge;
 if(!charge||typeof charge==='string'||!paymentIntentMatches(session,order,intent,charge,configuredMode))return false;
 await query(`UPDATE purchases SET status='paid',payment_intent=$1,
  paid_at=COALESCE(paid_at,$2) WHERE session_id=$3 AND status!='revoked'`,[intent.id,now(),session.id]);
 return true;
}

// Send a separate purchase confirmation after a verified payment. Stripe also
// supports its own official emailed card receipts from Dashboard settings.
// A unique DB record ensures replayed webhooks don't duplicate confirmations.
async function sendPurchaseConfirmation(sessionId){
 if(!activeMailer())return;
 const order=(await query(`SELECT p.session_id,p.sku,p.amount,u.email
 FROM purchases p JOIN users u ON u.id=p.user_id
 WHERE p.session_id=$1 AND p.status='paid'`,[sessionId]))[0];
 // Diagnostic purchases may email approved sandbox testers, but never live customers.
 if(!order||(order.sku==='checkout-test'&&!testMode())||(testMode()&&!isSandboxTester(order.email)))return;
 const claim=await query(
  'INSERT INTO purchase_notifications(session_id,sent_at) VALUES ($1,$2) ON CONFLICT(session_id) DO NOTHING RETURNING session_id',
  [sessionId,now()]);
 if(!claim.length)return;
 try{
  let stripeReceipt=null;
  try{
   const session=await stripe.checkout.sessions.retrieve(sessionId);
   if(session.payment_intent){
    const intent=await stripe.paymentIntents.retrieve(
      typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent.id,
      {expand:['latest_charge']});
    if(intent.latest_charge&&typeof intent.latest_charge!=='string')
     stripeReceipt=intent.latest_charge.receipt_url||null;
   }
  }catch(_e){/* Stripe receipts remain accessible from purchase history. */}
  await sendShopEmail({
    to:order.email,subject:testMode()?'[STRIPE SANDBOX] Zebra\'s Shop test order':'Your Zebra\'s Shop purchase is ready',
    text:receiptEmail({name:byId[order.sku]?.title,totalCents:order.amount,
      orderId:sessionId,storeUrl:SITE.origin,receiptUrl:stripeReceipt,testMode:testMode()}),
    idempotencyKey:'zebra-shop-order-'+sessionId
  });
 }catch(e){
  await query('DELETE FROM purchase_notifications WHERE session_id=$1',[sessionId]);
  console.warn('Purchase email delivery pending',e.code||'EMAIL_SEND_FAILED',e.status||'');
 }
}

// Registered BEFORE JSON parser: Stripe signatures require the untouched raw body.
app.post('/api/stripe/webhook',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
 if(!stripe||!configuredWebhookSecret(process.env.STRIPE_SECRET_KEY,process.env))return res.sendStatus(503);
 let evt;try{evt=stripe.webhooks.constructEvent(req.body,req.get('stripe-signature'),webSecret());}catch(e){return res.status(400).send('Invalid Stripe signature');}
 try{
  // A mismatched webhook environment cannot grant access or revoke orders.
  if(evt.livemode!==!testMode())return res.sendStatus(400);
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(evt.type)){
    const incoming=evt.data.object;
    if(['paid','no_payment_required'].includes(incoming.payment_status)){
      const session=await stripe.checkout.sessions.retrieve(incoming.id);
      // Stripe may send the webhook before our Checkout order insert finishes.
      // Retry delivery instead of acknowledging an order we cannot yet fulfill.
      const recorded=await query('SELECT session_id FROM purchases WHERE session_id=$1',[session.id]);
      if(shouldRetryUnrecordedCheckout(session,recorded)){
        throw new Error('Checkout order is not recorded yet; retry webhook delivery');
      }
      if(recorded.length&&await grantFromStripe(session)){
        await sendPurchaseConfirmation(session.id);
      }
    }
  }
  if(['charge.refunded','charge.dispute.created'].includes(evt.type)){
    // Dispute events carry a charge ID, not a PaymentIntent. Retrieve the charge
    // rather than silently failing to revoke purchases on disputes.
    const ch=evt.type==='charge.refunded'?evt.data.object:
      await stripe.charges.retrieve(typeof evt.data.object.charge==='string'?
        evt.data.object.charge:evt.data.object.charge?.id);
    const paymentIntent=typeof ch.payment_intent==='string'?ch.payment_intent:ch.payment_intent?.id;
    if(paymentIntent){
      await query(`UPDATE purchases SET status='revoked' WHERE payment_intent=$1`,[paymentIntent]);
      // All issued licenses also stop working because entitlementIsPaid checks
      // only active orders, in addition to checking Stripe on each payload fetch.
    }
  }
  res.sendStatus(200);
 }catch(e){console.error('Stripe webhook failure',e);res.sendStatus(500);}
});
app.use(express.json({limit:'20kb'}));app.use('/api',validateOrigin);
// First-party customer contact form. The browser cannot choose the recipient,
// and no mail app or paid support platform is required to submit a request.
// Successful API acceptance means the mail provider accepted it, not guaranteed inbox delivery.
// First-party support chat; real admin replies require the signed-in support account.
registerZebraChat({app,query,fetchUser,sendShopEmail,supportEmail:()=>process.env.SUPPORT_EMAIL||''});
app.post('/api/support/request',supportFormLimiter,async(req,res)=>{
 const input=validateSupportRequest(req.body);
 if(!input.ok)return res.status(400).json({ok:false,error:input.error});
 if(input.discard)return res.status(202).json({ok:true,reference:'REQUEST-RECEIVED'});
 const destination=String(process.env.SUPPORT_EMAIL||'').trim();
 if(!emailValid(destination)||!activeMailer()||providerAuth==='unauthorized'||providerAuth==='forbidden')
   return res.status(503).json({ok:false,error:'Email support is temporarily unavailable. Use the Gmail or email-app option below.'});
 const reference='ZBS-'+randomBytes(6).toString('hex').toUpperCase();
 const payload=supportEmailContent(input,reference);
 try{
  await sendShopEmail({to:destination,replyTo:input.email,
    subject:payload.subject,text:payload.text,
    idempotencyKey:'zebra-support-'+reference});
  res.status(202).json({ok:true,reference});
 }catch(err){
  console.warn('Support email rejected',err?.code||'MAIL_PROVIDER_ERROR',Number(err?.status)||'');
  res.status(503).json({ok:false,error:'Unable to submit right now. Please use Gmail or your email app instead.'});
 }
});

app.get('/api/store',async(req,res)=>{
 try{
  await refreshLiveMerchant();
  const state=publicState();
  if(testMode()){
   const user=await fetchUser(req);
   const approved=isSandboxTester(user?.email);
   if(!approved&&state.checkout_ready){
    state.checkout_ready=false;
    state.test_checkout_ready=false;
    state.checkout_message='This shop is in Stripe sandbox testing. Only approved test accounts can check out. No real money is charged.';
   }
   // No public sandbox sales or free script access. Protected script QA is
   // possible only for an approved tester and an explicit server-side toggle.
   const scriptsAllowed=approved&&process.env.ENABLE_TEST_SOFTWARE_DELIVERY==='1';
   if(!scriptsAllowed){
    state.catalog.products=state.catalog.products.map(p=>({...p,unavailable:true}));
    state.catalog.bundles=state.catalog.bundles.map(p=>({...p,unavailable:true}));
   }
   state.catalog.extras=state.catalog.extras.map(p=>({...p,
    unavailable:p.id!=='checkout-test'||!approved||!state.test_checkout_ready}));
  }
  res.json(state);
 }catch(e){safeError(res,e);}
});
// Public price preview only. Stripe always receives the server-validated amount.
const quoteLimiter=rateLimit({windowMs:15*60*1000,limit:80,standardHeaders:'draft-7',legacyHeaders:false});
app.get('/api/discount/quote',quoteLimiter,(req,res)=>{
 const item=byId[String(req.query.sku||'')];
 if(!item||item.unavailable)return res.status(404).json({error:'Product not available.'});
 const quote=quoteFor(item,req.query.code);
 if(!quote.ok)return res.status(400).json({error:quote.error});
 res.json(quote);
});
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
  try{
   await sendShopEmail({to:email,subject:'Your Zebra\'s Shop sign-in code',
     text:`Your Zebra\'s Shop sign-in code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`});
  }catch(mailErr){
   await query('DELETE FROM email_codes WHERE email=$1',[email]);
   console.warn('Sign-in email provider error',mailErr.code||'EMAIL_SEND_FAILED',mailErr.status||'');
   return res.status(503).json({error:mailErr.message});
  }
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
 await refreshLiveMerchant();
 if(!checkoutReady())return res.status(503).json({error:checkoutStatus()||'Checkout is unavailable. No payment was taken.'});
 if(testMode()&&!mayCheckoutSandbox({email:req.user.email,sku:String(req.body?.sku||'')}))
  return res.status(403).json({error:'Stripe sandbox is restricted to approved testers. No real money was charged.'});
 if(req.body?.accepted_terms!==true)return res.status(400).json({error:'Please accept store terms before purchase.'});
 const sku=String(req.body?.sku||''),item=byId[sku];if(!item||!Number.isInteger(item.price)||item.price<50||!itemReadyForSale(item))return res.status(400).json({error:'This product has not passed delivery verification yet. No payment was taken.'});
 const quote=quoteFor(item,req.body?.discount_code);
 if(!quote.ok)return res.status(400).json({error:quote.error});
 // A $0 checkout must use a Stripe coupon and receive an actual completed
 // Stripe Checkout Session. No fabricated "paid" records or client-side unlocks.
 let freeReservation=null;
 let unfinishedSessionId=null;
 try{
  if(quote.free){
   freeReservation=await reserveFreePromo(req.user.id,sku);
   if(!freeReservation)return res.status(409).json({error:'This account already has a free-promotion reservation or redemption. Each account may claim one free order.'});
  }
  const sessionData={
   mode:'payment',customer_email:req.user.email,client_reference_id:req.user.id,
   line_items:[{price_data:{currency:'usd',unit_amount:quote.free?item.price:quote.total,
      product_data:{name:item.title,description:item.description.slice(0,400)}},quantity:1}],
   metadata:{sku,user_id:req.user.id,promo_code:quote.code||'',free_promo:quote.free?'v1':'no'},
   success_url:`${SITE.origin}/account/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
   cancel_url:`${SITE.origin}/scripts/?checkout=cancel`,
   expires_at:Math.floor(Date.now()/1000)+60*60
  };
  if(quote.free){
   const coupon=await ensureFreeCoupon();
   if(!coupon?.valid||coupon.percent_off!==100)throw new Error('Complimentary checkout coupon is unavailable.');
   sessionData.discounts=[{coupon:coupon.id}];
   sessionData.payment_method_collection='if_required';
  }else{
   sessionData.payment_intent_data={metadata:{sku,user_id:req.user.id,promo_code:quote.code||''}};
  }
  const session=await stripe.checkout.sessions.create(sessionData);
  unfinishedSessionId=session.id;
  await query('INSERT INTO purchases (session_id,user_id,sku,amount,status,created_at) VALUES ($1,$2,$3,$4,$5,$6)',[session.id,req.user.id,sku,quote.total,'pending',now()]);
  if(freeReservation){
   await query('UPDATE free_promo_redemptions SET session_id=$1 WHERE user_id=$2 AND session_id=$3',[session.id,req.user.id,freeReservation]);
  }
  unfinishedSessionId=null; // Order and any free-promo reservation are now durable.
  res.json({url:session.url,code:quote.code,amount:quote.total,free:!!quote.free});
 }catch(e){
  // Never leave a payable Stripe URL open when our database rejected the order.
  // This cleanup is best-effort; failed expiry must be visible to the operator.
  if(unfinishedSessionId)await expireIncompleteCheckout(stripe,unfinishedSessionId);
  if(freeReservation)await query('DELETE FROM free_promo_redemptions WHERE user_id=$1 AND session_id=$2',[req.user.id,freeReservation]).catch(()=>{});
  safeError(res,e);
 }
});
app.post('/api/confirm',checkoutLimiter,requireUser,async(req,res)=>{
 const sessionId=String(req.body?.session_id||'');if(!/^cs_(test_|live_)[A-Za-z0-9_]{10,200}$/.test(sessionId))return res.status(400).json({error:'Invalid checkout reference.'});
 if(!stripe)return res.status(503).json({error:'Payments not configured.'});
 try{
  const order=(await query('SELECT * FROM purchases WHERE session_id=$1 AND user_id=$2',[sessionId,req.user.id]))[0];
  if(!order)return res.status(404).json({error:'Purchase not found for this account.'});
  if(order.status==='revoked')return res.status(403).json({error:'This purchase is no longer active.'});
  const session=await stripe.checkout.sessions.retrieve(sessionId);
  const paid=await grantFromStripe(session);
  if(paid)await sendPurchaseConfirmation(sessionId);
  res.json({paid});
 }catch(e){safeError(res,e);}
});
app.get('/api/library',requireUser,async(req,res)=>{
 try{
  const orders=await query(`SELECT sku,amount,paid_at,session_id FROM purchases WHERE user_id=$1 AND status='paid' ORDER BY paid_at DESC`,[req.user.id]);
  const owned=[...new Set(orders.flatMap(o=>includedIds(byId[o.sku]||{id:o.sku})))];
  res.json({owned,orders:orders.map(({sku,amount,paid_at,session_id})=>({sku,amount,paid_at,session_id}))});
 }catch(e){safeError(res,e);}
});
// Authenticated users can open their own official Stripe hosted receipts.
app.get('/api/receipt/:sessionId',requireUser,async(req,res)=>{
 const id=String(req.params.sessionId||'');
 if(!/^cs_(test_|live_)[A-Za-z0-9_]{10,200}$/.test(id))return res.sendStatus(400);
 try{
  const order=(await query('SELECT payment_intent FROM purchases WHERE session_id=$1 AND user_id=$2 AND status=\'paid\'',
    [id,req.user.id]))[0];
  if(!order||!order.payment_intent)return res.sendStatus(404);
  if(!stripe)return res.status(503).json({error:'Receipts are temporarily unavailable.'});
  const pi=await stripe.paymentIntents.retrieve(order.payment_intent,{expand:['latest_charge']});
  const charge=pi.latest_charge;
  const url=typeof charge==='object'&&charge?.receipt_url;
  if(!url||!/^https:\/\/pay\.stripe\.com\//.test(url))return res.status(404).json({error:'Stripe receipt not available yet.'});
  res.set('Referrer-Policy','no-referrer');
  res.redirect(302,url);
 }catch(e){safeError(res,e);}
});
// Every paid item receives one active secret. The public launcher and source are different assets.
const licenseLimiter=rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-7',legacyHeaders:false});
const loaderLimiter=rateLimit({windowMs:60*1000,limit:50,standardHeaders:'draft-7',legacyHeaders:false});
const licenseLoaderLimiter=rateLimit({windowMs:60*1000,limit:50,standardHeaders:false,legacyHeaders:false,
 skip:req=>!validLicenseKey(req.query?.key),
 keyGenerator:req=>licenseRateLimitKey(req.query.key)});

async function entitlementIsPaid(userId,sku){
 // Test cards must never unlock real protected software for public visitors.
 if(testMode()){
  const owner=(await query('SELECT email FROM users WHERE id=$1',[userId]))[0];
  if(!mayDeliverSandboxScript(owner?.email))return false;
 }
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
 if(!products.some(p=>p.id===sku&&!p.unavailable)||payloadReadiness.products[sku]!=='verified')return res.sendStatus(404);
 try{
  if(!await entitlementIsPaid(req.user.id,sku))return res.status(403).json({error:'Verified purchase required. No license was issued.'});
  const key='ZBL_'+randomBytes(28).toString('hex');
  await query('UPDATE licenses SET revoked_at=$1 WHERE user_id=$2 AND sku=$3 AND revoked_at IS NULL',[now(),req.user.id,sku]);
  await query('INSERT INTO licenses (id,user_id,sku,token_hash,created_at) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),req.user.id,sku,sha(key),now()]);
  res.json({loadstring:buyerLoadstring(sku,key),note:'The raw GitHub link is a public, license-only bootstrap. Your full script is delivered privately by Zebra’s Shop after verified ownership. This personal command contains your key; rotating it revokes the previous one.'});
 }catch(e){safeError(res,e);}
});
// Runtime licenses do not use browser cookies. Every delivery verifies the paid account.
app.get('/api/loader/:sku',loaderLimiter,licenseLoaderLimiter,async(req,res)=>{
 const sku=String(req.params.sku),key=String(req.query.key||'');
 if(!products.some(p=>p.id===sku&&!p.unavailable)||payloadReadiness.products[sku]!=='verified'||!/^ZBL_[a-f0-9]{56}$/.test(key))return res.sendStatus(403);
 try{
  const found=(await query('SELECT * FROM licenses WHERE token_hash=$1 AND sku=$2 AND revoked_at IS NULL',[sha(key),sku]))[0];
  if(!found||!await entitlementIsPaid(found.user_id,sku))return res.sendStatus(403);
  const item=products.find(p=>p.id===sku);
  if(!hasSealed(SCRIPT_DIR,item.file))return res.sendStatus(503);
  const payload=readVerifiedScript(SCRIPT_DIR,item.file,PAYLOAD_MANIFEST);
  await query('UPDATE licenses SET last_used_at=$1 WHERE id=$2',[now(),found.id]);
  res.set({'Referrer-Policy':'no-referrer','Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','Content-Disposition':'inline'});
  res.send(payload);
 }catch(e){safeError(res,e);}
});
// Paid installer is never publicly exposed by the web server.
app.get('/api/injector/download',downloadLimiter,requireUser,async(req,res)=>{
 try{
  if(!await entitlementIsPaid(req.user.id,'zflag-injector'))return res.status(403).json({error:'Verified ZFLAG purchase required.'});
  if(!zflagInstallerReady)return res.status(503).json({error:'Updated checksum-verified ZFLAG installer is not available yet.'});
  const binary=readSealed(SCRIPT_DIR,'zflag-setup.exe');
  res.set({'Cache-Control':'private,no-store','Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="ZFLAG_Setup.exe"','X-Robots-Tag':'noindex','Content-Length':String(binary.length)});
  res.end(binary);
 }catch(e){safeError(res,e);}
});
// Legacy direct downloads are intentionally disabled: buyers receive loaders only.
app.get('/api/download/:sku',(_req,res)=>res.status(410).json({error:'Raw downloads are disabled. Open My Library and generate your licensed loadstring.'}));
app.get('/api/health',(_req,res)=>{
 const vaultReady=payloadReadiness.ready;
 res.json({
  ok:true,service:'zebra-store',checkout:checkoutReady()?'configured':'disabled',
  deployed_git_commit:/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT||'')?process.env.RENDER_GIT_COMMIT:null,
  mode:testMode()?'test':process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')?'live':'unconfigured',
  email_login_ready:mailReady()&&usingPostgres&&providerAuth!=='unauthorized'&&providerAuth!=='forbidden',email_sender_mode:mailerMode(),email_provider_auth:providerAuth,
  stripe_api_ready:stripeAuth==='authorized',stripe_key_status:stripeAuth,webhook_configured:configuredWebhookSecret(process.env.STRIPE_SECRET_KEY,process.env),
  postgres_ready:usingPostgres,vault_ready:vaultReady,verified_script_count:Object.values(payloadReadiness.products).filter(v=>v==='verified').length,zflag_installer_ready:zflagInstallerReady,
   live_merchant_ready:configuredForLive()&&liveMerchant.ready,
  disabled_by_owner:process.env.DISABLE_CHECKOUT==='1',
  sandbox_testers_configured:sandboxEmails().length>0,
  sandbox_script_delivery_enabled:testMode()&&process.env.ENABLE_TEST_SOFTWARE_DELIVERY==='1'
 });
});
app.use(express.static(path.join(ROOT,'public'),{index:'index.html',dotfiles:'deny',setHeaders:r=>r.setHeader('Cache-Control','public,max-age=300')}));
app.get('*',(_req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));
init().then(async()=>{
 await Promise.all([
  checkProviderOnStartup().catch(()=>console.warn('Email provider diagnostic unavailable')),
  checkStripeOnStartup().catch(()=>console.warn('Stripe key diagnostic unavailable'))
 ]);
 console.log('Protected script integrity:',Object.values(payloadReadiness.products).filter(v=>v==='verified').length,'of 6');
 console.log('ZFLAG approved installer:',zflagInstallerReady?'verified':'not_available');
 app.listen(PORT,'0.0.0.0',()=>console.log(`BL Scripts Marketplace at ${SITE.origin}; checkout ${checkoutReady()?'READY':'LOCKED'}`));
}).catch(e=>{console.error('Database initialization failed',e);process.exit(1);});
export {app,checkoutReady,grantFromStripe};
