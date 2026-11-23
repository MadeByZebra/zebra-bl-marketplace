import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hashedNetwork,canonicalNetwork,authorizeNetwork} from '../license-network-binding.js';
import {rotateLicenseAtomically,LicenseRotationLimitError} from '../license-rotation.js';

const at=Date.UTC(2026,10,22,18,0);
const buyer='buyer';
const id='b8c0351d-6c7e-4897-92bf-008031f01d74';
const otherId='b7c0351d-6c7e-4897-92bf-008031f01d75';
function db(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users(id TEXT PRIMARY KEY);
 CREATE TABLE licenses(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),
 sku TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at BIGINT NOT NULL,revoked_at BIGINT);
 CREATE UNIQUE INDEX only_active ON licenses(user_id,sku) WHERE revoked_at IS NULL;
 CREATE TABLE license_network_bindings(license_id TEXT PRIMARY KEY REFERENCES licenses(id),
 network_hash TEXT NOT NULL,first_seen_at BIGINT NOT NULL,last_seen_at BIGINT NOT NULL,
 blocked_attempts INTEGER NOT NULL DEFAULT 0);`);
 sqlite.prepare('INSERT INTO users(id) VALUES(?)').run(buyer);
 sqlite.prepare('INSERT INTO licenses(id,user_id,sku,token_hash,created_at) VALUES(?,?,?,?,?)')
  .run(id,buyer,'fps-optimizer','a'.repeat(64),at);
 return sqlite;
}
test('binds only to a real network and does not store customer IP addresses',()=>{
 assert.equal(canonicalNetwork('203.0.113.11'),'ipv4:203.0.113.11');
 assert.equal(canonicalNetwork('::ffff:203.0.113.11'),'ipv4:203.0.113.11');
 assert.equal(canonicalNetwork('2001:db8:abcd:1234::1'),'ipv6:2001:0db8:abcd:1234');
 assert.equal(canonicalNetwork('2001:db8:abcd:1234::9999'),'ipv6:2001:0db8:abcd:1234');
 assert.equal(canonicalNetwork('not-an-ip'),null);
 assert.equal(hashedNetwork('not-an-ip',id),null);
 assert.equal(hashedNetwork('203.0.113.11',id),hashedNetwork('::ffff:203.0.113.11',id));
 assert.notEqual(hashedNetwork('203.0.113.11',id),hashedNetwork('203.0.113.12',id));
 assert.notEqual(hashedNetwork('203.0.113.11',id),hashedNetwork('203.0.113.11',otherId));
});
test('one license is first-use bound; a copied key on another network is denied and counted',async()=>{
 const sqlite=db();
 try{
  const a=hashedNetwork('203.0.113.11',id),b=hashedNetwork('203.0.113.12',id);
  assert.equal(await authorizeNetwork({sqlite,licenseId:id,networkHash:a,at}),true);
  assert.equal(await authorizeNetwork({sqlite,licenseId:id,networkHash:a,at:at+1000}),true);
  assert.equal(await authorizeNetwork({sqlite,licenseId:id,networkHash:b,at:at+2000}),false);
  const row=sqlite.prepare('SELECT * FROM license_network_bindings WHERE license_id=?').get(id);
  assert.equal(row.network_hash,a);
  assert.equal(row.blocked_attempts,1);
  assert.equal(Number(row.last_seen_at),at+1000);
  assert.equal(JSON.stringify(row).includes('203.0.113'),false);
 }finally{sqlite.close();}
});
test('buyer rotation retires shared key and allows new network, but only three keys per week',async()=>{
 const sqlite=db();
 try{
  const old=hashedNetwork('203.0.113.11',id);
  assert.equal(await authorizeNetwork({sqlite,licenseId:id,networkHash:old,at}),true);
  await rotateLicenseAtomically({sqlite,userId:buyer,sku:'fps-optimizer',
   licenseId:otherId,tokenHash:'b'.repeat(64),at:at+1000,maxKeysPerWeek:3});
  assert.ok(sqlite.prepare('SELECT revoked_at FROM licenses WHERE id=?').get(id).revoked_at);
  assert.equal(await authorizeNetwork({sqlite,licenseId:otherId,networkHash:hashedNetwork('203.0.113.12',otherId),at:at+2000}),true);
  const thirdId='b6c0351d-6c7e-4897-92bf-008031f01d76';
  await rotateLicenseAtomically({sqlite,userId:buyer,sku:'fps-optimizer',
   licenseId:thirdId,tokenHash:'c'.repeat(64),at:at+3000,maxKeysPerWeek:3});
  await assert.rejects(()=>rotateLicenseAtomically({sqlite,userId:buyer,sku:'fps-optimizer',
   licenseId:'b5c0351d-6c7e-4897-92bf-008031f01d77',tokenHash:'d'.repeat(64),
   at:at+4000,maxKeysPerWeek:3}),LicenseRotationLimitError);
  assert.equal(sqlite.prepare('SELECT revoked_at FROM licenses WHERE id=?').get(thirdId).revoked_at,null);
 }finally{sqlite.close();}
});
test('server checks paid entitlement and network binding before sending any payload',()=>{
 const s=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(s,/await entitlementIsPaid\(found\.user_id,sku\)/);
 assert.match(s,/hashedNetwork\(req\.ip,found\.id\)/);
 assert.match(s,/await authorizeNetwork\(\{pool,sqlite,licenseId:found\.id,networkHash,at:now\(\)\}\)/);
 assert.match(s,/maxKeysPerWeek:4/);
 assert.match(s,/app\.get\('\/api\/license-status\/:sku',requireUser/);
 assert.match(s,/blocked_network_attempts/);
});
