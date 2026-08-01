async function loadHomeData() {
  const userId = authContext.session.user.id;
  const [{ data: enrollments, error }, { data: xp }, { data: attempts }] = await Promise.all([
    client.from('enrollments').select('*, challenges(*, challenge_prices(*))').eq('user_id', userId).in('access_status', ['paid', 'granted']),
    client.from('xp_events').select('amount,challenge_id').eq('user_id', userId),
    client.from('course_quiz_attempts').select('quiz_id,passed,score_percent').eq('user_id', userId),
  ]);
  if (error) throw error;
  const paid = enrollments || [];
  const challengeIds = paid.map((e) => e.challenge_id);
  let progress = [];
  if (challengeIds.length) {
    const result = await client.from('playlist_video_progress').select('*').eq('user_id', userId).in('challenge_id', challengeIds);
    progress = result.data || [];
  }
  return { enrollments: paid, xp: xp || [], attempts: attempts || [], progress };
}

async function renderHome() {
  if (!authContext.session) return navigate('/auth?next=%2Fapp', true);
  const data = await loadHomeData();
  const name = authContext.profile?.display_name || authContext.session.user.email.split('@')[0];
  const totalXp = data.xp.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const passed = data.attempts.filter((a) => a.passed).length;
  const cards = data.enrollments.map((enrollment) => {
    const course = enrollment.challenges;
    const completed = data.progress.filter((p) => p.challenge_id === course.id && p.status === 'completed').length;
    const total = Number(course.lesson_count || Math.max(completed, 1));
    const percent = Math.min(100, Math.round((completed / total) * 100));
    return `<article class="enrolled-card">${courseCover(course, true)}<div class="enrolled-card-copy"><div class="eyebrow" style="color:var(--acid)">${escapeHtml(course.eyebrow || 'YOUR COURSE')}</div><h3>${escapeHtml(course.title)}</h3><p>${completed} lessons completed · ${percent}% of the route</p><div class="progress-track"><i style="width:${percent}%"></i></div><a class="btn acid" href="/learn/${encodeURIComponent(course.slug)}" data-link>${completed ? 'Continue learning' : 'Start course'} →</a></div></article>`;
  }).join('');
  app.innerHTML = `<div class="app-shell">${appHeader('home')}<main class="app-main shell">
    <section class="home-hero"><div><div class="eyebrow" style="color:var(--acid)">YOUR FINISH HOME</div><h1 class="display">Welcome back, ${escapeHtml(name)}.</h1><p class="lead" style="color:#ffffff75">No landing page. No sales loop. Just the courses you own and the next useful action.</p></div><aside class="stat-panel"><div class="stats"><div><strong>${data.enrollments.length}</strong><span>OWNED COURSES</span></div><div><strong>${totalXp}</strong><span>TOTAL XP</span></div><div><strong>${authContext.profile?.current_streak || 0}</strong><span>DAY STREAK</span></div></div><p class="muted" style="margin:25px 0 0">${passed} quiz checkpoint${passed === 1 ? '' : 's'} passed.</p></aside></section>
    <section class="home-section"><div class="home-section-head"><div><div class="eyebrow" style="color:var(--acid)">MY COURSES</div><h2>Your learning stack.</h2></div><a class="btn ghost" href="/catalog" data-link>Browse catalog</a></div>${cards ? `<div class="enrolled-grid">${cards}</div>` : `<div class="empty-state"><h2>Your stack is empty.</h2><p>Choose one course from the catalog. Payment unlocks the learning route, quizzes, XP and progress.</p><a class="btn acid" href="/catalog" data-link>Open catalog →</a></div>`}</section>
  </main></div>`;
}

async function renderCheckout(slug) {
  if (!authContext.session) return navigate(`/auth?next=${encodeURIComponent(`/checkout/${slug}`)}`, true);
  const course = await getCourse(slug);
  const enrollment = await getEnrollment(course.id);
  if (hasPaidAccess(enrollment)) return navigate(`/learn/${slug}`, true);
  const prices = course.challenge_prices || [];
  const stripe = prices.find((p) => p.provider === 'stripe' && p.currency === 'USD');
  const razorpay = prices.find((p) => p.provider === 'razorpay' && p.currency === 'INR');
  const crypto = prices.find((p) => p.provider === 'crypto' && p.currency === 'USDT');
  app.innerHTML = `<div>${appHeader('catalog')}<main class="shell">
    <section class="checkout-head"><div class="eyebrow">UNLOCK ${escapeHtml(course.title)}</div><h1 class="display">Pay once. Enter the course.</h1><p class="lead">Gamification begins only after verified payment. The browser cannot grant itself access, charming as that would be.</p></section>
    <section class="payment-grid">
      <article class="payment-card ${!isIndia() ? 'recommended' : ''}"><div class="eyebrow">INTERNATIONAL</div><h2>Stripe</h2><strong>${money(stripe?.amount || 2, 'USD')}</strong><p>Hosted checkout for cards outside India.</p><ul><li>Verified webhook unlock</li><li>Lifetime course access</li><li>Quizzes, XP and progress</li></ul><button class="btn" data-pay="stripe">Pay in USD</button></article>
      <article class="payment-card ${isIndia() ? 'recommended' : ''}"><div class="eyebrow">INDIA</div><h2>Razorpay</h2><strong>${money(razorpay?.amount || 159, 'INR')}</strong><p>UPI, cards and Indian payment methods.</p><ul><li>Signed payment verification</li><li>Lifetime course access</li><li>Quizzes, XP and progress</li></ul><button class="btn" data-pay="razorpay">Pay in INR</button></article>
      <article class="payment-card crypto"><div class="eyebrow" style="color:var(--acid)">COMING NEXT</div><h2>Crypto</h2><strong>${crypto?.amount || 2} USDT</strong><p>USDT and USDC first. ETH and SOL later.</p><ul><li>On-chain verification required</li><li>No screenshot-based access</li><li>No manual transaction hash theatre</li></ul><button class="btn ghost" data-pay="crypto">View crypto status</button></article>
    </section><div id="payment-status"></div>
  </main>${footer()}</div>`;
  document.querySelectorAll('[data-pay]').forEach((button) => button.onclick = () => startPayment(button.dataset.pay, course));
}

async function startPayment(provider, course) {
  if (provider === 'crypto') return toast('Crypto is staged until wallet and on-chain verification are configured.');
  const status = document.querySelector('#payment-status');
  status.innerHTML = '<div class="payment-status">Creating secure checkout…</div>';
  const { data, error } = await client.functions.invoke('payment-checkout', { body: { challenge_slug: course.slug, provider, success_url: `${location.origin}/learn/${course.slug}`, cancel_url: location.href } });
  if (error || data?.error) {
    const message = error?.message || data?.error || 'Checkout could not be created.';
    status.innerHTML = `<div class="payment-status error"><strong>Checkout is not active.</strong><br>${escapeHtml(message)}</div>`;
    return;
  }
  if (provider === 'stripe') return location.assign(data.checkout_url);
  if (!window.Razorpay) return toast('Razorpay failed to load.', 'error');
  const rz = new window.Razorpay({
    key: data.key_id,
    amount: data.amount,
    currency: 'INR',
    order_id: data.provider_order_id,
    name: 'FINISH',
    description: course.title,
    handler: async (response) => {
      const result = await client.functions.invoke('razorpay-verify', { body: { internal_order_id: data.order_id, razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature } });
      if (result.error || result.data?.error) return toast(result.error?.message || result.data?.error, 'error');
      await refreshAuth();
      navigate(`/learn/${course.slug}`, true);
    },
    theme: { color: '#11110f' },
  });
  rz.open();
}
