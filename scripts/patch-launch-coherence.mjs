import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function update(relativePath, transform) {
  const file = path.join(root, relativePath);
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (!after || typeof after !== 'string') throw new Error(`Invalid launch patch output for ${relativePath}`);
  fs.writeFileSync(file, after);
}

update('src/main.tsx', (source) => {
  const oldLayouts = `function PublicLayout() { return <><a className="skip-link" href="#main-content">Skip to content</a><ConnectionStatus /><SiteHeader /><div id="main-content"><Outlet /></div><Footer /></>; }
function AppLayout() { return <div className="app-surface"><a className="skip-link" href="#main-content">Skip to content</a><ConnectionStatus /><SiteHeader app /><div id="main-content"><Outlet /></div></div>; }`;
  const newLayouts = `function syncDocumentMetadata(pathname: string, options: { title: string; description: string; noIndex?: boolean }) {
  const canonicalHref = \`https://finish-landing-nine.vercel.app\${pathname}\`;
  document.title = options.title;
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = options.description;
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (robots) robots.content = options.noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large';
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.href = canonicalHref;
  const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = options.title;
  const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
  if (ogDescription) ogDescription.content = options.description;
  const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = canonicalHref;
}

function PublicLayout() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === '/catalog') {
      syncDocumentMetadata('/catalog', {
        title: 'Course Catalog | FINISH',
        description: 'Browse 84 structured FINISH learning routes with ordered lectures, two mastery assessments, saved progress and an applied final project.',
      });
    } else if (!location.pathname.startsWith('/course/')) {
      syncDocumentMetadata('/', {
        title: 'FINISH — Complete the course',
        description: 'FINISH turns rigorous free courses into structured learning routes with ordered lessons, assessments, progress and a final project.',
      });
    }
  }, [location.pathname]);
  return <><a className="skip-link" href="#main-content">Skip to content</a><ConnectionStatus /><SiteHeader /><div id="main-content"><Outlet /></div><Footer /></>;
}

function AppLayout() {
  const location = useLocation();
  useEffect(() => {
    syncDocumentMetadata(location.pathname, {
      title: 'Your FINISH Workspace',
      description: 'Private FINISH account and learning workspace.',
      noIndex: true,
    });
  }, [location.pathname]);
  return <div className="app-surface"><a className="skip-link" href="#main-content">Skip to content</a><ConnectionStatus /><SiteHeader app /><div id="main-content"><Outlet /></div></div>;
}`;
  if (source.includes(oldLayouts)) source = source.replace(oldLayouts, newLayouts);

  const courseEffectMarker = `  }, [slug, user]);

  if (error) return <main className="page shell"><PageError message={error} /></main>;`;
  const courseEffectReplacement = `  }, [slug, user]);

  useEffect(() => {
    if (!course) return;
    syncDocumentMetadata(\`/course/\${course.slug}\`, {
      title: \`\${course.title} | FINISH\`,
      description: course.description,
    });
  }, [course]);

  if (error) return <main className="page shell"><PageError message={error} /></main>;`;
  if (source.includes(courseEffectMarker)) source = source.replace(courseEffectMarker, courseEffectReplacement);

  const authMarker = `  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, navigate, next]);

  const submit = async`;
  const authReplacement = `  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, navigate, next]);
  useEffect(() => {
    syncDocumentMetadata('/auth', {
      title: 'Sign in | FINISH',
      description: 'Sign in to your private FINISH learning account.',
      noIndex: true,
    });
  }, []);

  const submit = async`;
  if (source.includes(authMarker)) source = source.replace(authMarker, authReplacement);

  const required = [
    'function syncDocumentMetadata(',
    "robots.content = options.noIndex ? 'noindex,nofollow'",
    "title: 'Course Catalog | FINISH'",
    "title: 'Sign in | FINISH'",
    'title: `${course.title} | FINISH`',
  ];
  for (const marker of required) {
    if (!source.includes(marker)) throw new Error(`Route metadata patch is missing: ${marker}`);
  }
  return source;
});

update('src/pages/Learn.tsx', (source) => {
  const marker = `  const playerHost = useRef<HTMLDivElement | null>(null);

  useEffect(() => {`;
  const replacement = `  const playerHost = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = state?.course?.title ? \`\${state.course.title} · Learning | FINISH\` : 'Learning | FINISH';
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robots) robots.content = 'noindex,nofollow';
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = \`https://finish-landing-nine.vercel.app/learn/\${slug}\`;
  }, [slug, state?.course?.title]);

  useEffect(() => {`;
  if (source.includes(marker)) source = source.replace(marker, replacement);
  for (const required of ["robots.content = 'noindex,nofollow'", 'Learning | FINISH']) {
    if (!source.includes(required)) throw new Error(`Learning metadata patch is missing: ${required}`);
  }
  return source;
});

