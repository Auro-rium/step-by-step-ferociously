import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function patch(relativePath, transform) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  fs.writeFileSync(file, after);
}

patch('src/main.tsx', (source) => source
  .replaceAll('<a href="/refunds">Refunds</a>', '<a href="/refunds">No Refunds</a>')
  .replaceAll('<a href="/refunds">Refund Policy</a>', '<a href="/refunds">No-Refund Policy</a>')
  .replaceAll('Refund Policy</a>. PayPal processes', 'No-Refund Policy</a>. <strong>All sales are final.</strong> PayPal processes')
);

patch('public/company-shell.js', (source) => source
  .replaceAll('One-time payment. No recurring subscription.', 'One-time payment. All sales final. No recurring subscription.')
  .replaceAll('<span>Secure checkout</span>', '<span>All sales final</span>')
  .replaceAll('<a href="/refunds">Purchase policy</a>', '<a href="/refunds">No-refund policy</a>')
  .replaceAll('<a href="/refunds">Refund & cancellation</a>', '<a href="/refunds">No refunds</a>')
);

const publicDir = path.join(root, 'public');
for (const name of fs.readdirSync(publicDir)) {
  if (!name.endsWith('.html')) continue;
  patch(path.join('public', name), (source) => source
    .replaceAll('<a href="/refunds">Refunds</a>', '<a href="/refunds">No Refunds</a>')
    .replaceAll('<a href="/refunds">Refund Policy</a>', '<a href="/refunds">No-Refund Policy</a>')
    .replaceAll('<a href="/refunds">Refund & cancellation</a>', '<a href="/refunds">No Refunds</a>')
  );
}

const main = fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8');
const refundPolicy = fs.readFileSync(path.join(root, 'public', 'refund-policy.html'), 'utf8');
const terms = fs.readFileSync(path.join(root, 'public', 'terms.html'), 'utf8');
const payments = fs.readFileSync(path.join(root, 'public', 'payments.html'), 'utf8');
const company = fs.readFileSync(path.join(root, 'public', 'company-shell.js'), 'utf8');

const required = [
  [main, 'No-Refund Policy'],
  [main, 'All sales are final.'],
  [refundPolicy, 'All FINISH course purchases are final and non-refundable'],
  [terms, '<strong>All sales are final.</strong>'],
  [payments, 'FINISH does not offer voluntary refunds.'],
  [company, 'All sales final'],
];
for (const [source, marker] of required) {
  if (!source.includes(marker)) throw new Error(`No-refund product patch is missing: ${marker}`);
}

for (const forbidden of ['seven calendar days', 'less than 20%', 'Eligible refund requests', 'clear seven-day review window']) {
  if (refundPolicy.includes(forbidden)) throw new Error(`Legacy refund promise remains: ${forbidden}`);
}

console.log('FINISH no-refund policy enforced across checkout, policies, and public navigation.');
