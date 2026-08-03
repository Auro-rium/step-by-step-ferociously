import { createClient } from '@supabase/supabase-js';

const TERMS_VERSION = '2026-08-03';
const NO_REFUND_VERSION = '2026-08-03';
const PAYPAL_PAYMENT_LINK = 'https://www.paypal.com/ncp/payment/8W4VPV34FECHC';
const PAYPAL_PAYMENT_LINK_ID = '8W4VPV34FECHC';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Authentication required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const db = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401);

    const input = await req.json();
    if (String(input.provider || 'paypal').toLowerCase() !== 'paypal') {
      return json({ error: 'FINISH accepts PayPal only' }, 400);
    }
    if (input.terms_accepted !== true || input.no_refund_accepted !== true) {
      return json({ error: 'You must agree to the Terms of Use and acknowledge the No-Refund Policy before payment.' }, 400);
    }
    if (String(input.terms_version || '') !== TERMS_VERSION || String(input.no_refund_version || '') !== NO_REFUND_VERSION) {
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
    if (Number(price.amount) !== 1) return json({ error: 'The PayPal Business Link currently supports the FINISH USD 1.00 launch price only.' }, 409);

    const { data: recentOrders } = await db
      .from('payment_orders')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('challenge_id', challenge.id)
      .eq('provider', 'paypal')
      .in('status', ['pending', 'manual_review'])
      .order('created_at', { ascending: false })
      .limit(5);

    const existing = (recentOrders || []).find((order: any) => order.metadata?.payment_mode === 'hosted_link');
    if (existing) {
      return json({
        kind: 'hosted_link',
        provider: 'paypal',
        checkout_url: PAYPAL_PAYMENT_LINK,
        order_id: existing.id,
        order_status: existing.status,
        transaction_id: existing.provider_payment_id || null,
        expected_amount: { currency: 'USD', value: '1.00' },
        policy_versions: { terms: TERMS_VERSION, no_refund: NO_REFUND_VERSION },
      });
    }

    const acceptedAt = new Date().toISOString();
    const { data: order, error: orderError } = await db.from('payment_orders').insert({
      user_id: userData.user.id,
      challenge_id: challenge.id,
      price_id: price.id,
      provider: 'paypal',
      currency: 'USD',
      amount: 1,
      status: 'pending',
      checkout_url: PAYPAL_PAYMENT_LINK,
      terms_accepted_at: acceptedAt,
      terms_version: TERMS_VERSION,
      no_refund_accepted_at: acceptedAt,
      no_refund_version: NO_REFUND_VERSION,
      metadata: {
        email: userData.user.email,
        challenge_slug: challenge.slug,
        challenge_title: challenge.title,
        payment_mode: 'hosted_link',
        payment_link_id: PAYPAL_PAYMENT_LINK_ID,
        expected_amount: { currency: 'USD', value: '1.00' },
        policy_acceptance: {
          terms_version: TERMS_VERSION,
          no_refund_version: NO_REFUND_VERSION,
          accepted_at: acceptedAt,
        },
      },
    }).select().single();
    if (orderError || !order) return json({ error: 'Could not create the FINISH payment order' }, 500);

    return json({
      kind: 'hosted_link',
      provider: 'paypal',
      checkout_url: PAYPAL_PAYMENT_LINK,
      order_id: order.id,
      order_status: order.status,
      expected_amount: { currency: 'USD', value: '1.00' },
      policy_versions: { terms: TERMS_VERSION, no_refund: NO_REFUND_VERSION },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected checkout error' }, 500);
  }
});
