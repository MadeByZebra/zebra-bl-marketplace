// Feedback is voluntary and only accepted after a verified purchase.
// There is deliberately no automatic 5-star review or public-facing count.
export function parseOrderFeedback(input){
 const rating=input?.rating;
 const comment=input?.comment;
 if(!Number.isInteger(rating)||rating<1||rating>5)return {ok:false,error:'Choose a rating from 1 to 5.'};
 if(typeof comment!=='string'||comment.length>1200)return {ok:false,error:'Feedback must be text of at most 1,200 characters.'};
 const clean=comment.trim();
 if(clean.length>1200)return {ok:false,error:'Feedback is too long.'};
 return {ok:true,rating,comment:clean};
}
export const validCheckoutReference=value=>typeof value==='string'
 &&/^cs_(test_|live_)[A-Za-z0-9_]{10,200}$/.test(value);
