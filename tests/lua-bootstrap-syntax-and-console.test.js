import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buyerLoadstring,githubLoaderUrl} from '../github-loader.js';

const SKUS=['control-center','str-grinder','end-grinder','dex-desktop','dex-mobile','fps-optimizer'];

// Prevent the precise production regression: inserting Lua with String.replace
// interpreted the "$'" token in a Lua pattern as JS "rest of original string",
// corrupting six launchers while existing substring-only checks passed.
function assertShortQuotedStringsAreClosed(source,sku){
 let quote=null,escaped=false,line=1;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(!quote){
   if(c==='-'&&source[i+1]==='-'){
    const end=source.indexOf('\n',i);
    if(end<0)break;
    i=end-1;continue;
   }
   if(c==='"'||c==="'"){quote=c;escaped=false;}
  }else{
   if(c==='\n')assert.fail(sku+' contains a broken quoted Lua string near line '+line);
   if(escaped)escaped=false;
   else if(c==='\\')escaped=true;
   else if(c===quote)quote=null;
  }
  if(c==='\n')line++;
 }
 assert.equal(quote,null,sku+' has an unterminated quoted Lua string');
}
test('all six published Lua bootstraps are lexically valid and have a single delivery tail',()=>{
 for(const sku of SKUS){
  const source=readFileSync(new URL('../loaders/'+sku+'.lua',import.meta.url),'utf8');
  assert.ok(source.length<8000,'unexpectedly huge public bootstrap '+sku);
  assertShortQuotedStringsAreClosed(source,sku);
  assert.equal((source.match(/local _u=table\.concat\(_b\)/g)||[]).length,1,sku+' malformed URL builder');
  assert.equal((source.match(/local _ok,_src=pcall/g)||[]).length,1,sku+' duplicated download code');
  assert.equal((source.match(/local _fn,_compile=loadstring\(_src\)/g)||[]).length,1,sku+' missing compile guard');
  assert.match(source,/type\(loadstring\)~='function'/,sku+' missing executor diagnostic');
  assert.match(source,/type\(_fn\)~='function'/,sku+' missing compile error diagnostic');
  assert.match(source,/ZebraBL_Installation_v1\.txt/);
  assert.match(source,/&device=/);
  assert.match(source,/string\.match\(_v,'\^\[a-f0-9\]\+\$'\)/);
  assert.match(source,/type\(warn\)=='function'/,sku+' F9 warning missing');
  assert.match(source,/ACTIVATION CODE: /,sku+' readable activation code missing');
  assert.match(source,/SetCore\('SendNotification'/,sku+' optional in-game notification missing');
  assert.match(source,/rconsoleprint/,sku+' executor output fallback missing');
  assert.doesNotMatch(source,/ZBL_[0-9a-f]{56}/,sku+' source accidentally contains paid key');
  assert.doesNotMatch(source,/LocalPlayer|\.UserId|AccountAge/,sku+' must not bind to Roblox alt');
 }
});
test('new personal command handles compile/network failures without a nil call',()=>{
 const key='ZBL_'+ 'e'.repeat(56);
 for(const sku of SKUS){
  const personal=buyerLoadstring(sku,key),url=githubLoaderUrl(sku);
  assert.ok(personal.includes(key));
  assert.ok(personal.includes(url));
  assert.match(personal,/local fn,reason=loadstring\(src\)/);
  assert.match(personal,/type\(fn\)~='function'/);
  assert.match(personal,/return fn\(\)$/);
  assert.match(personal,/type\(loadstring\)~='function'/);
  assert.match(personal,/if type\(warn\)=='function'/);
  assert.match(url,/device-approval-panel-20261123-v3$/);
 }
});
