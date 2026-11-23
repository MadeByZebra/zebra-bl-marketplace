import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHECKOUT_BRANDING_API_VERSION,checkoutBrandingForTheme} from '../checkout-branding.js';

test('Stripe Checkout branding follows the two approved monochrome website themes',()=>{
 assert.deepEqual(checkoutBrandingForTheme('dark'),{background_color:'#0B0B0B',button_color:'#F4F4F4'});
 assert.deepEqual(checkoutBrandingForTheme('light'),{background_color:'#F7F7F7',button_color:'#111111'});
 assert.deepEqual(checkoutBrandingForTheme('unexpected'),checkoutBrandingForTheme('dark'));
 assert.deepEqual(checkoutBrandingForTheme({foo:'bar'}),checkoutBrandingForTheme('dark'));
 assert.match(CHECKOUT_BRANDING_API_VERSION,/^2025-09-30\.clover$/);
});
test('brand overrides are immutable templates and return independent per-request objects',()=>{
 const a=checkoutBrandingForTheme('dark');
 a.background_color='#FF0000';
 assert.equal(checkoutBrandingForTheme('dark').background_color,'#0B0B0B');
});
test('checkout carries document theme to Stripe Session without changing ownership and payment gates',()=>{
 const client=readFileSync(new URL('../public/checkout/checkout.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(client,/document\.documentElement\.dataset\.theme==='light'\?'light':'dark'/);
 assert.match(client,/body:JSON\.stringify\(\{sku,accepted_terms:true,discount_code:quoteCode,theme:checkoutTheme\}\)/);
 assert.match(server,/branding_settings:checkoutBrandingForTheme\(checkoutTheme\)/);
 assert.match(server,/checkout_theme:checkoutTheme/);
 assert.match(server,/const checkoutTheme=req\.body\?\.theme==='light'\?'light':'dark'/);
 assert.match(server,/stripe\.checkout\.sessions\.create\(sessionData,\{apiVersion:CHECKOUT_BRANDING_API_VERSION\}\)/);
 assert.match(server,/if\(!checkoutReady\(\)\)/);
 assert.match(server,/if\(req\.body\?\.accepted_terms!==true\)/);
 assert.match(server,/if\(!item\|\|!Number\.isInteger\(item\.price\)/);
 assert.match(server,/await query\('INSERT INTO purchases/);
});
