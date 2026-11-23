// Stripe-hosted Checkout colors follow the storefront's saved light/dark theme.
// Stripe introduced per-Session branding_settings in API version 2025-09-30.clover.
// Only this Session-creation request opts into that version; the rest of the
// Stripe integration, webhook verification, and release gates remain unchanged.
export const CHECKOUT_BRANDING_API_VERSION='2025-09-30.clover';
const THEMES=Object.freeze({
 dark:Object.freeze({background_color:'#0B0B0B',button_color:'#F4F4F4'}),
 light:Object.freeze({background_color:'#F7F7F7',button_color:'#111111'})
});
export function checkoutBrandingForTheme(value){
 return {...THEMES[value==='light'?'light':'dark']};
}
