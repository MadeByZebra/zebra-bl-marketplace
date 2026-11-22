// One-time, fail-closed PostgreSQL migration from Render to Neon.
// Source is ALWAYS read-only; target is either entirely copied or rolled back.
// No credentials, buyer data, payment identifiers or license tokens are logged.
import {marketplaceSchema,MARKETPLACE_TABLES} from './marketplace-schema.js';

const MARKER_ID='render-to-neon-v1';
const BATCH=100;
const quote=name=>{
 if(typeof name!=='string'||!/^[a-z_][a-z0-9_]*$/.test(name))throw Error('Invalid database identifier');
 return '"'+name+'"';
};
const sameDatabase=(a,b)=>{
 try{
  const x=new URL(a),y=new URL(b);
  return x.hostname.toLowerCase()===y.hostname.toLowerCase()
   &&(x.port||'5432')===(y.port||'5432')&&x.pathname===y.pathname;
 }catch{return false;}
};
async function columns(client,table){
 const result=await client.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name=$1
   ORDER BY ordinal_position`,[table]);
 return result.rows.map(x=>x.column_name);
}
async function count(client,table){
 const result=await client.query('SELECT COUNT(*) AS n FROM public.'+quote(table));
 return Number(result.rows[0].n);
}
async function exists(client,table){
 const result=await client.query('SELECT to_regclass($1) AS relation',['public.'+table]);
 return result.rows[0]?.relation!=null;
}
export async function migrateMarketplaceDatabase({
 sourceUrl,targetUrl,targetPool,makeSourcePool,maintenanceActive=false,logger=()=>{}
}){
 if(!sourceUrl||!targetUrl||sameDatabase(sourceUrl,targetUrl)||sourceUrl===targetUrl)
  throw Error('Migration source and destination must be distinct databases');
 if(!targetPool||typeof makeSourcePool!=='function')
  throw Error('Missing migration database connection');
 const dest=await targetPool.connect();
 let sourceClient=null,sourcePool=null,sourceTxn=false,destTxn=false;
 try{
  await dest.query('BEGIN');destTxn=true;
  // Only one instance may migrate, even if Render briefly starts two workers.
  await dest.query('SELECT pg_advisory_xact_lock($1)',[748618203]);
  await dest.query(`CREATE TABLE IF NOT EXISTS zebra_migration_status (
   migration_id TEXT PRIMARY KEY, completed_at BIGINT NOT NULL)`);
  const marker=await dest.query(
   'SELECT migration_id FROM zebra_migration_status WHERE migration_id=$1',[MARKER_ID]);
  if(marker.rows.length){
   await dest.query('COMMIT');destTxn=false;
   return {status:'already_migrated',tables:MARKETPLACE_TABLES.length};
  }
  // Only a frozen source is safe; current orders/chat must not change mid-copy.
  if(!maintenanceActive)throw Error('Enable STORE_MAINTENANCE=1 before first migration');
  for(const table of MARKETPLACE_TABLES){
   if(await exists(dest,table)){
    const existing=await count(dest,table);
    if(existing!==0)throw Error('Migration target contains existing store records');
   }
  }
  sourcePool=makeSourcePool(sourceUrl);
  sourceClient=await sourcePool.connect();
  await sourceClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');sourceTxn=true;
  for(const create of marketplaceSchema)await dest.query(create);
  const counts={};
  for(const table of MARKETPLACE_TABLES){
   if(!await exists(sourceClient,table))throw Error('Source store table missing: '+table);
   const srcCols=await columns(sourceClient,table),dstCols=await columns(dest,table);
   if(!srcCols.length||JSON.stringify(srcCols)!==JSON.stringify(dstCols))
    throw Error('Migration schema differs for table: '+table);
   const columnList=srcCols.map(quote).join(',');
   const placeholders=srcCols.map((_,i)=>'$'+(i+1)).join(',');
   const statement=`INSERT INTO public.${quote(table)} (${columnList}) VALUES (${placeholders})`;
   // Each table has an immutable primary key; stable ordering works within
   // the repeatable-read source snapshot and bounded 100-row batches.
   const primaryKey=({
    email_codes:'email',users:'id',sessions:'token_hash',purchases:'session_id',
    licenses:'id',purchase_notifications:'session_id',
    free_promo_redemptions:'user_id',zebra_chat_threads:'id',
    zebra_chat_messages:'id'
   })[table];
   const srcCount=await count(sourceClient,table);
   if(!Number.isSafeInteger(srcCount)||srcCount<0)throw Error('Invalid source row count');
   for(let offset=0;offset<srcCount;offset+=BATCH){
    const page=await sourceClient.query(
     `SELECT ${columnList} FROM public.${quote(table)}
      ORDER BY ${quote(primaryKey)} LIMIT $1 OFFSET $2`,[BATCH,offset]);
    if(!page.rows.length)throw Error('Source snapshot changed during transfer');
    for(const row of page.rows){
     const values=srcCols.map(c=>row[c]);
     await dest.query(statement,values);
    }
   }
   const dstCount=await count(dest,table);
   if(dstCount!==srcCount)throw Error('Row count mismatch during database migration: '+table);
   counts[table]=dstCount;
  }
  await dest.query('INSERT INTO zebra_migration_status(migration_id,completed_at) VALUES($1,$2)',[MARKER_ID,Date.now()]);
  await dest.query('COMMIT');destTxn=false;
  await sourceClient.query('COMMIT');sourceTxn=false;
  logger('PostgreSQL migration committed; source preserved; table count:',MARKETPLACE_TABLES.length);
  return {status:'migrated',tables:MARKETPLACE_TABLES.length,counts};
 }catch(error){
  if(destTxn)await dest.query('ROLLBACK').catch(()=>{});
  if(sourceTxn)await sourceClient?.query('ROLLBACK').catch(()=>{});
  throw error;
 }finally{
  sourceClient?.release();
  if(sourcePool)await sourcePool.end();
  dest.release();
 }
}
