// Permanent buyer-side retrieval without storing a reusable raw loadstring.
// A secret-derived token can be reconstructed ONLY by the authenticated server.
// Existing random licenses can be upgraded once, in place, leaving installation
// approval and license ID intact. No new "issuance" is counted in this upgrade.
import {createHash,createHmac,hkdfSync,timingSafeEqual} from 'node:crypto';

const skuOk=s=>typeof s==='string'&&/^[a-z0-9-]{3,50}$/.test(s);
const idOk=s=>typeof s==='string'&&/^[A-Za-z0-9-]{3,90}$/.test(s);
const storedHashOk=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const derivedSecret=raw=>{
 if(typeof raw!=='string'||!/^[a-f0-9]{64}$/i.test(raw))throw Error('Server license key derivation unavailable.');
 return Buffer.from(hkdfSync('sha256',Buffer.from(raw,'hex'),
   Buffer.from('BL Scripts license v1 context','utf8'),
   Buffer.from('buyer-owned loadstring retrieval','utf8'),32));
};
export function recoverableKeyForLicense({id,user_id,sku},rawSecret){
 if(!idOk(id)||!idOk(user_id)||!skuOk(sku))throw Error('Invalid license key identity.');
 return 'ZBL_'+createHmac('sha256',derivedSecret(rawSecret))
  .update('BL-SCRIPTS-KEY-2026-v1\0'+id+'\0'+user_id+'\0'+sku)
  .digest('hex').slice(0,56);
}
export const shaToken=token=>createHash('sha256').update(token).digest('hex');
export function isRecoverableLicense(row,rawSecret){
 if(!row||!storedHashOk(row.token_hash))return false;
 const check=shaToken(recoverableKeyForLicense(row,rawSecret));
 return timingSafeEqual(Buffer.from(check,'hex'),Buffer.from(row.token_hash,'hex'));
}
export class MissingActiveLicenseError extends Error{
 constructor(){super('No active personal license yet. Select Create first command in My Library.');this.name='MissingActiveLicenseError';}
}
export async function upgradeLegacyLicenseInPlace({pool,sqlite,userId,sku,rawSecret}){
 if(!idOk(userId)||!skuOk(sku))throw Error('Invalid signed-in license recovery.');
 // Check the secret before taking locks or mutating any records.
 derivedSecret(rawSecret);
 if(pool){
  const client=await pool.connect();let began=false;
  try{
   await client.query('BEGIN');began=true;
   const locked=await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
   if(locked.rowCount!==1)throw Error('Account no longer available.');
   const result=await client.query(
    'SELECT id,user_id,sku,token_hash FROM licenses WHERE user_id=$1 AND sku=$2 AND revoked_at IS NULL',
    [userId,sku]);
   const row=result.rows[0];
   if(!row)throw new MissingActiveLicenseError();
   const token=recoverableKeyForLicense(row,rawSecret);
   let upgraded=false;
   if(!isRecoverableLicense(row,rawSecret)){
    const changed=await client.query(
     'UPDATE licenses SET token_hash=$1 WHERE id=$2 AND token_hash=$3 AND revoked_at IS NULL',
     [shaToken(token),row.id,row.token_hash]);
    if(changed.rowCount!==1)throw Error('License changed during recovery; retry without generating.');
    upgraded=true;
   }
   await client.query('COMMIT');began=false;
   return {token,upgraded};
  }catch(err){if(began)await client.query('ROLLBACK').catch(()=>{});throw err;}
  finally{client.release();}
 }
 if(sqlite){
  sqlite.exec('BEGIN IMMEDIATE');
  try{
   const user=sqlite.prepare('SELECT id FROM users WHERE id=?').get(userId);
   if(!user)throw Error('Account no longer available.');
   const row=sqlite.prepare('SELECT id,user_id,sku,token_hash FROM licenses WHERE user_id=? AND sku=? AND revoked_at IS NULL').get(userId,sku);
   if(!row)throw new MissingActiveLicenseError();
   const token=recoverableKeyForLicense(row,rawSecret);
   let upgraded=false;
   if(!isRecoverableLicense(row,rawSecret)){
    const change=sqlite.prepare('UPDATE licenses SET token_hash=? WHERE id=? AND token_hash=? AND revoked_at IS NULL')
     .run(shaToken(token),row.id,row.token_hash);
    if(change.changes!==1)throw Error('License changed during recovery; retry without generating.');
    upgraded=true;
   }
   sqlite.exec('COMMIT');
   return {token,upgraded};
  }catch(err){sqlite.exec('ROLLBACK');throw err;}
 }
 throw Error('Purchase database unavailable.');
}
