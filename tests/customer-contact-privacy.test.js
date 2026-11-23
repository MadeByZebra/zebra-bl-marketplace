import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const root=new URL('../public/',import.meta.url);
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const sourceFiles=(dir)=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
 const path=join(dir,entry.name);
 if(entry.isDirectory())return sourceFiles(path);
 return /\.(?:html|js|css|svg)$/.test(entry.name)?[path]:[];
});
test('public site does not hardcode private Gmail support or seller contact addresses',()=>{
 for(const path of sourceFiles(root.pathname)){
  const src=readFileSync(path,'utf8');
  for(const email of src.matchAll(/[a-z0-9._%+-]+@gmail\.com/gi)){
   assert.equal(email[0].toLowerCase(),'zebrablshopofficial@gmail.com',
    'Unexpected Gmail contact in publicly shipped asset '+path);
  }
 }
});
test('account makes installation activation steps clear without pretending an activation code exists on the site',()=>{
 const js=read('account/account.js'),css=read('brand.css');
 assert.match(js,/ACTIVATE YOUR PURCHASED INSTALLATION/);
 assert.match(js,/NOT emailed and does NOT appear automatically in My Library/);
 assert.match(js,/10-character code/);
 assert.match(js,/executor console\/output/);
 assert.match(js,/Generate \/ replace loadstring/);
 assert.match(js,/this REVOKES the previous command/);
 assert.match(js,/the SAME personal loadstring again/);
 assert.match(css,/\.commerce-device-pairing \.account-status:empty/);
 assert.match(css,/\.commerce-activation-steps/);
 assert.match(read('support/index.html'),/Where do I get the 10-character activation code/);
 assert.match(read('scripts/index.html'),/Where is my activation code/);
 assert.doesNotMatch(js,/localStorage|sessionStorage/);
});
test('the proprietary shop email, not the purchaser email, is used in order confirmation reply-to',()=>{
 const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 const delivery=readFileSync(new URL('../email-delivery.js',import.meta.url),'utf8');
 assert.match(server,/supportEmail:process\.env\.SUPPORT_EMAIL/);
 assert.match(server,/replyTo:process\.env\.SUPPORT_EMAIL/);
 assert.match(delivery,/Contact BL Scripts Support:/);
 assert.match(read('support/index.html'),/zebrablshopofficial@gmail\.com/);
 // Stripe's own email receipt is independent of the shop's confirmation,
 // and must be configured in the Stripe Dashboard public business profile.
});
