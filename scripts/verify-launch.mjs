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

requireText('package.json', [
  'node scripts/patch-paypal-only.mjs',
  'node scripts/patch-paypal-admin.mjs',
]);
forbidText('package.json', ['run-paypal-business-link-patch.mjs']);

requireText('index.html', ['<script type="module" src="/src/bootstrap.ts"></script>']);
forbidText('index.html', ['/legal-consent.js', '/legal-consent.css']);
forbidText('vercel.json', ['legal-consent', 'youtube-player-helpers']);

requireText('src/main.tsx', [
  'FINISH PayPal Orders v2 checkout',
  "const TERMS_VERSION = '2026-08-03'",
  "const NO_REFUND_VERSION = '2026-08-03'",
  'checkout-policy-agreement',
  'terms_accepted: true',
  'no_refund_accepted: true',
  'Agree above to continue',
  'Continue with PayPal',
  "supabase.functions.invoke('paypal-capture'",
  "searchParams.get('token')",
  "searchParams.get('finish_order')",
  "readiness.data?.paymentMode !== 'orders_v2'",
  'Payment captured. Opening your course.',
  'No transaction ID, screenshot, or admin unlock is required.',
  'FINISH captures and verifies the exact USD amount',
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
  'PAYPAL_BUSINESS_LINK',
  "supabase.rpc('submit_paypal_link_claim'",
  'PAYPAL TRANSACTION ID',
  'Submit payment for verification',
  "payment_mode === 'hosted_link'",
  "metadata?.payment_mode === 'hosted_link'",
  'manual_review',
  'IndianRupee',
  'INR PRICE',
  'defaultValue="159"',
  "p_inr: Number(form.get('inr'))",
  "theme: { color: '#7c5cff' }",
  '<span>{percent}% complete</span>',
  'PayPal setup pending',
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
  '/* FINISH PayPal Orders v2 */',
  '.admin-order-note',
  '.payment-order-copy',
]);
forbidText('src/checkout.css', [
  '/* FINISH PayPal Business Link */',
  '.paypal-claim-card',
  '.payment-review-order',
]);

requireText('src/pages/Learn.tsx', ["robots.content = 'noindex,nofollow'", 'Learning | FINISH']);
requireText('src/routes/landing.ts', ['<span>route progress</span>']);
forbidText('src/routes/landing.ts', ['<span>course complete</span>']);

requireText('src/pages/Admin.tsx', [
  'GLOBAL PAYPAL PRICE (USD)',
  'defaultValue="1"',
  'p_inr: 0',
  'LATEST PAYPAL ACTIVITY',
  'PayPal orders are created, captured and verified server-side.',
  'PayPal order:',
  'Capture:',
]);
forbidText('src/pages/Admin.tsx', [
  'INR PRICE',
  'defaultValue="159"',
  "p_inr: Number(form.get('inr'))",
  'admin_confirm_paypal_link_payment',
  'admin_reject_paypal_link_payment',
  'Verify & unlock',
  'PAYPAL TRANSACTION ID',
]);

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
  "payment_mode: 'orders_v2'",
  '/v2/checkout/orders',
  'experience_context',
  "intent: 'CAPTURE'",
  'custom_id: order.id',
  'provider_order_id',
  'PayPal-Request-Id',
  'terms_accepted_at',
  'no_refund_accepted_at',
  'The purchase policies changed. Reload checkout and review them again.',
  "in('access_status', ['paid', 'granted'])",
]);
forbidText('supabase/functions/payment-checkout/index.ts', [
  'PAYPAL_PAYMENT_LINK',
  "payment_mode: 'hosted_link'",
  'payment_link_id',
]);

requireText('supabase/functions/paypal-capture/index.ts', [
  '/v2/checkout/orders/',
  '/capture',
  "db.rpc('finalize_paypal_payment'",
  'orderReferenceMatches',
  'PayPal amount or currency mismatch',
  "order.metadata?.payment_mode !== 'orders_v2'",
  'Authentication required',
]);

requireText('supabase/functions/payment-readiness/index.ts', [
  "paymentMode: 'orders_v2'",
  "unlockMode: 'automatic_capture'",
  'paypalApiCheckout',
  'paypalWebhook',
  'paypalLive',
  'paypalApiAuthenticated',
  'paypalWebhookVerified',
  'webhookUrlMatches',
]);

requireText('supabase/functions/payment-webhook/index.ts', [
  'verificationBody',
  'rawEvent',
  "db.rpc('finalize_paypal_payment'",
  "db.rpc('revoke_paypal_payment'",
  'processing_status',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.PENDING',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
  'PayPal amount mismatch',
]);
forbidText('supabase/functions/payment-webhook/index.ts', [
  'JSON.stringify({ ...fields, webhook_id: webhookId, webhook_event: event })',
]);

requireText('supabase/migrations/20260803100000_paypal_orders_v2.sql', [
  'payment_orders_provider_order_unique',
  'finalize_paypal_payment',
  'revoke_paypal_payment',
  'processing_status',
  'grant execute on function public.finalize_paypal_payment',
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

requireText('public/payments.html', [
  'FINISH requests a corresponding PayPal order.',
  'FINISH verifies the capture server-side before granting access.',
  'Server-side verification',
  'transaction ID sent by a user is not enough by itself',
]);
forbidText('public/payments.html', [
  'official PayPal Business Payment Link',
  'submit the PayPal transaction ID',
  'treated as a claim until verified',
]);

requireText('public/terms.html', ['Project, repository, document, and live-build links']);
requireText('public/launch-discount.js', ['$1 USD worldwide · one-time', '$2 USD']);
forbidText('public/launch-discount.js', ['₹79', '₹159', 'INR', 'India ·']);

requireText('public/company-shell.js', [
  'courses: 104, lessons: 2724, quizzes: 208, questions: 4160, projects: 104',
  'Focused routes across AI, programming, systems, algorithms, mathematics, security and finance.',
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

for (const deadArtifact of [
  'public/legal-consent.js',
  'public/legal-consent.css',
  'scripts/run-paypal-business-link-patch.mjs',
  'scripts/patch-paypal-business-link.mjs',
  'scripts/split-routes.mjs',
]) {
  if (fs.existsSync(path.join(root, deadArtifact))) failures.push(`${deadArtifact}: purged production-dead artifact returned`);
}

if (failures.length) {
  console.error('FINISH launch verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('FINISH launch verification passed: production routes, automatic PayPal fulfillment, policy enforcement and dead-code boundaries are coherent.');
