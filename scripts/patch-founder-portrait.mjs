import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const whyFile = path.join(root, 'public', 'why.html');
const portraitFile = path.join(root, 'public', 'images', 'ishan-founder-3840.webp');

if (!fs.existsSync(portraitFile)) {
  throw new Error('The optimized 4K founder portrait is missing.');
}

let source = fs.readFileSync(whyFile, 'utf8');

const portrait = `<img
          class="founder-portrait"
          src="/images/ishan-founder-3840.webp"
          width="3840"
          height="3840"
          alt="Ishan Trivedi, founder of FINISH"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
        />`;

const inlinePortrait = /<img\s+alt="Ishan, founder of FINISH, smiling and giving a thumbs up"\s+src="data:image\/jpeg;base64,[^"]+">/;
if (inlinePortrait.test(source)) {
  source = source.replace(inlinePortrait, portrait);
} else if (!source.includes('src="/images/ishan-founder-3840.webp"')) {
  throw new Error('The founder portrait anchor in why.html could not be found.');
}

const styles = `
  <style id="founder-portrait-styles">
    .founder-photo {
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
    .founder-photo .founder-portrait {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      object-fit: cover !important;
      object-position: 50% 38% !important;
      border-radius: 50% !important;
    }
    @media (max-width: 720px) {
      .founder-photo { width: 184px !important; }
    }
  </style>`;

if (!source.includes('id="founder-portrait-styles"')) {
  source = source.replace('</head>', `${styles}\n</head>`);
}

for (const marker of [
  'src="/images/ishan-founder-3840.webp"',
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
console.log('FINISH founder portrait is external, 4K-ready, lazy-loaded and circular.');
