// Zebra's Shop promotions: verified server-side, charged via Stripe price_data.
// These codes are shareable; there is no per-account redemption limit.
// The diagnostic item is never discountable.
const campaigns=Object.freeze({
  ZEBRA10:{percent:10,scope:'all',description:'10% off an eligible order'},
  LAUNCH15:{percent:15,scope:'all',description:'15% off an eligible order'},
  BUNDLE20:{percent:20,scope:'bundle',description:'20% extra off a script bundle'}
});
export const promotionalCodes=Object.freeze(Object.keys(campaigns));
export function discountQuote(item,provided='',options={}){
  if(!item||!Number.isInteger(item.price)||item.price<50)return {ok:false,error:'Product is not available for a quote.'};
  const raw=String(provided||'').trim().toUpperCase();
  if(raw.length>32||raw&&!/^[A-Z0-9-]+$/.test(raw))return {ok:false,error:'Enter a valid discount code.'};
  if(!raw)return {ok:true,code:null,percent:0,original:item.price,total:item.price,saved:0,description:'Standard price'};
  if(item.testOnly)return {ok:false,error:'Discounts cannot be used on the payment diagnostic.'};
  // Private shop-owner promotion. The actual code comes from a server-only
  // environment variable and is never shipped in website JavaScript.
  const configured=String(options.freeCode||'').trim().toUpperCase();
  const eligible=item.kind!=='download'&&!item.testOnly&&
    (Array.isArray(item.items)||/\\.lua$/.test(String(item.file||'')));
  if(configured&&/^[A-Z0-9-]{6,32}$/.test(configured)&&raw===configured){
    if(!eligible)return {ok:false,error:'This free promotion is not eligible for that product.'};
    return {ok:true,code:raw,percent:100,original:item.price,total:0,saved:item.price,free:true,
      description:'100% off via verified Stripe Checkout; no card charge'};
  }
  const promo=campaigns[raw];
  if(!promo)return {ok:false,error:'That discount code is not valid.'};
  if(promo.scope==='bundle'&&!Array.isArray(item.items))return {ok:false,error:'This code applies to bundles only.'};
  const saved=Math.floor(item.price*promo.percent/100);
  const total=Math.max(50,item.price-saved);
  return {ok:true,code:raw,percent:promo.percent,original:item.price,total,saved:item.price-total,description:promo.description};
}
