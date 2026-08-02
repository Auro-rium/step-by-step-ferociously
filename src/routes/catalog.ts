import '../styles.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ijkdhrznxukawugeoocs.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kwSezylj6T63a7nIMtuxcg_0bQWm6-8';
const SESSION_KEY = 'sb-ijkdhrznxukawugeoocs-auth-token';
const INITIAL_COURSE_COUNT = 24;

type Price = { provider: string; currency: string; amount: number; active?: boolean };
type Course = {
  id: string;
  slug: string;
  title: string;
  description: string;
  outcome?: string | null;
  eyebrow?: string | null;
  duration_label?: string | null;
  cover_image_url?: string | null;
  lesson_count?: number | null;
  source_title?: string | null;
  source_channel?: string | null;
  difficulty?: string | null;
  route_ready?: boolean | null;
  challenge_prices?: Price[];
};
type SessionInfo = { accessToken: string; userId: string } | null;

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character] || character));
}

function getSession(): SessionInfo {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as {
      access_token?: string;
      expires_at?: number;
      user?: { id?: string };
      currentSession?: { access_token?: string; expires_at?: number; user?: { id?: string } };
    };
    const session = value.currentSession ?? value;
    if (!session.access_token || !session.user?.id) return null;
    if (session.expires_at && session.expires_at * 1000 <= Date.now()) return null;
    return { accessToken: session.access_token, userId: session.user.id };
  } catch {
    return null;
  }
}

function courseCategory(course: Course) {
  const value = `${course.slug} ${course.title} ${course.description} ${course.source_title || ''}`.toLowerCase();
  if (/(finance|financial|valuation|accounting|investment|fintech|blockchain|markets|money)/.test(value)) return 'Finance & Markets';
  if (/(cyber|security|cryptograph)/.test(value)) return 'Cybersecurity';
  if (/(database|sql|postgres)/.test(value)) return 'Databases';
  if (/(algorithm|data structure|data-structure)/.test(value)) return 'Algorithms & Data Structures';
  if (/(linear algebra|probabil|statistics|mathematics|matrix|calculus|signals)/.test(value)) return 'Mathematics & Statistics';
  if (/(operating system|distributed|architecture|computer system|computation structure|performance engineering|graphics|network)/.test(value)) return 'Systems & Architecture';
  if (/(artificial intelligence|machine learning|deep learning|neural|language model|transformer|computer vision|reinforcement|nlp|meta learning)/.test(value)) return 'AI & Machine Learning';
  return 'Programming & Web';
}

function formatMoney(course: Course) {
  const prices = (course.challenge_prices || []).filter((price) => price.active !== false);
  const usd = prices.find((price) => price.currency === 'USD');
  const inr = prices.find((price) => price.currency === 'INR');
  const price = usd || inr || prices[0];
  if (!price) return 'View course';
  try {
    return new Intl.NumberFormat(price.currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency', currency: price.currency, maximumFractionDigits: price.currency === 'INR' ? 0 : 2,
    }).format(Number(price.amount));
  } catch {
    return `${price.currency} ${price.amount}`;
  }
}

function coverFor(course: Course) {
  if (course.cover_image_url) return course.cover_image_url;
  const category = courseCategory(course);
  const initials = course.title.split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]).join('').toUpperCase();
  const title = escapeHtml(course.title);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#10100d"/><stop offset="1" stop-color="#040403"/></linearGradient><radialGradient id="r"><stop stop-color="#b86f3d" stop-opacity=".5"/><stop offset="1" stop-color="#0b0b09" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="675" fill="url(#g)"/><circle cx="930" cy="180" r="340" fill="url(#r)"/><path d="M760 100h330v330H760zM815 155h220v220H815z" fill="none" stroke="#b86f3d" stroke-width="4" opacity=".55"/><text x="70" y="95" fill="#b86f3d" font-family="Arial" font-size="22" font-weight="700">${escapeHtml(category).toUpperCase()}</text><foreignObject x="70" y="170" width="700" height="330"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#f4efe5;font:700 58px/1.04 Arial,sans-serif;display:flex;align-items:flex-end;height:100%">${title}</div></foreignObject><text x="70" y="610" fill="#a9b56b" font-family="Arial" font-size="24" font-weight="700">LECTURES • 2 QUIZZES • FLAGSHIP PROJECT</text><text x="1100" y="610" text-anchor="end" fill="#fff" opacity=".1" font-family="Arial" font-size="110" font-weight="900">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function fetchJson<T>(path: string, accessToken = SUPABASE_KEY): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

