export default async function handler(req, res) {
  if (req.query.token !== 'finish-smoke-9d3a71b4') {
    return res.status(404).json({ error: 'Not found' });
  }

  const email = `finish-smoke-${Date.now()}@example.com`;
  const response = await fetch('https://ijkdhrznxukawugeoocs.supabase.co/functions/v1/signup-no-confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: 'sb_publishable_kwSezylj6T63a7nIMtuxcg_0bQWm6-8',
    },
    body: JSON.stringify({
      email,
      password: 'SmokeTest123!',
      display_name: 'Signup Smoke Test',
    }),
  });

  const body = await response.json().catch(() => ({}));
  return res.status(response.status).json({ email, status: response.status, body });
}
