from pathlib import Path

main_path = Path('src/main.tsx')
styles_path = Path('src/styles.css')
index_path = Path('index.html')
main = main_path.read_text()
styles = styles_path.read_text()
index = index_path.read_text()

# 1. Add short-lived read cache for public/product route data.
cache_marker = "// FINISH product-read cache"
if cache_marker not in main:
    anchor = "function withTimeout<T>(promise: PromiseLike<T>, ms = 8000, label = 'Request'): Promise<T> {"
    cache = """// FINISH product-read cache\ntype CacheEntry<T> = { expiresAt: number; promise: Promise<T> };\nconst productReadCache = new Map<string, CacheEntry<unknown>>();\n\nfunction cachedRead<T>(key: string, loader: () => Promise<T>, ttlMs = 30000): Promise<T> {\n  const now = Date.now();\n  const cached = productReadCache.get(key) as CacheEntry<T> | undefined;\n  if (cached && cached.expiresAt > now) return cached.promise;\n  const promise = loader().catch((error) => { productReadCache.delete(key); throw error; });\n  productReadCache.set(key, { expiresAt: now + ttlMs, promise } as CacheEntry<unknown>);\n  return promise;\n}\n\nfunction prefetchCourse(slug: string) { void getCourse(slug).catch(() => undefined); }\n\n"""
    main = main.replace(anchor, cache + anchor)

# Wrap stable read APIs in cache without touching checkout/payment behavior.
old_catalog = "export async function getCatalog(): Promise<Challenge[]> {\n  const result = await withTimeout("
new_catalog = "export async function getCatalog(): Promise<Challenge[]> {\n  return cachedRead('catalog', async () => {\n  const result = await withTimeout("
if old_catalog in main:
    main = main.replace(old_catalog, new_catalog, 1)
    main = main.replace("  return (result.data ?? []) as Challenge[];\n}\n\nexport async function getCourse", "  return (result.data ?? []) as Challenge[];\n  }, 45000);\n}\n\nexport async function getCourse", 1)

old_course = "export async function getCourse(slug: string): Promise<Challenge> {\n  const result = await withTimeout("
new_course = "export async function getCourse(slug: string): Promise<Challenge> {\n  return cachedRead(`course:${slug}`, async () => {\n  const result = await withTimeout("
if old_course in main:
    main = main.replace(old_course, new_course, 1)
    main = main.replace("  return result.data as Challenge;\n}\n\nexport async function getEnrollment", "  return result.data as Challenge;\n  }, 60000);\n}\n\nexport async function getEnrollment", 1)

old_route = "export async function getLearningRoute(slug: string): Promise<LearningState> {\n  const result = await withTimeout("
new_route = "export async function getLearningRoute(slug: string): Promise<LearningState> {\n  return cachedRead(`learning-route:${slug}`, async () => {\n  const result = await withTimeout("
if old_route in main:
    main = main.replace(old_route, new_route, 1)
    main = main.replace("  return data;\n}\n\nexport async function getAdminData", "  return data;\n  }, 12000);\n}\n\nexport async function getAdminData", 1)

# 2. Premium loading state and connection recovery.
old_loader = "function PageLoader({ label = 'Loading FINISH' }: { label?: string }) {\n  return <div className=\"page-loader\"><LoaderCircle size={22} className=\"spin\" /><span>{label}</span></div>;\n}"
new_loader = """function PageLoader({ label = 'Loading FINISH' }: { label?: string }) {\n  return <main className=\"loading-shell\" aria-live=\"polite\" aria-busy=\"true\"><div className=\"loading-brand\">FINISH<span>.</span></div><div className=\"loading-skeleton\"><span /><span /><span /></div><div className=\"loading-status\"><LoaderCircle size={18} className=\"spin\" /><span>{label}</span></div></main>;\n}\n\nfunction ConnectionStatus() {\n  const [online, setOnline] = useState(() => navigator.onLine);\n  useEffect(() => {\n    const update = () => setOnline(navigator.onLine);\n    window.addEventListener('online', update);\n    window.addEventListener('offline', update);\n    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };\n  }, []);\n  return online ? null : <div className=\"connection-banner\" role=\"status\">You are offline. FINISH will reconnect automatically.</div>;\n}"""
if old_loader in main:
    main = main.replace(old_loader, new_loader, 1)

# 3. Better fatal recovery.
main = main.replace(
    '<button className="button button-primary" onClick={() => window.location.reload()}>Reload FINISH</button>',
    '<div className="fatal-actions"><button className="button button-primary" onClick={() => window.location.reload()}>Reload FINISH</button><a className="button button-soft" href="/">Return home</a></div>',
    1,
)

# 4. Prefetch course routes from product cards and owned course cards.
main = main.replace(
    '<Link className="button button-primary" to={owned ? `/learn/${course.slug}` : `/course/${course.slug}`}>',
    '<Link className="button button-primary" onMouseEnter={() => prefetchCourse(course.slug)} onFocus={() => prefetchCourse(course.slug)} to={owned ? `/learn/${course.slug}` : `/course/${course.slug}`}>',
)
main = main.replace(
    '<Link className="button button-acid" to={`/learn/${course.slug}`}>',
    '<Link className="button button-acid" onMouseEnter={() => void getLearningRoute(course.slug).catch(() => undefined)} onFocus={() => void getLearningRoute(course.slug).catch(() => undefined)} to={`/learn/${course.slug}`}>',
)

