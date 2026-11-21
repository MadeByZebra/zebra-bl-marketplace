import test from 'node:test';
import assert from 'node:assert/strict';
import {getOtpKey,hashEmailOtp} from '../email-otp.js';
const root='8e'.repeat(32);
test('email codes derive an independent key from protected server vault',()=>{
 const env={ZEBRA_PAYLOAD_KEY:root};
 assert.equal(getOtpKey(env).length,32);
 assert.equal(hashEmailOtp('Test@Example.com','013579',env),hashEmailOtp('test@example.com','013579',env));
 assert.notEqual(hashEmailOtp('test@example.com','013579',env),hashEmailOtp('test@example.com','013578',env));
 assert.notEqual(hashEmailOtp('test@example.com','013579',env),hashEmailOtp('test2@example.com','013579',env));
});
test('dedicated OTP_SECRET overrides vault-derived key, always server-only',()=>{
 const withVault={ZEBRA_PAYLOAD_KEY:root};
 const dedicated={...withVault,OTP_SECRET:'a-strong-dedicated-signing-secret-that-is-random'};
 assert.notEqual(hashEmailOtp('test@example.com','123456',withVault),hashEmailOtp('test@example.com','123456',dedicated));
});
test('missing or invalid key cannot issue insecure verification codes',()=>{
 assert.equal(getOtpKey({}),null);
 assert.equal(getOtpKey({ZEBRA_PAYLOAD_KEY:'bad'}),null);
 assert.throws(()=>hashEmailOtp('a@example.com','123456',{}),/not configured/);
});