update('src/routes/catalog.ts', (source) => {
  source = source.replaceAll('Finance & Markets', 'Finance & Investing');
  source = source.replace(
    /function formatMoney\(course: Course\) \{[\s\S]*?\n\}\n\nfunction coverFor/,
    `function formatMoney(course: Course) {
  const price = (course.challenge_prices || []).find((item) =>
    item.active !== false && item.provider === 'paypal' && item.currency === 'USD'
  );
  const amount = Number(price?.amount ?? 1);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function coverFor`,
  );
  if (!source.includes("item.provider === 'paypal' && item.currency === 'USD'")) {
    throw new Error('Split catalog is not PayPal-only.');
  }
  if (source.includes('Finance & Markets') || source.includes("price.currency === 'INR'")) {
    throw new Error('Split catalog still contains regional payment logic.');
  }
  return source;
});

update('src/course-product.tsx', (source) => {
  source = source
    .replaceAll('Project submitted. The admin review queue now has something more useful than another payment row.', 'Project submitted for review.')
    .replaceAll('<Github />Repository', '<Github />Project submission')
    .replaceAll('<Github />Open repository <ExternalLink />', '<Github />Open project <ExternalLink />')
    .replaceAll('REPOSITORY URL', 'PROJECT OR REPOSITORY URL')
    .replaceAll('placeholder="https://github.com/you/project"', 'placeholder="https://your-project-link.example"')
    .replaceAll('ENGINEERING REFLECTION', 'PROJECT REFLECTION');

  const required = [
    'Project submitted for review.',
    'PROJECT OR REPOSITORY URL',
    'PROJECT REFLECTION',
    'Project submission',
    'Open project',
  ];
  for (const marker of required) {
    if (!source.includes(marker)) throw new Error(`Cross-category project copy is missing: ${marker}`);
  }
  for (const marker of ['ENGINEERING REFLECTION', '>REPOSITORY URL<', 'Open repository']) {
    if (source.includes(marker)) throw new Error(`Coding-only project copy remains: ${marker}`);
  }
  return source;
});

update('public/terms.html', (source) => {
  source = source.replace(
    'Public repository and live-project links remain governed by their hosting providers.',
    'Project, repository, document, and live-build links remain governed by their hosting providers.',
  );
  if (!source.includes('Project, repository, document, and live-build links')) {
    throw new Error('Terms do not cover cross-category project links.');
  }
  return source;
});

update('public/launch-discount.js', (source) => {
  source = source.replace(
    '<b>Founding launch</b><i></i><span>50% off every course route</span><i></i><span class="launch-worldwide">₹79 India · $1 worldwide</span>',
    '<b>Founding launch</b><i></i><span>50% off every course route</span><i></i><span class="launch-worldwide">$1 USD worldwide · one-time</span>',
  );
  source = source.replace("    if (/₹|INR/i.test(clean)) return { current: clean, compare: '₹159' };\n", '');
  source = source.replace(
    "    if (/\\$|USD|US\\$/i.test(clean)) return { current: clean, compare: '$2' };",
    "    if (/\\$|USD|US\\$/i.test(clean)) return { current: clean, compare: '$2 USD' };",
  );
  if (/[₹]|INR PRICE|₹79|India ·/.test(source)) throw new Error('Regional launch pricing remains.');
  if (!source.includes('$1 USD worldwide · one-time')) throw new Error('Global launch pricing is missing.');
  return source;
});

update('public/company-shell.js', (source) => {
  source = source.replace(
    'const fallbackStats = { courses: 64, lessons: 1753, quizzes: 128, questions: 2560, projects: 64 };',
    'const fallbackStats = { courses: 84, lessons: 2216, quizzes: 168, questions: 3360, projects: 84 };',
  );
  source = source.replace(
    'Focused routes across programming, systems, algorithms, mathematics, security and AI.',
    'Focused routes across finance, programming, systems, algorithms, mathematics, security and AI.',
  );
  if (!source.includes('href="/payments"')) {
    source = source.replace(
      '<a href="/refunds">Refund & cancellation</a>',
      '<a href="/refunds">Refund & cancellation</a>\n            <a href="/payments">Payment policy</a>\n            <a href="/cookies">Cookie & storage policy</a>\n            <a href="/acceptable-use">Acceptable use</a>\n            <a href="/content-copyright">Content & copyright</a>',
    );
  }
  if (!source.includes('courses: 84, lessons: 2216, quizzes: 168, questions: 3360, projects: 84')) {
    throw new Error('Launch fallback statistics are stale.');
  }
  for (const route of ['/payments', '/cookies', '/acceptable-use', '/content-copyright']) {
    if (!source.includes(`href="${route}"`)) throw new Error(`Company footer is missing ${route}`);
  }
  return source;
});

console.log('FINISH launch coherence patch applied.');
