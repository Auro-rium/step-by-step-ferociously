import '../styles.css';

const SESSION_KEY = 'sb-ijkdhrznxukawugeoocs-auth-token';

function hasActiveSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw) as { access_token?: string; expires_at?: number; currentSession?: { access_token?: string; expires_at?: number } };
    const session = value.currentSession ?? value;
    if (!session.access_token) return false;
    return !session.expires_at || session.expires_at * 1000 > Date.now();
  } catch {
    return false;
  }
}

function setCanonical(href: string) {
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = href;
}

export function mountLanding() {
  const root = document.getElementById('root');
  if (!root) throw new Error('FINISH root element is missing.');

  document.title = 'FINISH — Complete the course';
  setCanonical('https://finish-landing-nine.vercel.app/');
  const accountLink = hasActiveSession()
    ? '<a class="button button-soft" href="/app">My learning <span aria-hidden="true">↗</span></a>'
    : '<a class="button button-dark" href="/auth">Sign in <span aria-hidden="true">↗</span></a>';

  root.innerHTML = `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header">
      <div class="shell header-inner">
        <a href="/" class="brand" aria-label="FINISH home">FINISH<span>.</span></a>
        <nav class="desktop-nav" aria-label="Primary navigation">
          <a href="/catalog">Courses</a>
          <a href="#method">How it works</a>
          <a href="/why">Why FINISH</a>
        </nav>
        <div class="header-actions">${accountLink}</div>
      </div>
    </header>
    <div id="main-content">
      <main>
        <section class="hero shell">
          <div class="hero-copy">
            <div class="status-line"><span></span><b>One serious course. One visible finish line.</b></div>
            <h1>Stop saving tutorials.<br><em>Finish the course.</em></h1>
            <p>FINISH turns excellent YouTube playlists into structured learning routes with ordered lessons, two mastery checks, saved progress, XP and a flagship project.</p>
            <div class="hero-actions">
              <a class="button button-primary button-large" href="/catalog">Explore courses <span aria-hidden="true">↗</span></a>
              <a class="text-link" href="#method">See the method <span aria-hidden="true">→</span></a>
            </div>
            <div class="trust-row"><span>✓ No subscription trap</span><span>✓ Permanent course access</span><span>✓ Progress saved</span></div>
          </div>
          <div class="hero-stage" aria-label="FINISH product preview">
            <div class="stage-orbit orbit-one"></div><div class="stage-orbit orbit-two"></div>
            <div class="product-window">
              <div class="window-top"><span></span><span></span><span></span><b>finish.course/learn</b></div>
              <div class="window-body">
                <aside class="preview-sidebar"><small>COURSE ROUTE</small><h3>Computer Networks</h3>
                  <div class="preview-step done"><i>✓</i><span>The network edge</span></div>
                  <div class="preview-step done"><i>✓</i><span>Packet switching</span></div>
                  <div class="preview-step active"><i>3</i><span>Delay and loss</span></div>
                  <div class="preview-step"><i>4</i><span>Mid-course quiz</span></div>
                  <div class="preview-step"><i>5</i><span>Protocol layers</span></div>
                </aside>
                <div class="preview-content"><div class="preview-label">LESSON 03 OF 18</div><h2>Delay, loss and throughput</h2><div class="preview-video"><span class="route-play" aria-hidden="true">▶</span><span>42% watched</span></div><div class="preview-progress"><span style="width:42%"></span></div><div class="preview-bottom"><b>Complete 80% to unlock the checkpoint</b><span>240 XP</span></div></div>
              </div>
            </div>
            <div class="floating-card float-a"><span aria-hidden="true">◴</span><div><b>68%</b><span>course complete</span></div></div>
            <div class="floating-card float-b"><span aria-hidden="true">✦</span><div><b>+60 XP</b><span>quiz passed</span></div></div>
          </div>
        </section>
        <section class="manifesto"><div class="shell manifesto-inner"><p>WATCH WITH INTENT</p><span>•</span><p>PROVE WHAT STUCK</p><span>•</span><p>BUILD SOMETHING</p><span>•</span><p>FINISH</p></div></section>
        <section id="method" class="section shell method-section">
          <div class="section-heading"><p class="eyebrow">THE METHOD</p><h2>A playlist gives you content.<br>FINISH gives you a route.</h2><p>The original lectures stay where they belong. FINISH adds the structure that turns passive watching into completed learning.</p></div>
          <div class="method-grid">
            <article><span>01</span><b class="method-icon">▦</b><h3>Follow one ordered route</h3><p>No tab wandering and no guessing what comes next. Every lecture has a place and a visible checkpoint.</p></article>
            <article><span>02</span><b class="method-icon">◔</b><h3>Prove understanding twice</h3><p>A 20-question checkpoint in the middle and another at the end interrupt passive consumption.</p></article>
            <article><span>03</span><b class="method-icon">✦</b><h3>Complete a flagship project</h3><p>The route ends with work you must build and submit, not a decorative completion percentage.</p></article>
          </div>
        </section>
        <section class="section shell value-section">
          <div class="value-card"><div><p class="eyebrow">NOT ANOTHER CONTENT LIBRARY</p><h2>Pay for completion, not access to thousands of things you will never open.</h2><p>Each FINISH course is one focused learning product: an ordered route, two assessments, permanent access and a flagship outcome.</p><a class="button button-acid button-large" href="/catalog">Browse the catalog <span aria-hidden="true">↗</span></a></div><div class="value-number"><small>THE PROMISE</small><strong>1</strong><span>course at a time</span></div></div>
        </section>
      </main>
    </div>
    <footer class="footer"><div class="shell footer-inner"><a href="/" class="brand">FINISH<span>.</span></a><p>Structured learning on top of excellent free courses.</p><span>© ${new Date().getFullYear()} FINISH</span></div></footer>
  `;
}
