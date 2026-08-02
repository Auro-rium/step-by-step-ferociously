import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function razorpayRequest(path: string, keyId: string, keySecret: string, init?: RequestInit) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.description || data?.description || "Razorpay API request failed");
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

    const body = await req.json();
    const providerOrderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    const internalOrderId = String(body.internal_order_id || "");
    if (!providerOrderId || !paymentId || !signature || !internalOrderId) {
      return json({ error: "Missing payment fields" }, 400);
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) return json({ status: "setup_required", missing: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] }, 503);

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(keySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = hex(await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${providerOrderId}|${paymentId}`),
    ));
    if (!safeEqual(digest, signature)) return json({ error: "Invalid payment signature" }, 400);

    const { data: order, error: orderError } = await db
      .from("payment_orders")
      .select("id,user_id,challenge_id,provider_order_id,provider_payment_id,amount,currency,status")
      .eq("id", internalOrderId)
      .eq("user_id", userData.user.id)
      .eq("provider", "razorpay")
      .single();
    if (orderError || !order || order.provider_order_id !== providerOrderId) {
      return json({ error: "Payment order mismatch" }, 400);
    }
    if (order.status === "paid") return json({ ok: true, access_status: "paid", duplicate: true });
    if (["refunded", "cancelled"].includes(order.status)) return json({ error: `Order is ${order.status}` }, 409);

    let payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, keyId, keySecret);
    const expectedAmount = Math.round(Number(order.amount) * 100);
    if (payment.order_id !== providerOrderId) return json({ error: "Razorpay order mismatch" }, 400);
    if (Number(payment.amount) !== expectedAmount) return json({ error: "Razorpay amount mismatch" }, 400);
    if (String(payment.currency).toUpperCase() !== String(order.currency).toUpperCase()) return json({ error: "Razorpay currency mismatch" }, 400);

    if (payment.status === "authorized" && payment.captured !== true) {
      payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, keyId, keySecret, {
        method: "POST",
        body: JSON.stringify({ amount: expectedAmount, currency: String(order.currency).toUpperCase() }),
      });
    }

    if (payment.status !== "captured" || payment.captured !== true) {
      await db.from("payment_orders").update({ status: "pending", provider_payment_id: paymentId, updated_at: new Date().toISOString() }).eq("id", order.id);
      return json({ error: "Payment is not captured yet", status: payment.status }, 409);
    }

    await db.from("payment_orders").update({
      status: "paid",
      provider_payment_id: paymentId,
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    await db.from("enrollments").upsert({
      user_id: order.user_id,
      challenge_id: order.challenge_id,
      access_status: "paid",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,challenge_id" });

    return json({ ok: true, access_status: "paid" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Verification failed" }, 500);
  }
});