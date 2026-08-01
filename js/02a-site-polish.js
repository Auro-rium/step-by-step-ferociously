publicHeader = function publicHeaderPolished(active = '') {
  const signedIn = Boolean(authContext.session);
  return `
    <header class="topbar shell">
      <a class="brand" href="/" data-link>FINISH<b>.</b></a>
      <nav class="nav-links">
        <a class="${active === 'catalog' ? 'active' : ''}" href="/catalog" data-link>Courses</a>
        <a href="/#how" data-link>How it works</a>
      </nav>
      <a class="btn ${signedIn ? 'soft' : ''}" href="${signedIn ? '/app' : '/auth'}" data-link>${signedIn ? 'My courses' : 'Sign in'}</a>
    </header>`;
};

footer = function footerPolished() {
  return `<footer class="footer shell"><span>FINISH. A clear way through a YouTube course.</span><span>The videos still belong to their original creators.</span></footer>`;
};

renderLanding = function renderLandingPolished() {
  app.innerHTML = `
    ${publicHeader()}
    <main>
      <section class="hero shell">
        <div>
          <div class="eyebrow">Learn one course at a time</div>
          <h1 class="display">You saved the playlist. <span>Now finish it.</span></h1>
          <p class="lead">FINISH puts a YouTube course in order, checks what you understood, and remembers where you stopped.</p>
          <div class="hero-actions">
            <a class="btn" href="/catalog" data-link>See available courses →</a>
            <a class="btn ghost" href="#how">How FINISH works</a>
          </div>
        </div>
        <div class="hero-product">
          <div class="network-cover">
            <div class="cover-copy"><small>ONE COURSE AT A TIME</small><h2>A clear route from the first lesson to the last.</h2></div>
          </div>
          <div class="product-metrics">
            <div><strong>Lessons in order</strong><span>Know what comes next</span></div>
            <div><strong>Quick checks</strong><span>See what actually stuck</span></div>
            <div><strong>Saved progress</strong><span>Return to the right lesson</span></div>
          </div>
        </div>
      </section>

      <div class="ticker">WATCH ONE · CHECK YOUR UNDERSTANDING · KEEP GOING · FINISH ·</div>

      <section id="how" class="section shell">
        <div class="split">
          <h2 class="display">A playlist is useful. A plan is better.</h2>
          <div>
            <p>YouTube has excellent courses, but it is easy to skip lessons, lose your place, or confuse watching with learning.</p>
            <p>FINISH keeps the original videos and adds the parts that help you complete them: a fixed order, short quizzes, saved progress, and one clear next step.</p>
          </div>
        </div>

        <div class="feature-row">
          <article class="feature"><span>01</span><h3>Follow the course</h3><p>Lessons stay in order, so you always know what comes next and what you have completed.</p></article>
          <article class="feature"><span>02</span><h3>Check what you learned</h3><p>Short quizzes show whether the lesson made sense before you move on.</p></article>
          <article class="feature"><span>03</span><h3>Continue from the right place</h3><p>Your course home remembers your progress, even after you close the tab.</p></article>
        </div>
      </section>
    </main>
    ${footer()}`;
};
