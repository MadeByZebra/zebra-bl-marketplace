// A buyer rotating a paid key must never lose their existing valid key if
// a database write fails. PostgreSQL and local SQLite do the two changes in
// one transaction. Row-locking the user serializes concurrent rotations.
export async function rotateLicenseAtomically({
 pool,sqlite,userId,sku,licenseId,tokenHash,at
}){
 if(typeof userId!=='string'||!userId||
    typeof sku!=='string'||!sku||typeof licenseId!=='string'||!licenseId||
    typeof tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(tokenHash)||
    !Number.isSafeInteger(at)||at<=0)throw new Error('Invalid license rotation');
 if(pool){
  const client=await pool.connect();
  let began=false;
  try{
   await client.query('BEGIN');began=true;
   const locked=await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
   if(locked.rowCount!==1)throw new Error('Account not found for license rotation');
   await client.query('UPDATE licenses SET revoked_at=$1 WHERE user_id=$2 AND sku=$3 AND revoked_at IS NULL',[at,userId,sku]);
   await client.query('INSERT INTO licenses (id,user_id,sku,token_hash,created_at) VALUES ($1,$2,$3,$4,$5)',[licenseId,userId,sku,tokenHash,at]);
   await client.query('COMMIT');began=false;
   return;
  }catch(error){
   if(began)await client.query('ROLLBACK').catch(()=>{});
   throw error;
  }finally{client.release();}
 }
 if(sqlite){
  sqlite.exec('BEGIN IMMEDIATE');
  try{
   const existing=sqlite.prepare('SELECT id FROM users WHERE id=?').get(userId);
   if(!existing)throw new Error('Account not found for license rotation');
   sqlite.prepare('UPDATE licenses SET revoked_at=? WHERE user_id=? AND sku=? AND revoked_at IS NULL').run(at,userId,sku);
   sqlite.prepare('INSERT INTO licenses (id,user_id,sku,token_hash,created_at) VALUES (?,?,?,?,?)').run(licenseId,userId,sku,tokenHash,at);
   sqlite.exec('COMMIT');
   return;
  }catch(error){
   sqlite.exec('ROLLBACK');
   throw error;
  }
 }
 throw new Error('Purchase database is not available');
}
