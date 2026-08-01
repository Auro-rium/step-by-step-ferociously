import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function safeRedirect(value: unknown, siteUrl: string, fallbackPath: string) {
  const base = new URL(siteUrl);
  try {
    const candidate = new URL(String(value || ""), base);
    return candidate.origin === base.origin ? candidate.toString() : new URL(fallbackPath, base).toString();
  } catch {
    return new URL(fallbackPath, base).toString();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

    const input = await req.json();
    const provider = String(input.provider || "").toLowerCase();
    const challengeSlug = String(input.challenge_slug || "");
    if (!["stripe", "razorpay", "crypto"].includes(provider)) return json({ error: "Unsupported provider" }, 400);

    const { data: challenge, error: challengeError } = await db.from("challenges").select("id,title,slug,status").eq("slug", challengeSlug).eq("status", "published").single();
    if (challengeError || !challenge) return json({ error: "Challenge not found" }, 404);

    const currency = provider === "razorpay" ? "INR" : provider === "stripe" ? "USD" : String(input.currency || "USDT").toUpperCase();
    const { data: price, error: priceError } = await db.from("challenge_prices").select("id,amount,currency,provider").eq("challenge_id", challenge.id).eq("provider", provider).eq("currency", currency).eq("active", true).single();
    if (priceError || !price) return json({ error: "Price is not configured" }, 400);

    if (provider === "crypto") return json({ status: "staged", provider: "crypto", currencies: ["USDT", "USDC"], message: "Crypto checkout is not live until wallet addresses and on-chain verification are configured." }, 409);

    const { data: order, error: orderError } = await db.from("payment_orders").insert({
      user_id: userData.user.id,
      challenge_id: challenge.id,
      price_id: price.id,
      provider,
      currency,
      amount: price.amount,
      status: "created",
      metadata: { email: userData.user.email, challenge_slug: challenge.slug },
    }).select().single();
    if (orderError || !order) return json({ error: "Could not create payment order" }, 500);

    const siteUrl = Deno.env.get("SITE_URL") || "https://finish-landing-nine.vercel.app";
    const successUrl = safeRedirect(input.success_url, siteUrl, `/learn/${challenge.slug}`);
    const cancelUrl = safeRedirect(input.cancel_url, siteUrl, `/checkout/${challenge.slug}`);

    if (provider === "stripe") {
      const secret = Deno.env.get("STRIPE_SECRET_KEY");
      if (!secret) return json({ error: "Stripe is not configured yet", status: "setup_required", missing: ["STRIPE_SECRET_KEY"], order_id: order.id }, 503);

      const form = new URLSearchParams();
      form.set("mode", "payment");
      form.set("success_url", successUrl);
      form.set("cancel_url", cancelUrl);
      form.set("client_reference_id", order.id);
      form.set("customer_email", userData.user.email || "");
      form.set("line_items[0][price_data][currency]", "usd");
      form.set("line_items[0][price_data][unit_amount]", String(Math.round(Number(price.amount) * 100)));
      form.set("line_items[0][price_data][product_data][name]", challenge.title);
      form.set("line_items[0][quantity]", "1");
      form.set("metadata[order_id]", order.id);
      form.set("metadata[user_id]", userData.user.id);
      form.set("metadata[challenge_id]", challenge.id);

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
      const stripe = await stripeRes.json();
      if (!stripeRes.ok) {
        await db.from("payment_orders").update({ status: "failed", metadata: { stripe_error: stripe } }).eq("id", order.id);
        return json({ error: stripe?.error?.message || "Stripe checkout failed" }, 502);
      }
      await db.from("payment_orders").update({ status: "pending", provider_order_id: stripe.id, checkout_url: stripe.url }).eq("id", order.id);
      return json({ kind: "redirect", provider, checkout_url: stripe.url, order_id: order.id });
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) return json({ error: "Razorpay is not configured yet", status: "setup_required", missing: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"], order_id: order.id }, 503);

    const credentials = btoa(`${keyId}:${keySecret}`);
    const rzRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(Number(price.amount) * 100), currency: "INR", receipt: order.id.replaceAll("-", "").slice(0, 40), notes: { internal_order_id: order.id, user_id: userData.user.id, challenge_id: challenge.id } }),
    });
    const razorpay = await rzRes.json();
    if (!rzRes.ok) {
      await db.from("payment_orders").update({ status: "failed", metadata: { razorpay_error: razorpay } }).eq("id", order.id);
      return json({ error: razorpay?.error?.description || "Razorpay order failed" }, 502);
    }

    await db.from("payment_orders").update({ status: "pending", provider_order_id: razorpay.id }).eq("id", order.id);
    return json({ kind: "razorpay", provider, key_id: keyId, provider_order_id: razorpay.id, order_id: order.id, amount: razorpay.amount, currency: razorpay.currency, name: "FINISH", description: challenge.title, prefill: { email: userData.user.email || "" } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected checkout error" }, 500);
  }
});
