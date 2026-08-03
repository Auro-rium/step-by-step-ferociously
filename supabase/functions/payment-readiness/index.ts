const EXPECTED_WEBHOOK_URL = 'https://ijkdhrznxukawugeoocs.supabase.co/functions/v1/payment-webhook';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const paypalBase = () => Deno.env.get('PAYPAL_ENV') === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function paypalToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('PayPal API credentials are missing');

  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'PayPal authentication failed');
  }
  return String(data.access_token);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!['GET', 'POST'].includes(req.method)) {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
  const environment = Deno.env.get('PAYPAL_ENV') === 'live' ? 'live' : 'sandbox';
  const paypalApiCheckout = Boolean(clientId && clientSecret && environment === 'live');
  const paypalWebhook = Boolean(webhookId && environment === 'live');
  const probe = new URL(req.url).searchParams.get('probe') === '1';

  let paypalApiAuthenticated: boolean | null = null;
  let paypalWebhookVerified: boolean | null = null;
  let webhookUrlMatches: boolean | null = null;
  let probeError: string | null = null;

  if (probe && paypalApiCheckout) {
    try {
      const accessToken = await paypalToken();
      paypalApiAuthenticated = true;
      if (webhookId) {
        const response = await fetch(`${paypalBase()}/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        paypalWebhookVerified = response.ok && data.id === webhookId;
        webhookUrlMatches = paypalWebhookVerified && data.url === EXPECTED_WEBHOOK_URL;
        if (!response.ok) {
          probeError = data.message || data.error_description || 'PayPal webhook lookup failed';
        }
      }
    } catch (error) {
      paypalApiAuthenticated = false;
      paypalWebhookVerified = false;
      webhookUrlMatches = false;
      probeError = error instanceof Error ? error.message : 'PayPal readiness probe failed';
    }
  }

  const configured = paypalApiCheckout && paypalWebhook;
  return new Response(JSON.stringify({
    paypal: configured,
    paypalCheckout: configured,
    paypalApiCheckout,
    paypalWebhook,
    paypalLive: environment === 'live',
    environment,
    paymentMode: 'orders_v2',
    provider: 'paypal',
    currency: 'USD',
    amount: 1,
    pricingModel: 'global',
    geolocationPricing: false,
    unlockMode: 'automatic_capture',
    returnCapture: true,
    webhookBackup: true,
    ...(probe ? {
      paypalApiAuthenticated,
      paypalWebhookVerified,
      webhookUrlMatches,
      probeError,
    } : {}),
  }), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
