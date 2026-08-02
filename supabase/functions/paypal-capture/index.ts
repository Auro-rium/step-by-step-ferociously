import { createClient } from '@supabase/supabase-js';

const paypalBase = () => Deno.env.get('PAYPAL_ENV') === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function paypalToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('PayPal is not configured');
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

function amountMatches(order: any, capture: any) {
  const value = capture?.amount?.value;
  const currency = capture?.amount?.currency_code;
  if (value == null || currency == null) return false;
  return String(currency).toUpperCase() === String(order.currency).toUpperCase()
    && Math.round(Number(value) * 100) === Math.round(Number(order.amount) * 100);
}

Deno.serve(async (req: Request) => {
  const siteUrl = Deno.env.get('SITE_URL') || 'https://finish-landing-nine.vercel.app';
  const url = new URL(req.url);
  const internalOrderId = url.searchParams.get('internal_order_id') || '';
  const paypalOrderId = url.searchParams.get('token') || '';
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let slug = '';
  try {
    if (!internalOrderId || !paypalOrderId) throw new Error('Payment callback is incomplete');

    const { data: order, error: orderError } = await db
      .from('payment_orders')
      .select('*')
      .eq('id', internalOrderId)
      .eq('provider', 'paypal')
      .single();
    if (orderError || !order || order.provider_order_id !== paypalOrderId) throw new Error('Payment order mismatch');

    slug = String(order.metadata?.challenge_slug || '');
    if (order.status !== 'paid') {
      const accessToken = await paypalToken();
      const response = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `${internalOrderId}-capture`,
        },
        body: '{}',
      });

      let data = await response.json();
      if (!response.ok) {
        const shown = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        data = await shown.json();
        if (!shown.ok || data.status !== 'COMPLETED') throw new Error(data.message || 'PayPal capture failed');
      }

      const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
      if (data.status !== 'COMPLETED' || !capture) throw new Error('PayPal payment is not completed');
      if (!amountMatches(order, capture)) throw new Error('PayPal amount or currency mismatch');

      await db.from('payment_orders').update({
        status: 'paid',
        provider_payment_id: capture.id || paypalOrderId,
        metadata: { ...order.metadata, paypal_capture: data },
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);

      await db.from('enrollments').upsert({
        user_id: order.user_id,
        challenge_id: order.challenge_id,
        access_status: 'paid',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,challenge_id' });
    }

    return Response.redirect(`${siteUrl}/learn/${encodeURIComponent(slug)}?payment=success`, 302);
  } catch (error) {
    const path = slug ? `/checkout/${encodeURIComponent(slug)}` : '/catalog';
    const reason = encodeURIComponent(error instanceof Error ? error.message : 'Payment failed');
    return Response.redirect(`${siteUrl}${path}?payment=failed&reason=${reason}`, 302);
  }
});
