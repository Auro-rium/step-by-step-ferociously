import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../src/main.tsx', import.meta.url);
let source = await readFile(file, 'utf8');

function replaceRequired(pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Catalog patch could not find ${label}.`);
  source = source.replace(pattern, replacement);
}

if (!source.includes("import './catalog.css';")) {
  source = source.replace("import './styles.css';", "import './styles.css';\nimport './catalog.css';");
}

if (!source.includes('Search, X,')) {
  replaceRequired(
    /import \{ ArrowLeft,([\s\S]*?) WalletCards \} from 'lucide-react';/,
    "import { ArrowLeft,$1 WalletCards, Search, X } from 'lucide-react';",
    'the Lucide icon import',
  );
}

const categoryBlock = `const CATALOG_CATEGORY_ORDER = [
  'All courses',
  'Finance & Investing',
  'AI & Machine Learning',
  'Programming & Web',
  'Systems & Architecture',
  'Algorithms & Data Structures',
  'Databases',
  'Mathematics & Statistics',
  'Cybersecurity',
] as const;

const CATALOG_SEARCH_ALIASES: Record<string, string> = {
  'Finance & Investing': 'finance financial markets investing investment corporate finance valuation accounting portfolio asset pricing stocks bonds options derivatives capital budgeting fintech blockchain money banking public finance',
  'AI & Machine Learning': 'ai ml llm machine learning deep learning neural networks transformers nlp computer vision reinforcement learning generative models data science',
  'Programming & Web': 'programming coding software development python javascript web django html css git developer tools computer science foundations',
  'Systems & Architecture': 'operating systems distributed systems architecture hardware cpu memory networks performance graphics nand2tetris systems engineering',
  'Algorithms & Data Structures': 'algorithms data structures complexity graphs trees hashing dynamic programming problem solving',
  Databases: 'database databases db sql relational storage indexing query optimization transactions concurrency recovery',
  'Mathematics & Statistics': 'mathematics maths probability statistics linear algebra matrices signals inference stochastic',
  Cybersecurity: 'cybersecurity security cryptography privacy threats incident response risk linux networks',
};

function normalizeCatalogText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .trim();
}

