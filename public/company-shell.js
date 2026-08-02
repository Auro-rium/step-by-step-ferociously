(() => {
  const supportEmail = 'auroriumnexus@gmail.com';
  const supabaseUrl = 'https://ijkdhrznxukawugeoocs.supabase.co';
  const supabaseKey = 'sb_publishable_kwSezylj6T63a7nIMtuxcg_0bQWm6-8';
  const fallbackStats = { courses: 64, lessons: 1753, quizzes: 128, questions: 2560, projects: 64 };
  const CACHE_KEY = 'finish:catalog-stats:v2';
  const CACHE_TTL = 10 * 60 * 1000;
  let catalogStats = fallbackStats;
  let statsRequest = null;
  let observer = null;
  let observerTimeout = 0;

  const number = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));
  const statsSignature = (stats) => [stats.courses, stats.lessons, stats.quizzes, stats.questions, stats.projects].join(':');
  const idle = (callback) => typeof window.finishIdle === 'function' ? window.finishIdle(callback) : window.setTimeout(callback, 80);

  function companyProofMarkup(stats) {
    return `
      <div class="company-proof-panel">
        <div class="company-proof-head">
          <div>
            <span class="company-kicker">BUILT FOR COURSE COMPLETION</span>
            <h2>A serious system around serious free courses.</h2>
            <p class="company-proof-copy">FINISH does not resell public lectures. It adds the structure around them: an ordered route, saved progress, two 20-question mastery checkpoints and a flagship project that turns watching into completed work.</p>
          </div>
          <aside class="company-purchase-card">
            <small>WHAT A PURCHASE UNLOCKS</small>
            <strong>Permanent access to one FINISH course route.</strong>
            <p>One-time payment. No recurring subscription. The source lectures remain owned and hosted by their original publishers.</p>
            <a href="/catalog">Choose a course</a>
          </aside>
        </div>
        <div class="company-proof-grid">
          <article><small>CATALOG</small><strong>${number(stats.courses)} rigorous courses</strong><p>Focused routes across programming, systems, algorithms, mathematics, security and AI.</p></article>
          <article><small>COURSEWORK</small><strong>${number(stats.lessons)} ordered lectures</strong><p>Canonical lecture sequences with a clear next step instead of tab wandering.</p></article>
          <article><small>ASSESSMENT</small><strong>${number(stats.quizzes)} mastery checkpoints</strong><p>${number(stats.questions)} authored questions and ${number(stats.projects)} required flagship projects.</p></article>
          <article><small>OWNERSHIP</small><strong>Independent product</strong><p>FINISH is not affiliated with YouTube, MIT, Stanford, Harvard, CMU or the source-course publishers.</p></article>
        </div>
      </div>`;
  }

  function footerMarkup() {
    const year = new Date().getFullYear();
    return `
      <div class="company-footer-inner">
        <div class="company-footer-top">
          <div class="company-footer-brand">
            <strong>FINISH<span>.</span></strong>
            <p>A course completion system for rigorous free online courses. One course, one route, one finished outcome.</p>
            <div class="company-footer-trust"><span>One-time purchase</span><span>No subscription</span><span>Progress saved</span><span>Secure checkout</span></div>
          </div>
          <nav class="company-footer-column" aria-label="Product links">
            <span class="company-footer-label">PRODUCT</span>
            <a href="/catalog">Course catalog</a>
            <a href="/#method">How FINISH works</a>
            <a href="/why">Why FINISH</a>
            <a href="/auth">Sign in</a>
          </nav>
          <nav class="company-footer-column" aria-label="Support links">
            <span class="company-footer-label">SUPPORT</span>
            <a href="mailto:${supportEmail}?subject=FINISH%20support">Email support</a>
            <a href="/refunds">Purchase policy</a>
            <a href="/privacy#contact">Privacy contact</a>
          </nav>
          <nav class="company-footer-column" aria-label="Legal links">
            <span class="company-footer-label">LEGAL</span>
            <a href="/terms">Terms of use</a>
            <a href="/privacy">Privacy policy</a>
            <a href="/refunds">Refund & cancellation</a>
          </nav>
        </div>
        <div class="company-footer-bottom">
          <p>FINISH provides an independent learning and progress layer around publicly available source courses. Source videos, names and trademarks belong to their respective owners. Availability of third-party content may change.</p>
          <span>© ${year} FINISH. All rights reserved.</span>
        </div>
      </div>`;
  }

  function renderProof(proof) {
    const signature = statsSignature(catalogStats);
    if (proof.dataset.catalogStats === signature) return;
    proof.innerHTML = companyProofMarkup(catalogStats);
    proof.dataset.catalogStats = signature;
  }

  function readCachedStats() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || Date.now() - Number(cached.savedAt || 0) > CACHE_TTL) return;
      catalogStats = { ...fallbackStats, ...cached.stats };
    } catch { /* Storage is optional. */ }
  }

  function loadCatalogStats() {
    if (statsRequest) return statsRequest;
    statsRequest = fetch(`${supabaseUrl}/rest/v1/rpc/get_public_catalog_stats`, {
      method: 'POST',
      headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Catalog statistics could not load.');
        return response.json();
      })
      .then((stats) => {
        if (!stats || typeof stats !== 'object') return fallbackStats;
        catalogStats = {
          courses: Number(stats.courses || fallbackStats.courses),
          lessons: Number(stats.lessons || fallbackStats.lessons),
          quizzes: Number(stats.quizzes || fallbackStats.quizzes),
          questions: Number(stats.questions || fallbackStats.questions),
          projects: Number(stats.projects || fallbackStats.projects),
        };
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), stats: catalogStats })); }
        catch { /* Storage is optional. */ }
        document.querySelectorAll('.company-proof').forEach(renderProof);
        return catalogStats;
      })
      .catch(() => fallbackStats)
      .finally(() => { statsRequest = null; });
    return statsRequest;
  }

  function stopWatching() {
    observer?.disconnect();
    observer = null;
    if (observerTimeout) window.clearTimeout(observerTimeout);
    observerTimeout = 0;
  }

  function upgrade() {
    const footer = document.querySelector('footer.footer');
    const onLanding = window.location.pathname === '/';
    let proof = document.querySelector('.company-proof');

    if (!footer) return false;
    if (footer.dataset.companyFooter !== 'true') {
      footer.dataset.companyFooter = 'true';
      footer.classList.add('company-footer');
      footer.innerHTML = footerMarkup();
    }

    if (onLanding) {
      if (!proof) {
        proof = document.createElement('section');
        proof.className = 'company-proof';
        proof.setAttribute('aria-label', 'About FINISH');
        footer.before(proof);
      }
      renderProof(proof);
      idle(() => void loadCatalogStats());
    } else if (proof) {
      proof.remove();
    }

    return true;
  }

  function activate() {
    stopWatching();
    if (upgrade()) return;
    const root = document.getElementById('root');
    if (!root) return;
    observer = new MutationObserver(() => {
      if (upgrade()) stopWatching();
    });
    observer.observe(root, { childList: true, subtree: true });
    observerTimeout = window.setTimeout(stopWatching, 5000);
  }

  readCachedStats();
  window.addEventListener('finish-route-change', activate);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once: true });
  else activate();
})();
