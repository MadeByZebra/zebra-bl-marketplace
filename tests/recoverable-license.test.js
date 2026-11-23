import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {recoverableKeyForLicense,isRecoverableLicense,shaToken,upgradeLegacyLicenseInPlace,MissingActiveLicenseError} from '../recoverable-license.js';
import {rotateLicenseAtomically} from '../license-rotation.js';

const secret='9f'.repeat(32);
const buyer='buyer-abc';
const id='bf57396a-1e8f-437a-a1b2-e81d3df43477';
const sku='fps-optimizer';
const makeDb=()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users(id TEXT PRIMARY KEY);
 CREATE TABLE licenses(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),
 sku TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at BIGINT NOT NULL,
 revoked_at BIGINT,last_used_at BIGINT);
 CREATE UNIQUE INDEX unique_active ON licenses(user_id,sku) WHERE revoked_at IS NULL;
 CREATE TABLE license_device_bindings(license_id TEXT PRIMARY KEY REFERENCES licenses(id),
 device_hash TEXT NOT NULL,approved_at BIGINT NOT NULL,last_used_at BIGINT NOT NULL,
 blocked_attempts INTEGER NOT NULL DEFAULT 0);
 INSERT INTO users(id) VALUES('buyer-abc');
 `);
 db.prepare('INSERT INTO licenses(id,user_id,sku,token_hash,created_at) VALUES(?,?,?,?,?)')
  .run(id,buyer,sku,shaToken('ZBL_'+'a'.repeat(56)),1795400000000);
 db.prepare('INSERT INTO license_device_bindings(license_id,device_hash,approved_at,last_used_at,blocked_attempts) VALUES(?,?,?,?,?)')
  .run(id,'6'.repeat(64),1795400000010,1795400000010,2);
 return db;
};
test('new buyer command is cryptographically derived, not written as plain text to the purchases database',()=>{
 const row={id,user_id:buyer,sku};
 const key=recoverableKeyForLicense(row,secret);
 assert.match(key,/^ZBL_[a-f0-9]{56}$/);
 assert.equal(key,recoverableKeyForLicense(row,secret));
 assert.notEqual(key,recoverableKeyForLicense({...row,id:'bf57396a-1e8f-437a-a1b2-e81d3df43478'},secret));
 assert.notEqual(key,recoverableKeyForLicense({...row,user_id:'another-buyer'},secret));
 assert.notEqual(key,recoverableKeyForLicense({...row,sku:'str-grinder'},secret));
 assert.notEqual(key,recoverableKeyForLicense(row,'a1'.repeat(32)));
 assert.equal(isRecoverableLicense({...row,token_hash:shaToken(key)},secret),true);
 assert.equal(isRecoverableLicense({...row,token_hash:shaToken(key)},'a1'.repeat(32)),false);
 assert.throws(()=>recoverableKeyForLicense(row,'bad'),/key derivation unavailable/);
});
test('a paid legacy account can recover an active key without using weekly resets or losing approved installation',async()=>{
 const db=makeDb();
 try{
  const old=db.prepare('SELECT * FROM licenses WHERE id=?').get(id);
  assert.equal(isRecoverableLicense(old,secret),false);
  const first=await upgradeLegacyLicenseInPlace({sqlite:db,userId:buyer,sku,rawSecret:secret});
  assert.equal(first.upgraded,true);
  assert.match(first.token,/^ZBL_[0-9a-f]{56}$/);
  assert.notEqual(shaToken(first.token),old.token_hash);
  const license=db.prepare('SELECT * FROM licenses WHERE id=?').get(id);
  assert.equal(license.id,id);
  assert.equal(license.revoked_at,null);
  assert.equal(license.token_hash,shaToken(first.token));
  assert.equal(isRecoverableLicense(license,secret),true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM licenses').get().n,1);
  const approved=db.prepare('SELECT * FROM license_device_bindings WHERE license_id=?').get(id);
  assert.equal(approved.device_hash,'6'.repeat(64));
  assert.equal(approved.blocked_attempts,2);
  const later=await upgradeLegacyLicenseInPlace({sqlite:db,userId:buyer,sku,rawSecret:secret});
  assert.deepEqual(later,{token:first.token,upgraded:false});
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM licenses').get().n,1);
 }finally{db.close();}
});
test('legacy migration cannot strand or mutate a license if the database update fails',async()=>{
 const db=makeDb();
 try{
  db.exec("CREATE TRIGGER reject_change BEFORE UPDATE OF token_hash ON licenses BEGIN SELECT RAISE(ABORT,'blocked write'); END;");
  await assert.rejects(()=>upgradeLegacyLicenseInPlace({sqlite:db,userId:buyer,sku,rawSecret:secret}),/blocked write/);
  assert.equal(db.prepare('SELECT token_hash FROM licenses WHERE id=?').get(id).token_hash,shaToken('ZBL_'+'a'.repeat(56)));
  assert.ok(db.prepare('SELECT * FROM license_device_bindings WHERE license_id=?').get(id));
 }finally{db.close();}
});
test('invalid account, nonexistent license and wrong server secret never rotate keys',async()=>{
 const db=makeDb();
 try{
  await assert.rejects(()=>upgradeLegacyLicenseInPlace({sqlite:db,userId:buyer,sku,rawSecret:'invalid'}),/key derivation unavailable/);
  await assert.rejects(()=>upgradeLegacyLicenseInPlace({sqlite:db,userId:'absent',sku,rawSecret:secret}),/Account no longer available/);
  await assert.rejects(()=>upgradeLegacyLicenseInPlace({sqlite:db,userId:buyer,sku:'end-grinder',rawSecret:secret}),MissingActiveLicenseError);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM licenses').get().n,1);
 }finally{db.close();}
});
test('future key rotation creates another retrievable key while preserving one active license',async()=>{
 const db=makeDb();
 try{
  const newId='66d05ce0-8c3e-4850-bf66-0747ca6ed606';
  const token=recoverableKeyForLicense({id:newId,user_id:buyer,sku},secret);
  await rotateLicenseAtomically({sqlite:db,userId:buyer,sku,licenseId:newId,tokenHash:shaToken(token),at:1795500000000,maxKeysPerWeek:4});
  const active=db.prepare('SELECT * FROM licenses WHERE revoked_at IS NULL').get();
  assert.equal(active.id,newId);
  assert.equal(isRecoverableLicense(active,secret),true);
  assert.equal(recoverableKeyForLicense(active,secret),token);
 }finally{db.close();}
});
test('public endpoints require login, paid entitlement and do not rotate on view or legacy recovery',()=>{
 const src=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(src,/app\.get\('\/api\/license\/:sku\/current',licenseLimiter,requireUser/);
 assert.match(src,/app\.post\('\/api\/license\/:sku\/recover',licenseLimiter,requireUser/);
 assert.match(src,/if\(!await entitlementIsPaid\(req\.user\.id,sku\)\)return res\.status\(403\)/);
 assert.match(src,/upgradeLegacyLicenseInPlace/);
 assert.match(src,/current_command_retrievable:recoverable/);
 assert.match(src,/legacy_recovery_available:!!bound&&!recoverable/);
 assert.match(src,/const key=recoverableKeyForLicense\(\{id,user_id:req\.user\.id,sku\}/);
 assert.doesNotMatch(src,/const key='ZBL_'\+randomBytes\(28\)/);
});
