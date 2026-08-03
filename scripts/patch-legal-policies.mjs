import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainFile = path.join(root, 'src', 'main.tsx');
const stylesFile = path.join(root, 'src', 'styles.css');

let source = fs.readFileSync(mainFile, 'utf8');

const oldFooter = `function Footer() {
  return <footer className="footer"><div className="shell footer-inner"><Brand /><p>Structured learning on top of excellent YouTube courses.</p><span>© {new Date().getFullYear()} FINISH</span></div></footer>;
}`;

const newFooter = `function Footer() {
  return <footer className="footer"><div className="shell footer-inner footer-policy-layout">
    <div className="footer-brand-block"><Brand /><p>Structured learning on top of excellent YouTube courses.</p><span>© {new Date().getFullYear()} FINISH</span></div>
    <nav className="footer-policy-links" aria-label="Legal and policy links">
      <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refunds">No Refunds</a><a href="/payments">Payments</a><a href="/cookies">Cookies</a><a href="/acceptable-use">Acceptable Use</a><a href="/content-copyright">Content & Copyright</a>
    </nav>
  </div></footer>;
}`;

if (source.includes(oldFooter)) source = source.replace(oldFooter, newFooter);
else if (!source.includes('footer-policy-links')) throw new Error('FINISH footer policy anchor is missing.');
source = source.replaceAll('<a href="/refunds">Refunds</a>', '<a href="/refunds">No Refunds</a>');

const authAnchor = `        <label>PASSWORD<input name="password" type="password" minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 8 characters" required /></label>`;
const authReplacement = `${authAnchor}
        {mode === 'signup' && <p className="policy-consent">By creating an account, you agree to the <a href="/terms">Terms of Use</a> and acknowledge the <a href="/privacy">Privacy Policy</a>.</p>}`;
if (source.includes(authAnchor) && !source.includes('By creating an account, you agree')) source = source.replace(authAnchor, authReplacement);
else if (!source.includes('By creating an account, you agree')) throw new Error('FINISH sign-up policy anchor is missing.');

const checkoutAnchor = `        <button className="button button-primary button-large full" disabled={!paypalReady || busy} onClick={() => void pay()}>
          {busy ? <LoaderCircle className="spin" /> : <WalletCards />} {paypalReady ? 'Continue to PayPal' : 'PayPal setup pending'}
        </button>`;
const checkoutReplacement = `${checkoutAnchor}
        <p className="policy-consent checkout-consent">By continuing, you agree to the <a href="/terms">Terms</a>, <a href="/payments">Payment Policy</a>, and <a href="/refunds">No-Refund Policy</a>. <strong>All sales are final.</strong> PayPal processes the payment under its own terms.</p>`;
if (source.includes(checkoutAnchor) && !source.includes('PayPal processes the payment under its own terms')) source = source.replace(checkoutAnchor, checkoutReplacement);
else if (source.includes('PayPal processes the payment under its own terms')) {
  source = source
    .replaceAll('<a href="/refunds">Refund Policy</a>', '<a href="/refunds">No-Refund Policy</a>')
    .replace('PayPal processes the payment under its own terms.</p>', '<strong>All sales are final.</strong> PayPal processes the payment under its own terms.</p>');
} else throw new Error('FINISH PayPal policy anchor is missing.');

if (!source.includes('No-Refund Policy') || !source.includes('All sales are final.')) {
  throw new Error('FINISH no-refund checkout disclosure is missing.');
}

fs.writeFileSync(mainFile, source);

let styles = fs.readFileSync(stylesFile, 'utf8');
if (!styles.includes('/* FINISH LEGAL SURFACES */')) {
  styles += `

/* FINISH LEGAL SURFACES */
.footer-policy-layout{display:grid;grid-template-columns:minmax(220px,1fr) minmax(360px,1.4fr);gap:28px;align-items:start}
.footer-brand-block{display:grid;gap:8px}.footer-brand-block p,.footer-brand-block span{margin:0}
.footer-policy-links{display:flex;flex-wrap:wrap;gap:10px 18px;justify-content:flex-end;align-content:start}
.footer-policy-links a{font-size:12px;color:inherit;text-decoration:none;white-space:nowrap}
.footer-policy-links a:hover{text-decoration:underline;text-underline-offset:3px}
.policy-consent{font-size:12px;line-height:1.55;color:var(--muted);margin:0}
.policy-consent a{color:inherit;font-weight:800;text-underline-offset:3px}
.checkout-consent{text-align:center;margin-top:14px}
@media(max-width:760px){.footer-policy-layout{grid-template-columns:1fr}.footer-policy-links{justify-content:flex-start}}
`;
  fs.writeFileSync(stylesFile, styles);
}

console.log('FINISH legal policies integrated with an explicit all-sales-final checkout disclosure.');
