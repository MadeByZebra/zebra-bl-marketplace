import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {retryablePurchaseEmailQuery,retryPendingPurchaseEmails} from '../purchase-email-retry.js';

test('select only completed paid orders missing email notifications in the current Stripe mode',()=>{
 const sql=retryablePurchaseEmailQuery();
 assert.match(sql,/p.status='paid'/);
 assert.match(sql,/LEFT JOIN purchase_notifications n ON n.session_id=p.session_id/);
 assert.match(sql,/n.session_id IS NULL/);
 assert.match(sql,/SUBSTR\(p.session_id,1,8\)=\$1/);
 assert.match(sql,/LIMIT \$2/);
});
test('only attempt unsent sandbox orders when running against sandbox',async()=>{
 const calls=[],db=[];
 const result=await retryPendingPurchaseEmails({
  modePrefix:'cs_test_',limit:3,
  query:async(sql,args)=>{db.push({sql,args});return [
   {session_id:'cs_test_customerA'},{session_id:'cs_live_customerB'},
   {session_id:'cs_test_customerC'}
  ]},
  send:async id=>calls.push(id)
 });
 assert.deepEqual(calls,['cs_test_customerA','cs_test_customerC']);
 assert.deepEqual(db[0].args,['cs_test_',3]);
 assert.deepEqual(result,{attempted:2,errors:0});
});
test('cannot query or send receipts with unknown payment environment',async()=>{
 let calls=0;
 const result=await retryPendingPurchaseEmails({
  modePrefix:null,query:async()=>{calls++},send:async()=>{calls++}
 });
 assert.deepEqual(result,{attempted:0,skipped:'unknown_payment_mode'});
 assert.equal(calls,0);
});
test('one failing send does not block the following purchaser receipt',async()=>{
 const ids=[],warnings=[];
 const result=await retryPendingPurchaseEmails({
  modePrefix:'cs_live_',query:async()=>[{session_id:'cs_live_failed'},{session_id:'cs_live_ok'}],
  send:async id=>{ids.push(id);if(id==='cs_live_failed')throw Object.assign(new Error('provider detail must not be logged'),{code:'MAIL_PROVIDER_TEMPORARY'});},
  report:(...parts)=>warnings.push(parts)
 });
 assert.deepEqual(ids,['cs_live_failed','cs_live_ok']);
 assert.deepEqual(result,{attempted:2,errors:1});
 assert.deepEqual(warnings,[['Purchase receipt retry failed:','MAIL_PROVIDER_TEMPORARY']]);
});
test('retry batches are bounded even with a misconfigured operator limit',async()=>{
 let received=null;
 await retryPendingPurchaseEmails({
  modePrefix:'cs_live_',limit:5000,query:async(sql,args)=>{received=args;return []},send:async()=>{}
 });
 assert.deepEqual(received,['cs_live_',20]);
});
test('the storefront starts bounded retry only after the server is running',()=>{
 const s=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(s,/async function retryUnsentConfirmations\(\)/);
 assert.match(s,/purchaseEmailRetryActive/);
 assert.match(s,/retryPendingPurchaseEmails\(\{query,send:sendPurchaseConfirmation,modePrefix,limit:10/);
 assert.match(s,/setTimeout\(\(\)=>\{void retryUnsentConfirmations\(\);\},30000\)/);
 assert.match(s,/setInterval\(\(\)=>\{void retryUnsentConfirmations\(\);\},5\*60\*1000\)/);
 assert.match(s,/periodic\.unref\?\.\(\)/);
});
