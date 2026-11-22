// Choose the Stripe signing secret for the active server-key environment.
// Never accept a test signing secret for a live Stripe merchant.
export function webhookSecretFor(secretKey,env={}){
 const key=String(secretKey||'');
 if(key.startsWith('sk_live_'))return String(env.STRIPE_LIVE_WEBHOOK_SECRET||'').trim();
 if(key.startsWith('sk_test_'))return String(env.STRIPE_TEST_WEBHOOK_SECRET||env.STRIPE_WEBHOOK_SECRET||'').trim();
 return '';
}

export function configuredWebhookSecret(secretKey,env={}){
 return /^whsec_[A-Za-z0-9]+$/.test(webhookSecretFor(secretKey,env));
}
