const OWNER = 'Auro-rium';
const REPO = 'step-by-step-ferociously';

const ALLOWED_FILES = new Set([
  'styles.css',
  'theme.css',
  'js/01-core.js',
  'js/02-public-auth.js',
  'js/02a-site-polish.js',
  'js/03-home-checkout.js',
  'js/04-learn-player.js',
  'js/05-learn-route-quiz.js',
  'js/06-admin.js',
  'js/07-router.js',
  'js/08-auth-recovery.js',
  'js/09-theme.js',
]);

function contentType(path) {
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

export default async function handler(req, res) {
  const path = String(req.query.path || '');
  const ref = String(req.query.ref || 'main');

  if (!ALLOWED_FILES.has(path) || !/^(main|[a-f0-9]{40})$/.test(ref)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).send('Not found');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const sourceUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${ref}/${path}`;
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FINISH-Vercel-Asset-Proxy' },
    });

    if (!response.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).send(`Asset source returned ${response.status}`);
    }

    const body = await response.text();
    res.setHeader('Content-Type', contentType(path));
    res.setHeader('Cache-Control', ref === 'main'
      ? 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
      : 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(body);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(504).send(error?.name === 'AbortError' ? 'Asset source timed out' : 'Asset source failed');
  } finally {
    clearTimeout(timeout);
  }
}
