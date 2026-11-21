// Free, first-party Zebra Support knowledge matcher.
// Deterministic FAQ answers: not a generative AI service or private order lookup.
// No external API call, paid credit, or user-profile access.
export const supportTopics = [
  {
    id:'order',label:'My purchase / receipt',
    expression:/\b(purchas(?:e|ed)|receipt|order|paid|bought|buy|library|missing item|missing script|unlock|entitle)\b/i,
    answer:"Check My Library while signed in with the same email you used at checkout. Only completed Stripe-verified purchases appear there. An official Stripe receipt link is available for eligible paid orders. If your purchase is missing, submit a support request with the product name, purchase date and your order reference. Never send payment card information.",
    links:[['Open My Library','/account/'],['Support instructions','/support/']]
  },
  {
    id:'refund',label:'Refund / billing problem',
    expression:/\b(refund|chargeback|disput(?:e|ed)|overcharg|double charg|billing|money back|fraud|unauthori[sz]ed|cancel order)\b/i,
    answer:"For a refund or billing issue, submit a support request with the product, date and order reference. Refund requests are reviewed individually and refunds are issued where required by law. We will never ask for your full card number or a login code. If you suspect card fraud, contact your card issuer too.",
    links:[['Refund policy','/terms/'],['Support Center','/support/']]
  },
  {
    id:'login',label:'Email sign-in',
    expression:/\b(log\s?in|sign\s?in|verification|otp|6.digit|email code|code not|spam|can.t access account|password)\b/i,
    answer:"Use the email address attached to your Zebra's Shop account. Check your Inbox, Spam and Promotions for the six-digit sign-in code. Codes expire after ten minutes; wait one minute between new requests. Never share a sign-in code with support.",
    links:[['Sign in','/account/'],['Help Center','/support/']]
  },
  {
    id:'key',label:'Script loader / license',
    expression:/\b(loadstring|license|licence|key|loader|install|download|launch|script fail|script not work|script won.t|invalid token)\b/i,
    answer:"Sign into My Library and confirm the product is shown as purchased. Generate your own current license loader from your library when available. Old keys stop working when rotated or access is revoked. Check that the product supports your device and game environment. If it still fails, send the product name, exact error and device type—never share your private license key.",
    links:[['My Library','/account/'],['Product descriptions','/scripts/']]
  },
  {
    id:'class',label:'STR / END class compatibility',
    expression:/\b(class\s?[abc]|str grinder|end grinder|training|push.mat|grind)\b/i,
    answer:"STR Grinder and END Grinder currently support Class A only. Class B and C support is planned but is not included in a purchase today. Read the relevant listing before buying; compatibility with future third-party game updates cannot be guaranteed.",
    links:[['Check compatibility','/scripts/'],['Terms & Refunds','/terms/']]
  },
  {
    id:'devices',label:'Desktop / mobile compatibility',
    expression:/\b(mobile|iphone|android|desktop|pc|windows|mac|compatib|platform|device|fps|performance)\b/i,
    answer:"Each tool has a stated supported platform in its product description. The DEX desktop and mobile editions are separate. The FPS tool reduces graphical effects but does not guarantee higher frame rates. Please check the precise platform and compatibility notes before purchase.",
    links:[['Product details','/scripts/']]
  },
  {
    id:'zflag',label:'ZFLAG availability',
    expression:/\b(zflag|injector|setup exe|exe file|installer)\b/i,
    answer:"ZFLAG delivery is gated while its Windows installer and compatibility are verified. If a download isn't available in your library, it has not been released for paid delivery. Never pay a third party claiming to distribute Zebra's private installer.",
    links:[['ZFLAG status','/zflag/'],['My Library','/account/']]
  },
  {
    id:'test',label:'Sandbox / checkout status',
    expression:/\b(sandbox|test card|checkout|stripe|payment disable|checkout fail|test payment)\b/i,
    answer:"Zebra's Shop is still in the Stripe test phase. Test payments are simulated and do not charge real money. The public storefront remains locked from real sales until payment verification, delivery and email checks are completed. Please do not attempt to pay with a real card in the test environment.",
    links:[['Store status','/scripts/']]
  },
  {
    id:'support',label:'Contact the shop',
    expression:/\b(human|person|agent|contact|support|help|talk to|speak to|email|representative|ticket)\b/i,
    answer:"I can answer common questions instantly, but I'm an automated FAQ assistant, not a human or a full AI model. If you still need help, select Contact support below to send a request directly to Zebra's Shop. Support requests are stored for review; immediate human replies are not guaranteed.",
    links:[['Contact options','/support/']]
  }
];

export function getSupportReply(message) {
  const text=String(message ?? '').trim().slice(0,3000);
  if(!text)return {id:'empty',answer:'Tell me what you need help with: purchases, receipts, sign-in, scripts, refunds or compatibility.',links:[]};
  for(const topic of supportTopics){
    if(topic.expression.test(text))return {id:topic.id,answer:topic.answer,links:topic.links};
  }
  return {id:'other',
    answer:"I don't have a verified answer for that specific question. I can help with purchases, receipts, sign-in, licenses, compatibility and refunds. If your issue is different, choose Contact support so someone can review it.",
    links:[['Search support articles','/support/'],['Shop contact','mailto:zebrablshopofficial@gmail.com']]
  };
}
