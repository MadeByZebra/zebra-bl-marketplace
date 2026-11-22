import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pendingPurchaseReconciliationSql,reconcilePendingPurchases} from '../purchase-reconciliation.js';

const nowMs=Date.UTC(2026,10,22,6,0,0);

test('only recent pending orders in the active Stripe environment are selected',()=>{
 const sql=pendingPurchaseReconciliationSql();
 assert.match(sql,/status='pending'/);
 assert.match(sql,/SUBSTR\(session_id,1,8\)=\$1/);
 assert.match(sql,/created_at >=\$2 AND created_at <=\$3/);
 assert.match(sql,/ORDER BY created_at DESC LIMIT \$4/);
});
test('verified paid recent sessions get confirmed and receive purchase mail',async()=>{
 const calls=[],db=[];
 const r=await reconcilePendingPurchases({
  nowMs,prefix:'cs_test_',limit:2,
  query:async(sql,args)=>{db.push(args);return [
   {session_id:'cs_test_paid123'},{session_id:'cs_test_unpaid456'}
  ]},
  fetchSession:async id=>{calls.push(['fetch',id]);return {id,payment_status:id.includes('unpaid')?'unpaid':'paid'};},
  confirmPaid:async session=>{calls.push(['verify',session.id]);return true;},
  notify:async id=>calls.push(['notify',id])
 });
 assert.deepEqual(db,[[ 'cs_test_', nowMs-7*24*60*60*1000, nowMs-45*1000, 2 ]]);
 assert.deepEqual(r,{scanned:2,confirmed:1,errors:0});
 assert.deepEqual(calls,[
  ['fetch','cs_test_paid123'],['verify','cs_test_paid123'],['notify','cs_test_paid123'],
  ['fetch','cs_test_unpaid456']
 ]);
});
test('failed or rejected Stripe verification cannot unlock a product or send receipt',async()=>{
 const events=[];
 const r=await reconcilePendingPurchases({
  nowMs,prefix:'cs_live_',
  query:async()=>[{session_id:'cs_test_nope'},{session_id:'cs_live_forged'},{session_id:'cs_live_invalid'}],
  fetchSession:async id=>({id,payment_status:'paid'}),
  confirmPaid:async s=>{events.push(['verify',s.id]);return false;},
  notify:async id=>events.push(['notify',id])
 });
 assert.deepEqual(r,{scanned:2,confirmed:0,errors:0});
 assert.deepEqual(events,[['verify','cs_live_forged'],['verify','cs_live_invalid']]);
});
test('mismatching Stripe response or no-payment session cannot generate an entitlement',async()=>{
 const notified=[];
 const result=await reconcilePendingPurchases({
  nowMs,prefix:'cs_live_',query:async()=>[{session_id:'cs_live_expected'},{session_id:'cs_live_open'}],
  fetchSession:async id=>({id:id==='cs_live_expected'?'cs_live_other':id,
   payment_status:id==='cs_live_open'?'unpaid':'paid'}),
  confirmPaid:async()=>{throw Error('must not call verify');},
  notify:async id=>notified.push(id)
 });
 assert.deepEqual(result,{scanned:2,confirmed:0,errors:0});
 assert.deepEqual(notified,[]);
});
test('one Stripe error does not block other recoverable orders',async()=>{
 const got=[],warnings=[];
 const r=await reconcilePendingPurchases({
  nowMs,prefix:'cs_live_',query:async()=>[{session_id:'cs_live_bad'},{session_id:'cs_live_good'}],
  fetchSession:async id=>{if(id==='cs_live_bad')throw Object.assign(Error('sensitive error message'),{code:'not_available'});
   return {id,payment_status:'paid'};},
  confirmPaid:async s=>{got.push('verified '+s.id);return true;},
  notify:async id=>got.push('notified '+id),
  report:(...x)=>warnings.push(x)
 });
 assert.deepEqual(r,{scanned:2,confirmed:1,errors:1});
 assert.deepEqual(got,['verified cs_live_good','notified cs_live_good']);
 assert.deepEqual(warnings,[['Pending Stripe order reconciliation failed:','not_available']]);
});
test('unrecognized modes or invalid timestamps never access purchase database',async()=>{
 let calls=0;const args={query:async()=>{calls++;return []},
  fetchSession:async()=>{calls++},confirmPaid:async()=>{calls++},notify:async()=>{calls++}};
 assert.equal((await reconcilePendingPurchases({...args,prefix:null})).skipped,'unrecognized_stripe_mode');
 assert.equal((await reconcilePendingPurchases({...args,prefix:'cs_live_',nowMs:-1})).skipped,'invalid_time');
 assert.equal(calls,0);
});
test('batch caps to prevent excessive Stripe API traffic',async()=>{
 let args;
 await reconcilePendingPurchases({
  nowMs,prefix:'cs_live_',limit:200,
  query:async(sql,params)=>{args=params;return []},
  fetchSession:async()=>{},confirmPaid:async()=>{},notify:async()=>{}
 });
 assert.equal(args[3],20);
});
test('server schedules safe reconciliation after startup with no payment initiation',()=>{
 const s=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(s,/pendingReconcileActive/);
 assert.match(s,/fetchSession:id=>stripe\.checkout\.sessions\.retrieve\(id\)/);
 assert.match(s,/confirmPaid:grantFromStripe,notify:sendPurchaseConfirmation/);
 assert.match(s,/reconciliationLoop=setInterval\(\(\)=>\{void reconcilePendingOrders\(\);\},3\*60\*1000\)/);
 assert.match(s,/reconciliationLoop\.unref\?\.\(\)/);
});
