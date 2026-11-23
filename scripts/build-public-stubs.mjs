// Publish only audited, keyless public bootstraps to a separate output folder.
// Do not regenerate simpler loaders that omit buyer-approved installation checks.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {products} from '../catalog.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(ROOT,'public-loader-repo');
fs.mkdirSync(output,{recursive:true});
for(const product of products.filter(x=>!x.unavailable&&x.file)){
 const filename=product.id+'.lua';
 const source=path.join(ROOT,'loaders',filename);
 const code=fs.readFileSync(source,'utf8');
 if(!code.includes('ZebraLicense')||!code.includes('ZebraInstallSecret')||
    !code.includes('&device=')||code.includes('ZEBRA_PAYLOAD_KEY'))
   throw Error('Refusing to publish an outdated or unsafe loader: '+filename);
 fs.writeFileSync(path.join(output,filename),code,{mode:0o644});
}
console.log('Public loader output contains no paid Lua. Buyers must use a personal paid key and approved installation.');
