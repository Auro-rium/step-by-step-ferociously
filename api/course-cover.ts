const COURSES: Record<string, { institution: string; kicker: string; lines: string[]; accent: string; accent2: string }> = {
  'mit-finance-theory-i': { institution: 'MIT', kicker: 'FINANCE THEORY', lines: ['Finance', 'Theory I'], accent: '#21c58b', accent2: '#f4cc68' },
  'mit-blockchain-and-money': { institution: 'MIT', kicker: 'DIGITAL FINANCE', lines: ['Blockchain', '& Money'], accent: '#31d7b0', accent2: '#78a8ff' },
  'yale-financial-theory': { institution: 'YALE', kicker: 'ASSET PRICING', lines: ['Financial', 'Theory'], accent: '#4aa3ff', accent2: '#c8dcff' },
  'yale-financial-markets': { institution: 'YALE', kicker: 'MARKETS & RISK', lines: ['Financial', 'Markets'], accent: '#3389ff', accent2: '#f0c45f' },
  'mit-public-finance-public-policy': { institution: 'MIT', kicker: 'ECONOMICS & POLICY', lines: ['Public Finance', '& Public Policy'], accent: '#ff8e5b', accent2: '#f1d16f' },
  'mit-fintech-shaping-financial-world': { institution: 'MIT', kicker: 'FINTECH', lines: ['Shaping the', 'Financial World'], accent: '#27c4a8', accent2: '#7b8cff' },
  'mit-mathematics-applications-finance': { institution: 'MIT', kicker: 'QUANTITATIVE FINANCE', lines: ['Mathematics', 'for Finance'], accent: '#a67cff', accent2: '#4dd6ff' },
  'nyu-mba-corporate-finance-2024': { institution: 'NYU STERN', kicker: 'MBA ARCHIVE', lines: ['Corporate', 'Finance 2024'], accent: '#b18bff', accent2: '#f2c462' },
  'nyu-mba-corporate-finance-2025': { institution: 'NYU STERN', kicker: 'MBA COURSE', lines: ['Corporate', 'Finance 2025'], accent: '#9c76ff', accent2: '#68d6c5' },
  'nyu-mba-valuation-2024': { institution: 'NYU STERN', kicker: 'MBA ARCHIVE', lines: ['Valuation', '2024'], accent: '#ff8d6d', accent2: '#dcb4ff' },
  'nyu-mba-valuation-2025': { institution: 'NYU STERN', kicker: 'MBA COURSE', lines: ['Valuation', '2025'], accent: '#ff735f', accent2: '#f3c967' },
  'nyu-undergraduate-corporate-finance': { institution: 'NYU STERN', kicker: 'UNDERGRADUATE', lines: ['Corporate', 'Finance'], accent: '#6ca8ff', accent2: '#63dfbd' },
  'nyu-undergraduate-valuation-2024': { institution: 'NYU STERN', kicker: 'UNDERGRADUATE', lines: ['Valuation', '2024'], accent: '#6f8cff', accent2: '#ffb366' },
  'nyu-accounting-for-finance-valuation': { institution: 'NYU STERN', kicker: 'ACCOUNTING', lines: ['Accounting for', 'Finance & Valuation'], accent: '#45c999', accent2: '#e8cc70' },
  'nyu-corporate-finance-online': { institution: 'NYU STERN', kicker: 'ONLINE COURSE', lines: ['Corporate', 'Finance Online'], accent: '#6a99ff', accent2: '#b58aff' },
  'nyu-foundations-of-finance': { institution: 'NYU STERN', kicker: 'FOUNDATIONS', lines: ['Foundations', 'of Finance'], accent: '#20bd8c', accent2: '#f4c75f' },
  'nyu-investment-philosophies': { institution: 'NYU STERN', kicker: 'INVESTING', lines: ['Investment', 'Philosophies'], accent: '#e99d4d', accent2: '#79c9ff' },
  'nyu-statistics-for-finance-investing': { institution: 'NYU STERN', kicker: 'STATISTICS', lines: ['Statistics for', 'Finance & Investing'], accent: '#8a78ff', accent2: '#4ed3d1' },
  'nyu-corporate-life-cycle': { institution: 'NYU STERN', kicker: 'BUSINESS LIFE CYCLE', lines: ['The Corporate', 'Life Cycle'], accent: '#e77670', accent2: '#f0c95f' },
  'nyu-little-book-of-valuation': { institution: 'NYU STERN', kicker: 'VALUATION', lines: ['The Little Book', 'of Valuation'], accent: '#b779ff', accent2: '#ffb16b' },
  'nyu-valuation-online': { institution: 'NYU STERN', kicker: 'ONLINE COURSE', lines: ['Valuation', 'Online'], accent: '#ff7662', accent2: '#73b9ff' },
};

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character] || character));
}

