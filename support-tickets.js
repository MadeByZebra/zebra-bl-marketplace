// Customer support ticket validation; safe to test without database or email credentials.
import {randomBytes} from 'node:crypto';
const ALLOWED_SUBJECTS = new Set(['Purchase or receipt','Account sign-in','Software / compatibility','Refund request','Other']);
export function normalizeTicket(body) {
  const email=String(body?.email||'').trim().toLowerCase();
  const subject=String(body?.subject||'').trim();
  const message=String(body?.message||'').trim();
  const website=String(body?.website||'').trim();
  if(website)return {ok:false,error:'Could not submit this request.'};
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return {ok:false,error:'Enter a valid reply email address.'};
  if(!ALLOWED_SUBJECTS.has(subject))return {ok:false,error:'Select a support topic.'};
  if(message.length<15||message.length>3000)return {ok:false,error:'Describe the problem in 15–3,000 characters.'};
  return {ok:true,email,subject,message};
}
export function supportAdminEmails(env=process.env) {
  return String(env.SUPPORT_INBOX_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(x=>/^\S+@\S+\.\S+$/.test(x));
}
export function isSupportAdmin(email,env=process.env) {
  return typeof email==='string'&&supportAdminEmails(env).includes(email.trim().toLowerCase());
}
export function makeTicketId() {
  return 'ZB-'+randomBytes(8).toString('hex').toUpperCase();
}
export function normalizeSupportReply(body) {
  const ticket=String(body?.ticket||'').trim().toUpperCase();
  const message=String(body?.message||'').trim();
  if(!/^ZB-[A-F0-9]{16}$/.test(ticket))return {ok:false,error:'Invalid ticket reference.'};
  if(message.length<2||message.length>3000)return {ok:false,error:'Reply must be between 2 and 3,000 characters.'};
  return {ok:true,ticket,message};
}
