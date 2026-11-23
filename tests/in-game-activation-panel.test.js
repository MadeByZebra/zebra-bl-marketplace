import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {githubLoaderUrl,buyerLoadstring} from '../github-loader.js';

const skus=['control-center','str-grinder','end-grinder','dex-desktop','dex-mobile','fps-optimizer'];
test('every licensed bootstrap displays only its short-lived pairing code in a closable Roblox UI',()=>{
 for(const sku of skus){
  const source=readFileSync(new URL('../loaders/'+sku+'.lua',import.meta.url),'utf8');
  assert.ok(source.length>4000&&source.length<8000,sku);
  assert.equal((source.match(/local function _showActivation\(_code\)/g)||[]).length,1,sku);
  assert.equal((source.match(/_showActivation\(_code\)/g)||[]).length,2,sku);
  assert.match(source,/local _code=string\.match\(_message,'enter code%s\+\(\[0-9A-F\]\+\)'/);
  assert.match(source,/_notice\('ACTIVATION CODE: '/);
  assert.match(source,/local _gui=Instance\.new\('ScreenGui'\)/);
  assert.match(source,/_gui\.Name='ZebraBLActivation'/);
  assert.match(source,/_gui\.Parent=_pg/);
  assert.match(source,/local _copy=_button\('CopyCode','COPY CODE'/);
  assert.match(source,/local _close=_button\('Dismiss','CLOSE'/);
  assert.match(source,/if type\(setclipboard\)=='function' and pcall\(setclipboard,_code\)/);
  assert.match(source,/_close\.MouseButton1Click:Connect\(function\(\) _gui:Destroy\(\) end\)/);
  assert.match(source,/On-screen panel unavailable. Check F9 Client log/);
  assert.match(source,/TweenService/);
  assert.doesNotMatch(source,/_label\(_k|_label\(_device|setclipboard,_k|setclipboard,_device/);
  assert.doesNotMatch(source,/\.UserId|LocalPlayer\.Name|GetUserIdFromNameAsync/);
 }
});
test('new loader version fetches the upgraded panel without generating a fresh purchase key',()=>{
 const key='ZBL_'+ 'e'.repeat(56);
 for(const sku of skus){
  const url=githubLoaderUrl(sku);
  assert.match(url,/device-approval-panel-20261123-v3$/);
  const command=buyerLoadstring(sku,key);
  assert.ok(command.includes(key));
  assert.ok(command.includes(url));
  assert.match(command,/type\(fn\)~='function'/);
 }
});
test('site explains that internal UI closes safely but external CMD may end the Roblox process',()=>{
 const account=readFileSync(new URL('../public/account/account.js',import.meta.url),'utf8');
 const faq=readFileSync(new URL('../public/support/index.html',import.meta.url),'utf8');
 assert.match(account,/Closing that panel will not close Roblox/);
 assert.match(account,/Avoid closing an external CMD window/);
 assert.match(account,/F9 and executor output remain backups/);
 assert.match(faq,/Copy Code button/);
});
