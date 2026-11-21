// A public Render URL is NOT a private Stripe sandbox.
// Only the store owner's explicitly allowlisted email accounts can complete
// test-card checkouts, and test-paid software delivery is separately gated.
// Never include this allowlist in frontend data.
export function sandboxEmails(env=process.env){
 return String(env.STRIPE_TEST_ALLOWED_EMAILS||'').split(',')
  .map(x=>x.trim().toLowerCase()).filter(Boolean)
  .filter(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
}
export function isSandboxTester(email,env=process.env){
 if(typeof email!=='string')return false;
 return sandboxEmails(env).includes(email.trim().toLowerCase());
}
export function mayCheckoutSandbox({email,sku,env=process.env}){
 if(!isSandboxTester(email,env)||env.ENABLE_TEST_CHECKOUT!=='1')return false;
 if(sku==='checkout-test')return true;
 return env.ENABLE_TEST_SOFTWARE_DELIVERY==='1';
}
export function mayDeliverSandboxScript(email,env=process.env){
 return isSandboxTester(email,env)&&env.ENABLE_TEST_SOFTWARE_DELIVERY==='1';
}
