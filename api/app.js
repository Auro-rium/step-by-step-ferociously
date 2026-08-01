const OWNER = 'Auro-rium';
const REPO = 'step-by-step-ferociously';

const APP_FILES = [
  'js/01-core.js',
  'js/01a-auth-safety.js',
  'js/02-public-auth.js',
  'js/02a-site-polish.js',
  'js/09-theme.js',
  'js/03-home-checkout.js',
  'js/04-learn-player.js',
  'js/05-learn-route-quiz.js',
  'js/06-admin.js',
  'js/00-external-loaders.js',
  'js/08-auth-recovery.js',
  'js/07-router.js',
];

const SUPABASE_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js',
];

async function fetchText(url, label, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FINISH-Self-Contained-Bundler' },
    });
    if (!response.ok) throw new Error(`${label}: source returned ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRepositorySource(path, ref) {
  const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${ref}/${path}`;
  return fetchText(url, path, 8000);
}

async function fetchSupabaseBundle() {
  const failures = [];
  for (const source of SUPABASE_SOURCES) {
    try {
      const bundle = await fetchText(source, new URL(source).hostname, 12000);
      if (!bundle.includes('createClient')) throw new Error('bundle does not contain createClient');
      return bundle;
    } catch (error) {
      failures.push(`${new URL(source).hostname}: ${error?.message || 'failed'}`);
    }
  }
  throw new Error(`Supabase SDK unavailable (${failures.join('; ')})`);
}

function browserFailure(message) {
  const safe = String(message)
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', ' ');

  return `\n;(() => {\n  const root = document.querySelector('#app');\n  if (!root) return;\n  root.innerHTML = '<main class="shell"><section class="page-head"><div class="eyebrow">APP ERROR</div><h1 class="display">The app bundle failed.</h1><p class="lead">${safe}</p><button class="btn" onclick="location.reload()">Reload</button></section></main>';\n})();\n`;
}

export default async function handler(req, res) {
  const ref = String(req.query.ref || 'main');

  if (!/^(main|[a-f0-9]{40})$/.test(ref)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).send(browserFailure('Invalid app build reference.'));
  }

  try {
    const [supabaseBundle, sources] = await Promise.all([
      fetchSupabaseBundle(),
      Promise.all(APP_FILES.map((path) => fetchRepositorySource(path, ref))),
    ]);

    const applicationBundle = sources
      .map((source, index) => `\n/* ${APP_FILES[index]} */\n${source}\n//# sourceURL=${APP_FILES[index]}\n`)
      .join('\n');

    const bundle = `/* Bundled Supabase SDK */\n${supabaseBundle}\n\n/* FINISH application */\n${applicationBundle}`;

    // Compile without running. This catches malformed concatenation before browsers receive it.
    new Function(bundle);

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-FINISH-Bundle-Validated', '1');
    res.setHeader('X-FINISH-Self-Contained', '1');
    res.setHeader('Cache-Control', ref === 'main'
      ? 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
      : 'public, max-age=31536000, s-maxage=31536000, immutable');
    return res.status(200).send(bundle);
  } catch (error) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(browserFailure(error?.message || 'App source unavailable.'));
  }
}
