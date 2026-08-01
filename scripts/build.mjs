import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

async function required(path) {
  await access(join(root, path));
  return readFile(join(root, path), 'utf8');
}

const supabasePath = 'node_modules/@supabase/supabase-js/dist/umd/supabase.js';
const [supabaseBundle, appSources, sourceIndex, styles, theme] = await Promise.all([
  required(supabasePath),
  Promise.all(APP_FILES.map(required)),
  required('index.html'),
  required('styles.css'),
  required('theme.css'),
]);

if (!supabaseBundle.includes('createClient')) {
  throw new Error('Installed Supabase browser bundle is invalid.');
}

const applicationBundle = appSources
  .map((source, index) => `\n/* ${APP_FILES[index]} */\n${source}\n//# sourceURL=${APP_FILES[index]}\n`)
  .join('\n');

const browserBundle = `/* Bundled at deploy time. No runtime CDN or GitHub fetches. */\n${supabaseBundle}\n\n/* FINISH application */\n${applicationBundle}`;

// Compile without executing browser globals. A malformed bundle must fail the deployment.
new Function(browserBundle);

const appName = `app.${fingerprint(browserBundle)}.js`;
const stylesName = `styles.${fingerprint(styles)}.css`;
const themeName = `theme.${fingerprint(theme)}.css`;

const builtIndex = sourceIndex
  .replace('/styles.css', `/assets/${stylesName}`)
  .replace('/theme.css', `/assets/${themeName}`)
  .replace('/app.js', `/assets/${appName}`);

if (!builtIndex.includes(`/assets/${appName}`)) {
  throw new Error('index.html does not contain the /app.js build placeholder.');
}

if (checkOnly) {
  console.log(`FINISH build check passed: ${APP_FILES.length} application files, ${appName}`);
  process.exit(0);
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'assets'), { recursive: true });

await Promise.all([
  writeFile(join(dist, 'index.html'), builtIndex),
  writeFile(join(dist, 'assets', appName), browserBundle),
  writeFile(join(dist, 'assets', stylesName), styles),
  writeFile(join(dist, 'assets', themeName), theme),
  writeFile(join(dist, 'build.json'), JSON.stringify({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    builtAt: new Date().toISOString(),
    assets: { app: appName, styles: stylesName, theme: themeName },
  }, null, 2)),
]);

console.log(`FINISH built successfully: ${appName}`);
