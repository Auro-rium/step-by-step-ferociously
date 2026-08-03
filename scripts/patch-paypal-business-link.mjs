import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAYPAL_LINK = 'https://www.paypal.com/ncp/payment/8W4VPV34FECHC';

function patchMain() {
  const file = path.join(root, 'src', 'main.tsx');
  let source = fs.readFileSync(file, 'utf8');

  source = source.replace(
    /(?:export )?interface PaymentOrder \{[\s\S]*?\n\}/,
    `export interface PaymentOrder {
  id: string;
  user_id?: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  provider_payment_id?: string | null;
  checkout_url?: string | null;
  metadata?: {
    email?: string;
    challenge_slug?: string;
    challenge_title?: string;
    payment_mode?: string;
    claim_status?: string;
    rejection_reason?: string;
  } | null;
  created_at: string;
  challenges?: { title?: string } | null;
}`,
  );

  const start = source.indexOf('// ---- src/pages/Checkout.tsx ----');
  const end = source.indexOf('// ---- src/pages/Learn.tsx ----');
  if (start < 0 || end < 0 || end <= start) throw new Error('Checkout section anchors are missing.');

  const checkout = `// ---- src/pages/Checkout.tsx ----

// FINISH PayPal Business Link checkout. Every payment starts with a signed-in user, selected course and recorded policy consent.
const TERMS_VERSION = '2026-08-03';
const NO_REFUND_VERSION = '2026-08-03';
const PAYPAL_BUSINESS_LINK = '${PAYPAL_LINK}';

function Checkout() {
  const { slug = '' } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Challenge | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const next = await getCourse(slug);
        const enrollment = await getEnrollment(user.id, next.id);
        if (hasPaidAccess(enrollment)) { navigate(\`/learn/\${slug}\`, { replace: true }); return; }
        const readiness = await supabase.functions.invoke('payment-readiness', { body: {} });
        const orders = await supabase
          .from('payment_orders')
          .select('id,status,provider_payment_id,metadata')
          .eq('user_id', user.id)
          .eq('challenge_id', next.id)
          .eq('provider', 'paypal')
          .in('status', ['pending', 'manual_review', 'paid'])
          .order('created_at', { ascending: false })
          .limit(10);
        if (!active) return;
        setCourse(next);
        setPaypalReady(Boolean(readiness.data?.paypalHostedLink || readiness.data?.paypal));
        const hostedOrder = (orders.data || []).find((row) => row.metadata?.payment_mode === 'hosted_link');
        if (hostedOrder) {
          if (hostedOrder.status === 'paid') { navigate(\`/learn/\${slug}\`, { replace: true }); return; }
          setOrderId(hostedOrder.id);
          setOrderStatus(hostedOrder.status);
          setTransactionId(hostedOrder.provider_payment_id || '');
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Checkout could not load.');
      }
    })();
    return () => { active = false; };
  }, [slug, user, navigate]);

  const openPayPal = async () => {
    if (!course || !paypalReady) return;
    if (!acceptedPolicies) {
      setError('You must agree to the Terms of Use and acknowledge the No-Refund Policy before payment.');
      return;
    }
    const paymentTab = window.open('', '_blank');
    if (paymentTab) {
      paymentTab.opener = null;
      paymentTab.document.title = 'Opening PayPal';
      paymentTab.document.body.innerHTML = '<p style="font:16px system-ui;padding:32px">Opening secure PayPal checkout…</p>';
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await supabase.functions.invoke('payment-checkout', {
        body: {
          challenge_slug: course.slug,
          provider: 'paypal',
          terms_accepted: true,
          terms_version: TERMS_VERSION,
          no_refund_accepted: true,
          no_refund_version: NO_REFUND_VERSION,
        },
      });
      if (result.error || result.data?.error) {
        throw new Error(result.error?.message || result.data?.error || 'Checkout could not be created.');
      }
      if (!result.data?.checkout_url || !result.data?.order_id) throw new Error('PayPal Business Link checkout is incomplete.');
      setOrderId(result.data.order_id);
      setOrderStatus(result.data.order_status || 'pending');
      setTransactionId(result.data.transaction_id || '');
      setMessage('PayPal opened in a separate tab. Complete the USD 1.00 payment, then return here with the transaction ID.');
      if (paymentTab) paymentTab.location.replace(result.data.checkout_url);
      else window.location.assign(result.data.checkout_url);
    } catch (reason) {
      paymentTab?.close();
      setError(reason instanceof Error ? reason.message : 'Payment could not start.');
    } finally {
      setBusy(false);
    }
  };

  const submitClaim = async () => {
    if (!orderId || !transactionId.trim()) return;
    setClaimBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await supabase.rpc('submit_paypal_link_claim', {
        p_order_id: orderId,
        p_transaction_id: transactionId.trim(),
      });
      if (result.error) throw result.error;
      setOrderStatus('manual_review');
      setTransactionId(result.data?.transaction_id || transactionId.trim().toUpperCase());
      setMessage('Payment submitted for verification. FINISH unlocks this course only after the PayPal transaction is confirmed.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The PayPal transaction could not be submitted.');
    } finally {
      setClaimBusy(false);
    }
  };

  const refreshStatus = async () => {
    if (!orderId) return;
    setClaimBusy(true);
    setError('');
    try {
      const result = await supabase.from('payment_orders').select('status,provider_payment_id').eq('id', orderId).single();
      if (result.error) throw result.error;
      setOrderStatus(result.data.status);
      setTransactionId(result.data.provider_payment_id || transactionId);
      if (result.data.status === 'paid') navigate(\`/learn/\${slug}\`, { replace: true });
      else setMessage(result.data.status === 'manual_review' ? 'Verification is still pending.' : 'Payment has not been confirmed yet.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Payment status could not be checked.');
    } finally {
      setClaimBusy(false);
    }
  };

  if (error && !course) return <main className="app-page shell"><PageError message={error} /></main>;
  if (!course) return <PageLoader label="Preparing secure checkout" />;

  const usd = course.challenge_prices?.find((price) => price.provider === 'paypal' && price.currency === 'USD' && price.active !== false)?.amount ?? 1;
  const buttonLabel = !paypalReady ? 'PayPal link unavailable' : !acceptedPolicies ? 'Agree above to continue' : 'Open PayPal payment';

  return <main className="app-page shell checkout-page">
    <Link className="back-link" to={\`/course/\${course.slug}\`}><ArrowLeft size={16} />Back to course</Link>
    <header className="checkout-heading">
      <p className="eyebrow">SECURE CHECKOUT</p>
      <h1>Unlock {course.title}.</h1>
      <p>Agree to the purchase terms, pay through the official FINISH PayPal Business Link, and submit the PayPal transaction ID for verification.</p>
    </header>
    {error && <div className="form-message error" role="alert">{error}</div>}
    {message && <div className="form-message success" role="status">{message}</div>}
    <section className="checkout-grid">
      <article className="payment-card recommended">
        <span className="recommended-label">OFFICIAL PAYPAL BUSINESS CHECKOUT</span>
        <div className="payment-icon"><CreditCard /></div>
        <p className="eyebrow">PAYPAL · USD</p>
        <h2>Pay FINISH securely on PayPal</h2>
        <strong>{formatMoney(usd, 'USD')}</strong>
        <p>The payment page is hosted by PayPal. FINISH records the selected course and your policy consent before opening it.</p>
        <ul>{['Permanent course access after verification', 'One-time USD 1.00 payment', 'All lessons, quizzes, progress and final project'].map((item) => <li key={item}><Check />{item}</li>)}</ul>
        <label className="checkout-policy-agreement">
          <input type="checkbox" checked={acceptedPolicies} onChange={(event) => { setAcceptedPolicies(event.target.checked); if (event.target.checked) setError(''); }} />
          <span>I have read and agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a> and <a href="/payments" target="_blank" rel="noreferrer">Payment Policy</a>, and I acknowledge the <a href="/refunds" target="_blank" rel="noreferrer">No-Refund Policy</a>. <strong>All sales are final.</strong></span>
        </label>
        <button className="button button-primary button-large full" disabled={!paypalReady || !acceptedPolicies || busy} onClick={() => void openPayPal()}>
          {busy ? <LoaderCircle className="spin" /> : <WalletCards />} {buttonLabel}
        </button>
        <p className="policy-consent checkout-consent">Official payment link: paypal.com · Checking the box records your acceptance on the FINISH order.</p>
      </article>
    </section>

    {orderId && <section className="paypal-claim-card panel" aria-live="polite">
      <div className="paypal-claim-head">
        <div><p className="eyebrow">PAYMENT VERIFICATION</p><h2>{orderStatus === 'manual_review' ? 'Transaction submitted.' : 'Finished paying on PayPal?'}</h2></div>
        <span className={\`order-status \${orderStatus || 'pending'}\`}>{orderStatus || 'pending'}</span>
      </div>
      {orderStatus === 'manual_review' ? <>
        <p>Transaction <strong>{transactionId}</strong> is waiting for confirmation. A verified webhook can unlock it automatically; otherwise the FINISH admin verifies it in the PayPal Business dashboard.</p>
        <button className="button button-soft" disabled={claimBusy} onClick={() => void refreshStatus()}>{claimBusy ? <LoaderCircle className="spin" /> : <ShieldCheck />}Check verification status</button>
      </> : <>
        <p>Copy the transaction ID from the completed PayPal receipt or PayPal activity page. A receipt screenshot alone does not unlock access.</p>
        <label>PAYPAL TRANSACTION ID<input value={transactionId} onChange={(event) => setTransactionId(event.target.value.toUpperCase())} placeholder="Example: 1AB23456CD789012E" autoCapitalize="characters" autoComplete="off" /></label>
        <div className="paypal-claim-actions">
          <button className="button button-primary" disabled={claimBusy || transactionId.trim().length < 8} onClick={() => void submitClaim()}>{claimBusy ? <LoaderCircle className="spin" /> : <CheckCircle2 />}Submit payment for verification</button>
          <a className="button button-soft" href={PAYPAL_BUSINESS_LINK} target="_blank" rel="noreferrer"><ArrowUpRight />Open PayPal again</a>
        </div>
      </>}
    </section>}

    <div className="secure-note"><ShieldCheck /><span>Opening or completing the reusable PayPal link does not by itself unlock a course. Access is granted only after FINISH verifies the claimed transaction against this signed-in user, course and USD 1.00 order.</span></div>
  </main>;
}

`;

  source = source.slice(0, start) + checkout + source.slice(end);
  for (const marker of [
    'PAYPAL_BUSINESS_LINK',
    '${PAYPAL_LINK}',
    "supabase.rpc('submit_paypal_link_claim'",
    'Submit payment for verification',
    'Open PayPal payment',
    "metadata?.payment_mode === 'hosted_link'",
  ]) {
    if (!source.includes(marker)) throw new Error(`PayPal Business Link checkout patch failed: ${marker}`);
  }
  fs.writeFileSync(file, source);
}

