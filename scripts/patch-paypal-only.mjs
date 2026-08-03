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

  const start = source.indexOf('// ---- src/pages/Checkout.tsx ----');
  const end = source.indexOf('// ---- src/pages/Learn.tsx ----');
  if (start < 0 || end < 0 || end <= start) throw new Error('Checkout section anchors are missing.');

  const checkout = `// ---- src/pages/Checkout.tsx ----\n\n// FINISH PayPal-only checkout. Pricing is global USD and never derived from IP location.\nconst TERMS_VERSION = '2026-08-03';\nconst NO_REFUND_VERSION = '2026-08-03';\n\nfunction Checkout() {\n  const { slug = '' } = useParams();\n  const { user } = useSession();\n  const navigate = useNavigate();\n  const [course, setCourse] = useState<Challenge | null>(null);\n  const [paypalReady, setPaypalReady] = useState(false);\n  const [acceptedPolicies, setAcceptedPolicies] = useState(false);\n  const [busy, setBusy] = useState(false);\n  const [error, setError] = useState('');\n\n  useEffect(() => {\n    if (!user) return;\n    let active = true;\n    (async () => {\n      try {\n        const next = await getCourse(slug);\n        const enrollment = await getEnrollment(user.id, next.id);\n        if (hasPaidAccess(enrollment)) { navigate(\`/learn/\${slug}\`, { replace: true }); return; }\n        const result = await supabase.functions.invoke('payment-readiness', { body: {} });\n        if (!active) return;\n        setCourse(next);\n        setPaypalReady(Boolean(result.data?.paypal));\n      } catch (reason) {\n        if (active) setError(reason instanceof Error ? reason.message : 'Checkout could not load.');\n      }\n    })();\n    return () => { active = false; };\n  }, [slug, user, navigate]);\n\n  const pay = async () => {\n    if (!course || !paypalReady) return;\n    if (!acceptedPolicies) {\n      setError('You must agree to the Terms of Use and acknowledge the No-Refund Policy before payment.');\n      return;\n    }\n    setBusy(true);\n    setError('');\n    try {\n      const result = await supabase.functions.invoke('payment-checkout', {\n        body: {\n          challenge_slug: course.slug,\n          provider: 'paypal',\n          terms_accepted: true,\n          terms_version: TERMS_VERSION,\n          no_refund_accepted: true,\n          no_refund_version: NO_REFUND_VERSION,\n          success_url: \`\${location.origin}/learn/\${course.slug}\`,\n          cancel_url: location.href,\n        },\n      });\n      if (result.error || result.data?.error) {\n        throw new Error(result.error?.message || result.data?.error || 'Checkout could not be created.');\n      }\n      if (!result.data?.checkout_url) throw new Error('PayPal approval URL is missing.');\n      location.assign(result.data.checkout_url);\n    } catch (reason) {\n      setError(reason instanceof Error ? reason.message : 'Payment could not start.');\n      setBusy(false);\n    }\n  };\n\n  if (error && !course) return <main className=\"app-page shell\"><PageError message={error} /></main>;\n  if (!course) return <PageLoader label=\"Preparing secure checkout\" />;\n\n  const usd = course.challenge_prices?.find((price) => price.provider === 'paypal' && price.currency === 'USD' && price.active !== false)?.amount ?? 1;\n  const buttonLabel = !paypalReady ? 'PayPal setup pending' : !acceptedPolicies ? 'Agree above to continue' : 'Continue to PayPal';\n\n  return <main className=\"app-page shell checkout-page\">\n    <Link className=\"back-link\" to={\`/course/\${course.slug}\`}><ArrowLeft size={16} />Back to course</Link>\n    <header className=\"checkout-heading\">\n      <p className=\"eyebrow\">SECURE CHECKOUT</p>\n      <h1>Unlock {course.title}.</h1>\n      <p>Agree to the purchase terms, complete PayPal payment, and FINISH unlocks the course only after server-side capture confirmation.</p>\n    </header>\n    {error && <div className=\"form-message error\" role=\"alert\">{error}</div>}\n    <section className=\"checkout-grid\">\n      <article className=\"payment-card recommended\">\n        <span className=\"recommended-label\">GLOBAL CHECKOUT</span>\n        <div className=\"payment-icon\"><CreditCard /></div>\n        <p className=\"eyebrow\">PAYPAL · USD</p>\n        <h2>Pay securely with PayPal</h2>\n        <strong>{formatMoney(usd, 'USD')}</strong>\n        <p>PayPal handles the hosted checkout. FINISH never prices or routes you using your IP address.</p>\n        <ul>{['Permanent course access', 'Server-verified payment unlock', 'All quizzes, progress and final project'].map((item) => <li key={item}><Check />{item}</li>)}</ul>\n        <label className=\"checkout-policy-agreement\">\n          <input type=\"checkbox\" checked={acceptedPolicies} onChange={(event) => { setAcceptedPolicies(event.target.checked); if (event.target.checked) setError(''); }} />\n          <span>I have read and agree to the <a href=\"/terms\" target=\"_blank\" rel=\"noreferrer\">Terms of Use</a> and <a href=\"/payments\" target=\"_blank\" rel=\"noreferrer\">Payment Policy</a>, and I acknowledge the <a href=\"/refunds\" target=\"_blank\" rel=\"noreferrer\">No-Refund Policy</a>. <strong>All sales are final.</strong></span>\n        </label>\n        <button className=\"button button-primary button-large full\" disabled={!paypalReady || !acceptedPolicies || busy} onClick={() => void pay()}>\n          {busy ? <LoaderCircle className=\"spin\" /> : <WalletCards />} {buttonLabel}\n        </button>\n        <p className=\"policy-consent checkout-consent\">PayPal processes the payment under its own terms. Checking the box records your acceptance on the FINISH payment order.</p>\n      </article>\n    </section>\n    <div className=\"secure-note\"><ShieldCheck /><span>Payment approval alone does not unlock the course. Access is granted only after PayPal confirms a completed capture with the correct USD amount.</span></div>\n  </main>;\n}\n\n`;

  source = source.slice(0, start) + checkout + source.slice(end);

  const required = [
    "import './checkout.css';",
    "const TERMS_VERSION = '2026-08-03'",
    "const NO_REFUND_VERSION = '2026-08-03'",
    'checkout-policy-agreement',
    'terms_accepted: true',
    'no_refund_accepted: true',
    'Agree above to continue',
    'Payment approval alone does not unlock the course.',
  ];
  for (const marker of required) {
    if (!source.includes(marker)) throw new Error(`PayPal consent patch failed: ${marker}`);
  }

  fs.writeFileSync(file, source);
}

