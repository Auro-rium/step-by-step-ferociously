import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

function requireText(file, markers) {
  const source = read(file);
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${file}: missing ${marker}`);
  }
  return source;
}

function forbidText(file, markers) {
  const source = read(file);
  for (const marker of markers) {
    if (source.includes(marker)) failures.push(`${file}: forbidden legacy marker ${marker}`);
  }
  return source;
}

requireText('src/main.tsx', [
  'FINISH PayPal-only checkout',
  "provider: 'paypal'",
  "currency: 'USD'",
  'This course route is still being structured and cannot be purchased yet.',
  'PayPal processes the payment under its own terms',
  'function syncDocumentMetadata(',
  "robots.content = options.noIndex ? 'noindex,nofollow'",
  "title: 'Course Catalog | FINISH'",
  "title: 'Sign in | FINISH'",
  'title: `${course.title} | FINISH`',
]);
forbidText('src/main.tsx', [
  'IndianRupee',
  'INR PRICE',
  'defaultValue="159"',
  "p_inr: Number(form.get('inr'))",
  "theme: { color: '#7c5cff' }",
]);

requireText('src/pages/Learn.tsx', ["robots.content = 'noindex,nofollow'", 'Learning | FINISH']);

requireText('src/pages/Admin.tsx', [
  'GLOBAL PAYPAL PRICE (USD)',
  'defaultValue="1"',
  'p_inr: 0',
  'LATEST PAYPAL ACTIVITY',
]);
forbidText('src/pages/Admin.tsx', ['INR PRICE', 'defaultValue="159"', "p_inr: Number(form.get('inr'))"]);

requireText('src/routes/catalog.ts', [
  'Finance & Investing',
  "item.provider === 'paypal' && item.currency === 'USD'",
  "currency: 'USD'",
]);
forbidText('src/routes/catalog.ts', ['Finance & Markets', "price.currency === 'INR'", "currency === 'INR'"]);

requireText('src/course-product.tsx', [
  'Project submitted for review.',
  'PROJECT OR REPOSITORY URL',
  'PROJECT REFLECTION',
  'Project submission',
  'Open project',
]);
forbidText('src/course-product.tsx', [
  'ENGINEERING REFLECTION',
  '>REPOSITORY URL<',
  'Open repository',
  'another payment row',
]);

requireText('public/terms.html', ['Project, repository, document, and live-build links']);
requireText('public/launch-discount.js', ['$1 USD worldwide · one-time', '$2 USD']);
forbidText('public/launch-discount.js', ['₹79', '₹159', 'INR', 'India ·']);

requireText('public/company-shell.js', [
  'courses: 84, lessons: 2216, quizzes: 168, questions: 3360, projects: 84',
  'Focused routes across finance, programming, systems, algorithms, mathematics, security and AI.',
  'href="/payments"',
  'href="/cookies"',
  'href="/acceptable-use"',
  'href="/content-copyright"',
]);

for (const policy of [
  'public/privacy.html',
  'public/terms.html',
  'public/refund-policy.html',
  'public/payments.html',
  'public/cookies.html',
  'public/acceptable-use.html',
  'public/content-copyright.html',
]) {
  if (!fs.existsSync(path.join(root, policy))) failures.push(`${policy}: missing policy page`);
}

for (const temporary of ['api/internal-playlist.ts', 'api/internal-ocw.ts']) {
  if (fs.existsSync(path.join(root, temporary))) failures.push(`${temporary}: temporary ingestion endpoint still exists`);
}

if (failures.length) {
  console.error('FINISH launch verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('FINISH launch verification passed: PayPal-only, global USD, policies, indexing, split routes, and cross-discipline project submissions are coherent.');