function setMeta() {
  document.title = 'Course Catalog | FINISH';
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = 'Browse structured FINISH course routes with ordered lectures, two 20-question assessments and a required flagship project.';
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.href = 'https://finish-landing-nine.vercel.app/catalog';
}

export async function mountCatalog() {
  const root = document.getElementById('root');
  if (!root) throw new Error('FINISH root element is missing.');
  setMeta();
  const session = getSession();
  const accountLink = session
    ? '<a class="button button-soft" href="/app">My learning <span aria-hidden="true">↗</span></a>'
    : '<a class="button button-dark" href="/auth">Sign in <span aria-hidden="true">↗</span></a>';

  root.innerHTML = `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header"><div class="shell header-inner"><a href="/" class="brand">FINISH<span>.</span></a><nav class="desktop-nav" aria-label="Primary navigation"><a href="/catalog" aria-current="page">Courses</a><a href="/#method">How it works</a><a href="/why">Why FINISH</a></nav><div class="header-actions">${accountLink}</div></div></header>
    <main id="main-content" class="page shell">
      <header class="page-hero"><p class="eyebrow">THE CATALOG</p><h1>Choose one thing worth finishing.</h1><p>Structured learning routes built around strong free courses. Ordered lectures, two 20-question assessments and a required flagship project.</p></header>
      <section class="catalog-loading panel" aria-live="polite"><p class="eyebrow">LOADING COURSES</p><h2>Building the current catalog…</h2></section>
    </main>
    <footer class="footer"><div class="shell footer-inner"><a href="/" class="brand">FINISH<span>.</span></a><p>One route. Two assessments. One finished outcome.</p><span>© ${new Date().getFullYear()} FINISH</span></div></footer>`;

  const select = 'id,slug,title,description,outcome,eyebrow,duration_label,cover_image_url,lesson_count,source_title,source_channel,difficulty,route_ready,challenge_prices(provider,currency,amount,active)';
  const catalogPath = `/rest/v1/challenges?select=${encodeURIComponent(select)}&status=eq.published&order=is_featured.desc,created_at.asc`;

  try {
    const coursesPromise = fetchJson<Course[]>(catalogPath);
    const enrollmentsPromise = session
      ? fetchJson<Array<{ challenge_id: string; access_status: string }>>(`/rest/v1/enrollments?select=challenge_id,access_status&user_id=eq.${encodeURIComponent(session.userId)}&access_status=in.(paid,granted)`, session.accessToken).catch(() => [])
      : Promise.resolve([]);
    const [courses, enrollments] = await Promise.all([coursesPromise, enrollmentsPromise]);
    const owned = new Set(enrollments.map((row) => row.challenge_id));
    const main = root.querySelector<HTMLElement>('#main-content');
    if (!main) return;

    let query = '';
    let category = 'All courses';
    let visibleLimit = INITIAL_COURSE_COUNT;
    const counts = new Map<string, number>();
    for (const course of courses) counts.set(courseCategory(course), (counts.get(courseCategory(course)) || 0) + 1);
    const categories = ['All courses', ...Array.from(counts.keys()).sort()];

    main.innerHTML = `
      <header class="page-hero"><p class="eyebrow">THE CATALOG</p><h1>Choose one thing worth finishing.</h1><p>Structured learning routes built around strong free courses. Ordered lectures, two 20-question assessments and a required flagship project.</p></header>
      <section class="catalog-toolbar" aria-label="Course filters">
        <div class="catalog-search-wrap"><input class="catalog-search" id="catalog-search" type="search" autocomplete="off" placeholder="Search course, university, topic or skill…" aria-label="Search courses"><button class="catalog-clear" type="button" hidden aria-label="Clear search">Clear</button></div>
        <div class="category-chips" role="list" aria-label="Course categories"></div>
      </section>
      <div class="catalog-result-line" aria-live="polite"></div>
      <section class="catalog-grid"></section>
      <div class="catalog-more"></div>`;

    const chips = main.querySelector<HTMLElement>('.category-chips')!;
    const results = main.querySelector<HTMLElement>('.catalog-result-line')!;
    const grid = main.querySelector<HTMLElement>('.catalog-grid')!;
    const more = main.querySelector<HTMLElement>('.catalog-more')!;
    const search = main.querySelector<HTMLInputElement>('#catalog-search')!;
    const clear = main.querySelector<HTMLButtonElement>('.catalog-clear')!;

    const render = () => {
      const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const filtered = courses.filter((course) => {
        if (category !== 'All courses' && courseCategory(course) !== category) return false;
        const haystack = `${course.title} ${course.description} ${course.outcome || ''} ${course.source_title || ''} ${course.source_channel || ''} ${course.difficulty || ''} ${courseCategory(course)}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      });
      const displayed = filtered.slice(0, visibleLimit);

      chips.innerHTML = categories.map((item) => `<button type="button" class="category-chip ${category === item ? 'active' : ''}" data-category="${escapeHtml(item)}">${escapeHtml(item)} <span>${item === 'All courses' ? courses.length : counts.get(item) || 0}</span></button>`).join('');
      results.innerHTML = `<span><strong>${filtered.length}</strong> of ${courses.length} courses</span><span>${escapeHtml(category)}${query ? ` · “${escapeHtml(query)}”` : ''}</span>`;
      grid.innerHTML = displayed.map((course) => {
        const isOwned = owned.has(course.id);
        const ready = course.route_ready !== false;
        const destination = isOwned && ready ? `/learn/${course.slug}` : `/course/${course.slug}`;
        const label = isOwned && ready ? 'Continue course' : ready ? 'Explore course' : 'View preview';
        const price = isOwned ? 'Owned' : ready ? formatMoney(course) : 'Opening soon';
        return `<article class="course-card">
          <div class="course-artwork"><img src="${escapeHtml(coverFor(course))}" alt="" loading="lazy" decoding="async"><div class="artwork-glow"></div><div class="artwork-grid"></div><div class="artwork-copy"><small>${escapeHtml(course.eyebrow || courseCategory(course))}</small><strong>${escapeHtml(course.title)}</strong></div></div>
          <div class="course-card-body"><span class="course-card-category">${escapeHtml(courseCategory(course))}</span><div class="course-meta"><span class="pill">${escapeHtml(course.duration_label || 'Self-paced')}</span><span class="pill">${course.lesson_count || 'Playlist'} lectures</span></div><h2>${escapeHtml(course.title)}</h2><p>${escapeHtml(course.description)}</p><div class="course-structure-line">${ready ? '2 × 20-question assessments · flagship project' : 'Course route is being completed'}</div><div class="card-bottom"><strong>${escapeHtml(price)}</strong><a class="button button-primary" href="${escapeHtml(destination)}">${label} <span aria-hidden="true">↗</span></a></div></div>
        </article>`;
      }).join('');

      if (!filtered.length) {
        grid.innerHTML = '<div class="empty-state panel"><p class="eyebrow">NO MATCHES</p><h2>No courses match this search.</h2><p>Try fewer terms or another category. Search engines, regrettably, still require words that exist.</p><button class="button button-primary" type="button" data-clear-all>Clear filters</button></div>';
      }
      more.innerHTML = filtered.length > displayed.length ? `<button class="button button-soft button-large" type="button" data-show-more>Show ${Math.min(24, filtered.length - displayed.length)} more courses</button>` : '';
      clear.hidden = !query;
    };

    search.addEventListener('input', () => { query = search.value; visibleLimit = INITIAL_COURSE_COUNT; render(); });
    main.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const categoryButton = target.closest<HTMLButtonElement>('[data-category]');
      if (categoryButton) { category = categoryButton.dataset.category || 'All courses'; visibleLimit = INITIAL_COURSE_COUNT; render(); return; }
      if (target.closest('[data-show-more]')) { visibleLimit += 24; render(); return; }
      if (target.closest('[data-clear-all]') || target.closest('.catalog-clear')) { query = ''; category = 'All courses'; visibleLimit = INITIAL_COURSE_COUNT; search.value = ''; render(); }
    });
    render();
  } catch (error) {
    const main = root.querySelector<HTMLElement>('#main-content');
    if (!main) return;
    const message = error instanceof Error ? error.message : 'The catalog could not load.';
    main.innerHTML = `<section class="page-error panel"><p class="eyebrow">CATALOG ERROR</p><h1>This page could not open.</h1><p>${escapeHtml(message)}</p><button class="button button-primary" onclick="location.reload()">Try again</button></section>`;
  }
}
