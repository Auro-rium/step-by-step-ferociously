import { createClient } from '@supabase/supabase-js';

const TERMS_VERSION = '2026-08-03';
const NO_REFUND_VERSION = '2026-08-03';

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

async function verifyPaypalWebhook(req: Request, rawEvent: string) {
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
  const prefix = JSON.stringify({
    ...fields,
    webhook_id: webhookId,
  }).slice(0, -1);
  const verificationBody = `${prefix},"webhook_event":${rawEvent}}`;

  const response = await fetch(`${paypalBase()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: verificationBody,
  });
  const data = await response.json();
  return response.ok && data.verification_status === 'SUCCESS';
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
      'PayPal-Request-Id': `${internalOrderId}-webhook-capture-v2`,
      Prefer: 'return=representation',
    },
    body: '{}',
  });
  const data = await response.json();
  if (response.ok) return data;

  if (response.status === 422) {
    const shown = await showPaypalOrder(accessToken, paypalOrderId);
    if (shown.status === 'COMPLETED') return shown;
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

function amountMatches(order: any, amount: unknown, currency: unknown) {
  if (amount == null || currency == null) return false;
  return String(currency).toUpperCase() === String(order.currency).toUpperCase()
    && Math.round(Number(amount) * 100) === Math.round(Number(order.amount) * 100);
}

function hasCurrentPolicyConsent(order: any) {
  return Boolean(
    order?.terms_accepted_at
    && order?.no_refund_accepted_at
    && order?.terms_version === TERMS_VERSION
    && order?.no_refund_version === NO_REFUND_VERSION
  );
}

async function markEvent(
  db: any,
  eventId: string,
  status: 'processed' | 'ignored' | 'failed',
  error?: string,
) {
  await db
    .from('payment_webhook_events')
    .update({
      processing_status: status,
      processed_at: status === 'failed' ? null : new Date().toISOString(),
      last_error: error || null,
    })
    .eq('provider', 'paypal')
    .eq('event_id', eventId);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!req.headers.get('paypal-transmission-id')) {
    return json({ error: 'PayPal webhook headers are required' }, 400);
  }

  const raw = await req.text();
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let eventId = req.headers.get('paypal-transmission-id') || '';
  try {
    if (!(await verifyPaypalWebhook(req, raw))) {
      return json({ error: 'Invalid PayPal signature' }, 400);
    }

    const event = JSON.parse(raw);
    eventId = String(event.id || eventId);
    const eventType = String(event.event_type || '');
    const eventRecord = {
      provider: 'paypal',
      event_id: eventId,
      event_type: eventType,
      payload: event,
      processing_status: 'received',
      processed_at: null,
      last_error: null,
    };

    const inserted = await db
      .from('payment_webhook_events')
      .insert(eventRecord);
    if (inserted.error?.code === '23505') {
      const existing = await db
        .from('payment_webhook_events')
        .select('processing_status')
        .eq('provider', 'paypal')
        .eq('event_id', eventId)
        .single();
      if (existing.data?.processing_status === 'processed' || existing.data?.processing_status === 'ignored') {
        return json({ ok: true, duplicate: true });
      }
      await db
        .from('payment_webhook_events')
        .update({
          processing_status: 'received',
          last_error: null,
          payload: event,
          event_type: eventType,
        })
        .eq('provider', 'paypal')
        .eq('event_id', eventId);
    } else if (inserted.error) {
      throw new Error('Could not persist PayPal webhook');
    }

    const resource = event.resource || {};
    const related = resource.supplementary_data?.related_ids || {};
    const providerOrderId = related.order_id
      || (['CHECKOUT.ORDER.APPROVED', 'CHECKOUT.PAYMENT-APPROVAL.REVERSED'].includes(eventType) ? resource.id : null);
    const captureId = related.capture_id
      || (eventType.startsWith('PAYMENT.CAPTURE.') ? resource.id : null);

    let order: any = null;
    if (providerOrderId) {
      const result = await db
        .from('payment_orders')
        .select('*')
        .eq('provider', 'paypal')
        .eq('provider_order_id', providerOrderId)
        .maybeSingle();
      order = result.data;
    }
    if (!order && captureId) {
      const result = await db
        .from('payment_orders')
        .select('*')
        .eq('provider', 'paypal')
        .eq('provider_payment_id', captureId)
        .maybeSingle();
      order = result.data;
    }

    if (!order) {
      await markEvent(db, eventId, 'ignored');
      return json({ ok: true, ignored: true });
    }
    if (order.metadata?.payment_mode !== 'orders_v2') {
      await markEvent(db, eventId, 'ignored');
      return json({ ok: true, ignored: true, reason: 'legacy_order' });
    }
    if (!hasCurrentPolicyConsent(order)) {
      throw new Error('Payment order is missing current policy acceptance');
    }

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      if (order.status === 'paid') {
        await markEvent(db, eventId, 'processed');
        return json({ ok: true, duplicate: true });
      }

      const accessToken = await paypalToken();
      const captured = await capturePaypalOrder(accessToken, String(resource.id), order.id);
      const capture = firstCapture(captured);
      if (!capture || String(capture.status).toUpperCase() === 'PENDING') {
        await db
          .from('payment_orders')
          .update({
            status: 'pending',
            provider_payment_id: capture?.id || order.provider_payment_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);
        await markEvent(db, eventId, 'processed');
        return json({ ok: true, pending: true });
      }
      if (
        String(captured.status).toUpperCase() !== 'COMPLETED'
        || String(capture.status).toUpperCase() !== 'COMPLETED'
      ) {
        throw new Error('PayPal capture is not completed');
      }
      if (!amountMatches(order, capture.amount?.value, capture.amount?.currency_code)) {
        throw new Error('PayPal amount mismatch');
      }

      const finalized = await db.rpc('finalize_paypal_payment', {
        p_order_id: order.id,
        p_provider_order_id: String(resource.id),
        p_provider_payment_id: String(capture.id),
      });
      if (finalized.error) throw finalized.error;
    } else if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      if (!providerOrderId) throw new Error('PayPal capture webhook is missing its order ID');
      if (!amountMatches(order, resource.amount?.value, resource.amount?.currency_code)) {
        throw new Error('PayPal amount mismatch');
      }

      const finalized = await db.rpc('finalize_paypal_payment', {
        p_order_id: order.id,
        p_provider_order_id: String(providerOrderId),
        p_provider_payment_id: String(resource.id),
      });
      if (finalized.error) throw finalized.error;
    } else if (eventType === 'PAYMENT.CAPTURE.PENDING') {
      await db
        .from('payment_orders')
        .update({
          status: 'pending',
          provider_payment_id: String(resource.id || order.provider_payment_id || ''),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    } else if (['PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.DECLINED', 'CHECKOUT.PAYMENT-APPROVAL.REVERSED'].includes(eventType)) {
      const revoked = await db.rpc('revoke_paypal_payment', {
        p_order_id: order.id,
        p_status: 'failed',
      });
      if (revoked.error) throw revoked.error;
    } else if (['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED'].includes(eventType)) {
      const revoked = await db.rpc('revoke_paypal_payment', {
        p_order_id: order.id,
        p_status: 'refunded',
      });
      if (revoked.error) throw revoked.error;
    } else {
      await markEvent(db, eventId, 'ignored');
      return json({ ok: true, ignored: true });
    }

    await markEvent(db, eventId, 'processed');
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    if (eventId) await markEvent(db, eventId, 'failed', message);
    return json({ error: message }, 500);
  }
});
