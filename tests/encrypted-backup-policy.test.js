import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {X509Certificate} from 'node:crypto';

const workflow=readFileSync(new URL('../.github/workflows/encrypted-neon-backup.yml',import.meta.url),'utf8');
const publicCert=readFileSync(new URL('../backups/bl-scripts-backup-PUBLIC-cert.pem',import.meta.url),'utf8');
const ignores=readFileSync(new URL('../.gitignore',import.meta.url),'utf8');

test('offsite backup encrypts customer data before uploading only ciphertext',()=>{
 assert.match(workflow,/docker run --rm -e DATABASE_URL postgres:18-alpine/);
 assert.match(workflow,/pg_dump --dbname/);
 assert.match(workflow,/openssl cms -encrypt -binary -aes-256-gcm/);
 assert.match(workflow,/rm -f bl-scripts-database\.pgcustom/);
 assert.match(workflow,/path: bl-scripts-database\.pgcustom\.cms/);
 assert.match(workflow,/retention-days: 30/);
 assert.match(workflow,/\$\{\{ secrets\.BL_SCRIPTS_NEON_BACKUP_URL \}\}/);
 assert.match(workflow,/if-no-files-found: error/);
 assert.doesNotMatch(workflow,/echo .*\$\{?DATABASE_URL/);
});
test('public encryption certificate contains no private key material and is strong enough',()=>{
 assert.match(publicCert,/BEGIN CERTIFICATE/);
 assert.doesNotMatch(publicCert,/PRIVATE KEY/);
 const cert=new X509Certificate(publicCert);
 assert.ok(cert.publicKey.asymmetricKeyDetails.modulusLength>=3072);
 assert.ok(new Date(cert.validTo).getTime()>Date.now()+365*24*60*60*1000);
});
test('secret files and database plaintext are excluded from accidental Git commits',()=>{
 assert.match(ignores,/\*PRIVATE_KEY\.pem/);
 assert.match(ignores,/\*\.pgcustom/);
 assert.match(ignores,/\.env/);
});
