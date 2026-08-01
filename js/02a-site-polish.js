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

renderLanding = async function renderLandingPolished() {
  if (authContext.session) return navigate('/app', true);

  const courses = await getCatalog();
  const featured = courses.find((course) => course.is_featured) || courses[0];
  const heroTitle = featured?.title || 'One course. A clear route.';
  const lessonLabel = featured?.lesson_count ? `${featured.lesson_count} lessons` : 'One lesson';

  app.innerHTML = `
    ${publicHeader()}
    <main>
      <section class="hero shell">
        <div>
          <div class="eyebrow">Learn one course at a time</div>
          <h1 class="display">You saved the playlist. <span>Now finish it.</span></h1>
          <p class="lead">FINISH gives a YouTube course an order, short knowledge checks, and a place to continue from. The videos stay on YouTube. Your progress does not get lost there.</p>
          <div class="hero-actions">
            <a class="btn" href="/catalog" data-link>See available courses →</a>
            <a class="btn ghost" href="#how">How FINISH works</a>
          </div>
        </div>
        <div class="hero-product">
          <div class="network-cover">
            <div class="cover-copy"><small>YOUR NEXT COURSE</small><h2>${escapeHtml(heroTitle)}</h2></div>
          </div>
          <div class="product-metrics">
            <div><strong>${escapeHtml(lessonLabel)}</strong><span>Follow the course in order</span></div>
            <div><strong>Quick checks</strong><span>See what actually stuck</span></div>
            <div><strong>Saved progress</strong><span>Return to the right lesson</span></div>
          </div>
        </div>
      </section>

      <div class="ticker">WATCH ONE · CHECK YOUR UNDERSTANDING · KEEP GOING · FINISH ·</div>

      <section id="how" class="section shell">
        <div class="split">
          <h2 class="display">You do not need more videos. You need a way through the ones you chose.</h2>
          <div>
            <p>A good playlist can teach a full subject, but YouTube does not keep the plan for you. Videos get skipped, progress gets forgotten, and the course joins the pile of things you meant to finish.</p>
            <p>FINISH keeps the original videos and adds the useful parts around them: a fixed order, checkpoints, saved progress, and one clear next step.</p>
          </div>
        </div>

        <div class="feature-row">
          <article class="feature"><span>01</span><h3>Follow the course</h3><p>Lessons stay in order, so you always know what comes next and what you have already completed.</p></article>
          <article class="feature"><span>02</span><h3>Check what you learned</h3><p>Short quizzes catch the difference between watching a video and understanding it.</p></article>
          <article class="feature"><span>03</span><h3>Come back without guessing</h3><p>Your course home remembers your progress and takes you back to the right place.</p></article>
        </div>
      </section>

      ${featured ? `
        <section class="section shell">
          <div class="featured-card">
            ${courseCover(featured)}
            <div class="featured-copy">
              <div class="eyebrow" style="color:var(--acid)">AVAILABLE COURSE</div>
              <h2 class="display">${escapeHtml(featured.title)}</h2>
              <p>${escapeHtml(featured.outcome || featured.description || 'Follow the full course, keep your place, and finish with proof that you understood it.')}</p>
              <a class="btn acid" href="/course/${encodeURIComponent(featured.slug)}" data-link>View the course →</a>
            </div>
            <div class="price-panel">
              <span>ONE-TIME ACCESS</span>
              <strong>${money(priceFor(featured).amount, priceFor(featured).currency)}</strong>
              <ul><li>The complete playlist route</li><li>Quiz checkpoints</li><li>Saved progress</li><li>Course access that does not expire</li></ul>
              <a class="btn" href="/course/${encodeURIComponent(featured.slug)}" data-link>See course details</a>
            </div>
          </div>
        </section>` : ''}
    </main>
    ${footer()}`;
};
