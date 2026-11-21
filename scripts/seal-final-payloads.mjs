// LOCAL SELLER-ONLY BUILD TOOL. Reads seller's obfuscated Lua; writes ciphertext only.
import fs from 'node:fs';import path from 'node:path';import {seal,unseal,contentSha} from '../vault.js';
const src=process.argv[2],dst=process.argv[3]||'sealed-payloads';
if(!src)throw Error('Usage: node scripts/seal-final-payloads.mjs SOURCE_DIR [OUTPUT_DIR]');
const map={'control-center.lua':'Control_Center_V7_5_OBFUSCATED.lua','str-grinder.lua':'STR_Grinder_Class_A_OBFUSCATED.lua','end-grinder.lua':'END_Grinder_Class_A_OBFUSCATED.lua','dex-desktop.lua':'DEX_Grinder_Desktop_OBFUSCATED.lua','dex-mobile.lua':'DEX_Grinder_Mobile_OBFUSCATED.lua','fps-optimizer.lua':'FPS_Optimizer_OBFUSCATED.lua'};
fs.mkdirSync(dst,{recursive:true});const manifest={};
for(const [output,input]of Object.entries(map)){
 const data=fs.readFileSync(path.join(src,input));const ciphertext=seal(data,process.env.ZEBRA_PAYLOAD_KEY);
 if(!unseal(ciphertext,process.env.ZEBRA_PAYLOAD_KEY).equals(data))throw Error('Verification failure '+input);
 fs.writeFileSync(path.join(dst,output+'.sealed'),ciphertext,{mode:0o600});
 manifest[output]={sha256:contentSha(data),bytes:data.length,ciphertext_bytes:ciphertext.length};
}
fs.writeFileSync(path.join(dst,'MANIFEST.json'),JSON.stringify(manifest,null,2));
console.log('Sealed six obfuscated payloads and verified every byte; original Lua not written to output.');
