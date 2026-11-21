import test from 'node:test';
import assert from 'node:assert/strict';
import {discountQuote,promotionalCodes} from '../discounts.js';
import {byId} from '../catalog.js';
test('three shop coupon codes are registered',()=>{
 assert.deepEqual([...promotionalCodes],['ZEBRA10','LAUNCH15','BUNDLE20']);
});
test('ZEBRA10 and LAUNCH15 produce exact Stripe cents',()=>{
 const p=byId['control-center'];
 assert.deepEqual({...discountQuote(p,'zebra10')},{ok:true,code:'ZEBRA10',percent:10,original:1999,total:1800,saved:199,description:'10% off an eligible order'});
 assert.equal(discountQuote(p,'LAUNCH15').total,1700);
});
test('BUNDLE20 discounts bundles, not individual scripts',()=>{
 const b=discountQuote(byId['complete-collection'],'BUNDLE20');
 assert.equal(b.total,4172);assert.equal(b.saved,1043);
 assert.equal(discountQuote(byId['fps-optimizer'],'BUNDLE20').ok,false);
});
test('invalid codes, test items and malformed codes fail closed',()=>{
 assert.equal(discountQuote(byId['control-center'],'NOTAREALCODE').ok,false);
 assert.equal(discountQuote(byId['checkout-test'],'ZEBRA10').ok,false);
 assert.equal(discountQuote(byId['control-center'],'bad code<script>').ok,false);
 assert.equal(discountQuote(byId['control-center'],'').total,1999);
});
test('discounts never lower a paid order below 50 cents',()=>{
 for(const p of [byId['fps-optimizer'],byId['str-grinder'],byId['complete-collection']]){
  for(const code of promotionalCodes){
   const x=discountQuote(p,code);
   if(x.ok)assert.ok(x.total>=50&&x.total<=p.price&&Number.isInteger(x.total));
  }
 }
});

test('owner-configured complimentary code yields a genuine zero-dollar quote',()=>{
 const c=discountQuote(byId['control-center'],'zebrafree',{freeCode:'ZEBRAFREE'});
 assert.equal(c.ok,true);
 assert.equal(c.free,true);
 assert.equal(c.total,0);
 assert.equal(c.percent,100);
 assert.equal(c.saved,1999);
 assert.equal(discountQuote(byId['control-center'],'zebrafree').ok,false);
});
test('complimentary code excludes unverified installer and diagnostic and remains separate from regular discounts',()=>{
 const o={freeCode:'ZEBRAFREE'};
 assert.equal(discountQuote(byId['zflag-injector'],'ZEBRAFREE',o).ok,false);
 assert.equal(discountQuote(byId['checkout-test'],'ZEBRAFREE',o).ok,false);
 assert.equal(discountQuote(byId['complete-collection'],'ZEBRAFREE',o).total,0);
 assert.equal(discountQuote(byId['control-center'],'ZEBRA10',o).total,1800);
});
test('unknown or malformed complimentary promotions fail closed',()=>{
 const o={freeCode:'ZEBRAFREE'};
 assert.equal(discountQuote(byId['fps-optimizer'],'NOFREE',o).ok,false);
 assert.equal(discountQuote(byId['fps-optimizer'],'ZEBRAFREE123',o).ok,false);
 assert.equal(discountQuote(byId['fps-optimizer'],'ZEBRAFREE',{freeCode:'invalid code'}).ok,false);
});
