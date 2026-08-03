import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  path.join(root, 'src', 'main.tsx'),
  path.join(root, 'src', 'pages', 'Admin.tsx'),
].filter((file) => fs.existsSync(file));

function patchOrders(source, relativePath) {
  const ordersStart = source.indexOf("      {tab === 'orders' && (");
  if (ordersStart < 0) return source;
  const ordersEnd = source.indexOf('\n    </main>', ordersStart);
  if (ordersEnd < 0) throw new Error(`Admin orders section anchor is missing in ${relativePath}.`);

  const orders = `      {tab === 'orders' && (
        <section className="panel orders-panel">
          <p className="eyebrow">LATEST PAYPAL ACTIVITY</p>
          <h2>{orders.length} recent order{orders.length === 1 ? '' : 's'}.</h2>
          <p className="admin-order-note">PayPal orders are created, captured and verified server-side. Buyers never submit transaction IDs, and administrators never manually unlock paid courses.</p>
          {orders.length ? orders.map((order) => (
            <article key={order.id}>
              <div className="payment-order-copy">
                <strong>{order.challenges?.title || order.metadata?.challenge_title || 'Course'}</strong>
                <span>{order.provider} · {order.currency} {order.amount} · {new Date(order.created_at).toLocaleString()}</span>
                {order.metadata?.email && <span>Buyer: {order.metadata.email}</span>}
                {order.provider_order_id && <code>PayPal order: {order.provider_order_id}</code>}
                {order.provider_payment_id && <code>Capture: {order.provider_payment_id}</code>}
                {order.status === 'pending' && <small>Waiting for PayPal approval or completed capture.</small>}
              </div>
              <b className={'order-status ' + order.status}>{order.status}</b>
            </article>
          )) : <p>No payment attempts yet.</p>}
        </section>
      )}`;

  return source.slice(0, ordersStart) + orders + source.slice(ordersEnd);
}

function patchAdmin(file) {
  let source = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(root, file);

  source = source.replaceAll("p_inr: Number(form.get('inr'))", 'p_inr: 0');

  source = source.replace(
    '<div className="form-columns"><label>USD PRICE<input name="usd" type="number" step="0.01" defaultValue="2" required /></label><label>INR PRICE<input name="inr" type="number" step="1" defaultValue="159" required /></label></div>',
    '<label>GLOBAL PAYPAL PRICE (USD)<input name="usd" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>',
  );

  source = source.replace(
    /<div className="form-columns">\s*<label>USD PRICE<input name="usd" type="number" step="0\.01" defaultValue="2" required \/><\/label>\s*<label>INR PRICE<input name="inr" type="number" step="1" defaultValue="159" required \/><\/label>\s*<\/div>/g,
    '<label>GLOBAL PAYPAL PRICE (USD)<input name="usd" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>',
  );

  source = source.replaceAll('inspect payment activity.', 'inspect automatic PayPal order activity.');
  source = source.replaceAll('inspect PayPal order activity.', 'inspect automatic PayPal order activity.');
  source = source.replaceAll('LATEST PAYMENT ACTIVITY', 'LATEST PAYPAL ACTIVITY');
  source = patchOrders(source, relativePath);

  const required = [
    'p_inr: 0',
    'GLOBAL PAYPAL PRICE (USD)',
    'defaultValue="1"',
    'LATEST PAYPAL ACTIVITY',
    'PayPal orders are created, captured and verified server-side.',
    'PayPal order:',
    'Capture:',
  ];
  for (const marker of required) {
    if (!source.includes(marker)) throw new Error(`PayPal Orders v2 admin patch failed for ${relativePath}: ${marker}`);
  }

  const forbidden = [
    'INR PRICE',
    'defaultValue="159"',
    "p_inr: Number(form.get('inr'))",
    'admin_confirm_paypal_link_payment',
    'admin_reject_paypal_link_payment',
    'Verify & unlock',
    'PAYPAL TRANSACTION ID',
  ];
  for (const marker of forbidden) {
    if (source.includes(marker)) throw new Error(`Legacy payment admin remains in ${relativePath}: ${marker}`);
  }

  fs.writeFileSync(file, source);
}

for (const file of targets) patchAdmin(file);
console.log(`FINISH automatic PayPal Orders v2 admin applied to ${targets.length} source file(s).`);
