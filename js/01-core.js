'use strict';

const SUPABASE_URL = 'https://ijkdhrznxukawugeoocs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kwSezylj6T63a7nIMtuxcg_0bQWm6-8';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
let authContext = { session: null, profile: null };
let player = null;
let playerReady = false;
let playerTimer = null;
let currentCourseState = null;
let authMode = 'signin';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const money = (amount, currency) => {
  try { return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: currency === 'INR' ? 0 : 2 }).format(Number(amount)); }
  catch { return `${currency} ${amount}`; }
};

function toast(message, type = '') {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type}`;
  clearTimeout(window.__finishToast);
  window.__finishToast = setTimeout(() => { toastEl.className = 'toast'; }, 3800);
}

function isIndia() {
  const language = String(navigator.language || '').toLowerCase();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  return language.endsWith('-in') || timezone === 'Asia/Kolkata' || timezone === 'Asia/Calcutta';
}

function internalPath(value, fallback = '/app') {
  try {
    const decoded = decodeURIComponent(value || '');
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return fallback;
    return decoded;
  } catch { return fallback; }
}

function navigate(path, replace = false) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  renderRoute();
}

function routeInfo() {
  const parts = location.pathname.split('/').filter(Boolean);
  const query = new URLSearchParams(location.search);
  if (!parts.length) return { name: 'landing', query };
  if (parts[0] === 'auth') return { name: 'auth', query };
  if (parts[0] === 'app') return { name: 'home', query };
  if (parts[0] === 'catalog') return { name: 'catalog', query };
  if (parts[0] === 'course' && parts[1]) return { name: 'course', slug: decodeURIComponent(parts[1]), query };
  if (parts[0] === 'checkout' && parts[1]) return { name: 'checkout', slug: decodeURIComponent(parts[1]), query };
  if (parts[0] === 'learn' && parts[1]) return { name: 'learn', slug: decodeURIComponent(parts[1]), query };
  if (parts[0] === 'admin') return { name: 'admin', query };
  return { name: 'notFound', query };
}

async function refreshAuth() {
  const { data } = await client.auth.getSession();
  const session = data.session;
  let profile = null;
  if (session) {
    const result = await client.from('profiles').select('*').eq('id', session.user.id).single();
    profile = result.data || null;
  }
  authContext = { session, profile };
  return authContext;
}

function publicHeader(active = '') {
  const signedIn = Boolean(authContext.session);
  return `
    <header class="topbar shell">
      <a class="brand" href="/" data-link>FINISH<b>.</b></a>
      <nav class="nav-links">
        <a class="${active === 'catalog' ? 'active' : ''}" href="/catalog" data-link>Catalog</a>
        <a href="/#how" data-link>How it works</a>
        <a href="/#pricing" data-link>Pricing</a>
      </nav>
      <a class="btn ${signedIn ? 'soft' : ''}" href="${signedIn ? '/app' : '/auth'}" data-link>${signedIn ? 'My home' : 'Sign in'}</a>
    </header>`;
}

function appHeader(active = '') {
  const p = authContext.profile;
  const name = p?.display_name || authContext.session?.user?.email?.split('@')[0] || 'Learner';
  return `
    <header class="topbar shell">
      <a class="brand" href="/app" data-link>FINISH<b>.</b></a>
      <nav class="nav-links">
        <a class="${active === 'home' ? 'active' : ''}" href="/app" data-link>My courses</a>
        <a class="${active === 'catalog' ? 'active' : ''}" href="/catalog" data-link>Catalog</a>
        ${p?.role === 'admin' ? `<a class="${active === 'admin' ? 'active' : ''}" href="/admin" data-link>Admin</a>` : ''}
      </nav>
      <div class="nav-user"><div class="avatar">${escapeHtml(name[0]?.toUpperCase() || 'U')}</div><button class="icon-btn" data-signout>Sign out</button></div>
    </header>`;
}

function footer() {
  return `<footer class="footer shell"><span>FINISH. Structured learning on top of YouTube.</span><span>Video ownership remains with the original creators.</span></footer>`;
}

function courseCover(course, compact = false) {
  const title = escapeHtml(course.title || 'Untitled course');
  const image = course.cover_image_url && !course.cover_image_url.startsWith('/')
    ? `<img src="${escapeHtml(course.cover_image_url)}" alt="${title}" loading="lazy" onerror="this.remove();this.parentElement.classList.add('generated')">`
    : '';
  return `<div class="course-cover ${image ? '' : 'generated'} ${compact ? 'compact' : ''}">${image}<div class="cover-label"><small>${escapeHtml((course.eyebrow || 'FINISH CHALLENGE').toUpperCase())}</small><strong>${title}</strong></div></div>`;
}

function priceFor(course) {
  const prices = course.challenge_prices || [];
  const preferred = isIndia() ? prices.find((p) => p.provider === 'razorpay' && p.currency === 'INR') : prices.find((p) => p.provider === 'stripe' && p.currency === 'USD');
  return preferred || prices.find((p) => p.active) || { amount: Number(course.price_cents || 0) / 100, currency: course.currency || 'USD', provider: 'stripe' };
}

function courseCard(course, enrollment = null) {
  const price = priceFor(course);
  const hasAccess = ['paid', 'granted'].includes(enrollment?.access_status);
  return `<article class="course-card">
    ${courseCover(course)}
    <div class="course-card-body">
      <div class="eyebrow">${escapeHtml(course.duration_label || 'Self-paced challenge')}</div>
      <h2>${escapeHtml(course.title)}</h2>
      <p>${escapeHtml(course.description)}</p>
      <div class="card-meta"><span class="pill">${course.lesson_count || 'Playlist'} lessons</span><span class="pill">Quizzes</span><span class="pill">XP + streaks</span></div>
      <div class="course-card-actions">
        <a class="btn soft" href="/course/${encodeURIComponent(course.slug)}" data-link>View course</a>
        <a class="btn" href="${hasAccess ? `/learn/${encodeURIComponent(course.slug)}` : `/course/${encodeURIComponent(course.slug)}` }" data-link>${hasAccess ? 'Continue' : 'Gamify it'}</a>
      </div>
    </div>
  </article>`;
}

async function getCatalog() {
  const { data, error } = await client.from('challenges').select('*, challenge_prices(*)').eq('status', 'published').order('is_featured', { ascending: false }).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getCourse(slug) {
  const { data, error } = await client.from('challenges').select('*, challenge_prices(*)').eq('slug', slug).eq('status', 'published').single();
  if (error) throw error;
  return data;
}

async function getEnrollment(challengeId) {
  if (!authContext.session) return null;
  const { data } = await client.from('enrollments').select('*').eq('user_id', authContext.session.user.id).eq('challenge_id', challengeId).maybeSingle();
  return data || null;
}

function hasPaidAccess(enrollment) {
  return ['paid', 'granted'].includes(enrollment?.access_status);
}
