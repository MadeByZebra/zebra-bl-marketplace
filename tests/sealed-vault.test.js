import test from 'node:test';import assert from 'node:assert/strict';
import {seal,unseal,keyBuffer} from '../vault.js';
import {randomBytes} from 'node:crypto';
test('encrypted AES-GCM payloads round-trip without leaking source',()=>{
 const key=randomBytes(32).toString('hex'),source=Buffer.from('print("SOURCE MUST BE PRIVATE")\\n'.repeat(100));
 const ciphertext=seal(source,key);
 assert.ok(!ciphertext.toString().includes('SOURCE MUST BE PRIVATE'));
 assert.ok(unseal(ciphertext,key).equals(source));
 assert.throws(()=>unseal(ciphertext,randomBytes(32).toString('hex')));
});
test('key validation',()=>{assert.throws(()=>keyBuffer('broken'));assert.equal(keyBuffer('01'.repeat(32)).length,32)});
