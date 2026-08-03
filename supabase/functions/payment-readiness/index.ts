const PAYPAL_PAYMENT_LINK = 'https://www.paypal.com/ncp/payment/8W4VPV34FECHC';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const paypalApiCheckout = Boolean(
    Deno.env.get('PAYPAL_CLIENT_ID') && Deno.env.get('PAYPAL_CLIENT_SECRET'),
  );
  const paypalWebhook = Boolean(Deno.env.get('PAYPAL_WEBHOOK_ID'));
  return new Response(JSON.stringify({
    paypal: true,
    paypalCheckout: true,
    paypalHostedLink: true,
    paypalApiCheckout,
    paypalWebhook,
    paymentMode: 'hosted_link',
    paymentLink: PAYPAL_PAYMENT_LINK,
    provider: 'paypal',
    currency: 'USD',
    amount: 1,
    pricingModel: 'global',
    geolocationPricing: false,
    unlockMode: paypalWebhook ? 'webhook_or_admin_verification' : 'admin_verification',
  }), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
