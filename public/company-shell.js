(() => {
  const supportEmail = 'auroriumnexus@gmail.com';

  function companyProofMarkup() {
    return `
      <div class="company-proof-panel">
        <div class="company-proof-head">
          <div>
            <span class="company-kicker">BUILT FOR COURSE COMPLETION</span>
            <h2>A serious system around serious free courses.</h2>
            <p class="company-proof-copy">FINISH does not resell public lectures. It adds the structure around them: an ordered route, saved progress, knowledge checks, a final assessment and a capstone that turns watching into completed work.</p>
          </div>
          <aside class="company-purchase-card">
            <small>WHAT A PURCHASE UNLOCKS</small>
            <strong>Permanent access to one FINISH course route.</strong>
            <p>One-time payment. No recurring subscription. The source lectures remain owned and hosted by their original publishers.</p>
            <a href="/catalog">Choose a course</a>
          </aside>
        </div>
        <div class="company-proof-grid">
          <article><small>CATALOG</small><strong>44 rigorous courses</strong><p>Focused routes across programming, systems, algorithms, mathematics, security and AI.</p></article>
          <article><small>COURSEWORK</small><strong>1,185 ordered lectures</strong><p>Canonical lecture sequences with a clear next step instead of tab wandering.</p></article>
          <article><small>ASSESSMENT</small><strong>880 authored questions</strong><p>Knowledge checks tied to the actual material, not generic trivia assembled for decoration.</p></article>
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

  function upgradeCompanyShell() {
    const footer = document.querySelector('footer.footer');
    const onLanding = window.location.pathname === '/';
    let proof = document.querySelector('.company-proof');

    if (onLanding && footer && !proof) {
      proof = document.createElement('section');
      proof.className = 'company-proof';
      proof.setAttribute('aria-label', 'About FINISH');
      proof.innerHTML = companyProofMarkup();
      footer.before(proof);
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
