async function renderAdmin() {
  if (!authContext.session) return navigate('/auth?next=%2Fadmin', true);
  if (authContext.profile?.role !== 'admin') return navigate('/app', true);
  const [coursesResult, ordersResult] = await Promise.all([
    client.from('challenges').select('*, challenge_prices(*)').order('created_at', { ascending: false }),
    client.from('payment_orders').select('*, challenges(title)').order('created_at', { ascending: false }).limit(20),
  ]);
  const courses = coursesResult.data || [];
  const orders = ordersResult.data || [];
  app.innerHTML = `<div class="app-shell">${appHeader('admin')}<main class="app-main shell"><section class="admin-head"><div><div class="eyebrow" style="color:var(--acid)">PRIVATE ADMIN</div><h1 class="display">Manage the catalog.</h1><p class="muted">This route and every write action are restricted to your admin role in Supabase.</p></div><aside class="admin-badge"><span>ADMIN ACCOUNT</span><strong>${escapeHtml(authContext.session.user.email)}</strong><p>Ordinary learners cannot see this navigation or execute these database functions.</p></aside></section>
    <div class="admin-tabs"><button class="active" data-tab="course">Add course</button><button data-tab="quiz">Add quiz</button><button data-tab="orders">Orders</button></div>
    <section id="admin-content"></section>
  </main></div>`;
  const renderTab = (tab) => {
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'course') renderAdminCourse(courses);
    if (tab === 'quiz') renderAdminQuiz(courses);
    if (tab === 'orders') renderAdminOrders(orders);
  };
  document.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => renderTab(b.dataset.tab));
  renderTab('course');
}

function renderAdminCourse(courses) {
  document.querySelector('#admin-content').innerHTML = `<div class="admin-grid"><form id="course-form" class="admin-panel form"><div class="eyebrow">COURSE BUILDER</div><h2>Publish a playlist challenge.</h2><label>TITLE<input id="course-title-input" required></label><label>SLUG<input id="course-slug-input" pattern="[a-z0-9-]+" required></label><label>YOUTUBE PLAYLIST URL<input id="course-playlist-input" type="url" required></label><label>DESCRIPTION<textarea id="course-description-input" required></textarea></label><label>OUTCOME<textarea id="course-outcome-input" required></textarea></label><label>COVER IMAGE URL (OPTIONAL)<input id="course-cover-input" type="url"></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label>USD PRICE<input id="course-usd-input" type="number" min="0" step="0.01" value="2" required></label><label>INR PRICE<input id="course-inr-input" type="number" min="0" step="1" value="159" required></label></div><button class="btn">Publish course</button></form><aside class="admin-panel"><div class="eyebrow">CURRENT CATALOG</div><h2>${courses.length} published course${courses.length === 1 ? '' : 's'}.</h2><div class="catalog-admin-list">${courses.map((c) => `<article class="catalog-admin-item"><div class="eyebrow">${escapeHtml(c.status)}</div><h3>${escapeHtml(c.title)}</h3><p class="muted">${escapeHtml(c.youtube_playlist_id || 'No playlist')}</p></article>`).join('')}</div></aside></div>`;
  document.querySelector('#course-title-input').addEventListener('input', (e) => { document.querySelector('#course-slug-input').value = e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); });
  document.querySelector('#course-form').onsubmit = async (event) => {
    event.preventDefault();
    let playlistId = '';
    try { playlistId = new URL(document.querySelector('#course-playlist-input').value).searchParams.get('list') || ''; } catch { return toast('Use a valid YouTube playlist URL.', 'error'); }
    const button = event.submitter; button.disabled = true;
    const { error } = await client.rpc('create_challenge_from_playlist', {
      p_title: document.querySelector('#course-title-input').value,
      p_slug: document.querySelector('#course-slug-input').value,
      p_description: document.querySelector('#course-description-input').value,
      p_outcome: document.querySelector('#course-outcome-input').value,
      p_playlist_id: playlistId,
      p_cover_image_url: document.querySelector('#course-cover-input').value,
      p_lesson_count: 0,
      p_usd: Number(document.querySelector('#course-usd-input').value),
      p_inr: Number(document.querySelector('#course-inr-input').value),
    });
    button.disabled = false;
    if (error) return toast(error.message, 'error');
    toast('Course published.', 'success');
    renderRoute();
  };
}

