import { createClient } from '@supabase/supabase-js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const paypalBase = () => Deno.env.get('PAYPAL_ENV') === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function paypalToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('PayPal credentials are missing');

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

async function verifyPaypalWebhook(req: Request, event: unknown) {
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
  if (!webhookId) throw new Error('PayPal webhook ID is missing');
  const fields = {
    auth_algo: req.headers.get('paypal-auth-algo'),
    cert_url: req.headers.get('paypal-cert-url'),
    transmission_id: req.headers.get('paypal-transmission-id'),
    transmission_sig: req.headers.get('paypal-transmission-sig'),
    transmission_time: req.headers.get('paypal-transmission-time'),
  };
  if (Object.values(fields).some((value) => !value)) return false;

  const accessToken = await paypalToken();
  const response = await fetch(`${paypalBase()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, webhook_id: webhookId, webhook_event: event }),
  });
  const data = await response.json();
  return response.ok && data.verification_status === 'SUCCESS';
}

function amountMatches(order: any, amount: unknown, currency: unknown) {
  if (amount == null || currency == null) return false;
  return String(currency).toUpperCase() === String(order.currency).toUpperCase()
    && Math.round(Number(amount) * 100) === Math.round(Number(order.amount) * 100);
}

async function grantAccess(db: any, order: any, paymentId: string | null) {
  await db.from('payment_orders').update({
    status: 'paid',
    provider_payment_id: paymentId || order.provider_payment_id,
    updated_at: new Date().toISOString(),
  }).eq('id', order.id);
  await db.from('enrollments').upsert({
    user_id: order.user_id,
    challenge_id: order.challenge_id,
    access_status: 'paid',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,challenge_id' });
}

async function revokeAccess(db: any, order: any) {
  await db.from('payment_orders').update({
    status: 'refunded',
    updated_at: new Date().toISOString(),
  }).eq('id', order.id);
  await db.from('enrollments').upsert({
    user_id: order.user_id,
    challenge_id: order.challenge_id,
    access_status: 'refunded',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,challenge_id' });
}

async function capturePaypalOrder(providerOrderId: string, internalOrderId: string) {
  const accessToken = await paypalToken();
  const response = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `${internalOrderId}-webhook-capture`,
    },
    body: '{}',
  });

  let data = await response.json();
  if (!response.ok) {
    const shown = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    data = await shown.json();
    if (!shown.ok || data.status !== 'COMPLETED') throw new Error(data.message || 'PayPal capture failed');
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!req.headers.get('paypal-transmission-id')) return json({ error: 'PayPal webhook headers are required' }, 400);

  const raw = await req.text();
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const event = JSON.parse(raw);
    if (!(await verifyPaypalWebhook(req, event))) return json({ error: 'Invalid PayPal signature' }, 400);

    const eventId = String(event.id || req.headers.get('paypal-transmission-id'));
    const eventType = String(event.event_type || '');
    const { error: eventError } = await db.from('payment_webhook_events').insert({
      provider: 'paypal',
      event_id: eventId,
      event_type: eventType,
      payload: event,
    });
    if (eventError?.code === '23505') return json({ ok: true, duplicate: true });
    if (eventError) return json({ error: 'Could not persist webhook' }, 500);

    const resource = event.resource || {};
    const related = resource.supplementary_data?.related_ids || {};
    const providerOrderId = related.order_id
      || (eventType === 'CHECKOUT.ORDER.APPROVED' ? resource.id : null);
    const captureId = related.capture_id
      || (eventType.startsWith('PAYMENT.CAPTURE.') ? resource.id : null);

    let order: any = null;
    if (providerOrderId) {
      const result = await db.from('payment_orders').select('*')
        .eq('provider', 'paypal').eq('provider_order_id', providerOrderId).maybeSingle();
      order = result.data;
    }
    if (!order && captureId) {
      const result = await db.from('payment_orders').select('*')
        .eq('provider', 'paypal').eq('provider_payment_id', captureId).maybeSingle();
      order = result.data;
    }
    if (!order) return json({ ok: true, ignored: true });

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      if (order.status === 'paid') return json({ ok: true, duplicate: true });
      const captured = await capturePaypalOrder(String(resource.id), order.id);
      const capture = captured.purchase_units?.[0]?.payments?.captures?.[0];
      if (captured.status !== 'COMPLETED' || !capture) return json({ ok: true, pending: true });
      if (!amountMatches(order, capture.amount?.value, capture.amount?.currency_code)) {
        return json({ error: 'PayPal amount mismatch' }, 400);
      }
      await grantAccess(db, order, String(capture.id || resource.id));
    } else if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      if (!amountMatches(order, resource.amount?.value, resource.amount?.currency_code)) {
        return json({ error: 'PayPal amount mismatch' }, 400);
      }
      await grantAccess(db, order, String(resource.id || order.provider_payment_id || ''));
    } else if (eventType === 'PAYMENT.CAPTURE.PENDING') {
      await db.from('payment_orders').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', order.id);
    } else if (['PAYMENT.CAPTURE.DENIED', 'CHECKOUT.PAYMENT-APPROVAL.REVERSED'].includes(eventType)) {
      await db.from('payment_orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', order.id);
    } else if (['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED'].includes(eventType)) {
      await revokeAccess(db, order);
    } else {
      return json({ ok: true, ignored: true });
    }

    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Webhook error' }, 500);
  }
});
