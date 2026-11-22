import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkoutOrderPrefix,checkoutOrderMatchesMode} from '../stripe-order-mode.js';

test('configured Stripe server key determines test versus live order namespace',()=>{
 assert.equal(checkoutOrderPrefix('sk_test_example'),'cs_test_');
 assert.equal(checkoutOrderPrefix('sk_live_example'),'cs_live_');
 assert.equal(checkoutOrderPrefix('rk_live_example'),'cs_live_');
 assert.equal(checkoutOrderPrefix('rk_test_example'),'cs_test_');
 assert.equal(checkoutOrderPrefix('pk_live_publishable'),null);
 assert.equal(checkoutOrderPrefix(''),null);
 assert.equal(checkoutOrderPrefix(null),null);
});
test('test payment sessions cannot become visible in live library or unlock live licenses',()=>{
 assert.equal(checkoutOrderMatchesMode('cs_test_someSession','sk_live_example'),false);
 assert.equal(checkoutOrderMatchesMode('cs_live_someSession','sk_test_example'),false);
 assert.equal(checkoutOrderMatchesMode('cs_live_someSession','sk_live_example'),true);
 assert.equal(checkoutOrderMatchesMode('cs_test_someSession','sk_test_example'),true);
 assert.equal(checkoutOrderMatchesMode('cs_live_someSession',null),false);
});
test('both live and test library and entitlement queries filter the purchase namespace',()=>{
 const src=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(src,/SELECT sku,amount,paid_at,session_id FROM purchases WHERE user_id=\$1 AND status='paid' AND SUBSTR\(session_id,1,8\)=\$2/);
 assert.match(src,/SELECT \* FROM purchases WHERE user_id=\$1 AND status='paid' AND SUBSTR\(session_id,1,8\)=\$2/);
 assert.match(src,/checkoutOrderPrefix\(process\.env\.STRIPE_SECRET_KEY\)/);
 assert.match(src,/checkoutOrderMatchesMode\(sessionId,process\.env\.STRIPE_SECRET_KEY\)/);
 assert.match(src,/checkoutOrderMatchesMode\(id,process\.env\.STRIPE_SECRET_KEY\)/);
});
