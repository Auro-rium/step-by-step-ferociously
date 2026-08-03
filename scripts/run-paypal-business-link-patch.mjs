import fs from 'node:fs';

const patchFile = new URL('./patch-paypal-business-link.mjs', import.meta.url);
let source = fs.readFileSync(patchFile, 'utf8');
source = source.replace("    '${PAYPAL_LINK}',", '    PAYPAL_LINK,');
if (source.includes("    '${PAYPAL_LINK}',")) {
  throw new Error('PayPal Business Link patch still verifies the template placeholder.');
}
fs.writeFileSync(patchFile, source);
await import('./patch-paypal-business-link.mjs?verified=1');