export default function handler(request: any, response: any) {
  const slug = String(request.query?.slug || '').trim();
  const course = COURSES[slug];

  if (!course) {
    response.status(404).setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Unknown course cover.');
    return;
  }

  const [lineOne, lineTwo = ''] = course.lines.map(escapeXml);
  const institution = escapeXml(course.institution);
  const kicker = escapeXml(course.kicker);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-label="${lineOne} ${lineTwo}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07120f"/><stop offset="1" stop-color="#020706"/></linearGradient>
    <radialGradient id="glow" cx="78%" cy="18%" r="70%"><stop stop-color="${course.accent}" stop-opacity=".42"/><stop offset="1" stop-color="${course.accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${course.accent}"/><stop offset="1" stop-color="${course.accent2}"/></linearGradient>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#fff" stroke-opacity=".055"/></pattern>
    <filter id="blur"><feGaussianBlur stdDeviation="24"/></filter>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect width="1200" height="675" fill="url(#grid)"/>
  <rect width="1200" height="675" fill="url(#glow)"/>
  <circle cx="975" cy="165" r="210" fill="none" stroke="${course.accent}" stroke-opacity=".34" stroke-width="2"/>
  <circle cx="975" cy="165" r="142" fill="none" stroke="${course.accent2}" stroke-opacity=".28" stroke-width="2"/>
  <circle cx="975" cy="165" r="70" fill="${course.accent}" fill-opacity=".1" stroke="${course.accent}" stroke-opacity=".5" stroke-width="2"/>
  <path d="M780 165h390M975-30v390M835 25l280 280M1115 25L835 305" fill="none" stroke="${course.accent2}" stroke-opacity=".28" stroke-width="2"/>
  <path d="M70 116h520" stroke="url(#line)" stroke-width="7" stroke-linecap="round"/>
  <rect x="70" y="54" width="176" height="42" rx="21" fill="${course.accent}" fill-opacity=".16" stroke="${course.accent}" stroke-opacity=".55"/>
  <text x="158" y="82" fill="#f7fff9" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="800" letter-spacing="2">${institution}</text>
  <text x="70" y="180" fill="${course.accent2}" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" letter-spacing="4">${kicker}</text>
  <text x="70" y="294" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="70" font-weight="850" letter-spacing="-2">${lineOne}</text>
  <text x="70" y="378" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="70" font-weight="850" letter-spacing="-2">${lineTwo}</text>
  <g transform="translate(70 490)">
    <rect width="560" height="92" rx="18" fill="#ffffff" fill-opacity=".055" stroke="#ffffff" stroke-opacity=".1"/>
    <text x="28" y="38" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="800" letter-spacing="3">FINISH COURSE</text>
    <text x="28" y="68" fill="#b9c8bf" font-family="Inter,Arial,sans-serif" font-size="18">Structured route · checkpoints · final project</text>
  </g>
  <g transform="translate(910 500)">
    <circle cx="78" cy="52" r="72" fill="${course.accent}" fill-opacity=".14" filter="url(#blur)"/>
    <text x="78" y="68" fill="#ffffff" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="46" font-weight="900">F.</text>
  </g>
</svg>`;

  response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.status(200).send(svg);
}
