import { createClient } from "@supabase/supabase-js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const paypalBase = () => Deno.env.get("PAYPAL_ENV") === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

async function paypalToken() {
  const id = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) throw new Error("PayPal credentials are missing");
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "PayPal authentication failed");
  return String(data.access_token);
}

async function verifyPaypalWebhook(req: Request, event: unknown) {
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
  if (!webhookId) throw new Error("PayPal webhook ID is missing");
  const fields = {
    auth_algo: req.headers.get("paypal-auth-algo"),
    cert_url: req.headers.get("paypal-cert-url"),
    transmission_id: req.headers.get("paypal-transmission-id"),
    transmission_sig: req.headers.get("paypal-transmission-sig"),
    transmission_time: req.headers.get("paypal-transmission-time"),
  };
  if (Object.values(fields).some((value) => !value)) return false;
  const accessToken = await paypalToken();
  const response = await fetch(`${paypalBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, webhook_id: webhookId, webhook_event: event }),
  });
  const data = await response.json();
  return response.ok && data.verification_status === "SUCCESS";
}

function amountMatches(order: any, amount: unknown, currency: unknown, minorUnits = false) {
  if (amount == null || currency == null) return true;
  if (String(currency).toUpperCase() !== String(order.currency).toUpperCase()) return false;
  const expected = Math.round(Number(order.amount) * 100);
  const received = minorUnits ? Math.round(Number(amount)) : Math.round(Number(amount) * 100);
  return Number.isFinite(expected) && Number.isFinite(received) && expected === received;
}

async function grantAccess(db: any, order: any, paymentId: string | null) {
  await db.from("payment_orders").update({
    status: "paid",
    provider_payment_id: paymentId || order.provider_payment_id,
    updated_at: new Date().toISOString(),
  }).eq("id", order.id);
  await db.from("enrollments").upsert({
    user_id: order.user_id,
    challenge_id: order.challenge_id,
    access_status: "paid",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,challenge_id" });
}

async function markRefunded(db: any, order: any) {
  await db.from("payment_orders").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", order.id);
  await db.from("enrollments").upsert({
    user_id: order.user_id,
    challenge_id: order.challenge_id,
    access_status: "refunded",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,challenge_id" });
}

async function capturePaypalOrder(providerOrderId: string, internalOrderId: string) {
  const accessToken = await paypalToken();
  const capture = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `${internalOrderId}-capture`,
    },
    body: "{}",
  });
  let data = await capture.json();
  if (!capture.ok) {
    const shown = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });
    data = await shown.json();
    if (!shown.ok || data.status !== "COMPLETED") throw new Error(data.message || "PayPal capture failed");
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const raw = await req.text();
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const razorpaySignature = req.headers.get("x-razorpay-signature");
    const paypalTransmissionId = req.headers.get("paypal-transmission-id");
    let provider: "razorpay" | "paypal";
    let event: any;
    let eventId: string;
    let eventType: string;

    if (razorpaySignature) {
      provider = "razorpay";
      const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
      if (!secret) return json({ error: "Razorpay webhook secret missing" }, 503);
      const expected = await hmacHex(secret, raw);
      if (!safeEqual(expected, razorpaySignature)) return json({ error: "Invalid Razorpay signature" }, 400);
      event = JSON.parse(raw);
      eventId = req.headers.get("x-razorpay-event-id") || String(event.id || crypto.randomUUID());
      eventType = String(event.event || "");
    } else if (paypalTransmissionId) {
      provider = "paypal";
      event = JSON.parse(raw);
      if (!(await verifyPaypalWebhook(req, event))) return json({ error: "Invalid PayPal signature" }, 400);
      eventId = String(event.id || paypalTransmissionId);
      eventType = String(event.event_type || "");
    } else {
      return json({ error: "Unknown webhook provider" }, 400);
    }

    const { error: eventError } = await db.from("payment_webhook_events").insert({
      provider,
      event_id: eventId,
      event_type: eventType,
      payload: event,
    });
    if (eventError?.code === "23505") return json({ ok: true, duplicate: true });
    if (eventError) return json({ error: "Could not persist webhook" }, 500);

    if (provider === "razorpay") {
      const payment = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      const refund = event.payload?.refund?.entity;
      const providerOrderId = payment?.order_id || orderEntity?.id;
      let order: any = null;

      if (providerOrderId) {
        const result = await db.from("payment_orders").select("*").eq("provider", "razorpay").eq("provider_order_id", providerOrderId).maybeSingle();
        order = result.data;
      } else if (refund?.payment_id) {
        const result = await db.from("payment_orders").select("*").eq("provider", "razorpay").eq("provider_payment_id", refund.payment_id).maybeSingle();
        order = result.data;
      }
      if (!order) return json({ ok: true, ignored: true });

      if (["payment.captured", "order.paid"].includes(eventType)) {
        const amount = payment?.amount ?? orderEntity?.amount_paid;
        const currency = payment?.currency ?? orderEntity?.currency;
        if (!amountMatches(order, amount, currency, true)) return json({ error: "Razorpay amount mismatch" }, 400);
        await grantAccess(db, order, payment?.id || order.provider_payment_id || null);
      } else if (["payment.failed", "order.payment_failed"].includes(eventType)) {
        await db.from("payment_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", order.id);
      } else if (["refund.processed", "payment.refunded"].includes(eventType)) {
        await markRefunded(db, order);
      } else {
        return json({ ok: true, ignored: true });
      }
      return json({ ok: true });
    }

    const resource = event.resource || {};
    const related = resource.supplementary_data?.related_ids || {};
    const providerOrderId = related.order_id || (eventType === "CHECKOUT.ORDER.APPROVED" ? resource.id : null);
    const captureId = related.capture_id || (eventType.startsWith("PAYMENT.CAPTURE.") ? resource.id : null);
    let order: any = null;

    if (providerOrderId) {
      const result = await db.from("payment_orders").select("*").eq("provider", "paypal").eq("provider_order_id", providerOrderId).maybeSingle();
      order = result.data;
    }
    if (!order && captureId) {
      const result = await db.from("payment_orders").select("*").eq("provider", "paypal").eq("provider_payment_id", captureId).maybeSingle();
      order = result.data;
    }
    if (!order) return json({ ok: true, ignored: true });

    if (eventType === "CHECKOUT.ORDER.APPROVED") {
      const captured = await capturePaypalOrder(String(resource.id), order.id);
      const capture = captured.purchase_units?.[0]?.payments?.captures?.[0];
      if (captured.status !== "COMPLETED" || !capture) return json({ ok: true, pending: true });
      if (!amountMatches(order, capture.amount?.value, capture.amount?.currency_code)) return json({ error: "PayPal amount mismatch" }, 400);
      await grantAccess(db, order, String(capture.id || resource.id));
    } else if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      if (!amountMatches(order, resource.amount?.value, resource.amount?.currency_code)) return json({ error: "PayPal amount mismatch" }, 400);
      await grantAccess(db, order, String(resource.id || order.provider_payment_id || ""));
    } else if (eventType === "PAYMENT.CAPTURE.PENDING") {
      await db.from("payment_orders").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", order.id);
    } else if (["PAYMENT.CAPTURE.DENIED", "CHECKOUT.PAYMENT-APPROVAL.REVERSED"].includes(eventType)) {
      await db.from("payment_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", order.id);
    } else if (["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"].includes(eventType)) {
      await markRefunded(db, order);
    } else {
      return json({ ok: true, ignored: true });
    }

    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Webhook error" }, 500);
  }
});