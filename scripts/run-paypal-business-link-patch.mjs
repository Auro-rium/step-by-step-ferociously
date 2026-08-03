import fs from 'node:fs';

const patchFile = new URL('./patch-paypal-business-link.mjs', import.meta.url);
let source = fs.readFileSync(patchFile, 'utf8');
source = source.replace("    '${PAYPAL_LINK}',", '    PAYPAL_LINK,');
source = source.replace('    `export interface PaymentOrder {', '    `interface PaymentOrder {');
if (source.includes("    '${PAYPAL_LINK}',")) {
  throw new Error('PayPal Business Link patch still verifies the template placeholder.');
}
if (source.includes('    `export interface PaymentOrder {')) {
  throw new Error('PayPal Business Link patch would duplicate the route-splitting export.');
}
fs.writeFileSync(patchFile, source);
await import('./patch-paypal-business-link.mjs?verified=2');