function questionBlock(index) {
  return `<div class="question-builder" data-question-builder><div class="eyebrow">QUESTION ${index + 1}</div><label>PROMPT<input data-q="prompt" required></label><label>OPTIONS, ONE PER LINE<textarea data-q="options" required></textarea></label><label>CORRECT OPTION NUMBER<input data-q="correct" type="number" min="1" value="1" required></label><label>EXPLANATION<textarea data-q="explanation" required></textarea></label><button type="button" class="text-btn" data-remove-question>Remove question</button></div>`;
}

function renderAdminQuiz(courses) {
  document.querySelector('#admin-content').innerHTML = `<div class="admin-grid"><form id="quiz-builder-form" class="admin-panel form"><div class="eyebrow">QUIZ BUILDER</div><h2>Add a paid checkpoint.</h2><label>COURSE<select id="quiz-course" required>${courses.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.title)}</option>`).join('')}</select></label><label>QUIZ TITLE<input id="quiz-title" required></label><label>DESCRIPTION<textarea id="quiz-description"></textarea></label><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px"><label>POSITION<input id="quiz-position" type="number" min="1" value="1"></label><label>AFTER LESSON<input id="quiz-unlock" type="number" min="0" value="2"></label><label>PASS %<input id="quiz-pass" type="number" min="1" max="100" value="70"></label><label>XP<input id="quiz-xp" type="number" min="0" value="60"></label></div><div id="question-builders">${questionBlock(0)}${questionBlock(1)}${questionBlock(2)}</div><button type="button" class="btn soft" id="add-question">Add question</button><button class="btn">Publish quiz</button></form><aside class="admin-panel"><div class="eyebrow">RULES</div><h2>A quiz is part of the product, not decoration.</h2><p class="muted">Questions are visible only to paid learners. Correct answer keys never leave the database. XP is idempotent and awarded only once after a passing score.</p></aside></div>`;
  const rebindRemove = () => document.querySelectorAll('[data-remove-question]').forEach((b) => b.onclick = () => { if (document.querySelectorAll('[data-question-builder]').length <= 1) return toast('Keep at least one question.'); b.closest('[data-question-builder]').remove(); });
  rebindRemove();
  document.querySelector('#add-question').onclick = () => { const wrap = document.querySelector('#question-builders'); wrap.insertAdjacentHTML('beforeend', questionBlock(wrap.children.length)); rebindRemove(); };
  document.querySelector('#quiz-builder-form').onsubmit = async (event) => {
    event.preventDefault();
    const questions = [...document.querySelectorAll('[data-question-builder]')].map((box) => {
      const options = box.querySelector('[data-q="options"]').value.split('\n').map((x) => x.trim()).filter(Boolean);
      return { prompt: box.querySelector('[data-q="prompt"]').value.trim(), options, correct_index: Number(box.querySelector('[data-q="correct"]').value) - 1, explanation: box.querySelector('[data-q="explanation"]').value.trim() };
    });
    const button = event.submitter; button.disabled = true;
    const { error } = await client.rpc('admin_create_course_quiz', { p_challenge_slug: document.querySelector('#quiz-course').value, p_title: document.querySelector('#quiz-title').value, p_description: document.querySelector('#quiz-description').value, p_position: Number(document.querySelector('#quiz-position').value), p_unlock_after_video: Number(document.querySelector('#quiz-unlock').value), p_pass_percent: Number(document.querySelector('#quiz-pass').value), p_xp_reward: Number(document.querySelector('#quiz-xp').value), p_questions: questions });
    button.disabled = false;
    if (error) return toast(error.message, 'error');
    toast('Quiz published.', 'success');
    event.currentTarget.reset();
  };
}

function renderAdminOrders(orders) {
  document.querySelector('#admin-content').innerHTML = `<section class="admin-panel"><div class="eyebrow">PAYMENT ORDERS</div><h2>Latest attempts.</h2>${orders.length ? orders.map((o) => `<article class="order-row"><div><strong>${escapeHtml(o.challenges?.title || 'Course')}</strong><br><small>${escapeHtml(o.provider)} · ${money(o.amount, o.currency)} · ${escapeHtml(o.created_at)}</small></div><span class="pill">${escapeHtml(o.status)}</span></article>`).join('') : '<p class="muted">No payment attempts yet.</p>'}</section>`;
}

function renderNotFound() {
  app.innerHTML = `${publicHeader()}<main class="shell"><section class="page-head"><div class="eyebrow">404</div><h1 class="display">This route went nowhere.</h1><p class="lead">Unlike a tutorial playlist, at least this dead end is obvious.</p><a class="btn" href="${authContext.session ? '/app' : '/'}" data-link>Go home</a></section></main>`;
}
