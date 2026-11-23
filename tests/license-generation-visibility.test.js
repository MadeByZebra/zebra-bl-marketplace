import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('generation errors are outside the hidden secret panel and visible next to Generate',()=>{
 const js=read('public/account/account.js'),css=read('public/brand.css');
 assert.match(js,/const generationStatus=element\('p'/);
 assert.match(js,/generationStatus\.setAttribute\('role','status'\)/);
 assert.match(js,/row\.append\(generationStatus,result,pairing,securityNote\)/);
 assert.match(js,/showGenerationMessage\('Generation failed: '\+error\.message,true\)/);
 assert.match(css,/\.commerce-account \.commerce-generation-status/);
 assert.match(css,/\.commerce-generation-status\.error/);
});
test('successful personal command is visibly revealed, scrolls into view and offers copy/download',()=>{
 const js=read('public/account/account.js');
 assert.match(js,/area\.value=data\.loadstring/);
 assert.match(js,/result\.hidden=false/);
 assert.match(js,/result\.scrollIntoView\?/);
 assert.match(js,/navigator\.clipboard\?\.writeText\(data\.loadstring\)/);
 assert.match(js,/const copy=element\('button','Copy loadstring'/);
 assert.match(js,/const download=element\('button','Download \.txt'/);
 assert.match(js,/No replacements left this week/);
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
 assert.match(terms,/four personal keys per product/);
 assert.doesNotMatch(server,/\bmaxKeysPerWeek:0\b/);
});
