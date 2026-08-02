const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const paypalCheckout = Boolean(
    Deno.env.get('PAYPAL_CLIENT_ID') && Deno.env.get('PAYPAL_CLIENT_SECRET'),
  );
  const paypalWebhook = Boolean(Deno.env.get('PAYPAL_WEBHOOK_ID'));
  return new Response(JSON.stringify({
    paypal: paypalCheckout && paypalWebhook,
    paypalCheckout,
    paypalWebhook,
    provider: 'paypal',
    currency: 'USD',
    pricingModel: 'global',
    geolocationPricing: false,
  }), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
