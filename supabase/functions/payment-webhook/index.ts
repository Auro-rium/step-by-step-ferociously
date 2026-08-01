import { createClient } from "@supabase/supabase-js";

function json(body: unknown, status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}})}
function hex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function hmacHex(secret:string,message:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)))}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const raw=await req.text();
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  try{
    const stripeSignature=req.headers.get('stripe-signature');
    const razorpaySignature=req.headers.get('x-razorpay-signature');
    let provider=''; let event:any; let eventId=''; let eventType='';

    if(stripeSignature){
      provider='stripe';
      const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET');
      if(!secret)return json({error:'Stripe webhook secret missing'},503);
      const parts=Object.fromEntries(stripeSignature.split(',').map(p=>p.split('=',2)));
      const t=parts.t; const v1=parts.v1;
      if(!t||!v1)return json({error:'Malformed Stripe signature'},400);
      if(Math.abs(Math.floor(Date.now()/1000)-Number(t))>300)return json({error:'Stale Stripe webhook'},400);
      const expected=await hmacHex(secret,`${t}.${raw}`);
      if(!safeEqual(expected,v1))return json({error:'Invalid Stripe signature'},400);
      event=JSON.parse(raw); eventId=String(event.id||''); eventType=String(event.type||'');
    } else if(razorpaySignature){
      provider='razorpay';
      const secret=Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
      if(!secret)return json({error:'Razorpay webhook secret missing'},503);
      const expected=await hmacHex(secret,raw);
      if(!safeEqual(expected,razorpaySignature))return json({error:'Invalid Razorpay signature'},400);
      event=JSON.parse(raw); eventId=req.headers.get('x-razorpay-event-id')||crypto.randomUUID(); eventType=String(event.event||'');
    } else return json({error:'Unknown webhook provider'},400);

    const {error:eventError}=await db.from('payment_webhook_events').insert({provider,event_id:eventId,event_type:eventType,payload:event});
    if(eventError && eventError.code==='23505')return json({ok:true,duplicate:true});
    if(eventError)return json({error:'Could not persist webhook'},500);

    let order:any=null; let paymentId:string|null=null;
    if(provider==='stripe' && eventType==='checkout.session.completed'){
      const session=event.data?.object;
      if(session?.payment_status!=='paid')return json({ok:true,ignored:true});
      const internalOrderId=session?.client_reference_id||session?.metadata?.order_id;
      const result=await db.from('payment_orders').select('*').eq('id',internalOrderId).eq('provider','stripe').single();
      order=result.data; paymentId=session?.payment_intent||session?.id;
    }
    if(provider==='razorpay' && ['payment.captured','order.paid'].includes(eventType)){
      const payment=event.payload?.payment?.entity;
      const providerOrderId=payment?.order_id||event.payload?.order?.entity?.id;
      const result=await db.from('payment_orders').select('*').eq('provider_order_id',providerOrderId).eq('provider','razorpay').single();
      order=result.data; paymentId=payment?.id||null;
    }
    if(!order)return json({ok:true,ignored:true});

    await db.from('payment_orders').update({status:'paid',provider_payment_id:paymentId}).eq('id',order.id);
    await db.from('enrollments').upsert({user_id:order.user_id,challenge_id:order.challenge_id,access_status:'paid',updated_at:new Date().toISOString()},{onConflict:'user_id,challenge_id'});
    return json({ok:true});
  }catch(error){return json({error:error instanceof Error?error.message:'Webhook error'},500)}
});
