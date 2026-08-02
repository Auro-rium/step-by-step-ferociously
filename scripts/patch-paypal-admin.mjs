import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  path.join(root, 'src', 'main.tsx'),
  path.join(root, 'src', 'pages', 'Admin.tsx'),
].filter((file) => fs.existsSync(file));

function patchAdmin(file) {
  let source = fs.readFileSync(file, 'utf8');

  source = source.replaceAll("p_inr: Number(form.get('inr'))", 'p_inr: 0');

  source = source.replace(
    '<div className="form-columns"><label>USD PRICE<input name="usd" type="number" step="0.01" defaultValue="2" required /></label><label>INR PRICE<input name="inr" type="number" step="1" defaultValue="159" required /></label></div>',
    '<label>GLOBAL PAYPAL PRICE (USD)<input name="usd" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>',
  );

  source = source.replace(
    /<div className="form-columns">\s*<label>USD PRICE<input name="usd" type="number" step="0\.01" defaultValue="2" required \/><\/label>\s*<label>INR PRICE<input name="inr" type="number" step="1" defaultValue="159" required \/><\/label>\s*<\/div>/g,
    '<label>GLOBAL PAYPAL PRICE (USD)<input name="usd" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>',
  );

  source = source.replaceAll('inspect payment activity.', 'inspect PayPal order activity.');
  source = source.replaceAll('LATEST PAYMENT ACTIVITY', 'LATEST PAYPAL ACTIVITY');

  const required = [
    'p_inr: 0',
    'GLOBAL PAYPAL PRICE (USD)',
    'defaultValue="1"',
  ];
  for (const marker of required) {
    if (!source.includes(marker)) throw new Error(`PayPal admin patch failed for ${path.relative(root, file)}: ${marker}`);
  }
  const forbidden = ['INR PRICE', 'defaultValue="159"', "p_inr: Number(form.get('inr'))"];
  for (const marker of forbidden) {
    if (source.includes(marker)) throw new Error(`Legacy payment field remains in ${path.relative(root, file)}: ${marker}`);
  }

  fs.writeFileSync(file, source);
}

for (const file of targets) patchAdmin(file);
console.log(`FINISH PayPal-only admin applied to ${targets.length} source file(s).`);
