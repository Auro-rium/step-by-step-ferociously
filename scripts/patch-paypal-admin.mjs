import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'src', 'main.tsx');
let source = fs.readFileSync(file, 'utf8');

const oldRpc = "p_usd: Number(form.get('usd')), p_inr: Number(form.get('inr'))";
const newRpc = "p_usd: Number(form.get('usd')), p_inr: 0";
if (!source.includes(oldRpc) && !source.includes(newRpc)) {
  throw new Error('Admin payment RPC anchor is missing.');
}
source = source.replace(oldRpc, newRpc);

const oldPriceFields = '<div className="form-columns"><label>USD PRICE<input name="usd" type="number" step="0.01" defaultValue="2" required /></label><label>INR PRICE<input name="inr" type="number" step="1" defaultValue="159" required /></label></div>';
const newPriceField = '<label>GLOBAL PAYPAL PRICE (USD)<input name="usd" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>';
if (!source.includes(oldPriceFields) && !source.includes(newPriceField)) {
  throw new Error('Admin price fields anchor is missing.');
}
source = source.replace(oldPriceFields, newPriceField);

fs.writeFileSync(file, source);
console.log('FINISH admin course creation is PayPal-only.');
