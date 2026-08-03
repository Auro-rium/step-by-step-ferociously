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

async function showPaypalOrder(accessToken: string, paypalOrderId: string) {
  const response = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Could not read the PayPal order');
  return data;
}

async function capturePaypalOrder(
  accessToken: string,
  paypalOrderId: string,
  internalOrderId: string,
) {
  const response = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `${internalOrderId}-capture-v2`,
      Prefer: 'return=representation',
    },
    body: '{}',
  });

  const data = await response.json();
  if (response.ok) return data;

  if (response.status === 422) {
    const shown = await showPaypalOrder(accessToken, paypalOrderId);
    if (shown.status === 'COMPLETED' || shown.status === 'APPROVED') return shown;
  }

  const detail = data?.details?.[0]?.description || data?.message || data?.error_description;
  throw new Error(detail || 'PayPal capture failed');
}

function firstCapture(paypalOrder: any) {
  for (const unit of paypalOrder?.purchase_units || []) {
    const capture = unit?.payments?.captures?.[0];
    if (capture) return capture;
  }
  return null;
}

function amountMatches(order: any, capture: any) {
  const value = capture?.amount?.value;
  const currency = capture?.amount?.currency_code;
  if (value == null || currency == null) return false;
  return String(currency).toUpperCase() === String(order.currency).toUpperCase()
    && Math.round(Number(value) * 100) === Math.round(Number(order.amount) * 100);
}

function orderReferenceMatches(order: any, paypalOrder: any) {
  const unit = paypalOrder?.purchase_units?.[0];
  return unit?.custom_id === order.id || unit?.reference_id === order.id;
}

function hasCurrentPolicyConsent(order: any) {
  return Boolean(
    order?.terms_accepted_at
    && order?.no_refund_accepted_at
    && order?.terms_version === TERMS_VERSION
    && order?.no_refund_version === NO_REFUND_VERSION
  );
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
    const internalOrderId = String(input.order_id || '').trim();
    const paypalOrderId = String(input.paypal_order_id || '').trim();
    if (!internalOrderId || !paypalOrderId) {
      return json({ error: 'Payment callback is incomplete' }, 400);
    }

    const { data: order, error: orderError } = await db
      .from('payment_orders')
      .select('*')
      .eq('id', internalOrderId)
      .eq('user_id', userData.user.id)
      .eq('provider', 'paypal')
      .single();
    if (orderError || !order) return json({ error: 'FINISH payment order not found' }, 404);
    if (order.provider_order_id !== paypalOrderId) {
      return json({ error: 'PayPal order mismatch' }, 409);
    }
    if (order.metadata?.payment_mode !== 'orders_v2') {
      return json({ error: 'This payment order is not eligible for automatic capture' }, 409);
    }
    if (!hasCurrentPolicyConsent(order)) {
      return json({ error: 'Payment order is missing required policy acceptance' }, 409);
    }
    if (
      String(order.currency).toUpperCase() !== 'USD'
      || Math.round(Number(order.amount) * 100) !== 100
    ) {
      return json({ error: 'FINISH payment amount mismatch' }, 409);
    }

    if (order.status === 'paid') {
      const result = await db.rpc('finalize_paypal_payment', {
        p_order_id: order.id,
        p_provider_order_id: paypalOrderId,
        p_provider_payment_id: order.provider_payment_id || paypalOrderId,
      });
      if (result.error) throw result.error;
      return json({
        ok: true,
        status: 'paid',
        order_id: order.id,
        paypal_order_id: paypalOrderId,
        capture_id: order.provider_payment_id || null,
        already_captured: true,
      });
    }

    const accessToken = await paypalToken();
    let paypalOrder = await capturePaypalOrder(accessToken, paypalOrderId, internalOrderId);
    if (paypalOrder.status === 'APPROVED') {
      paypalOrder = await capturePaypalOrder(accessToken, paypalOrderId, internalOrderId);
    }

    if (!orderReferenceMatches(order, paypalOrder)) {
      return json({ error: 'PayPal did not return the FINISH order reference' }, 409);
    }

    const capture = firstCapture(paypalOrder);
    const captureStatus = String(capture?.status || paypalOrder.status || '').toUpperCase();
    if (captureStatus === 'PENDING') {
      await db
        .from('payment_orders')
        .update({
          status: 'pending',
          provider_payment_id: capture?.id || order.provider_payment_id,
          metadata: {
            ...order.metadata,
            paypal_capture_status: 'PENDING',
            paypal_last_response: paypalOrder,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      return json({
        ok: true,
        status: 'pending',
        order_id: order.id,
        paypal_order_id: paypalOrderId,
      });
    }

    if (String(paypalOrder.status).toUpperCase() !== 'COMPLETED' || !capture) {
      return json({ error: 'PayPal payment is not completed' }, 409);
    }
    if (String(capture.status).toUpperCase() !== 'COMPLETED') {
      return json({ error: 'PayPal capture is not completed' }, 409);
    }
    if (!amountMatches(order, capture)) {
      return json({ error: 'PayPal amount or currency mismatch' }, 409);
    }

    const finalized = await db.rpc('finalize_paypal_payment', {
      p_order_id: order.id,
      p_provider_order_id: paypalOrderId,
      p_provider_payment_id: String(capture.id),
    });
    if (finalized.error) throw finalized.error;

    await db
      .from('payment_orders')
      .update({
        metadata: {
          ...order.metadata,
          paypal_capture_status: 'COMPLETED',
          paypal_capture_time: capture.create_time || new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    return json({
      ok: true,
      status: 'paid',
      order_id: order.id,
      paypal_order_id: paypalOrderId,
      capture_id: String(capture.id),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Payment capture failed' }, 500);
  }
});