function patchCourseProduct() {
  const file = path.join(root, 'src', 'course-product.tsx');
  let source = fs.readFileSync(file, 'utf8');

  const interfaceStart = source.indexOf('export interface RegionalOffer');
  const interfaceEnd = source.indexOf('export interface RegionalPrice');
  if (interfaceStart < 0 || interfaceEnd < 0) throw new Error('Regional offer anchors are missing.');

  source = source.slice(0, interfaceStart) + `export interface RegionalOffer {\n  country: 'GLOBAL';\n  countryName: 'Global';\n  provider: 'paypal';\n  currency: 'USD';\n  market: 'global';\n}\n\n` + source.slice(interfaceEnd);

  const regionStart = source.indexOf('const fallbackRegion');
  const priceStart = source.indexOf('export function regionalPrice');
  if (regionStart < 0 || priceStart < 0) throw new Error('Regional runtime anchors are missing.');

  const globalRuntime = `const globalOffer: RegionalOffer = {\n  country: 'GLOBAL',\n  countryName: 'Global',\n  provider: 'paypal',\n  currency: 'USD',\n  market: 'global',\n};\n\nexport function useRegion() {\n  return globalOffer;\n}\n\n`;
  source = source.slice(0, regionStart) + globalRuntime + source.slice(priceStart);

  const currentPriceStart = source.indexOf('export function regionalPrice');
  const currentPriceEnd = source.indexOf('\nfunction statusCopy', currentPriceStart);
  if (currentPriceStart < 0 || currentPriceEnd < 0) throw new Error('Regional price anchors are missing.');

  const priceRuntime = `export function regionalPrice(prices: RegionalPrice[], _region: RegionalOffer) {\n  return prices.find((price) => price.active !== false && price.provider === 'paypal' && price.currency === 'USD')\n    || { amount: 1, currency: 'USD', provider: 'paypal' };\n}\n`;
  source = source.slice(0, currentPriceStart) + priceRuntime + source.slice(currentPriceEnd);

  fs.writeFileSync(file, source);
}

patchMain();
patchCourseProduct();
console.log('FINISH PayPal checkout now requires recorded Terms and No-Refund acceptance.');
