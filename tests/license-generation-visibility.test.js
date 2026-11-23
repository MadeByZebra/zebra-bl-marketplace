import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('generation errors are outside the hidden secret panel and visible next to Generate',()=>{
 const js=read('public/account/account.js'),css=read('public/brand.css');
 assert.match(js,/const generationStatus=element\('p'/);
 assert.match(js,/generationStatus\.setAttribute\('role','status'\)/);
 assert.match(js,/row\.append\(setupNote,generationStatus,result,approvedStatus,pairing,securityNote\)/);
 assert.match(js,/showGenerationMessage\('Generation failed: '\+error\.message,true\)/);
 assert.match(css,/\.commerce-account \.commerce-generation-status/);
 assert.match(css,/\.commerce-generation-status\.error/);
});
test('successful personal command is visibly revealed, scrolls into view and offers copy/download',()=>{
 const js=read('public/account/account.js');
 assert.match(js,/area\.value=data\.loadstring/);
 assert.match(js,/result\.hidden=false/);
 assert.match(js,/result\.scrollIntoView\?/);
 assert.match(js,/navigator\.clipboard\.writeText\(data\.loadstring\)/);
 assert.match(js,/const copy=element\('button','Copy loadstring'/);
 assert.match(js,/download=element\('button','Download \.txt'/);
 assert.match(js,/The weekly limit affects NEW replacement keys only/);
 assert.match(js,/loadQuota|refreshQuota/);
 assert.match(read('public/brand.css'),/\.commerce-loader-card:not\(\[hidden\]\):not\(\.commerce-device-pairing\)/);
});
test('four issuance attempts are allowed by the protected paid route while retaining purchase and rotation checks',()=>{
 const server=read('server.js');
 assert.match(server,/if\(!await entitlementIsPaid\(req\.user\.id,sku\)\)return res\.status\(403\)/);
 assert.match(server,/maxKeysPerWeek:4/);
 assert.match(server,/keys_issued_last_7_days:Number\(recent\[0\]\?\.n\|\|0\),max_keys_per_7_days:4/);
 assert.match(server,/rotateLicenseAtomically/);
 const terms=read('public/terms/index.html');
 assert.match(terms,/four per product in a rolling seven-day period/);
 assert.doesNotMatch(server,/\bmaxKeysPerWeek:0\b/);
});

test('paid command retrieval is separate from limited replacement, and approved installation hides repeated activation UI',()=>{
 const js=read('public/account/account.js'),order=read('public/order/order.js');
 assert.match(js,/const view=element\('button','View my loadstring/);
 assert.match(js,/view\.textContent=!info\.issued/);
 assert.match(js,/info\.current_command_retrievable/);
 assert.match(js,/\/api\/license\/'\+encodeURIComponent\(sku\)\+'\/current'/);
 assert.match(js,/\/api\/license\/'\+encodeURIComponent\(sku\)\+'\/recover'/);
 assert.match(js,/pairing\.hidden=Boolean\(info\.device_approval_enabled&&info\.device_approved\)/);
 assert.match(js,/approvedStatus\.hidden=false/);
 assert.match(js,/No code is needed on each Roblox launch or auto-execute/);
 assert.match(js,/The weekly limit affects NEW replacement keys only/);
 assert.match(order,/View my purchased loadstring/);
 assert.match(order,/status\.current_command_retrievable/);
 assert.match(order,/\/api\/license\/'\+encodeURIComponent\(item\.id\)\+'\/current'/);
});
