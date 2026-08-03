import { createClient } from '@supabase/supabase-js';

const TERMS_VERSION = '2026-08-03';
const NO_REFUND_VERSION = '2026-08-03';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const paypalBase = () => Deno.env.get('PAYPAL_ENV') === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

function safeRedirect(value: unknown, siteUrl: string, fallbackPath: string) {
  const base = new URL(siteUrl);
  try {
    const candidate = new URL(String(value || ''), base);
    return candidate.origin === base.origin ? candidate.toString() : new URL(fallbackPath, base).toString();
  } catch {
    return new URL(fallbackPath, base).toString();
  }
}

async function paypalToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('PayPal is not configured yet');

  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || 'PayPal authentication failed');
  return String(data.access_token);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Authentication required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const db = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401);

    const input = await req.json();
    const provider = String(input.provider || 'paypal').toLowerCase();
    if (provider !== 'paypal') return json({ error: 'FINISH accepts PayPal only' }, 400);

    const acceptedTerms = input.terms_accepted === true;
    const acceptedNoRefund = input.no_refund_accepted === true;
    const termsVersion = String(input.terms_version || '');
    const noRefundVersion = String(input.no_refund_version || '');
    if (!acceptedTerms || !acceptedNoRefund) {
      return json({ error: 'You must agree to the Terms of Use and acknowledge the No-Refund Policy before payment.' }, 400);
    }
    if (termsVersion !== TERMS_VERSION || noRefundVersion !== NO_REFUND_VERSION) {
      return json({ error: 'The purchase policies changed. Reload checkout and review them again.' }, 409);
    }

    const challengeSlug = String(input.challenge_slug || '').trim();
    const { data: challenge, error: challengeError } = await db
      .from('challenges')
      .select('id,title,slug,status,route_ready')
      .eq('slug', challengeSlug)
      .eq('status', 'published')
      .single();
    if (challengeError || !challenge) return json({ error: 'Course not found' }, 404);
    if (challenge.route_ready === false) return json({ error: 'This course is not ready for purchase' }, 409);

    const { data: existingAccess } = await db
      .from('enrollments')
      .select('access_status')
      .eq('user_id', userData.user.id)
      .eq('challenge_id', challenge.id)
      .in('access_status', ['paid', 'granted'])
      .maybeSingle();
    if (existingAccess) return json({ error: 'This course is already unlocked for your account.' }, 409);

    const { data: price, error: priceError } = await db
      .from('challenge_prices')
      .select('id,amount,currency,provider')
      .eq('challenge_id', challenge.id)
      .eq('provider', 'paypal')
      .eq('currency', 'USD')
      .eq('active', true)
      .single();
    if (priceError || !price) return json({ error: 'PayPal USD price is not configured' }, 400);

    const acceptedAt = new Date().toISOString();
    const { data: order, error: orderError } = await db.from('payment_orders').insert({
      user_id: userData.user.id,
      challenge_id: challenge.id,
      price_id: price.id,
      provider: 'paypal',
      currency: 'USD',
      amount: price.amount,
      status: 'created',
      terms_accepted_at: acceptedAt,
      terms_version: TERMS_VERSION,
      no_refund_accepted_at: acceptedAt,
      no_refund_version: NO_REFUND_VERSION,
      metadata: {
        email: userData.user.email,
        challenge_slug: challenge.slug,
        policy_acceptance: {
          terms_version: TERMS_VERSION,
          no_refund_version: NO_REFUND_VERSION,
          accepted_at: acceptedAt,
        },
      },
    }).select().single();
    if (orderError || !order) return json({ error: 'Could not create payment order' }, 500);

    const siteUrl = Deno.env.get('SITE_URL') || 'https://finish-landing-nine.vercel.app';
    const cancelUrl = safeRedirect(input.cancel_url, siteUrl, `/checkout/${challenge.slug}`);
    const captureUrl = `${supabaseUrl}/functions/v1/paypal-capture?internal_order_id=${encodeURIComponent(order.id)}`;
    const accessToken = await paypalToken();

    const response = await fetch(`${paypalBase()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': order.id,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: order.id,
          custom_id: order.id,
          description: challenge.title,
          amount: { currency_code: 'USD', value: Number(price.amount).toFixed(2) },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'FINISH',
              user_action: 'PAY_NOW',
              return_url: captureUrl,
              cancel_url: cancelUrl,
            },
          },
        },
      }),
    });
    const paypal = await response.json();

    if (!response.ok) {
      await db.from('payment_orders').update({
        status: 'failed',
        metadata: { ...order.metadata, paypal_error: paypal },
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      return json({ error: paypal.message || 'PayPal checkout failed' }, 502);
    }

    const approvalUrl = paypal.links?.find((link: { rel?: string; href?: string }) =>
      link.rel === 'payer-action' || link.rel === 'approve')?.href;
    if (!approvalUrl) {
      await db.from('payment_orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', order.id);
      return json({ error: 'PayPal approval URL is missing' }, 502);
    }

    await db.from('payment_orders').update({
      status: 'pending',
      provider_order_id: paypal.id,
      checkout_url: approvalUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);

    return json({
      kind: 'redirect',
      provider: 'paypal',
      checkout_url: approvalUrl,
      order_id: order.id,
      policy_versions: { terms: TERMS_VERSION, no_refund: NO_REFUND_VERSION },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected checkout error' }, 500);
  }
});
