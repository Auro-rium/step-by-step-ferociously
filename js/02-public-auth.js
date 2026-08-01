const AUTH_SITE_URL = 'https://finish-landing-nine.vercel.app';

function confirmationRedirect(next) {
  return `${AUTH_SITE_URL}/auth?confirmed=1&next=${encodeURIComponent(next)}`;
}

async function renderLanding() {
  if (authContext.session) return navigate('/app', true);
  const courses = await getCatalog();
  const featured = courses.find((c) => c.is_featured) || courses[0];
  app.innerHTML = `
    ${publicHeader()}
    <main>
      <section class="hero shell">
        <div>
          <div class="eyebrow">A better way to learn from YouTube</div>
          <h1 class="display">Stop collecting tutorials. <span>Finish one.</span></h1>
          <p class="lead">FINISH turns serious playlists into paid, structured challenges with ordered lessons, quizzes, progress, XP and one outcome you can actually show.</p>
          <div class="hero-actions"><a class="btn" href="/catalog" data-link>Browse the catalog →</a><a class="btn ghost" href="#how">See how it works</a></div>
        </div>
        <div class="hero-product">
          <div class="network-cover"><div class="cover-copy"><small>CHALLENGE 001</small><h2>${escapeHtml(featured?.title || 'Distributed Systems Understood')}</h2></div></div>
          <div class="product-metrics"><div><strong>1 route</strong><span>No playlist wandering</span></div><div><strong>3 quizzes</strong><span>Prove the learning</span></div><div><strong>${featured ? money(priceFor(featured).amount, priceFor(featured).currency) : '$2'}</strong><span>One time</span></div></div>
        </div>
      </section>
      <div class="ticker">WATCH · PROVE IT · BUILD THE MENTAL MODEL · FINISH ·</div>
      <section id="how" class="section shell">
        <div class="split"><h2 class="display">The problem is not content. It is completion.</h2><div><p>YouTube already has excellent teaching. The failure happens after the click: no route, no accountability, no test of understanding, and no meaningful finish line.</p><p>FINISH leaves the video on YouTube and adds the product layer people actually pay for.</p></div></div>
        <div class="feature-row"><article class="feature"><span>01</span><h3>Ordered route</h3><p>Each lesson unlocks after the previous checkpoint. No tab-hopping disguised as learning.</p></article><article class="feature"><span>02</span><h3>Knowledge checks</h3><p>Quizzes interrupt passive watching and award XP only after a real passing score.</p></article><article class="feature"><span>03</span><h3>Personal home</h3><p>After login, learners return to their own courses and progress. The sales page gets out of the way.</p></article></div>
      </section>
      ${featured ? `<section id="pricing" class="section shell"><div class="featured-card">${courseCover(featured)}<div class="featured-copy"><div class="eyebrow" style="color:var(--acid)">FIRST DROP</div><h2 class="display">${escapeHtml(featured.title)}</h2><p>${escapeHtml(featured.outcome)}</p><a class="btn acid" href="/course/${encodeURIComponent(featured.slug)}" data-link>See the challenge →</a></div><div class="price-panel"><span>ONE-TIME ACCESS</span><strong>${money(priceFor(featured).amount, priceFor(featured).currency)}</strong><ul><li>Full playlist route</li><li>Quiz checkpoints</li><li>Persistent XP and streaks</li><li>Lifetime course access</li></ul><a class="btn" href="/course/${encodeURIComponent(featured.slug)}" data-link>Gamify this course</a></div></div></section>` : ''}
    </main>${footer()}`;
}

async function renderCatalog() {
  const courses = await getCatalog();
  let enrollmentMap = new Map();
  if (authContext.session) {
    const { data } = await client.from('enrollments').select('*').eq('user_id', authContext.session.user.id);
    enrollmentMap = new Map((data || []).map((e) => [e.challenge_id, e]));
  }
  app.innerHTML = `
    ${authContext.session ? `<div class="app-shell">${appHeader('catalog')}<main class="app-main shell">` : `${publicHeader('catalog')}<main class="shell">`}
    <section class="page-head"><div class="eyebrow">THE CATALOG</div><h1 class="display">Choose one thing worth finishing.</h1><p class="lead">Each course begins with an existing YouTube playlist. FINISH adds sequence, checkpoints, quizzes, progress and a paid learning experience around it.</p></section>
    <section class="catalog-grid">${courses.length ? courses.map((c) => courseCard(c, enrollmentMap.get(c.id))).join('') : '<div class="empty-state"><h2>No challenges published yet.</h2></div>'}</section>
    </main>${authContext.session ? '</div>' : footer()}`;
}