function courseCategory(course: Challenge) {
  const value = normalizeCatalogText(\`${'${course.slug} ${course.title} ${course.source_title || \'\'}'}\`);
  if (/(finance|financial|accounting|valuation|investing|investment|portfolio|asset pricing|capital market|corporate life cycle|fintech|blockchain and money|banking|public finance)/.test(value)) return 'Finance & Investing';
  if (/(artificial intelligence|machine learning|deep learning|computer vision|reinforcement learning|natural language|language model|large language|neural network|transformer|generative|meta learning|tensorflow|fast ai|karpathy)/.test(value)) return 'AI & Machine Learning';
  if (/(cybersecurity|computer systems security|cryptography|cryptanalysis)/.test(value)) return 'Cybersecurity';
  if (/(database|dbms)/.test(value)) return 'Databases';
  if (/(linear algebra|probability|statistics|mathematics|matrix methods|signals and systems|probabilistic systems)/.test(value)) return 'Mathematics & Statistics';
  if (/(algorithm|data structures)/.test(value)) return 'Algorithms & Data Structures';
  if (/(operating system|distributed system|computation structures|computer architecture|system engineering|performance engineering|computer graphics|nand2tetris)/.test(value)) return 'Systems & Architecture';
  return 'Programming & Web';
}

function courseSearchText(course: Challenge) {
  const category = courseCategory(course);
  return normalizeCatalogText([
    course.slug,
    course.title,
    course.description || '',
    course.outcome || '',
    course.source_title || '',
    course.source_channel || '',
    course.difficulty || '',
    category,
    CATALOG_SEARCH_ALIASES[category] || '',
  ].join(' '));
}`;

if (!source.includes('const CATALOG_CATEGORY_ORDER')) {
  replaceRequired(
    /function courseCategory\(course: Challenge\) \{[\s\S]*?\n\}\n\nfunction courseCoverData/,
    `${categoryBlock}\n\nfunction courseCoverData`,
    'the course category classifier',
  );
}

if (!source.includes("'Finance & Investing': ['#071a17'")) {
  replaceRequired(
    /const palettes: Record<string, \[string, string, string\]> = \{\n/,
    "const palettes: Record<string, [string, string, string]> = {\n    'Finance & Investing': ['#071a17', '#18a875', '#f3c969'],\n",
    'the course artwork palette',
  );
}

source = source.replace("const [category, setCategory] = useState('All');", "const [category, setCategory] = useState('All courses');");

const catalogFilterBlock = `const categoryCounts = useMemo(() => courses.reduce<Record<string, number>>((counts, course) => {
    const item = courseCategory(course);
    counts[item] = (counts[item] || 0) + 1;
    return counts;
  }, {}), [courses]);
  const categories = useMemo(() => CATALOG_CATEGORY_ORDER.filter((item) => item === 'All courses' || (categoryCounts[item] || 0) > 0), [categoryCounts]);
  const visibleCourses = useMemo(() => {
    const terms = normalizeCatalogText(query).split(' ').filter(Boolean);
    return courses.filter((course) => {
      const matchesCategory = category === 'All courses' || courseCategory(course) === category;
      const haystack = courseSearchText(course);
      return matchesCategory && terms.every((term) => haystack.includes(term));
    });
  }, [courses, query, category]);`;

if (!source.includes('const categoryCounts = useMemo')) {
  replaceRequired(
    /const categories = useMemo\(\(\) => \['All',[\s\S]*?\}, \[courses, query, category\]\);/,
    catalogFilterBlock,
    'the catalog filtering block',
  );
}

const toolbarBlock = `<section className="catalog-toolbar" aria-label="Course filters">
        <div className="catalog-toolbar-heading">
          <div><span>FIND YOUR ROUTE</span><p>Search the complete catalog by topic, skill, institution or course name.</p></div>
          <strong>{courses.length} courses</strong>
        </div>
        <div className="catalog-search-shell">
          <Search size={21} aria-hidden="true" />
          <input className="catalog-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try valuation, Python, distributed systems, MIT…" aria-label="Search the full course catalog" autoComplete="off" />
          {query ? <button className="catalog-search-clear catalog-clear" type="button" onClick={() => setQuery('')} aria-label="Clear course search"><X size={17} /></button> : <span className="catalog-search-scope">TITLE · TOPIC · SOURCE</span>}
        </div>
        <div className="catalog-category-heading"><div><span>BROWSE BY FIELD</span><p>Pick a category or scroll to see every field.</p></div><small>Use arrows, mouse wheel, trackpad or touch</small></div>
        <div className="category-rail-shell">
          <button className="category-scroll-button" type="button" aria-label="Scroll categories left" onClick={() => document.querySelector<HTMLElement>('.category-chips')?.scrollBy({ left: -360, behavior: 'smooth' })}><ChevronLeft size={19} /></button>
          <div className="category-chips" role="list" aria-label="Course categories" tabIndex={0}>{categories.map((item) => <button key={item} type="button" className={\`category-chip ${'${category === item ? \'active\' : \'\'}'}\`} onClick={() => setCategory(item)} aria-pressed={category === item}><span>{item}</span><b>{item === 'All courses' ? courses.length : categoryCounts[item] || 0}</b></button>)}</div>
          <button className="category-scroll-button" type="button" aria-label="Scroll categories right" onClick={() => document.querySelector<HTMLElement>('.category-chips')?.scrollBy({ left: 360, behavior: 'smooth' })}><ChevronRight size={19} /></button>
        </div>
      </section>
      <div className="catalog-result-line"><span>{visibleCourses.length} of {courses.length} courses</span><span>{query.trim() ? \`Search: “${'${query.trim()}'}”\` : category}</span></div>`;

if (!source.includes('category-rail-shell')) {
  replaceRequired(
    /<section className="catalog-toolbar" aria-label="Course filters">[\s\S]*?<div className="catalog-result-line">[\s\S]*?<\/div>/,
    toolbarBlock,
    'the catalog toolbar',
  );
}

source = source.replace("setCategory('All');", "setCategory('All courses');");
source = source.replaceAll("theme: { color: '#7c5cff' }", "theme: { color: '#c47a45' }");

const requiredMarkers = [
  "import './catalog.css';",
  'const CATALOG_CATEGORY_ORDER',
  "'Finance & Investing'",
  "useState('All courses')",
  'const categoryCounts = useMemo',
  'catalog-toolbar-heading',
  'category-rail-shell',
  'Search, X',
];
for (const marker of requiredMarkers) {
  if (!source.includes(marker)) throw new Error(`Catalog patch verification failed for ${marker}.`);
}
if (source.includes("theme: { color: '#7c5cff' }")) {
  throw new Error('Legacy purple Razorpay theme is still present.');
}

await writeFile(file, source);
