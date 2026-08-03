import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const whyFile = path.join(root, 'public', 'why.html');
const imagesDirectory = path.join(root, 'public', 'images');
const portraitFile = path.join(imagesDirectory, 'ishan-founder-3840.svg');

let source = fs.readFileSync(whyFile, 'utf8');
const dataMatch = source.match(/data:image\/jpeg;base64,([^"'()\s<]+)/);
const figureMatch = source.match(/(<figure\b[^>]*class="[^"]*founder-photo[^"]*"[^>]*>)([\s\S]*?)(<\/figure>)/);

if (dataMatch && figureMatch) {
  fs.mkdirSync(imagesDirectory, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="3840" viewBox="0 0 3840 3840" role="img" aria-label="Ishan Trivedi, founder of FINISH">
  <defs><clipPath id="portrait-circle"><circle cx="1920" cy="1920" r="1920" /></clipPath></defs>
  <rect width="3840" height="3840" fill="#11100d" clip-path="url(#portrait-circle)" />
  <image href="data:image/jpeg;base64,${dataMatch[1]}" x="-439" y="-1063" width="4725" height="5907" preserveAspectRatio="none" clip-path="url(#portrait-circle)" />
</svg>\n`;
  fs.writeFileSync(portraitFile, svg);
}

const portrait = `<img
          class="founder-portrait"
          src="/images/ishan-founder-3840.svg"
          width="3840"
          height="3840"
          alt="Ishan Trivedi, founder of FINISH"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
        />`;

if (dataMatch && figureMatch) {
  const caption = figureMatch[2].match(/<figcaption\b[\s\S]*?<\/figcaption>/)?.[0] || '';
  source = source.replace(figureMatch[0], `${figureMatch[1]}${portrait}${caption}${figureMatch[3]}`);
} else if (!source.includes('src="/images/ishan-founder-3840.svg"')) {
  throw new Error('The founder portrait or its figure in why.html could not be found.');
}
if (!fs.existsSync(portraitFile)) {
  throw new Error('The external 4K founder portrait could not be generated.');
}

const styles = `
  <style id="founder-portrait-styles">
    .founder-photo,
    .founder-portrait-frame {
      width: clamp(180px, 24vw, 260px) !important;
      aspect-ratio: 1 !important;
      margin: 0 auto !important;
      overflow: hidden !important;
      border: 1px solid rgba(226, 160, 110, .38) !important;
      border-radius: 50% !important;
      background: #11100d !important;
      box-shadow: 0 24px 72px rgba(0, 0, 0, .38), 0 0 0 9px rgba(199, 122, 69, .07) !important;
      contain: layout paint;
    }
    .founder-portrait {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      object-fit: cover !important;
      object-position: 50% 38% !important;
      border-radius: 50% !important;
    }
    @media (max-width: 720px) {
      .founder-photo,
      .founder-portrait-frame { width: 184px !important; }
    }
  </style>`;

if (!source.includes('id="founder-portrait-styles"')) {
  source = source.replace('</head>', `${styles}\n</head>`);
}

for (const marker of [
  'src="/images/ishan-founder-3840.svg"',
  'width="3840"',
  'height="3840"',
  'loading="lazy"',
  'decoding="async"',
  'fetchpriority="low"',
  'border-radius: 50%',
]) {
  if (!source.includes(marker)) throw new Error(`Founder portrait patch failed: ${marker}`);
}
if (source.includes('data:image/jpeg;base64')) {
  throw new Error('The inline founder portrait still bloats why.html.');
}

fs.writeFileSync(whyFile, source);
console.log('FINISH founder portrait is external, 4K-canvas, lazy-loaded and circular.');
