import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function patchMain() {
  const file = path.join(root, 'src', 'main.tsx');
  let source = fs.readFileSync(file, 'utf8');

  if (!source.includes("import './checkout.css';")) {
    source = source.replace("import './styles.css';", "import './styles.css';\nimport './checkout.css';");
  }

  source = source.replace(', IndianRupee,', ',');
  source = source.replace("type Currency = 'USD' | 'INR' | 'USDT' | string;", "type Currency = 'USD' | string;");
  source = source.replace("type PaymentProvider = 'paypal' | 'razorpay' | 'crypto' | string;", "type PaymentProvider = 'paypal' | string;");

  source = source.replace(
    /interface PaymentOrder \{[\s\S]*?\n\}/,
    `interface PaymentOrder {
  id: string;
  user_id?: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  provider_order_id?: string | null;
  provider_payment_id?: string | null;
  checkout_url?: string | null;
  metadata?: {
    email?: string;
    challenge_slug?: string;
    challenge_title?: string;
    payment_mode?: string;
    expected_amount?: { currency?: string; value?: string };
  } | null;
  created_at: string;
  challenges?: { title?: string } | null;
}`,
  );

  const start = source.indexOf('// ---- src/pages/Checkout.tsx ----');
  const end = source.indexOf('// ---- src/pages/Learn.tsx ----');
  if (start < 0 || end < 0 || end <= start) throw new Error('Checkout section anchors are missing.');

  const checkout = `// ---- src/pages/Checkout.tsx ----

// FINISH PayPal Orders v2 checkout. The buyer approves once; FINISH captures, verifies and unlocks server-side.
const TERMS_VERSION = '2026-08-03';
const NO_REFUND_VERSION = '2026-08-03';

function Checkout() {
  const { slug = '' } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const captureStarted = useRef(false);
  const [course, setCourse] = useState<Challenge | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const paypalState = searchParams.get('paypal') || '';
  const finishOrderId = searchParams.get('finish_order') || '';
  const paypalOrderId = searchParams.get('token') || '';

  const waitForAccess = async (challengeId: string) => {
    if (!user) return false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const enrollment = await getEnrollment(user.id, challengeId);
      if (hasPaidAccess(enrollment)) return true;
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    return false;
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const next = await getCourse(slug);
        const enrollment = await getEnrollment(user.id, next.id);
        if (hasPaidAccess(enrollment)) {
          navigate('/learn/' + slug, { replace: true });
          return;
        }

        const readiness = await supabase.functions.invoke('payment-readiness', { body: {} });
        if (readiness.error || readiness.data?.paymentMode !== 'orders_v2') {
          throw new Error(readiness.error?.message || 'PayPal automatic checkout is unavailable.');
        }
        if (!active) return;
        setCourse(next);
        setPaypalReady(Boolean(
          readiness.data?.paypalApiCheckout
          && readiness.data?.paypalWebhook
          && readiness.data?.paypalLive
        ));

        if (paypalState === 'cancelled') {
          setMessage('PayPal checkout was cancelled. No course access was changed.');
          navigate('/checkout/' + slug, { replace: true });
          return;
        }

        if (paypalState === 'return' && finishOrderId && paypalOrderId && !captureStarted.current) {
          captureStarted.current = true;
          setCaptureBusy(true);
          setError('');
          setMessage('PayPal approved the order. FINISH is capturing and verifying the payment now.');
          const captured = await supabase.functions.invoke('paypal-capture', {
            body: {
              order_id: finishOrderId,
              paypal_order_id: paypalOrderId,
            },
          });
          if (captured.error || captured.data?.error) {
            throw new Error(captured.error?.message || captured.data?.error || 'PayPal capture failed.');
          }
          if (captured.data?.status === 'paid' || await waitForAccess(next.id)) {
            setMessage('Payment captured. Opening your course.');
            navigate('/learn/' + slug, { replace: true });
            return;
          }
          setMessage('Your payment is still processing at PayPal. FINISH will unlock the course as soon as the completed-capture webhook arrives.');
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Checkout could not load.');
      } finally {
        if (active) setCaptureBusy(false);
      }
    })();
    return () => { active = false; };
  }, [slug, user, navigate, paypalState, finishOrderId, paypalOrderId]);

  const pay = async () => {
    if (!course || !paypalReady || captureBusy) return;
    if (!acceptedPolicies) {
      setError('You must agree to the Terms of Use and acknowledge the No-Refund Policy before payment.');
      return;
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
      if (
        result.data?.kind !== 'orders_v2'
        || !result.data?.checkout_url
        || !result.data?.order_id
        || !result.data?.paypal_order_id
      ) {
        throw new Error('PayPal Orders v2 checkout is incomplete.');
      }
      window.location.assign(result.data.checkout_url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Payment could not start.');
      setBusy(false);
    }
  };

  if (error && !course) return <main className="app-page shell"><PageError message={error} /></main>;
  if (!course) return <PageLoader label={captureBusy ? 'Verifying PayPal payment' : 'Preparing secure checkout'} />;

  const usd = course.challenge_prices?.find((price) =>
    price.provider === 'paypal' && price.currency === 'USD' && price.active !== false
  )?.amount ?? 1;
  const buttonLabel = !paypalReady
    ? 'PayPal unavailable'
    : !acceptedPolicies
      ? 'Agree above to continue'
      : busy
        ? 'Opening PayPal'
        : 'Continue with PayPal';

  return <main className="app-page shell checkout-page">
    <Link className="back-link" to={'/course/' + course.slug}><ArrowLeft size={16} />Back to course</Link>
    <header className="checkout-heading">
      <p className="eyebrow">SECURE CHECKOUT</p>
      <h1>Unlock {course.title}.</h1>
      <p>Approve the one-time payment on PayPal. FINISH captures it server-side and unlocks this exact course automatically.</p>
    </header>
    {error && <div className="form-message error" role="alert">{error}</div>}
    {message && <div className="form-message success" role="status">{message}</div>}
    <section className="checkout-grid">
      <article className="payment-card recommended">
        <span className="recommended-label">AUTOMATIC PAYPAL CHECKOUT</span>
        <div className="payment-icon"><CreditCard /></div>
        <p className="eyebrow">PAYPAL · USD</p>
        <h2>Pay securely with PayPal</h2>
        <strong>{formatMoney(usd, 'USD')}</strong>
        <p>FINISH creates a course-specific PayPal order. No transaction ID, screenshot, or admin unlock is required.</p>
        <ul>{[
          'Permanent course access after confirmed capture',
          'One-time USD 1.00 payment',
          'Automatic server-side verification',
        ].map((item) => <li key={item}><Check />{item}</li>)}</ul>
        <label className="checkout-policy-agreement">
          <input
            type="checkbox"
            checked={acceptedPolicies}
            onChange={(event) => {
              setAcceptedPolicies(event.target.checked);
              if (event.target.checked) setError('');
            }}
          />
          <span>I have read and agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a> and <a href="/payments" target="_blank" rel="noreferrer">Payment Policy</a>, and I acknowledge the <a href="/refunds" target="_blank" rel="noreferrer">No-Refund Policy</a>. <strong>All sales are final.</strong></span>
        </label>
        <button
          className="button button-primary button-large full"
          disabled={!paypalReady || !acceptedPolicies || busy || captureBusy}
          onClick={() => void pay()}
        >
          {busy || captureBusy ? <LoaderCircle className="spin" /> : <WalletCards />} {buttonLabel}
        </button>
        <p className="policy-consent checkout-consent">Checking the box records your acceptance on the FINISH payment order. PayPal processes the payment under its own terms.</p>
      </article>
    </section>
    <div className="secure-note"><ShieldCheck /><span>FINISH captures and verifies the exact USD amount, PayPal order, signed-in account and selected course before granting access. Approval alone is never treated as payment.</span></div>
  </main>;
}

`;

  source = source.slice(0, start) + checkout + source.slice(end);

  const required = [
    "import './checkout.css';",
    'FINISH PayPal Orders v2 checkout',
    "const TERMS_VERSION = '2026-08-03'",
    "const NO_REFUND_VERSION = '2026-08-03'",
    'checkout-policy-agreement',
    'terms_accepted: true',
    'no_refund_accepted: true',
    'Agree above to continue',
    "supabase.functions.invoke('paypal-capture'",
    "searchParams.get('token')",
    "searchParams.get('finish_order')",
    'Continue with PayPal',
    'No transaction ID, screenshot, or admin unlock is required.',
  ];
  for (const marker of required) {
    if (!source.includes(marker)) throw new Error(`PayPal Orders v2 checkout patch failed: ${marker}`);
  }

  for (const forbidden of [
    'PAYPAL_BUSINESS_LINK',
    "supabase.rpc('submit_paypal_link_claim'",
    'PAYPAL TRANSACTION ID',
    'Submit payment for verification',
    "payment_mode === 'hosted_link'",
  ]) {
    if (source.includes(forbidden)) throw new Error(`Legacy PayPal link flow remains: ${forbidden}`);
  }

  fs.writeFileSync(file, source);
}

