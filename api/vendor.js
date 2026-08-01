const VENDORS = {
  supabase: [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js',
  ],
};

async function fetchWithTimeout(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FINISH-Vendor-Proxy' },
    });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  const name = String(req.query.name || '');
  const sources = VENDORS[name];

  if (!sources) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).send('Vendor not found');
  }

  const failures = [];
  for (const source of sources) {
    try {
      const response = await fetchWithTimeout(source);
      if (!response.ok) {
        failures.push(`${new URL(source).hostname}: ${response.status}`);
        continue;
      }

      const body = await response.text();
      if (!body || !body.includes('createClient')) {
        failures.push(`${new URL(source).hostname}: invalid bundle`);
        continue;
      }

      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-FINISH-Vendor-Source', new URL(source).hostname);
      return res.status(200).send(body);
    } catch (error) {
      failures.push(`${new URL(source).hostname}: ${error?.name || 'failed'}`);
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(502).send(`Vendor unavailable: ${failures.join(', ')}`);
}
