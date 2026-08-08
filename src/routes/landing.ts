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

function setDescription(content: string) {
  let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!description) {
    description = document.createElement('meta');
    description.name = 'description';
    document.head.append(description);
  }
  description.content = content;
}

export function mountLanding() {
  const root = document.getElementById('root');
  if (!root) throw new Error('FINISH root element is missing.');

  document.title = 'FINISH — Finish a course or bring your own playlist';
  setCanonical('https://finish-landing-nine.vercel.app/');
  setDescription('Choose from 100+ structured FINISH learning routes or turn your own YouTube playlist into a private course with assessments, progress and a flagship project.');

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
          <a href="/custom">Make a route</a>
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
            <div class="status-line"><span></span><b>100+ structured routes · first course free · bring your own playlist</b></div>
            <h1>Finish the course you meant to take.<br><em>Or bring your own.</em></h1>
            <p>Choose a rigorous FINISH route, or paste a YouTube playlist and let AI structure it into ordered lessons, two mastery checks, saved progress and a flagship project. Your first catalog course is free.</p>
            <div class="hero-actions">
              <a class="button button-primary button-large" href="/catalog">Start a course free <span aria-hidden="true">↗</span></a>
              <a class="text-link" href="/custom">Build from my playlist <span aria-hidden="true">→</span></a>
              <a class="text-link" href="#method">See how FINISH works <span aria-hidden="true">↓</span></a>
            </div>
            <div class="trust-row"><span>✓ First catalog course free</span><span>✓ Custom routes unlock for $1</span><span>✓ No subscription</span></div>
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
            <div class="floating-card float-a"><span aria-hidden="true">▦</span><div><b>100+</b><span>structured routes</span></div></div>
            <div class="floating-card float-b"><span aria-hidden="true">✦</span><div><b>BYO</b><span>playlist → FINISH route</span></div></div>
          </div>
        </section>

        <section class="manifesto"><div class="shell manifesto-inner"><p>CHOOSE A ROUTE</p><span>•</span><p>OR BRING YOUR OWN</p><span>•</span><p>PROVE WHAT STUCK</p><span>•</span><p>FINISH</p></div></section>

        <section id="method" class="section shell method-section">
          <div class="section-heading"><p class="eyebrow">TWO WAYS IN. ONE FINISH LINE.</p><h2>The internet already has enough content.<br>FINISH adds the system around it.</h2><p>Start with a course we have already structured, or bring a playlist you already trust. Either way, passive watching gets replaced by a route with checkpoints and a visible outcome.</p></div>
          <div class="method-grid">
            <article><span>01</span><b class="method-icon">▦</b><h3>Choose from 100+ routes</h3><p>Browse serious free courses across AI, programming, systems, finance, mathematics, security and more. Your first catalog course is free.</p></article>
            <article><span>02</span><b class="method-icon">✦</b><h3>Or bring a YouTube playlist</h3><p>Paste a public or unlisted playlist. FINISH keeps the source videos on YouTube and uses AI to build your private route around them.</p></article>
            <article><span>03</span><b class="method-icon">◔</b><h3>Finish with proof</h3><p>Track real progress, pass two 20-question mastery checks and complete a flagship project instead of collecting another abandoned bookmark.</p></article>
          </div>
        </section>

        <section class="section shell value-section">
          <div class="value-card"><div><p class="eyebrow">YOUR BOOKMARKS, STRUCTURED</p><h2>Already saved the right playlist? Turn it into the course.</h2><p>FINISH reads the playlist order and titles, generates the learning structure, two mastery assessments and a flagship project, then shows you the route before the $1 one-time unlock. The generated route stays private to your account.</p><a class="button button-acid button-large" href="/custom">Build my FINISH route <span aria-hidden="true">↗</span></a></div><div class="value-number"><small>CUSTOM ROUTE</small><strong>$1</strong><span>one-time unlock</span></div></div>
        </section>

        <section class="section shell value-section">
          <div class="value-card"><div><p class="eyebrow">TRY THE FULL PRODUCT FIRST</p><h2>Your first catalog course is free.</h2><p>Pick one published FINISH course and use the entire route: ordered lessons, saved progress, both assessments, XP and the flagship project. If the system works for you, additional courses are simple one-time purchases.</p><a class="button button-primary button-large" href="/catalog">Choose my free course <span aria-hidden="true">↗</span></a></div><div class="value-number"><small>FREE TRIAL</small><strong>1</strong><span>complete course</span></div></div>
        </section>
      </main>
    </div>
    <footer class="footer"><div class="shell footer-inner"><a href="/" class="brand">FINISH<span>.</span></a><p>Choose a route or bring your own. Finish one thing.</p><span>© ${new Date().getFullYear()} FINISH</span></div></footer>
  `;
}
