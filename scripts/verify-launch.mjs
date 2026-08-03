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
  "const TERMS_VERSION = '2026-08-03'",
  "const NO_REFUND_VERSION = '2026-08-03'",
  'checkout-policy-agreement',
  'terms_accepted: true',
  'no_refund_accepted: true',
  'Agree above to continue',
  '!paypalReady || !acceptedPolicies || busy',
  'Payment approval alone does not unlock the course.',
  'Checking the box records your acceptance on the FINISH payment order.',
  'This course route is still being structured and cannot be purchased yet.',
  'function syncDocumentMetadata(',
  "robots.content = options.noIndex ? 'noindex,nofollow'",
  "title: 'Course Catalog | FINISH'",
  "title: 'Sign in | FINISH'",
  'title: `${course.title} | FINISH`',
  '<span>{percent}% of lessons</span>',
  "import './catalog.css';",
  "import './checkout.css';",
]);
forbidText('src/main.tsx', [
  'IndianRupee',
  'INR PRICE',
  'defaultValue="159"',
  "p_inr: Number(form.get('inr'))",
  "theme: { color: '#7c5cff' }",
  '<span>{percent}% complete</span>',
  'disabled={!paypalReady || busy}',
]);

requireText('src/catalog.css', [
  '.category-rail-shell',
  '.category-scroll-button',
  'scroll-snap-type:x proximity',
  '.catalog-search-shell:focus-within',
]);
requireText('src/checkout.css', [
  '.checkout-policy-agreement',
  ':has(input:checked)',
]);

requireText('src/pages/Learn.tsx', ["robots.content = 'noindex,nofollow'", 'Learning | FINISH']);
requireText('src/routes/landing.ts', ['<span>route progress</span>']);
forbidText('src/routes/landing.ts', ['<span>course complete</span>']);

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
  'catalog-search-shell',
  'category-rail-shell',
  'data-category-scroll',
  'Scroll categories left',
  'Scroll categories right',
  'centerActiveCategory',
]);
forbidText('src/routes/catalog.ts', ['Finance & Markets', "price.currency === 'INR'", "currency === 'INR'"]);

requireText('supabase/functions/payment-checkout/index.ts', [
  'terms_accepted_at',
  'no_refund_accepted_at',
  'terms_version',
  'no_refund_version',
  'The purchase policies changed. Reload checkout and review them again.',
  "in('access_status', ['paid', 'granted'])",
]);
requireText('supabase/functions/paypal-capture/index.ts', [
  'hasCurrentPolicyConsent',
  'Payment order is missing required policy acceptance',
  "data.status !== 'COMPLETED'",
  'PayPal amount or currency mismatch',
]);
requireText('supabase/functions/payment-webhook/index.ts', [
  'hasCurrentPolicyConsent',
  'Payment order is missing required policy acceptance',
  'PAYMENT.CAPTURE.COMPLETED',
  'PayPal amount mismatch',
]);

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

console.log('FINISH launch verification passed: catalog navigation, mandatory policy consent, PayPal capture gating, global USD pricing, policies, indexing, and learning routes are coherent.');
