import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const whyFile = path.join(root, 'public', 'why.html');
const imagesDirectory = path.join(root, 'public', 'images');
const portraitFile = path.join(imagesDirectory, 'ishan-founder-3840.svg');

let source = fs.readFileSync(whyFile, 'utf8');

const figureStart = source.indexOf('<figure class="founder-photo"');
const figureOpenEnd = figureStart >= 0 ? source.indexOf('>', figureStart) + 1 : -1;
const figureEnd = figureOpenEnd > 0 ? source.indexOf('</figure>', figureOpenEnd) : -1;
const base64Marker = figureOpenEnd > 0 ? source.indexOf(';base64,', figureOpenEnd) : -1;
const dataStart = base64Marker >= 0 ? base64Marker + ';base64,'.length : -1;
let dataEnd = dataStart;
while (dataEnd >= 0 && dataEnd < source.length && /[A-Za-z0-9+/=]/.test(source[dataEnd])) dataEnd += 1;
const encodedPortrait = dataStart >= 0 && dataEnd > dataStart ? source.slice(dataStart, dataEnd) : '';
const sectionEnd = dataEnd > 0 ? source.indexOf('</section>', dataEnd) : -1;
const replacementEnd = figureEnd > figureOpenEnd ? figureEnd : sectionEnd;

if (encodedPortrait && replacementEnd > figureOpenEnd && base64Marker < replacementEnd) {
  fs.mkdirSync(imagesDirectory, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="3840" viewBox="0 0 3840 3840" role="img" aria-label="Ishan Trivedi, founder of FINISH">
  <defs><clipPath id="portrait-circle"><circle cx="1920" cy="1920" r="1920" /></clipPath></defs>
  <rect width="3840" height="3840" fill="#11100d" clip-path="url(#portrait-circle)" />
  <image href="data:image/jpeg;base64,${encodedPortrait}" x="-439" y="-1063" width="4725" height="5907" preserveAspectRatio="none" clip-path="url(#portrait-circle)" />
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

if (encodedPortrait && replacementEnd > figureOpenEnd && base64Marker < replacementEnd) {
  if (figureEnd > figureOpenEnd) {
    const existingFigureBody = source.slice(figureOpenEnd, figureEnd);
    const caption = existingFigureBody.match(/<figcaption\b[\s\S]*?<\/figcaption>/)?.[0] || '';
    source = source.slice(0, figureOpenEnd) + portrait + caption + source.slice(figureEnd);
  } else {
    source = source.slice(0, figureOpenEnd) + portrait + '</figure>\n    ' + source.slice(sectionEnd);
  }
} else if (!source.includes('src="/images/ishan-founder-3840.svg"')) {
  throw new Error(`The founder portrait could not be parsed: figure=${figureStart}, section=${sectionEnd}, base64=${base64Marker}.`);
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
if (source.includes(';base64,')) {
  throw new Error('The inline founder portrait still bloats why.html.');
}

fs.writeFileSync(whyFile, source);
console.log('FINISH founder portrait is external, 4K-canvas, lazy-loaded and circular.');