function patchCheckoutStyles() {
  const file = path.join(root, 'src', 'checkout.css');
  let source = fs.readFileSync(file, 'utf8');
  const legacyStart = source.indexOf('/* FINISH PayPal Business Link */');
  if (legacyStart >= 0) source = source.slice(0, legacyStart).trimEnd() + '\n';

  if (!source.includes('/* FINISH PayPal Orders v2 */')) {
    source += `

/* FINISH PayPal Orders v2 */
.admin-order-note{margin:8px 0 18px;color:var(--muted);line-height:1.6}
.payment-order-copy{display:grid;gap:5px;min-width:0}
.payment-order-copy code{width:max-content;max-width:100%;overflow-wrap:anywhere;color:var(--ink);font-size:12px}
.payment-order-copy small{color:var(--muted)}
.order-status.paid{border-color:color-mix(in srgb,var(--acid) 55%,var(--line))}
.order-status.pending{border-color:color-mix(in srgb,#e8b44c 55%,var(--line))}
`;
  }
  fs.writeFileSync(file, source);
}

function patchCourseProduct() {
  const file = path.join(root, 'src', 'course-product.tsx');
  let source = fs.readFileSync(file, 'utf8');

  const interfaceStart = source.indexOf('export interface RegionalOffer');
  const interfaceEnd = source.indexOf('export interface RegionalPrice');
  if (interfaceStart < 0 || interfaceEnd < 0) throw new Error('Regional offer anchors are missing.');

  source = source.slice(0, interfaceStart) + `export interface RegionalOffer {
  country: 'GLOBAL';
  countryName: 'Global';
  provider: 'paypal';
  currency: 'USD';
  market: 'global';
}

` + source.slice(interfaceEnd);

  const regionStart = source.indexOf('const fallbackRegion');
  const priceStart = source.indexOf('export function regionalPrice');
  if (regionStart < 0 || priceStart < 0) throw new Error('Regional runtime anchors are missing.');

  const globalRuntime = `const globalOffer: RegionalOffer = {
  country: 'GLOBAL',
  countryName: 'Global',
  provider: 'paypal',
  currency: 'USD',
  market: 'global',
};

export function useRegion() {
  return globalOffer;
}

`;
  source = source.slice(0, regionStart) + globalRuntime + source.slice(priceStart);

  const currentPriceStart = source.indexOf('export function regionalPrice');
  const currentPriceEnd = source.indexOf('\nfunction statusCopy', currentPriceStart);
  if (currentPriceStart < 0 || currentPriceEnd < 0) throw new Error('Regional price anchors are missing.');

  const priceRuntime = `export function regionalPrice(prices: RegionalPrice[], _region: RegionalOffer) {
  return prices.find((price) => price.active !== false && price.provider === 'paypal' && price.currency === 'USD')
    || { amount: 1, currency: 'USD', provider: 'paypal' };
}
`;
  source = source.slice(0, currentPriceStart) + priceRuntime + source.slice(currentPriceEnd);

  fs.writeFileSync(file, source);
}

patchMain();
patchCheckoutStyles();
patchCourseProduct();
console.log('FINISH PayPal Orders v2 checkout now captures, verifies and unlocks automatically.');
