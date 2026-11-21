import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {products,bundles,byId,includedIds,publicCatalog} from '../catalog.js';
const root=path.resolve(import.meta.dirname,'..');
test('all listings have unique IDs and valid prices',()=>{
 assert.equal(new Set([...products,...bundles].map(x=>x.id)).size,products.length+bundles.length);
 for(const p of [...products,...bundles])assert.ok(p.unavailable||Number.isInteger(p.price)&&p.price>=100);
});
test('bundles include only sellable scripts and save approximately 10 percent',()=>{
 for(const b of bundles){const sum=b.items.reduce((s,id)=>s+byId[id].price,0);assert.ok(b.items.every(x=>byId[x]&&!byId[x].unavailable));assert.equal(b.price,Math.round(sum*.9));}
});
test('source filenames never appear in public catalog',()=>{
 const c=JSON.stringify(publicCatalog());for(const p of products){assert.equal('file' in publicCatalog().products.find(x=>x.id===p.id),false);if(p.file)assert.ok(!c.includes(p.file));}
});
test('uploaded sellable scripts have matching private filenames',()=>{
 const dir=path.join(root,'private-scripts');
 if(!fs.existsSync(dir))return; // CI/deploy-safe source intentionally excludes private assets
 for(const p of products.filter(x=>!x.unavailable))assert.ok(fs.statSync(path.join(dir,p.file)).size>100);
});
test('no Lua scripts are inside public assets',()=>{
 const files=fs.readdirSync(path.join(root,'public'));assert.equal(files.some(f=>f.endsWith('.lua')||f.endsWith('.txt')),false);
});
test('bundle entitlements include each paid file exactly once',()=>{
 const b=byId['complete-collection'];assert.equal(new Set(includedIds(b)).size,6);
});
