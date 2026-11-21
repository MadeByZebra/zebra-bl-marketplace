// Zebra's Shop: first-party, no-attribution support assistant.
// This is a deterministic FAQ responder, NOT a general-purpose LLM.
export const SHOP_LINKS=Object.freeze({
  library:'https://zebra-bl-marketplace.onrender.com/account/',
  support:'https://zebra-bl-marketplace.onrender.com/support/#contact',
  terms:'https://zebra-bl-marketplace.onrender.com/terms/',
  scripts:'https://zebra-bl-marketplace.onrender.com/scripts/',
  zflag:'https://zebra-bl-marketplace.onrender.com/zflag/'
});
export const HUMAN_REPLY=[
  'I can alert Zebra Support that you need a person.',
  'A team member may join this chat when available; human replies are not guaranteed immediately.',
  'You can also leave an email request at '+SHOP_LINKS.support+'.'
].join(' ');
const includes=(s,rx)=>rx.test(s);
export function isHumanRequest(input){
 const q=String(input||'').toLowerCase();
 return includes(q,/\b(human|real person|live agent|actual person|real agent|manager|talk to (a )?(person|someone)|speak to (a )?(person|someone)|transfer (me|to)|representative)\b/i);
}
export function faqReply(input){
 const q=String(input||'').toLowerCase().trim();
 if(!q)return 'How can we help with BL Scripts, ZFLAG, your account, or a purchase?';
 if(isHumanRequest(q))return HUMAN_REPLY;
 if(includes(q,/\b(refund|return my money|chargeback|charged twice|money back)\b/)){
  return 'For refund or billing questions, see our terms at '+SHOP_LINKS.terms+'. To request a review, submit the product name, order reference (if available), and issue using '+SHOP_LINKS.support+'. I cannot approve refunds or access your payment information.';
 }
 if(includes(q,/\b(library|receipt|purchas(e|ed)|order|download|can't find|cannot find|missing product|login|log in|sign in|verification code|six.digit)\b/)){
  return 'Open My Library at '+SHOP_LINKS.library+' and sign in with the email you used at checkout. A six-digit sign-in code will be emailed to you. Verified orders appear there. The store is currently in Stripe sandbox testing, so test orders do not deliver real software. If an expected order is missing, use '+SHOP_LINKS.support+'. I cannot view your private account or payment.';
 }
 if(includes(q,/\b(zflag|fastflag|flag editor)\b/)){
  return 'ZFLAG is a Windows FastFlag configuration utility with browsing, editing and presets. It is not currently available for paid delivery. Read the product information at '+SHOP_LINKS.zflag+'.';
 }
 if(includes(q,/\b(class [abc]|str grinder|end grinder|grind|classes)\b/)){
  return 'STR and END Grinders currently support Class A only. Class B and Class C are planned, not guaranteed. See '+SHOP_LINKS.scripts+' for product details.';
 }
 if(includes(q,/\b(price|cost|discount|coupon|promo|payment|pay|paying|paywall|checkout|credit card)\b/)){
  return 'Real purchases are not yet available: Zebra’s Shop is testing Stripe sandbox checkout. No real charge is created by a sandbox test payment. Product prices and offers should be confirmed on '+SHOP_LINKS.scripts+'. Please never enter card details in this chat.';
 }
 if(includes(q,/\b(install|compatible|requirements|windows|roblox|executor|setup|does .* work)\b/)){
  return 'Compatibility depends on the product. Please check the details at '+SHOP_LINKS.scripts+' or '+SHOP_LINKS.zflag+'. If you need specific installation help, tell me the product and error message—without sending passwords, private keys or payment information.';
 }
 if(includes(q,/\b(email|contact|support|ticket|help)\b/)){
  return 'I can help with product basics, accounts and purchases. For a detailed question or email follow-up, contact Zebra Support at '+SHOP_LINKS.support+'. If you need a human in this chat, say “human” and I’ll alert the owner.';
 }
 if(includes(q,/^(hi|hello|hey|good (morning|afternoon|evening)|yo|sup)[.! ]*$/)){
  return 'Hey! I’m Zebra Support’s automated assistant. What can I help you with—BL Scripts, ZFLAG, purchases, or an account?';
 }
 return 'I can help with BL Scripts, ZFLAG, My Library and general order questions. Could you describe the product or issue? For questions I cannot verify, use '+SHOP_LINKS.support+'. You can also type “human” to request the owner.';
}
export function cleanChatMessage(input){
 if(typeof input!=='string')return null;
 const message=input.trim();
 if(message.length<1||message.length>1200||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(message))return null;
 return message;
}
