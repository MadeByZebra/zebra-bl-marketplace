// Email OTP signing. A dedicated OTP_SECRET is preferred, but a strongly random
// server-only AES vault key may be used as the root of a separately derived OTP key.
// Domain-separated HMAC keeps encryption and OTP verification keys independent.
import {createHmac} from 'node:crypto';
export function getOtpKey(env=process.env){
 const dedicated=String(env.OTP_SECRET||'');
 if(dedicated.length>=32)
  return createHmac('sha256',Buffer.from(dedicated,'utf8'))
   .update('zebra-shop/email-otp-dedicated/v1').digest();
 const vault=String(env.ZEBRA_PAYLOAD_KEY||'');
 if(/^[a-f0-9]{64}$/i.test(vault))
  return createHmac('sha256',Buffer.from(vault,'hex'))
   .update('zebra-shop/email-otp-derived/v1').digest();
 return null;
}
export function hashEmailOtp(email,code,env=process.env){
 const key=getOtpKey(env);
 if(!key)throw Error('Email OTP signing is not configured.');
 return createHmac('sha256',key).update(String(email).toLowerCase())
  .update('\\0').update(String(code)).digest('hex');
}