async function renderCourseDetail(slug) {
  const course = await getCourse(slug);
  const enrollment = await getEnrollment(course.id);
  const paid = hasPaidAccess(enrollment);
  const price = priceFor(course);
  const ctaHref = paid ? `/learn/${encodeURIComponent(slug)}` : authContext.session ? `/checkout/${encodeURIComponent(slug)}` : `/auth?next=${encodeURIComponent(`/checkout/${slug}`)}`;
  const ctaText = paid ? 'Continue learning' : authContext.session ? 'Unlock the challenge' : 'Sign in to unlock';
  app.innerHTML = `
    ${authContext.session ? `<div class="app-shell">${appHeader('catalog')}<main class="app-main shell">` : `${publicHeader('catalog')}<main class="shell">`}
    <section class="course-detail"><div class="detail-grid">
      ${courseCover(course)}
      <div class="detail-copy"><div class="eyebrow">${escapeHtml(course.eyebrow || 'FINISH CHALLENGE')}</div><h1 class="display">${escapeHtml(course.title)}</h1><p class="lead">${escapeHtml(course.description)}</p>
        <div class="detail-facts"><div><strong>${course.lesson_count || 'Full'}</strong><span>PLAYLIST LESSONS</span></div><div><strong>3+</strong><span>QUIZ CHECKPOINTS</span></div><div><strong>${money(price.amount, price.currency)}</strong><span>ONE-TIME ACCESS</span></div></div>
        <h2 class="display" style="font-size:38px">What changes after you buy it</h2>
        <div class="detail-list"><div><span class="tick">✓</span><span><strong>A real route.</strong><br><span class="muted">Lessons unlock in order instead of becoming another saved playlist.</span></span></div><div><span class="tick">✓</span><span><strong>Quizzes with consequences.</strong><br><span class="muted">Passing scores unlock XP. Watching alone does not.</span></span></div><div><span class="tick">✓</span><span><strong>Your own learning home.</strong><br><span class="muted">Purchased courses, progress, streaks and continue buttons live under your account.</span></span></div></div>
        <div class="purchase-box"><div class="eyebrow" style="color:var(--acid)">${paid ? 'YOU OWN THIS COURSE' : 'LIFETIME ACCESS'}</div><div class="price-line"><div><strong>${paid ? 'Unlocked' : money(price.amount, price.currency)}</strong><p>${paid ? 'Return whenever you need it.' : 'No subscription. No giant library.'}</p></div><a class="btn acid" href="${ctaHref}" data-link>${ctaText} →</a></div></div>
      </div>
    </div></section>
    </main>${authContext.session ? '</div>' : footer()}`;
}

function authTemplate(next) {
  const signup = authMode === 'signup';
  return `
    <header class="topbar shell"><a class="brand" href="/" data-link>FINISH<b>.</b></a><a href="/catalog" data-link>Browse catalog</a></header>
    <main class="auth-page shell">
      <section class="auth-copy"><div class="eyebrow">YOUR COURSES, NOT ANOTHER SALES PAGE</div><h1 class="display">Return to where you actually stopped.</h1><p class="lead">Sign in once. After that, FINISH opens on your personal course home.</p></section>
      <section class="auth-card"><div class="auth-inner"><div class="eyebrow">FINISH ACCOUNT</div><h2>${signup ? 'Create your account.' : 'Welcome back.'}</h2><p class="muted">${signup ? 'You will continue after confirming the address.' : 'Continue to your courses.'}</p>
        <form id="auth-form" class="form">
          ${signup ? '<label>NAME<input id="auth-name" autocomplete="name" required></label>' : ''}
          <label>EMAIL<input id="auth-email" type="email" autocomplete="email" required></label>
          <label>PASSWORD<input id="auth-password" type="password" minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}" required></label>
          <button class="btn" id="auth-submit">${signup ? 'Create account' : 'Sign in'}</button>
        </form>
        <button class="text-btn" id="auth-toggle">${signup ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
        <div id="confirm-panel" class="confirm-panel" hidden>
          <strong>Confirmation sent to <span id="confirm-email">your email</span>.</strong>
          <p>Open the message from <b>noreply@mail.app.supabase.io</b>. Check Spam and Promotions too, because email providers enjoy hide-and-seek.</p>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            <a class="btn soft" href="https://mail.google.com/mail/u/0/#search/from%3A(noreply%40mail.app.supabase.io)" target="_blank" rel="noopener">Open Gmail</a>
            <button class="btn soft" id="resend-confirmation" type="button">Resend email</button>
          </div>
          <p id="resend-status" class="muted" style="margin-bottom:0"></p>
        </div>
      </div></section>
    </main>`;
}

