(() => {
  const supportEmail = 'auroriumnexus@gmail.com';
  const supabaseUrl = 'https://ijkdhrznxukawugeoocs.supabase.co';
  const supabaseKey = 'sb_publishable_kwSezylj6T63a7nIMtuxcg_0bQWm6-8';
  const fallbackStats = { courses: 64, lessons: 1753, quizzes: 128, questions: 2560, projects: 64 };
  let catalogStats = fallbackStats;
  let statsRequest = null;

  const number = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));
  const statsSignature = (stats) => [stats.courses, stats.lessons, stats.quizzes, stats.questions, stats.projects].join(':');

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
            <a href="/refund-policy.html">Purchase policy</a>
            <a href="/privacy.html#contact">Privacy contact</a>
          </nav>
          <nav class="company-footer-column" aria-label="Legal links">
            <span class="company-footer-label">LEGAL</span>
            <a href="/terms.html">Terms of use</a>
            <a href="/privacy.html">Privacy policy</a>
            <a href="/refund-policy.html">Refund & cancellation</a>
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

  function loadCatalogStats() {
    if (statsRequest) return statsRequest;
    statsRequest = fetch(`${supabaseUrl}/rest/v1/rpc/get_public_catalog_stats`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        'Content-Type': 'application/json',
      },
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
        document.querySelectorAll('.company-proof').forEach(renderProof);
        return catalogStats;
      })
      .catch(() => fallbackStats);
    return statsRequest;
  }

  function upgradeCompanyShell() {
    const footer = document.querySelector('footer.footer');
    const onLanding = window.location.pathname === '/';
    let proof = document.querySelector('.company-proof');

    if (onLanding && footer) {
      if (!proof) {
        proof = document.createElement('section');
        proof.className = 'company-proof';
        proof.setAttribute('aria-label', 'About FINISH');
        footer.before(proof);
      }
      renderProof(proof);
      void loadCatalogStats();
    } else if (!onLanding && proof) {
      proof.remove();
    }

    if (footer && footer.dataset.companyFooter !== 'true') {
      footer.dataset.companyFooter = 'true';
      footer.classList.add('company-footer');
      footer.innerHTML = footerMarkup();
    }
  }

  const observer = new MutationObserver(upgradeCompanyShell);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', upgradeCompanyShell);
  window.addEventListener('popstate', () => window.setTimeout(upgradeCompanyShell, 0));
  document.addEventListener('click', (event) => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (anchor && anchor.getAttribute('href')?.startsWith('/')) window.setTimeout(upgradeCompanyShell, 80);
  });
  upgradeCompanyShell();
})();
