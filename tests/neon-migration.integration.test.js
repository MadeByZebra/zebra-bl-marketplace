// Runs only in GitHub Actions with an ephemeral local Postgres service.
// All credentials are disposable and no live Render/Neon account is touched.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {marketplaceSchema,MARKETPLACE_TABLES} from '../marketplace-schema.js';
import {migrateMarketplaceDatabase} from '../neon-migration.js';

const adminUrl=process.env.TEST_POSTGRES_ADMIN_URL;
const dbTest=adminUrl?test:test.skip;
const dbs=['zebra_source_ok','zebra_target_ok','zebra_source_bad','zebra_target_bad','zebra_source_full','zebra_target_full'];
let admin;
function dbUrl(db){const u=new URL(adminUrl);u.pathname='/'+db;return u.toString();}
async function seed(pool,{extraColumn=false}={}){
 for(const sql of marketplaceSchema)await pool.query(sql);
 if(extraColumn)await pool.query('ALTER TABLE users ADD COLUMN unexpected_source_column TEXT');
 await pool.query("INSERT INTO email_codes(email,code_hash,attempts,expires_at,sent_at) VALUES ('buyer@demo.invalid','hash',0,100,50)");
 await pool.query("INSERT INTO users(id,email,password_hash,created_at) VALUES ('user-one','buyer@demo.invalid','salt:hash',1)");
 await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ('token-hash','user-one',100)");
 await pool.query("INSERT INTO purchases(session_id,user_id,sku,amount,status,payment_intent,created_at,paid_at) VALUES ('cs_test_unique123','user-one','str-grinder',999,'paid','pi_demo',1,2)");
 await pool.query("INSERT INTO licenses(id,user_id,sku,token_hash,created_at) VALUES ('license-one','user-one','str-grinder','secret-hash',1)");
 await pool.query("INSERT INTO purchase_notifications(session_id,sent_at) VALUES ('cs_test_unique123',2)");
 await pool.query("INSERT INTO free_promo_redemptions(user_id,sku,session_id,created_at) VALUES ('user-one','str-grinder','cs_test_unique123',1)");
 await pool.query("INSERT INTO zebra_chat_threads(id,token_hash,status,created_at,updated_at,last_alert_at) VALUES ('thread-one','chat-token','bot',1,2,0)");
 await pool.query("INSERT INTO zebra_chat_messages(id,thread_id,sender,text,created_at) VALUES ('msg-one','thread-one','visitor','Hello',1)");
}
async function totalRows(pool){
 const result={};
 for(const table of MARKETPLACE_TABLES){
  const r=await pool.query('SELECT COUNT(*)::int AS count FROM '+table);
  result[table]=r.rows[0].count;
 }
 return result;
}
before(async()=>{
 if(!adminUrl)return;
 admin=new Pool({connectionString:adminUrl});
 for(const name of dbs)await admin.query('CREATE DATABASE '+name);
});
after(async()=>{if(admin)await admin.end()});

dbTest('copies all nine business tables; preserves customer records and source exactly; reruns safely',async()=>{
 const source=new Pool({connectionString:dbUrl('zebra_source_ok')});
 const target=new Pool({connectionString:dbUrl('zebra_target_ok')});
 try{
  await seed(source);
  const beforeCounts=await totalRows(source);
  const result=await migrateMarketplaceDatabase({
   sourceUrl:dbUrl('zebra_source_ok'),targetUrl:dbUrl('zebra_target_ok'),
   targetPool:target,makeSourcePool:url=>new Pool({connectionString:url}),maintenanceActive:true
  });
  assert.equal(result.status,'migrated');
  assert.deepEqual(result.counts,beforeCounts);
  assert.deepEqual(await totalRows(target),beforeCounts);
  assert.deepEqual(await totalRows(source),beforeCounts);
  const order=(await target.query('SELECT * FROM purchases')).rows[0];
  assert.equal(order.payment_intent,'pi_demo');
  assert.equal(order.amount,999);
  assert.equal(order.status,'paid');
  assert.equal((await target.query('SELECT * FROM licenses')).rows[0].token_hash,'secret-hash');
  assert.equal((await target.query('SELECT text FROM zebra_chat_messages')).rows[0].text,'Hello');
  const rerun=await migrateMarketplaceDatabase({
   sourceUrl:dbUrl('zebra_source_ok'),targetUrl:dbUrl('zebra_target_ok'),
   targetPool:target,makeSourcePool:()=>{throw Error('Old database should never be reopened');},maintenanceActive:false
  });
  assert.equal(rerun.status,'already_migrated');
 }finally{await source.end();await target.end();}
});

dbTest('a mismatched source schema rolls back ALL copied tables and migration marker',async()=>{
 const source=new Pool({connectionString:dbUrl('zebra_source_bad')});
 const target=new Pool({connectionString:dbUrl('zebra_target_bad')});
 try{
  await seed(source,{extraColumn:true});
  await assert.rejects(()=>migrateMarketplaceDatabase({
   sourceUrl:dbUrl('zebra_source_bad'),targetUrl:dbUrl('zebra_target_bad'),
   targetPool:target,makeSourcePool:url=>new Pool({connectionString:url}),maintenanceActive:true
  }),/schema differs for table: users/);
  const tables=(await target.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows;
  assert.equal(tables.length,0,'Failed migration must not leave tables, marker or partial customer data');
  assert.equal((await source.query('SELECT COUNT(*)::int AS count FROM purchases')).rows[0].count,1);
 }finally{await source.end();await target.end();}
});

dbTest('first migration refuses unfrozen source and populated destinations',async()=>{
 const source=new Pool({connectionString:dbUrl('zebra_source_full')});
 const target=new Pool({connectionString:dbUrl('zebra_target_full')});
 try{
  await seed(source);
  await assert.rejects(()=>migrateMarketplaceDatabase({
   sourceUrl:dbUrl('zebra_source_full'),targetUrl:dbUrl('zebra_target_full'),
   targetPool:target,makeSourcePool:url=>new Pool({connectionString:url}),maintenanceActive:false
  }),/STORE_MAINTENANCE=1/);
  await seed(target);
  await assert.rejects(()=>migrateMarketplaceDatabase({
   sourceUrl:dbUrl('zebra_source_full'),targetUrl:dbUrl('zebra_target_full'),
   targetPool:target,makeSourcePool:()=>{throw Error('Should reject occupied target before source access')},
   maintenanceActive:true
  }),/target contains existing store records/);
 }finally{await source.end();await target.end();}
});
