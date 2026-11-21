import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL('../public/smooth-scroll.js',import.meta.url),'utf8');
function createBrowser(){
 const callbacks=new Map(),queue=new Map(),reduced={matches:false,addEventListener(){}};
 const root={scrollHeight:2100,clientHeight:800,classList:{contains:()=>false}};
 const handlers={}; let id=0,y=0,ts=0;
 class Element{constructor(native=false){this.native=native}closest(){return this.native?this:null}}
 class HTMLElement extends Element {}
 const document={
  scrollingElement:root,documentElement:root,body:{},hidden:false,
  addEventListener:(name,cb)=>{handlers[name]=cb},
  querySelector:()=>null
 };
 const browser={
  window:null,document,Element,HTMLElement,
  innerHeight:800,innerWidth:1200,get scrollY(){return y},set scrollY(v){y=v},
  matchMedia:()=>reduced,
  getComputedStyle:()=>({overflowY:'visible'}),
  requestAnimationFrame:cb=>{queue.set(++id,cb);return id},
  cancelAnimationFrame:key=>queue.delete(key),
  addEventListener:(name,callback)=>{callbacks.set(name,callback)},
  scrollTo:arg=>{y=Math.max(0,Math.min(root.scrollHeight-browser.innerHeight,Number(arg.top)))},
  Object,Math,Number,JSON
 };
 browser.window=browser;
 vm.runInNewContext(script,browser,{filename:'smooth-scroll.js'});
 function wheel(deltaY=120,extra={}){
  let prevented=false;
  const event={deltaX:0,deltaY,deltaMode:0,ctrlKey:false,metaKey:false,
    shiftKey:false,altKey:false,cancelable:true,defaultPrevented:false,
    target:new Element(),preventDefault(){prevented=true},...extra};
  callbacks.get('wheel')(event);
  return prevented;
 }
 function advance(n=1){
  for(let k=0;k<n;k++){
   const frames=[...queue.entries()];
   queue.clear();
   ts+=16.67;
   for(const [,cb]of frames)cb(ts);
  }
 }
 return {wheel,advance,reduced,callbacks,root,document,handlers,
   get position(){return y},set position(v){y=v},get animating(){return browser.__blScroll.isAnimating()},
   get version(){return browser.__blScroll.version}};
}
test('normal wheel inputs are intercepted and animate account page smoothly',()=>{
 const b=createBrowser();
 assert.equal(b.version,'2.1');
 assert.equal(b.wheel(140),true);
 assert.equal(b.animating,true);
 b.advance(1);
 assert.ok(b.position>0 && b.position<140,'smooth animation must not jump');
 b.advance(140);
 assert.equal(Math.round(b.position),140);
 assert.equal(b.animating,false);
});
test('small scrollbar/layout position drift no longer silently cancels inertia',()=>{
 const b=createBrowser();
 assert.equal(b.wheel(240),true);
 b.advance(1);
 b.position+=8; // Browser may adjust scrollY while My Library dynamically updates.
 b.advance(1);
 assert.equal(b.animating,true,'minor asynchronous layout drift should not cancel animation');
 b.advance(120);
 assert.equal(Math.round(b.position),240);
});
test('successive rapid trackpad/wheel events keep animating instead of switching to native',()=>{
 const b=createBrowser();
 assert.equal(b.wheel(75),true);
 b.advance(2);
 assert.equal(b.wheel(80,{deltaX:40}),true);
 b.advance(2);
 assert.equal(b.wheel(90,{deltaX:70}),true);
 b.advance(140);
 assert.equal(Math.round(b.position),245);
});
test('nested UI, reduced motion, keyboard and open support chat preserve native semantics',()=>{
 const b=createBrowser();
 assert.equal(b.wheel(150,{target:new (class Other{})()}),true);
 b.advance(150);
 assert.equal(Math.round(b.position),150);
 b.reduced.matches=true;
 assert.equal(b.wheel(80),false);
 b.reduced.matches=false;
 const box=new (class Other{})();
 // CSS scroll-locked chat must block the underlying website.
 b.root.classList.contains=()=>true;
 assert.equal(b.wheel(100),true);
 assert.equal(b.animating,false);
 b.root.classList.contains=()=>false;
 assert.equal(b.wheel(100),true);
 b.advance(2);
 assert.equal(b.animating,true);
 b.handlers.pointerdown();
 assert.equal(b.animating,false);
});
