import fs from 'node:fs';
import path from 'node:path';
import {products} from '../catalog.js';
const dir=path.resolve('public-loader-repo');fs.mkdirSync(dir,{recursive:true});
const endpoint=process.env.LOADER_ORIGIN||'https://YOUR-MARKETPLACE-DOMAIN';
for(const p of products.filter(x=>!x.unavailable)){
 const code=`-- Zebra public bootstrap for ${p.title}. No paid source or license is included.\n-- Set _G.ZebraLicense to your purchased key before running this public bootstrap.\nlocal _key=_G.ZebraLicense\nif type(_key)~="string" or not string.match(_key,"^ZBL_[0-9a-f]+$") then error("Zebra license required: sign in to My Library") end\nlocal _url=${JSON.stringify(endpoint+'/api/loader/'+p.id+'?key=')}.._key\nreturn loadstring(game:HttpGet(_url))()\n`;
 fs.writeFileSync(path.join(dir,p.id+'.lua'),code);
}
