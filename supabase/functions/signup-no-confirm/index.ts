import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const displayName = String(body.display_name || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Enter a valid email address" }, 400);
    }
    if (password.length < 8 || password.length > 72) {
      return json({ error: "Password must be 8 to 72 characters" }, 400);
    }
    if (!displayName || displayName.length > 80) {
      return json({ error: "Enter a valid name" }, 400);
    }

    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown")
      .split(",")[0]
      .trim();
    const [emailHash, ipHash] = await Promise.all([sha256(email), sha256(ip)]);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ count: emailAttempts }, { count: ipAttempts }] = await Promise.all([
      db.from("signup_rate_limits").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gte("created_at", cutoff),
      db.from("signup_rate_limits").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", cutoff),
    ]);

    if ((emailAttempts || 0) >= 5 || (ipAttempts || 0) >= 12) {
      return json({ error: "Too many signup attempts. Try again later." }, 429);
    }

    await db.from("signup_rate_limits").insert({ email_hash: emailHash, ip_hash: ipHash });

    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (error) {
      const message = error.message.toLowerCase().includes("already")
        ? "An account with this email already exists. Sign in instead."
        : error.message;
      return json({ error: message }, error.status || 400);
    }

    await db.rpc("cleanup_signup_rate_limits");
    return json({ ok: true, user_id: data.user.id }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not create account" }, 500);
  }
});
