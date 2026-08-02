import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../src/main.tsx', import.meta.url);
let source = await readFile(file, 'utf8');

function replaceRequired(pattern, replacement, label) {
  if (typeof pattern === 'string') {
    if (!source.includes(pattern)) throw new Error(`Performance patch could not find ${label}.`);
    source = source.replace(pattern, replacement);
    return;
  }
  if (!pattern.test(source)) throw new Error(`Performance patch could not find ${label}.`);
  source = source.replace(pattern, replacement);
}

if (!source.includes('function readSessionCache<T>')) {
  replaceRequired(
    'function prefetchCourse(slug: string) { void getCourse(slug).catch(() => undefined); }',
    `function readSessionCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; value?: T };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > maxAgeMs) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

function writeSessionCache<T>(key: string, value: T) {
  try { window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value })); }
  catch { /* Storage may be unavailable in strict privacy modes. */ }
}

function primeRead<T>(key: string, value: T, ttlMs = 60000) {
  productReadCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    promise: Promise.resolve(value),
  } as CacheEntry<unknown>);
}

function prefetchCourse(slug: string) { void getCourse(slug).catch(() => undefined); }`,
    'the product cache helpers',
  );
}

if (!source.includes('const CATALOG_SELECT =')) {
  replaceRequired(
    /export async function getProfile\(userId: string\): Promise<Profile \| null> \{[\s\S]*?\n\}\n\nexport async function getCatalog/,
    `export async function getProfile(userId: string): Promise<Profile | null> {
  const result = await withTimeout(
    supabase.from('profiles').select('id, display_name, role, current_streak').eq('id', userId).maybeSingle(),
    6000,
    'Profile',
  );
  if (result.error) throw result.error;
  return result.data as Profile | null;
}

const CATALOG_SELECT = 'id, slug, title, description, outcome, eyebrow, duration_label, cover_image_url, youtube_playlist_id, lesson_count, total_xp, status, is_featured, created_at, source_title, source_channel, source_url, difficulty, project_required, quiz_count, route_ready, challenge_prices(id, challenge_id, provider, currency, amount, active, compare_at_amount, promotion_label, promotion_starts_at, promotion_ends_at)';
const CATALOG_SESSION_KEY = 'finish:catalog:v3';

export async function getCatalog`,
    'the profile and catalog API boundary',
  );

  replaceRequired(
    /export async function getCatalog\(\): Promise<Challenge\[]> \{[\s\S]*?\n\}\n\nexport async function getCourse/,
    `export async function getCatalog(): Promise<Challenge[]> {
  return cachedRead('catalog', async () => {
    const stored = readSessionCache<Challenge[]>(CATALOG_SESSION_KEY, 5 * 60 * 1000);
    if (stored?.length) {
      stored.forEach((course) => primeRead(\`course:\${course.slug}\`, course, 5 * 60 * 1000));
      return stored;
    }

    const result = await withTimeout(
      supabase
        .from('challenges')
        .select(CATALOG_SELECT)
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: true }),
      9000,
      'Catalog',
    );
    if (result.error) throw result.error;
    const courses = (result.data ?? []) as unknown as Challenge[];
    courses.forEach((course) => primeRead(\`course:\${course.slug}\`, course, 5 * 60 * 1000));
    writeSessionCache(CATALOG_SESSION_KEY, courses);
    return courses;
  }, 5 * 60 * 1000);
}

export async function getCourse`,
    'the catalog read path',
  );

  replaceRequired(
    /export async function getCourse\(slug: string\): Promise<Challenge> \{[\s\S]*?\n\}\n\nexport async function getEnrollment/,
    `export async function getCourse(slug: string): Promise<Challenge> {
  return cachedRead(\`course:\${slug}\`, async () => {
    const result = await withTimeout(
      supabase.from('challenges').select(CATALOG_SELECT).eq('slug', slug).eq('status', 'published').single(),
      9000,
      'Course',
    );
    if (result.error) throw result.error;
    return result.data as unknown as Challenge;
  }, 5 * 60 * 1000);
}

export async function getEnrollment`,
    'the course read path',
  );

  replaceRequired(
    "supabase.from('enrollments').select('*').eq('user_id', userId).eq('challenge_id', challengeId).maybeSingle()",
    "supabase.from('enrollments').select('id, user_id, challenge_id, access_status, enrolled_at').eq('user_id', userId).eq('challenge_id', challengeId).maybeSingle()",
    'the course access query',
  );

  replaceRequired(
    /export async function getDashboard\(userId: string\) \{[\s\S]*?\n\}\n\nexport async function getLearningData/,
    `export async function getDashboard(_userId: string) {
  const result = await withTimeout(
    supabase.rpc('get_dashboard_fast'),
    9000,
    'Dashboard',
  );
  if (result.error) throw result.error;
  const data = (result.data ?? {}) as {
    enrollments?: Enrollment[];
    xp?: XpEvent[];
    attempts?: QuizAttempt[];
    progress?: VideoProgress[];
  };
  return {
    enrollments: data.enrollments ?? [],
    xp: data.xp ?? [],
    attempts: data.attempts ?? [],
    progress: data.progress ?? [],
  };
}

export async function getLearningData`,
    'the dashboard read path',
  );
}