async function renderAuth(query) {
  const next = internalPath(query.get('next') || '/app');
  if (authContext.session) return navigate(next, true);
  app.innerHTML = authTemplate(next);
  bindAuth(next);
  if (query.get('confirmed') === '1') toast('Email confirmed. Sign in to continue.', 'success');
}

function showConfirmation(email) {
  const panel = document.querySelector('#confirm-panel');
  const label = document.querySelector('#confirm-email');
  if (panel) panel.hidden = false;
  if (label) label.textContent = email || 'your email';
}

function startResendCooldown(button, seconds = 60) {
  if (!button) return;
  clearInterval(button.__finishCooldown);
  let remaining = Math.max(1, Number(seconds) || 60);
  const status = document.querySelector('#resend-status');
  button.disabled = true;
  const update = () => {
    button.textContent = `Resend in ${remaining}s`;
    if (status) status.textContent = 'The email was requested. Delivery may take a minute.';
    remaining -= 1;
    if (remaining < 0) {
      clearInterval(button.__finishCooldown);
      button.disabled = false;
      button.textContent = 'Resend email';
      if (status) status.textContent = 'Still missing? Resend once, then check Spam and Promotions.';
    }
  };
  update();
  button.__finishCooldown = setInterval(update, 1000);
}

function bindAuth(next) {
  const form = document.querySelector('#auth-form');
  const toggle = document.querySelector('#auth-toggle');
  if (toggle) toggle.onclick = () => {
    authMode = authMode === 'signup' ? 'signin' : 'signup';
    app.innerHTML = authTemplate(next);
    bindAuth(next);
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    const email = document.querySelector('#auth-email').value.trim().toLowerCase();
    const password = document.querySelector('#auth-password').value;
    const submit = document.querySelector('#auth-submit');
    submit.disabled = true;
    try {
      if (authMode === 'signup') {
        const name = document.querySelector('#auth-name').value.trim();
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: confirmationRedirect(next),
          },
        });
        if (error) throw error;
        if (data.session) {
          await refreshAuth();
          return navigate(next, true);
        }
        showConfirmation(email);
        startResendCooldown(document.querySelector('#resend-confirmation'), 60);
        toast(`Confirmation requested for ${email}.`, 'success');
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await refreshAuth();
        navigate(next, true);
      }
    } catch (error) {
      const message = error?.message || String(error);
      if (message.toLowerCase().includes('email not confirmed')) {
        showConfirmation(email);
      }
      const waitMatch = message.match(/after\s+(\d+)\s+seconds?/i);
      if (waitMatch) startResendCooldown(document.querySelector('#resend-confirmation'), Number(waitMatch[1]));
      toast(message, 'error');
    } finally {
      submit.disabled = false;
    }
  };

  const resend = document.querySelector('#resend-confirmation');
  if (resend) resend.onclick = async () => {
    const email = document.querySelector('#auth-email').value.trim().toLowerCase();
    if (!email) return toast('Enter the email first.', 'error');
    resend.disabled = true;
    const { error } = await client.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: confirmationRedirect(next) },
    });
    if (error) {
      const waitMatch = error.message.match(/after\s+(\d+)\s+seconds?/i);
      startResendCooldown(resend, waitMatch ? Number(waitMatch[1]) : 60);
      return toast(error.message, 'error');
    }
    showConfirmation(email);
    startResendCooldown(resend, 60);
    toast(`A fresh confirmation was requested for ${email}.`, 'success');
  };
}
