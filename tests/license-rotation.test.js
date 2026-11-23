import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {rotateLicenseAtomically} from '../license-rotation.js';

const keyHash=c=>c.repeat(64);
const at=Date.UTC(2026,10,22,7);
function testDb(){
 const db=new DatabaseSync(':memory:');
 db.exec(`
 CREATE TABLE users(id TEXT PRIMARY KEY);
 CREATE TABLE licenses(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,sku TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,created_at BIGINT NOT NULL,revoked_at BIGINT);
 CREATE UNIQUE INDEX one_active ON licenses (user_id,sku) WHERE revoked_at IS NULL;`);
 db.prepare('INSERT INTO users(id) VALUES (?)').run('buyer');
 db.prepare('INSERT INTO licenses(id,user_id,sku,token_hash,created_at) VALUES (?,?,?,?,?)').run(
  'old-license','buyer','str-grinder',keyHash('a'),at-1000);
 return db;
}
test('successful SQLite key rotation revokes old license and persists exactly one new one',async()=>{
 const sqlite=testDb();
 try{
  await rotateLicenseAtomically({sqlite,userId:'buyer',sku:'str-grinder',
   licenseId:'new-license',tokenHash:keyHash('b'),at});
  const old=sqlite.prepare('SELECT revoked_at FROM licenses WHERE id=?').get('old-license');
  const fresh=sqlite.prepare('SELECT revoked_at,token_hash FROM licenses WHERE id=?').get('new-license');
  assert.equal(Number(old.revoked_at),at);
  assert.equal(fresh.revoked_at,null);
  assert.equal(fresh.token_hash,keyHash('b'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM licenses WHERE revoked_at IS NULL').get().n,1);
 }finally{sqlite.close();}
});
test('failed SQLite insertion rolls back revocation, preserving a buyer license',async()=>{
 const sqlite=testDb();
 try{
  // Duplicates the old token hash; the insert must reject and rollback.
  await assert.rejects(()=>rotateLicenseAtomically({sqlite,userId:'buyer',sku:'str-grinder',
   licenseId:'new-license',tokenHash:keyHash('a'),at}),/UNIQUE/);
  const existing=sqlite.prepare('SELECT revoked_at FROM licenses WHERE id=?').get('old-license');
  assert.equal(existing.revoked_at,null);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM licenses').get().n,1);
 }finally{sqlite.close();}
});
test('missing account and invalid rotation never strand a token',async()=>{
 const sqlite=testDb();
 try{
  await assert.rejects(()=>rotateLicenseAtomically({sqlite,userId:'absent',sku:'str-grinder',
   licenseId:'new',tokenHash:keyHash('b'),at}),/Account not found/);
  await assert.rejects(()=>rotateLicenseAtomically({sqlite,userId:'buyer',sku:'str-grinder',
   licenseId:'new',tokenHash:'bad-token',at}),/Invalid license rotation/);
  assert.equal(sqlite.prepare('SELECT revoked_at FROM licenses WHERE id=?').get('old-license').revoked_at,null);
 }finally{sqlite.close();}
});
test('Postgres locks the buyer then commits new license and retires old license together',async()=>{
 const calls=[];let released=0;
 const client={query:async(sql)=>{calls.push(sql);return sql.startsWith('SELECT')?{rowCount:1}:{rowCount:1}},
  release:()=>released++};
 await rotateLicenseAtomically({pool:{connect:async()=>client},userId:'buyer',sku:'str-grinder',
  licenseId:'new',tokenHash:keyHash('b'),at});
 assert.deepEqual(calls.map(s=>s.split(' ')[0]),['BEGIN','SELECT','UPDATE','INSERT','COMMIT']);
 assert.match(calls[1],/FOR UPDATE/);
 assert.equal(released,1);
});
test('Postgres insert failure triggers rollback and returns client to pool',async()=>{
 const calls=[];let released=0;
 const client={query:async(sql)=>{
   calls.push(sql);
   if(sql.startsWith('INSERT'))throw Error('DB insert failed');
   return sql.startsWith('SELECT')?{rowCount:1}:{rowCount:1};
  },release:()=>released++};
 await assert.rejects(()=>rotateLicenseAtomically({pool:{connect:async()=>client},
  userId:'buyer',sku:'str-grinder',licenseId:'new',tokenHash:keyHash('b'),at}),/DB insert failed/);
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.equal(released,1);
});
test('HTTP paid-license route uses transaction helper before returning loadstring',()=>{
 const src=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(src,/await rotateLicenseAtomically\(\{pool,sqlite,userId:req\.user\.id,sku,/);
 assert.match(src,/tokenHash:sha\(key\),at:now\(\),maxKeysPerWeek:4/);
 assert.match(src,/if\(!await entitlementIsPaid\(req\.user\.id,sku\)\)/);
 assert.doesNotMatch(src,/await query\('UPDATE licenses SET revoked_at=\$1 WHERE user_id=\$2/);
});
