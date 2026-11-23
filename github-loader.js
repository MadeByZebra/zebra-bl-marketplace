// Buyer-specific GitHub loader URL. Public GitHub hosts ONLY the bootstrap,
// never protected Lua. The actual script is served by /api/loader/:sku after
// server-side entitlement and active license verification.
const BASE='https://raw.githubusercontent.com/MadeByZebra/zebra-bl-marketplace/main/loaders/';
// Change this version when public bootstraps update: cached old loaders cannot
// perform buyer-approved installation pairing and must never be delivered.
const BOOTSTRAP_VERSION='device-approval-f9-20261123-v2';
const SUPPORTED=Object.freeze(new Set([
 'control-center','str-grinder','end-grinder','dex-desktop','dex-mobile','fps-optimizer'
]));
export function githubLoaderUrl(sku){
 if(!SUPPORTED.has(sku))throw new Error('This product has no public bootstrap.');
 return BASE+sku+'.lua?v='+BOOTSTRAP_VERSION;
}
export function buyerLoadstring(sku,key){
 if(!/^ZBL_[a-f0-9]{56}$/.test(String(key||'')))throw new Error('Invalid private license key.');
 const url=githubLoaderUrl(sku);
 // Keep the token inside the buyer's personal command, never a public repo
 // URL or shared file. The public bootstrap consumes and clears it.
 return `local e=(getgenv and getgenv()) or _G; e.ZebraLicense=${JSON.stringify(key)}; local ok,src=pcall(function()return game:HttpGet(${JSON.stringify(url)},true)end); if not ok or type(src)~='string' then if type(warn)=='function' then warn('[BL Scripts] Could not fetch the updated public loader.') end; error('BL Scripts: public loader unavailable. Check connection.',0) end; if type(loadstring)~='function' then if type(warn)=='function' then warn('[BL Scripts] This executor does not provide loadstring.') end; error('BL Scripts: loadstring unavailable in this executor.',0) end; local fn,reason=loadstring(src); if type(fn)~='function' then if type(warn)=='function' then warn('[BL Scripts] Public loader could not compile. Open My Library and copy its latest command.') end; error('BL Scripts: public loader could not compile.',0) end; return fn()`;
}