if (!source.includes('const courseCoverCache = new Map')) {
  replaceRequired(
    'function courseCoverData(course: Challenge) {',
    `const courseCoverCache = new Map<string, string>();

function courseCoverData(course: Challenge) {
  const cacheKey = \`\${course.id}:\${course.title}:\${courseCategory(course)}\`;
  const cachedCover = courseCoverCache.get(cacheKey);
  if (cachedCover) return cachedCover;`,
    'the course artwork generator',
  );
  replaceRequired(
    '  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;\n}',
    `  const cover = \`data:image/svg+xml;charset=UTF-8,\${encodeURIComponent(svg)}\`;
  courseCoverCache.set(cacheKey, cover);
  return cover;
}`,
    'the generated artwork return value',
  );
}

source = source.replace(
  '<img src={cover} alt="" loading="lazy" decoding="async" />',
  '<img src={cover} alt="" width="1200" height="675" loading="lazy" decoding="async" fetchPriority="low" />',
);

const catalogStart = source.indexOf('function Catalog() {');
const catalogEnd = source.indexOf('// ---- src/pages/Course.tsx ----', catalogStart);
if (catalogStart < 0 || catalogEnd < 0) throw new Error('Performance patch could not isolate the catalog component.');
let catalogSource = source.slice(catalogStart, catalogEnd);

if (!catalogSource.includes('const [visibleLimit, setVisibleLimit]')) {
  const categoryState = "  const [category, setCategory] = useState('All courses');";
  if (!catalogSource.includes(categoryState)) throw new Error('Performance patch could not find the catalog category state.');
  catalogSource = catalogSource.replace(categoryState, `${categoryState}\n  const [visibleLimit, setVisibleLimit] = useState(24);`);

  const effectPattern = /  useEffect\(\(\) => \{\n    let active = true;[\s\S]*?\n  \}, \[user\]\);/;
  if (!effectPattern.test(catalogSource)) throw new Error('Performance patch could not find the catalog loading effect.');
  catalogSource = catalogSource.replace(effectPattern, `  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setError('');
        const accessRequest = user
          ? withTimeout(
              supabase.from('enrollments').select('id, user_id, challenge_id, access_status, enrolled_at').eq('user_id', user.id),
              6000,
              'Catalog access',
            )
          : Promise.resolve({ data: [] as Enrollment[], error: null });
        const [rows, accessResult] = await Promise.all([getCatalog(), accessRequest]);
        if (accessResult.error) throw accessResult.error;
        const map = new Map(((accessResult.data ?? []) as Enrollment[]).map((row) => [row.challenge_id, row]));
        if (active) { setCourses(rows); setEnrollments(map); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'The catalog could not load.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);`);

  const filterPattern = /(  const visibleCourses = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[courses, query, category\]\);)/;
  if (!filterPattern.test(catalogSource)) throw new Error('Performance patch could not find the catalog filtering result.');
  catalogSource = catalogSource.replace(filterPattern, `$1

  useEffect(() => { setVisibleLimit(24); }, [query, category]);
  const renderedCourses = visibleCourses.slice(0, visibleLimit);`);

  const grid = '<section className="catalog-grid">{visibleCourses.map((course) => <CourseCard key={course.id} course={course} enrollment={enrollments.get(course.id)} />)}</section>';
  if (!catalogSource.includes(grid)) throw new Error('Performance patch could not find the catalog course grid.');
  catalogSource = catalogSource.replace(grid, `<>
      <section className="catalog-grid">{renderedCourses.map((course) => <CourseCard key={course.id} course={course} enrollment={enrollments.get(course.id)} />)}</section>
      {renderedCourses.length < visibleCourses.length && <div className="catalog-load-more"><button type="button" className="button button-soft" onClick={() => setVisibleLimit((limit) => Math.min(limit + 24, visibleCourses.length))}>Show more courses</button><span>{renderedCourses.length} of {visibleCourses.length} rendered</span></div>}
    </>`);
}

source = source.slice(0, catalogStart) + catalogSource + source.slice(catalogEnd);

const requiredMarkers = [
  'const CATALOG_SELECT =',
  "supabase.rpc('get_dashboard_fast')",
  'const courseCoverCache = new Map',
  'const [visibleLimit, setVisibleLimit] = useState(24)',
  'const renderedCourses = visibleCourses.slice(0, visibleLimit)',
  'catalog-load-more',
  'fetchPriority="low"',
  "finish:catalog:v3",
];
for (const marker of requiredMarkers) {
  if (!source.includes(marker)) throw new Error(`Performance patch verification failed for ${marker}.`);
}

await writeFile(file, source);
