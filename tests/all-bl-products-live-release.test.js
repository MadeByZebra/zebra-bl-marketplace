import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {products,bundles,extraProducts,includedIds} from '../catalog.js';
import {VERIFIED_LIVE_IDS,verifiedLiveProduct,liveReleaseReadiness} from '../live-sales-release-gates.js';
import {liveBuyerAllowed} from '../live-checkout-buyers.js';
import {githubLoaderUrl,buyerLoadstring} from '../github-loader.js';

const six=['control-center','str-grinder','end-grinder','dex-desktop','dex-mobile','fps-optimizer'];
const safePublicRelease={
 LIVE_VERIFIED_SKUS:six.join(','),LIVE_DATABASE_CONFIRMED:'1',
 LIVE_PUBLIC_SALES_APPROVED:'1',LIVE_BUYER_TEST_ONLY:'0',
 LIVE_ZFLAG_VERIFIED:'0',ALLOW_LIVE_SALES:'1'
};
const repoRead=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('catalog and server entitlement share one exact six-product release matrix',()=>{
 assert.deepEqual(VERIFIED_LIVE_IDS,six);
 assert.deepEqual(products.filter(p=>!p.unavailable).map(p=>p.id),six);
 for(const sku of six){
  const item=products.find(p=>p.id===sku);
  assert.ok(item&&item.file.endsWith('.lua'),sku);
  assert.ok(Number.isSafeInteger(item.price)&&item.price>=199,sku);
  assert.equal(verifiedLiveProduct(item,safePublicRelease,includedIds),true,sku);
  assert.ok(existsSync(new URL('../loaders/'+sku+'.lua',import.meta.url)),sku+' public bootstrap');
  assert.ok(existsSync(new URL('../sealed-payloads/'+item.file+'.sealed',import.meta.url)),sku+' encrypted payload');
  const loader=repoRead('loaders/'+sku+'.lua');
  assert.match(loader,/ZebraBL_Installation_v1\.txt/);
  assert.match(loader,/ACTIVATION CODE: /);
  assert.match(loader,/ZebraBLActivation/);
  const command=buyerLoadstring(sku,'ZBL_'+'a'.repeat(56));
  assert.ok(command.includes(githubLoaderUrl(sku)));
  assert.ok(command.includes('ZebraLicense'));
 }
});
test('eligible training bundles deliver exactly their paid component SKUs',()=>{
 assert.deepEqual(bundles.map(p=>p.id),['class-a-duo','dex-pair','complete-collection']);
 assert.deepEqual(includedIds(bundles[0]),['str-grinder','end-grinder']);
 assert.deepEqual(includedIds(bundles[1]),['dex-desktop','dex-mobile']);
 assert.deepEqual(includedIds(bundles[2]),six);
 for(const bundle of bundles){
  assert.equal(verifiedLiveProduct(bundle,safePublicRelease,includedIds),true,bundle.id);
  assert.ok(bundle.price>=50);
  assert.equal(includedIds(bundle).every(id=>six.includes(id)),true);
 }
 const incomplete={...safePublicRelease,LIVE_VERIFIED_SKUS:'fps-optimizer'};
 for(const bundle of bundles)assert.equal(verifiedLiveProduct(bundle,incomplete,includedIds),false,bundle.id);
});
test('only explicitly enabled owned scripts unlock; third-party and unverified installer stay on hold',()=>{
 assert.equal(liveReleaseReadiness(safePublicRelease).ready,true);
 for(const sku of six){
  assert.equal(verifiedLiveProduct(products.find(p=>p.id===sku),{...safePublicRelease,LIVE_VERIFIED_SKUS:''},includedIds),false);
 }
 assert.equal(verifiedLiveProduct(products.find(p=>p.id==='class-s-joiner'),safePublicRelease,includedIds),false);
 const zflag=extraProducts.find(p=>p.id==='zflag-injector');
 assert.equal(verifiedLiveProduct(zflag,safePublicRelease,includedIds),false);
 assert.equal(verifiedLiveProduct(extraProducts.find(p=>p.id==='checkout-test'),safePublicRelease,includedIds),false);
});
test('public buyer access requires deliberate release and pilot override stays fail closed',()=>{
 assert.equal(liveBuyerAllowed('buyer@example.com',safePublicRelease),true);
 assert.equal(liveBuyerAllowed('buyer@example.com',{...safePublicRelease,LIVE_PUBLIC_SALES_APPROVED:'0'}),false);
 assert.equal(liveBuyerAllowed('buyer@example.com',{...safePublicRelease,LIVE_BUYER_TEST_ONLY:'1',LIVE_TEST_BUYER_EMAILS:'owner@example.com'}),false);
 assert.equal(liveBuyerAllowed('owner@example.com',{...safePublicRelease,LIVE_BUYER_TEST_ONLY:'1',LIVE_TEST_BUYER_EMAILS:'owner@example.com'}),true);
});
test('every paid SKU uses server-side checkout, account-bound retrieval and approved installation validation',()=>{
 const server=repoRead('server.js'),account=repoRead('public/account/account.js'),order=repoRead('public/order/order.js');
 assert.match(server,/const sku=String\(req\.body\?\.sku\|\|''\),item=byId\[sku\]/);
 assert.match(server,/if\(!item\|\|!Number\.isInteger\(item\.price\)\|\|item\.price<50\|\|!itemReadyForSale\(item\)\)/);
 assert.match(server,/await grantFromStripe\(session\)/);
 assert.match(server,/includedIds\(byId\[order\.sku\]\|\|\{id:order\.sku\}\)\.includes\(sku\)/);
 assert.match(server,/app\.get\('\/api\/license\/:sku\/current',licenseLimiter,requireUser/);
 assert.match(server,/app\.post\('\/api\/license\/:sku\/recover',licenseLimiter,requireUser/);
 assert.match(server,/requestDeviceApproval\(\{query,licenseId:found\.id,deviceSecret,at:now\(\)\}\)/);
 assert.match(server,/wrapLuaWithTicket\(payload,/);
 for(const sku of six)assert.ok(account.includes("'"+sku+"'"),sku+' user instructions');
 assert.match(account,/view\.textContent=!info\.issued/);
 assert.match(account,/pairing\.hidden=Boolean\(info\.device_approval_enabled&&info\.device_approved\)/);
 assert.match(order,/status\.current_command_retrievable/);
});
test('buyer-facing text truthfully describes Class A, mobile compatibility and public checkout',()=>{
 const account=repoRead('public/account/account.js');
 assert.match(account,/STR Grinder: this tool currently works in Class A only/);
 assert.match(account,/END Grinder: Class A only/);
 assert.match(account,/mobile executor with working persistent file storage/);
 assert.match(account,/auto-execute starts before you enter Class A/);
 const support=repoRead('public/support/index.html');
 assert.match(support,/six BL Scripts products and eligible bundles/);
 assert.match(support,/ON HOLD/);
 assert.match(support,/unverified ZFLAG installer/);
});