# 5. Add global connection banner and skip link without modifying business logic.
main = main.replace(
    "function PublicLayout() { return <><SiteHeader /><Outlet /><Footer /></>; }",
    "function PublicLayout() { return <><a className=\"skip-link\" href=\"#main-content\">Skip to content</a><ConnectionStatus /><SiteHeader /><div id=\"main-content\"><Outlet /></div><Footer /></>; }",
)
main = main.replace(
    "function AppLayout() { return <div className=\"app-surface\"><SiteHeader app /><Outlet /></div>; }",
    "function AppLayout() { return <div className=\"app-surface\"><a className=\"skip-link\" href=\"#main-content\">Skip to content</a><ConnectionStatus /><SiteHeader app /><div id=\"main-content\"><Outlet /></div></div>; }",
)

# 6. Static production metadata and assets.
if 'property="og:title"' not in index:
    index = index.replace(
        '<meta name="description" content="FINISH turns serious YouTube courses into structured learning routes with quizzes, progress and a clear outcome." />',
        '<meta name="description" content="FINISH turns serious YouTube courses into structured learning routes with quizzes, progress and a clear outcome." />\n    <meta name="robots" content="index,follow,max-image-preview:large" />\n    <meta name="application-name" content="FINISH" />\n    <meta property="og:type" content="website" />\n    <meta property="og:title" content="FINISH — Complete the course" />\n    <meta property="og:description" content="Structured learning routes built on excellent YouTube courses. Ordered lessons, quizzes, saved progress and a clear finish line." />\n    <meta property="og:url" content="https://finish-landing-nine.vercel.app/" />\n    <meta name="twitter:card" content="summary_large_image" />\n    <link rel="canonical" href="https://finish-landing-nine.vercel.app/" />\n    <link rel="manifest" href="/manifest.webmanifest" />',
    )

# 7. Product-wide polish CSS. Append-only, scoped and reversible.
css_marker = '/* FINISH v1 non-payment readiness */'
if css_marker not in styles:
    styles += r'''

/* FINISH v1 non-payment readiness */
html { scroll-behavior: smooth; }
body { overflow-x: hidden; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
button, a, input, textarea, select { -webkit-tap-highlight-color: transparent; }
:focus-visible { outline: 2px solid #c8ff2e; outline-offset: 3px; }
.skip-link { position: fixed; top: 12px; left: 12px; z-index: 9999; transform: translateY(-160%); padding: 10px 14px; border-radius: 10px; background: #c8ff2e; color: #09090a; font-weight: 800; }
.skip-link:focus { transform: translateY(0); }
.connection-banner { position: fixed; left: 50%; bottom: 18px; z-index: 9998; transform: translateX(-50%); width: min(92vw, 560px); padding: 12px 16px; border: 1px solid rgba(255,255,255,.16); border-radius: 14px; background: rgba(18,18,22,.96); color: #f3f3f0; text-align: center; box-shadow: 0 18px 60px rgba(0,0,0,.4); backdrop-filter: blur(18px); }
.loading-shell { min-height: 72vh; display: grid; place-content: center; justify-items: center; gap: 24px; padding: 40px 24px; background: radial-gradient(circle at 50% 40%, rgba(124,92,255,.13), transparent 42%); }
.loading-brand { font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 900; letter-spacing: -.06em; }
.loading-brand span { color: #c8ff2e; }
.loading-skeleton { width: min(82vw, 540px); display: grid; gap: 12px; }
.loading-skeleton span { display: block; height: 16px; border-radius: 999px; background: linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.15), rgba(255,255,255,.06)); background-size: 220% 100%; animation: finish-shimmer 1.35s linear infinite; }
.loading-skeleton span:nth-child(2) { width: 78%; }
.loading-skeleton span:nth-child(3) { width: 58%; }
.loading-status { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,.68); font-size: .92rem; }
.fatal-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
@keyframes finish-shimmer { to { background-position: -220% 0; } }
.course-card, .owned-card, .method-grid article, .value-card, .panel { contain: layout paint; }
.course-card, .owned-card, .method-grid article { transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease; }
@media (hover: hover) {
  .course-card:hover, .owned-card:hover, .method-grid article:hover { transform: translateY(-4px); border-color: rgba(200,255,46,.28); box-shadow: 0 22px 65px rgba(0,0,0,.28); }
}
@media (max-width: 720px) {
  .shell { width: min(100% - 28px, var(--shell, 1180px)); }
  .site-header { position: sticky; top: 0; backdrop-filter: blur(18px); }
  .header-inner { min-height: 66px; }
  .header-actions .button { min-height: 42px; padding-inline: 14px; }
  .hero { padding-top: 54px; }
  .hero-copy h1 { text-wrap: balance; }
  .trust-row { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .page-hero h1, .dashboard-hero h1, .course-hero-copy h1 { text-wrap: balance; }
  .catalog-grid, .owned-grid { gap: 18px; }
  .card-bottom, .owned-card-copy > div { align-items: stretch; }
  .card-bottom .button, .owned-card-copy .button { width: 100%; justify-content: center; }
  .fatal-actions { flex-direction: column; }
  .fatal-actions > * { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
'''

main_path.write_text(main)
styles_path.write_text(styles)
index_path.write_text(index)

public = Path('public')
public.mkdir(exist_ok=True)
(public / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: https://finish-landing-nine.vercel.app/sitemap.xml\n')
(public / 'sitemap.xml').write_text('''<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://finish-landing-nine.vercel.app/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n  <url><loc>https://finish-landing-nine.vercel.app/catalog</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n</urlset>\n''')
(public / 'manifest.webmanifest').write_text('''{\n  "name": "FINISH",\n  "short_name": "FINISH",\n  "description": "Structured learning routes built on excellent YouTube courses.",\n  "start_url": "/",\n  "display": "standalone",\n  "background_color": "#0b0b0c",\n  "theme_color": "#0b0b0c",\n  "icons": []\n}\n''')