function patchAdmin() {
  const file = path.join(root, 'src', 'pages', 'Admin.tsx');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(
    "import { BookPlus, ClipboardList, LoaderCircle, Plus, ReceiptText, Trash2 } from 'lucide-react';",
    "import { BookPlus, CheckCircle2, ClipboardList, LoaderCircle, Plus, ReceiptText, Trash2, XCircle } from 'lucide-react';",
  );
  source = source.replace(
    "  const [busy, setBusy] = useState(false);",
    "  const [busy, setBusy] = useState(false);\n  const [orderBusy, setOrderBusy] = useState('');",
  );

  const insertion = `
  const confirmPayment = async (order: PaymentOrder) => {
    if (!order.provider_payment_id) return setError('This order has no PayPal transaction ID.');
    if (!window.confirm(\`Verify transaction \${order.provider_payment_id} in the PayPal Business dashboard, then unlock this course?\`)) return;
    setOrderBusy(order.id);
    setError('');
    setMessage('');
    const result = await supabase.rpc('admin_confirm_paypal_link_payment', {
      p_order_id: order.id,
      p_transaction_id: order.provider_payment_id,
    });
    setOrderBusy('');
    if (result.error) return setError(result.error.message);
    setMessage('Payment verified and course unlocked.');
    await load();
  };

  const rejectPayment = async (order: PaymentOrder) => {
    if (!window.confirm('Reject this payment claim? No course access will be granted.')) return;
    setOrderBusy(order.id);
    setError('');
    setMessage('');
    const result = await supabase.rpc('admin_reject_paypal_link_payment', {
      p_order_id: order.id,
      p_reason: 'Transaction could not be verified in the PayPal Business dashboard.',
    });
    setOrderBusy('');
    if (result.error) return setError(result.error.message);
    setMessage('Payment claim rejected.');
    await load();
  };
`;
  if (!source.includes('const confirmPayment = async')) {
    source = source.replace('\n  if (loading) return <PageLoader label="Opening the admin workspace" />;', `${insertion}\n  if (loading) return <PageLoader label="Opening the admin workspace" />;`);
  }

  const ordersStart = source.indexOf("      {tab === 'orders' && (");
  const ordersEnd = source.indexOf('\n    </main>', ordersStart);
  if (ordersStart < 0 || ordersEnd < 0) throw new Error('Admin orders section anchors are missing.');
  const orders = `      {tab === 'orders' && (
        <section className="panel orders-panel">
          <p className="eyebrow">LATEST PAYPAL ACTIVITY</p>
          <h2>{orders.length} recent order{orders.length === 1 ? '' : 's'}.</h2>
          <p className="admin-order-note">For Business Link claims, verify the exact transaction ID and USD 1.00 amount in PayPal before unlocking. A learner-entered ID is a claim, not proof.</p>
          {orders.length ? orders.map((order) => (
            <article key={order.id} className={order.status === 'manual_review' ? 'payment-review-order' : ''}>
              <div className="payment-order-copy">
                <strong>{order.challenges?.title || order.metadata?.challenge_title || 'Course'}</strong>
                <span>{order.provider} · {order.currency} {order.amount} · {new Date(order.created_at).toLocaleString()}</span>
                {order.metadata?.email && <span>Buyer: {order.metadata.email}</span>}
                {order.provider_payment_id && <code>PayPal transaction: {order.provider_payment_id}</code>}
                {order.status === 'pending' && order.metadata?.payment_mode === 'hosted_link' && <small>Waiting for the learner to submit a transaction ID.</small>}
              </div>
              <div className="payment-order-actions">
                <b className={\`order-status \${order.status}\`}>{order.status}</b>
                {order.status === 'manual_review' && <div>
                  <button className="button button-primary" disabled={orderBusy === order.id} onClick={() => void confirmPayment(order)}>{orderBusy === order.id ? <LoaderCircle className="spin" /> : <CheckCircle2 />}Verify & unlock</button>
                  <button className="button button-soft" disabled={orderBusy === order.id} onClick={() => void rejectPayment(order)}><XCircle />Reject</button>
                </div>}
              </div>
            </article>
          )) : <p>No payment attempts yet.</p>}
        </section>
      )}`;
  source = source.slice(0, ordersStart) + orders + source.slice(ordersEnd);

  for (const marker of ['admin_confirm_paypal_link_payment', 'Verify & unlock', 'PayPal transaction:', 'admin_reject_paypal_link_payment']) {
    if (!source.includes(marker)) throw new Error(`PayPal Business Link admin patch failed: ${marker}`);
  }
  fs.writeFileSync(file, source);
}

