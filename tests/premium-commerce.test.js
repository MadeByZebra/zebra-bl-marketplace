import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseOrderFeedback,validCheckoutReference} from '../order-feedback.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const order=read('public/order/index.html'),checkout=read('public/checkout/index.html');
const orderJs=read('public/order/order.js'),checkoutJs=read('public/checkout/checkout.js');
const css=read('public/commerce.css'),server=read('server.js');
const account=read('public/account/index.html'),accountJs=read('public/account/account.js');
const catalogJs=read('public/app.js');
const schema=read('marketplace-schema.js');

test('checkout and order pages use existing true-black branding with original screenshot structure',()=>{
 for(const html of [checkout,order,account]){
  assert.match(html,/class="zebra-v8/);
  assert.match(html,/zebra-true-black-v8\.css/);
  assert.match(html,/commerce\.css/);
  assert.match(html,/ZEBRA’S SHOP/);
  assert.match(html,/href="\/support\//);
 }
 assert.match(checkout,/Order information/);
 assert.match(checkout,/Confirm &amp; pay/);
 assert.match(checkout,/Receive your items/);
 assert.match(checkout,/id="summaryTotal"/);
 assert.match(checkout,/id="completeCheckout"[^>]*disabled/);
 assert.match(order,/id="deliveredItems"/);
 assert.match(order,/id="orderDetailsCard" hidden/);
 assert.match(order,/id="receiptLink"/);
 assert.match(order,/id="reviewForm"/);
 assert.match(order,/id="paymentStep"/);
 assert.match(order,/id="deliveryStep"/);
 assert.doesNotMatch(order,/class="completed"><i>✓<\/i> Confirm &amp; pay/);
 assert.match(order,/id="copyAllLoadstrings"/);
 assert.match(css,/grid-template-columns:minmax/);
 assert.match(css,/@media\(max-width:620px\)/);
});
test('checkout cannot invent products, grant payment or trust browser pricing',()=>{
 assert.match(checkoutJs,/await Promise\.all\(\[api\('\/api\/store'\),api\('\/api\/me'\)\]\)/);
 assert.match(checkoutJs,/!state\.store\?\.checkout_ready/);
 assert.match(checkoutJs,/state\.item\.unavailable/);
 assert.match(checkoutJs,/!\$\('acceptTerms'\)\.checked/);
 assert.match(checkoutJs,/api\('\/api\/checkout'/);
 assert.match(checkoutJs,/url\.hostname!=='checkout\.stripe\.com'/);
 assert.match(server,/itemReadyForSale\(item\)/);
 assert.match(server,/stripe\.checkout\.sessions\.create\(sessionData\)/);
 assert.match(server,/ALLOW_LIVE_SALES/);
 assert.doesNotMatch(checkoutJs,/payment_status\s*[:=]\s*['"]paid/);
 assert.doesNotMatch(checkout,/\b(?:sk|rk)_live_[A-Za-z0-9]/);
});
test('receipt only displays deliverables after signed-in server verification',()=>{
 assert.match(orderJs,/api\('\/api\/me'\)/);
 assert.match(orderJs,/api\('\/api\/confirm'/);
 assert.match(orderJs,/api\('\/api\/order\//);
 assert.match(orderJs,/if\(!confirmed\.paid\|\|order\.status!=='paid'\)/);
 assert.match(orderJs,/renderDelivered\(order\)/);
 assert.match(orderJs,/\$\('paymentStep'\)\.classList\.add\('completed'\)/);
 assert.match(orderJs,/\$\('copyAllLoadstrings'\)\.addEventListener/);
 assert.match(orderJs,/api\('\/api\/license\//);
 assert.match(orderJs,/Generate personal loadstring/);
 assert.match(orderJs,/Download \.txt/);
 assert.match(orderJs,/api\/receipt\//);
 assert.match(orderJs,/navigator\.clipboard/);
 assert.match(orderJs,/if\(order\.status==='revoked'\)/);
 assert.match(server,/WHERE session_id=\$1 AND user_id=\$2/);
 assert.match(server,/app\.get\('\/api\/order\/:sessionId',requireUser/);
 assert.match(server,/checkoutOrderMatchesMode\(id,process\.env\.STRIPE_SECRET_KEY\)/);
});
test('Stripe Checkout redirects to the new order and checkout pages',()=>{
 assert.match(server,/success_url:`\$\{SITE\.origin\}\/order\/\?session_id=\{CHECKOUT_SESSION_ID\}`/);
 assert.match(server,/cancel_url:`\$\{SITE\.origin\}\/checkout\/\?sku=\$\{encodeURIComponent\(sku\)\}&canceled=1`/);
 assert.match(catalogJs,/window\.location\.assign\('\/checkout\/\?sku='/);
 assert.match(accountJs,/\/order\/\?session_id=/);
});
test('feedback requires valid ratings, keeps length limits and refuses auto reviews',()=>{
 assert.deepEqual(parseOrderFeedback({rating:5,comment:'  Works well! '}),{ok:true,rating:5,comment:'Works well!'});
 for(const rating of [0,6,-1,1.5,'5',null,undefined]){
  assert.equal(parseOrderFeedback({rating,comment:''}).ok,false);
 }
 assert.equal(parseOrderFeedback({rating:5,comment:'x'.repeat(1201)}).ok,false);
 assert.equal(parseOrderFeedback({rating:5,comment:null}).ok,false);
 assert.equal(parseOrderFeedback({rating:1,comment:''}).ok,true);
 assert.match(schema,/CREATE TABLE IF NOT EXISTS order_feedback/);
 assert.match(server,/app\.post\('\/api\/order\/:sessionId\/feedback',feedbackLimiter,requireUser/);
 assert.match(server,/AND status=\$3/);
 assert.match(order,/id="reviewRating"/);
 assert.match(order,/id="reviewMessage"/);
 assert.match(order,/Feedback is private to the shop owner/);
 assert.doesNotMatch(orderJs,/setTimeout\([\s\S]*rating:\s*5/);
});
test('validates order references and does not expose orders or keys anonymously',()=>{
 assert.equal(validCheckoutReference('cs_live_'+'A'.repeat(30)),true);
 assert.equal(validCheckoutReference('cs_test_'+'Z'.repeat(24)),true);
 for(const id of ['cs_live_a','javascript:alert(1)','cs_invalid_'+'x'.repeat(30),'cs_live_'+'x'.repeat(220),null]){
  assert.equal(validCheckoutReference(id),false);
 }
 assert.match(server,/SELECT session_id,sku,amount,status,created_at,paid_at FROM purchases WHERE session_id=\$1 AND user_id=\$2/);
 assert.match(server,/const items=itemIds\.map/);
 assert.match(orderJs,/state\.secretCache\.set/);
 assert.doesNotMatch(orderJs,/localStorage|sessionStorage/);
 assert.doesNotMatch(orderJs,/innerHTML/);
});
