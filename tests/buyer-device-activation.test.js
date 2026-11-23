import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {requestDeviceApproval,approveInstallation,installationHash} from '../license-device-approval.js';
import {issueExecutionTicket,redeemExecutionTicket,wrapLuaWithTicket} from '../license-execution-ticket.js';

const licenseId='372f8c58-092b-495a-92a1-796657bb3ece';
const deviceA='a'.repeat(64),deviceB='b'.repeat(64);
const t=Date.UTC(2026,10,23,12);
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE licenses(id TEXT PRIMARY KEY);
 CREATE TABLE license_device_pairings(license_id TEXT NOT NULL REFERENCES licenses(id),
  device_hash TEXT NOT NULL,code_hash TEXT NOT NULL,requested_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,PRIMARY KEY(license_id,device_hash));
 CREATE INDEX license_device_pairings_expiry ON license_device_pairings(expires_at);
 CREATE TABLE license_device_bindings(license_id TEXT PRIMARY KEY REFERENCES licenses(id),
  device_hash TEXT NOT NULL,approved_at BIGINT NOT NULL,last_used_at BIGINT NOT NULL,
  blocked_attempts INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE license_execution_tickets(token_hash TEXT PRIMARY KEY,license_id TEXT NOT NULL REFERENCES licenses(id),
  sku TEXT NOT NULL,created_at BIGINT NOT NULL,expires_at BIGINT NOT NULL,consumed_at BIGINT);
 CREATE INDEX license_execution_tickets_expiry ON license_execution_tickets(expires_at);
 INSERT INTO licenses(id) VALUES('${licenseId}');
 `);
 const query=async(sql,values=[])=>{
  const statement=db.prepare(sql.replace(/\$\d+/g,'?'));
  return /^\s*(SELECT|WITH)\b/i.test(sql)||/\bRETURNING\b/i.test(sql)
    ?statement.all(...values):(statement.run(...values),[]);
 };
 return {db,query};
}
test('only a paid buyer who submits the pairing code through the authenticated site can approve an installation',async()=>{
 const {db,query}=fixture();
 try{
  const first=await requestDeviceApproval({query,licenseId,deviceSecret:deviceA,at:t});
  assert.equal(first.status,'pending');
  assert.equal(first.code,'AAAAAAAAAA');
  assert.equal((await requestDeviceApproval({query,licenseId,deviceSecret:deviceA,at:t+10})).status,'pending');
  assert.equal((await requestDeviceApproval({query,licenseId,deviceSecret:deviceB,at:t+20})).status,'pending');
  assert.equal((await approveInstallation({query,licenseId,code:'FFFFFFFFFF',at:t+30})).status,'expired_or_invalid');
  assert.equal((await approveInstallation({query,licenseId,code:first.code,at:t+40})).status,'approved');
  assert.equal((await requestDeviceApproval({query,licenseId,deviceSecret:deviceA,at:t+50})).status,'approved');
  assert.equal((await requestDeviceApproval({query,licenseId,deviceSecret:deviceB,at:t+60})).status,'different_device');
  const bound=db.prepare('SELECT * FROM license_device_bindings WHERE license_id=?').get(licenseId);
  assert.equal(bound.device_hash,installationHash(licenseId,deviceA));
  assert.equal(bound.blocked_attempts,1);
  assert.equal(JSON.stringify(bound).includes(deviceA),false);
  assert.equal((await approveInstallation({query,licenseId,code:'BBBBBBBBBB',at:t+100})).status,'expired_or_invalid');
 }finally{db.close();}
});
test('unapproved clients cannot authorize themselves; pairing codes expire and pending attempts are bounded',async()=>{
 const {db,query}=fixture();
 try{
  assert.equal((await requestDeviceApproval({query,licenseId,deviceSecret:'invalid',at:t})).status,'invalid');
  const one=await requestDeviceApproval({query,licenseId,deviceSecret:'1'.repeat(64),at:t});
  const two=await requestDeviceApproval({query,licenseId,deviceSecret:'2'.repeat(64),at:t});
  const three=await requestDeviceApproval({query,licenseId,deviceSecret:'3'.repeat(64),at:t});
  assert.equal([one.status,two.status,three.status].join(','),'pending,pending,pending');
  assert.equal((await requestDeviceApproval({query,licenseId,deviceSecret:'4'.repeat(64),at:t})).status,'too_many_requests');
  assert.equal((await approveInstallation({query,licenseId,code:one.code,at:t+600001})).status,'expired_or_invalid');
  assert.equal((await requestDeviceApproval({query,licenseId,deviceSecret:'4'.repeat(64),at:t+600001})).status,'pending');
 }finally{db.close();}
});
test('runtime ticket is one-time and expires; copying a previously used Lua payload fails',async()=>{
 const {db,query}=fixture();
 try{
  const ticket=await issueExecutionTicket({query,licenseId,sku:'fps-optimizer',at:t});
  assert.match(ticket,/^[a-f0-9]{64}$/);
  assert.equal(await redeemExecutionTicket({query,token:ticket,sku:'str-grinder',at:t+1}),null);
  assert.equal(await redeemExecutionTicket({query,token:ticket,sku:'fps-optimizer',at:t+1}),licenseId);
  assert.equal(await redeemExecutionTicket({query,token:ticket,sku:'fps-optimizer',at:t+2}),null);
  const expired=await issueExecutionTicket({query,licenseId,sku:'fps-optimizer',at:t+10});
  assert.equal(await redeemExecutionTicket({query,token:expired,sku:'fps-optimizer',at:t+120011}),null);
  const fresh=await issueExecutionTicket({query,licenseId,sku:'fps-optimizer',at:t+120012});
  assert.equal(await redeemExecutionTicket({query,token:fresh,sku:'fps-optimizer',at:t+120013}),licenseId);
 }finally{db.close();}
});
test('delivered paid payload has a runtime check and non-PII attribution before the original obfuscated script',()=>{
 const source=Buffer.from('-- ALREADY-OBFUSCATED BUYER LUA\nreturn true\n');
 const url='https://zebra-bl-marketplace.onrender.com/api/runtime/fps-optimizer?token='+'a'.repeat(64);
 const delivered=wrapLuaWithTicket(source,url,licenseId,'fps-optimizer').toString('utf8');
 assert.match(delivered,/per-license delivery id [a-f0-9]{24}/);
 assert.match(delivered,/game:HttpGet/);
 assert.match(delivered,/ZBL_OK/);
 assert.ok(delivered.endsWith(source.toString('utf8')));
 assert.doesNotMatch(delivered,/\@|buyer@example/);
});
test('each published GitHub bootstrap adds separate device identity without restricting Roblox usernames',()=>{
 for(const sku of ['control-center','str-grinder','end-grinder','dex-desktop','dex-mobile','fps-optimizer']){
  const s=readFileSync(new URL('../loaders/'+sku+'.lua',import.meta.url),'utf8');
  assert.match(s,/ZebraLicense/);
  assert.match(s,/ZebraInstallSecret/);
  assert.match(s,/ZebraBL_Installation_v1\.txt/);
  assert.match(s,/GenerateGUID/);
  assert.match(s,/readfile/);
  assert.match(s,/writefile/);
  assert.match(s,/&device=/);
  assert.doesNotMatch(s,/LocalPlayer|UserId|PlayerId|account_id|user_name/);
 }
 const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(server,/app\.post\('\/api\/approve-device\/:sku',deviceApproveLimiter,requireUser/);
 assert.match(server,/await entitlementIsPaid\(req\.user\.id,sku\)/);
 assert.match(server,/deviceApprovalActive\(\)/);
 assert.match(server,/requestDeviceApproval\(\{query,licenseId:found\.id,deviceSecret,at:now\(\)\}\)/);
 assert.match(server,/wrapLuaWithTicket\(payload,/);
 assert.match(server,/app\.get\('\/api\/runtime\/:sku',runtimeTicketLimiter/);
 assert.match(server,/!await entitlementIsPaid\(license\.user_id,sku\)/);
});