function patchStyles() {
  const file = path.join(root, 'src', 'checkout.css');
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes('/* FINISH PayPal Business Link */')) return;
  source += `

/* FINISH PayPal Business Link */
.paypal-claim-card{max-width:860px;margin:28px auto 0;padding:24px}
.paypal-claim-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:14px}
.paypal-claim-head h2{margin:5px 0 0}
.paypal-claim-card>p{color:var(--muted);line-height:1.65}
.paypal-claim-card label{display:grid;gap:8px;margin:18px 0;color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.08em}
.paypal-claim-card input{width:100%;padding:15px 16px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--ink);font:700 15px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase}
.paypal-claim-actions{display:flex;flex-wrap:wrap;gap:10px}
.admin-order-note{margin:8px 0 18px;color:var(--muted);line-height:1.6}
.payment-review-order{border-color:color-mix(in srgb,var(--acid) 45%,var(--line))!important;background:color-mix(in srgb,var(--acid) 4%,transparent)}
.payment-order-copy{display:grid;gap:5px;min-width:0}
.payment-order-copy code{width:max-content;max-width:100%;overflow-wrap:anywhere;color:var(--ink);font-size:12px}
.payment-order-copy small{color:var(--muted)}
.payment-order-actions{display:grid;justify-items:end;gap:10px}
.payment-order-actions>div{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
.payment-order-actions .button{padding:9px 12px;font-size:11px}
@media(max-width:720px){.paypal-claim-head{display:grid}.payment-order-actions{justify-items:start}.payment-order-actions>div{justify-content:flex-start}}
`;
  fs.writeFileSync(file, source);
}

