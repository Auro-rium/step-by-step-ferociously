import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const checkOnly = process.argv.includes('--check');

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

const HTML_FILES = ['index.html', 'catalog.html', 'auth.html'];

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

async function required(path) {
  await access(join(root, path));
  return readFile(join(root, path), 'utf8');
}

const [appSources, htmlSources, styles, theme] = await Promise.all([
  Promise.all(APP_FILES.map(required)),
  Promise.all(HTML_FILES.map(required)),
  required('styles.css'),
  required('theme.css'),
]);

const applicationSource = appSources
  .map((source, index) => `\n/* ${APP_FILES[index]} */\n${source}\n`)
  .join('\n');

const entrySource = `
import { createClient } from '@supabase/supabase-js';
window.__FINISH_BOOT_STAGE__ = 'bundle-start';
window.supabase = { createClient };
${applicationSource}
window.__FINISH_ROUTER_READY__ = true;
window.__FINISH_BOOT_STAGE__ = 'router-ready';
document.documentElement.dataset.finishReady = '1';
`;

const result = await build({
  stdin: {
    contents: entrySource,
    resolveDir: root,
    sourcefile: 'finish-entry.js',
    loader: 'js',
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  target: ['chrome100', 'safari15'],
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'info',
});

const browserBundle = result.outputFiles?.[0]?.text;
if (!browserBundle || !browserBundle.includes('__FINISH_ROUTER_READY__')) {
  throw new Error('The compiled browser bundle is missing its router boot marker.');
}

const appName = `app.${fingerprint(browserBundle)}.js`;
const stylesName = `styles.${fingerprint(styles)}.css`;
const themeName = `theme.${fingerprint(theme)}.css`;

function buildHtml(source, filename) {
  const built = source
    .replace('/styles.css', `/assets/${stylesName}`)
    .replace('/theme.css', `/assets/${themeName}`)
    .replace('/app.js', `/assets/${appName}`);

  if (!built.includes(`/assets/${appName}`)) {
    throw new Error(`${filename} does not contain the /app.js build placeholder.`);
  }
  return built;
}

const builtHtml = htmlSources.map((source, index) => buildHtml(source, HTML_FILES[index]));

if (checkOnly) {
  console.log(`FINISH build check passed: ${APP_FILES.length} app files, ${HTML_FILES.length} route shells, ${appName}`);
  process.exit(0);
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'assets'), { recursive: true });

await Promise.all([
  ...builtHtml.map((content, index) => writeFile(join(dist, HTML_FILES[index]), content)),
  writeFile(join(dist, 'assets', appName), browserBundle),
  writeFile(join(dist, 'assets', stylesName), styles),
  writeFile(join(dist, 'assets', themeName), theme),
  writeFile(join(dist, 'build.json'), JSON.stringify({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    builtAt: new Date().toISOString(),
    assets: { app: appName, styles: stylesName, theme: themeName },
    routeShells: HTML_FILES,
  }, null, 2)),
]);

console.log(`FINISH built successfully with esbuild: ${appName}`);
