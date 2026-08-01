const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const stripe = Boolean(Deno.env.get('STRIPE_SECRET_KEY') && Deno.env.get('STRIPE_WEBHOOK_SECRET'));
  const razorpay = Boolean(Deno.env.get('RAZORPAY_KEY_ID') && Deno.env.get('RAZORPAY_KEY_SECRET'));
  const razorpayWebhook = Boolean(Deno.env.get('RAZORPAY_WEBHOOK_SECRET'));
  return new Response(JSON.stringify({ stripe, razorpay, razorpayWebhook, crypto: false }), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
