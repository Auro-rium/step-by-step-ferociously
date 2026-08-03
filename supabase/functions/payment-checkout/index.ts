import { createClient } from '@supabase/supabase-js';

const TERMS_VERSION = '2026-08-03';
const NO_REFUND_VERSION = '2026-08-03';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://finish-landing-nine.vercel.app';

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

async function paypalToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('PayPal live API credentials are missing');
  if (Deno.env.get('PAYPAL_ENV') !== 'live') throw new Error('PayPal is not configured for live payments');

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

async function createPaypalOrder(
  accessToken: string,
  order: any,
  challenge: any,
  amount: string,
) {
  const returnUrl = `${SITE_URL}/checkout/${encodeURIComponent(challenge.slug)}?paypal=return&finish_order=${encodeURIComponent(order.id)}`;
  const cancelUrl = `${SITE_URL}/checkout/${encodeURIComponent(challenge.slug)}?paypal=cancelled&finish_order=${encodeURIComponent(order.id)}`;
  const description = `FINISH course: ${challenge.title}`.slice(0, 127);

  const response = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `${order.id}-create-v2`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order.id,
        custom_id: order.id,
        invoice_id: `FINISH-${order.id}`,
        description,
        amount: { currency_code: 'USD', value: amount },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'FINISH',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.id) {
    const detail = data?.details?.[0]?.description || data?.message || data?.error_description;
    throw new Error(detail || 'PayPal order creation failed');
  }

  const approval = (data.links || []).find((link: any) =>
    link?.rel === 'payer-action' || link?.rel === 'approve'
  );
  if (!approval?.href) throw new Error('PayPal approval URL is missing');
  return { data, approvalUrl: String(approval.href) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Authentication required' }, 401);

    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401);

    const input = await req.json();
    if (String(input.provider || 'paypal').toLowerCase() !== 'paypal') {
      return json({ error: 'FINISH accepts PayPal only' }, 400);
    }
    if (input.terms_accepted !== true || input.no_refund_accepted !== true) {
      return json({
        error: 'You must agree to the Terms of Use and acknowledge the No-Refund Policy before payment.',
      }, 400);
    }
    if (
      String(input.terms_version || '') !== TERMS_VERSION
      || String(input.no_refund_version || '') !== NO_REFUND_VERSION
    ) {
      return json({
        error: 'The purchase policies changed. Reload checkout and review them again.',
      }, 409);
    }

    const challengeSlug = String(input.challenge_slug || '').trim();
    const { data: challenge, error: challengeError } = await db
      .from('challenges')
      .select('id,title,slug,status,route_ready')
      .eq('slug', challengeSlug)
      .eq('status', 'published')
      .single();
    if (challengeError || !challenge) return json({ error: 'Course not found' }, 404);
    if (challenge.route_ready === false) {
      return json({ error: 'This course is not ready for purchase' }, 409);
    }

    const { data: existingAccess } = await db
      .from('enrollments')
      .select('access_status')
      .eq('user_id', userData.user.id)
      .eq('challenge_id', challenge.id)
      .in('access_status', ['paid', 'granted'])
      .maybeSingle();
    if (existingAccess) {
      return json({ error: 'This course is already unlocked for your account.' }, 409);
    }

    const { data: price, error: priceError } = await db
      .from('challenge_prices')
      .select('id,amount,currency,provider')
      .eq('challenge_id', challenge.id)
      .eq('provider', 'paypal')
      .eq('currency', 'USD')
      .eq('active', true)
      .single();
    if (priceError || !price) return json({ error: 'PayPal USD price is not configured' }, 400);

    const amount = Number(price.amount);
    if (!Number.isFinite(amount) || Math.round(amount * 100) !== 100) {
      return json({ error: 'FINISH live checkout currently supports the USD 1.00 launch price only.' }, 409);
    }
    const amountText = amount.toFixed(2);

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: reusableOrders } = await db
      .from('payment_orders')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('challenge_id', challenge.id)
      .eq('provider', 'paypal')
      .eq('status', 'pending')
      .gte('created_at', fifteenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(5);

    const reusable = (reusableOrders || []).find((order: any) =>
      order.metadata?.payment_mode === 'orders_v2'
      && order.provider_order_id
      && order.checkout_url
    );
    if (reusable) {
      return json({
        kind: 'orders_v2',
        provider: 'paypal',
        checkout_url: reusable.checkout_url,
        order_id: reusable.id,
        paypal_order_id: reusable.provider_order_id,
        order_status: reusable.status,
        expected_amount: { currency: 'USD', value: amountText },
        policy_versions: { terms: TERMS_VERSION, no_refund: NO_REFUND_VERSION },
      });
    }

    const acceptedAt = new Date().toISOString();
    const metadata = {
      email: userData.user.email,
      challenge_slug: challenge.slug,
      challenge_title: challenge.title,
      payment_mode: 'orders_v2',
      expected_amount: { currency: 'USD', value: amountText },
      policy_acceptance: {
        terms_version: TERMS_VERSION,
        no_refund_version: NO_REFUND_VERSION,
        accepted_at: acceptedAt,
      },
    };

    const { data: order, error: orderError } = await db
      .from('payment_orders')
      .insert({
        user_id: userData.user.id,
        challenge_id: challenge.id,
        price_id: price.id,
        provider: 'paypal',
        currency: 'USD',
        amount,
        status: 'pending',
        terms_accepted_at: acceptedAt,
        terms_version: TERMS_VERSION,
        no_refund_accepted_at: acceptedAt,
        no_refund_version: NO_REFUND_VERSION,
        metadata,
      })
      .select()
      .single();
    if (orderError || !order) {
      return json({ error: 'Could not create the FINISH payment order' }, 500);
    }

    try {
      const accessToken = await paypalToken();
      const paypal = await createPaypalOrder(accessToken, order, challenge, amountText);
      const nextMetadata = {
        ...metadata,
        paypal_status: paypal.data.status,
        paypal_created_at: paypal.data.create_time || new Date().toISOString(),
      };
      const { error: updateError } = await db
        .from('payment_orders')
        .update({
          provider_order_id: paypal.data.id,
          checkout_url: paypal.approvalUrl,
          metadata: nextMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      if (updateError) throw updateError;

      return json({
        kind: 'orders_v2',
        provider: 'paypal',
        checkout_url: paypal.approvalUrl,
        order_id: order.id,
        paypal_order_id: paypal.data.id,
        order_status: 'pending',
        expected_amount: { currency: 'USD', value: amountText },
        policy_versions: { terms: TERMS_VERSION, no_refund: NO_REFUND_VERSION },
      });
    } catch (error) {
      await db
        .from('payment_orders')
        .update({
          status: 'failed',
          metadata: {
            ...metadata,
            paypal_create_error: error instanceof Error ? error.message : 'Unknown PayPal error',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      throw error;
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected checkout error' }, 500);
  }
});