function patchPaymentPolicy() {
  const file = path.join(root, 'public', 'payments.html');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(
    /<section id="provider">[\s\S]*?<\/section>/,
    '<section id="provider"><h2>1. PayPal is the only payment provider</h2><p>FINISH accepts course payments through its official PayPal Business Payment Link. Razorpay, Stripe, cryptocurrency, bank transfer, UPI, screenshots, and payment links supplied by third parties are not accepted.</p><p>PayPal may offer PayPal balance, linked bank, card, or guest checkout options depending on eligibility. FINISH does not control which funding methods PayPal presents.</p></section>',
  );
  source = source.replace(
    /<section id="checkout">[\s\S]*?<\/section>/,
    '<section id="checkout"><h2>3. Checkout flow</h2><ol><li>You sign in and select one FINISH course.</li><li>You agree to the Terms, Payment Policy, and No-Refund Policy.</li><li>FINISH creates an internal USD 1.00 order tied to your account and course.</li><li>FINISH opens its official reusable PayPal Business Payment Link.</li><li>After payment, you submit the PayPal transaction ID to that FINISH order.</li><li>FINISH grants access only after the transaction is verified by a trusted webhook or against the PayPal Business dashboard.</li></ol><p>Opening the link, returning from PayPal, or submitting an identifier does not by itself create paid access.</p></section>',
  );
  source = source.replace(
    /<section id="verification">[\s\S]*?<\/section>/,
    '<section id="verification"><h2>4. Payment verification</h2><p>FINISH verifies the PayPal transaction identifier, USD amount, payment status, signed-in user, selected course, internal order, and recorded policy consent before granting access. A learner-entered transaction ID is treated as a claim until verified.</p><p>A screenshot, email receipt, bank message, or typed transaction ID is not enough by itself to unlock a course. Duplicate transaction identifiers cannot be attached to multiple FINISH orders.</p></section>',
  );
  source = source.replaceAll('PayPal order exists or payment review is incomplete.', 'The PayPal payment or FINISH verification review is incomplete.');
  source = source.replaceAll('PayPal confirmed capture and FINISH may grant access.', 'FINISH verified the PayPal payment and granted access.');
  for (const marker of ['official PayPal Business Payment Link', 'submit the PayPal transaction ID', 'treated as a claim until verified']) {
    if (!source.includes(marker)) throw new Error(`Payment Policy patch failed: ${marker}`);
  }
  fs.writeFileSync(file, source);
}

patchMain();
patchAdmin();
patchStyles();
patchPaymentPolicy();
console.log('FINISH PayPal Business Link checkout, transaction claims and admin verification applied.');
