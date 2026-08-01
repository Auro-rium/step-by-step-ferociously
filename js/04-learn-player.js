async function loadLearningState(course, enrollment) {
  const userId = authContext.session.user.id;
  const [{ data: progress }, { data: xp }, { data: quizzes, error: quizError }, { data: attempts }] = await Promise.all([
    client.from('playlist_video_progress').select('*').eq('user_id', userId).eq('challenge_id', course.id),
    client.from('xp_events').select('*').eq('user_id', userId).eq('challenge_id', course.id),
    client.from('course_quizzes').select('*, course_quiz_questions(*)').eq('challenge_id', course.id).eq('published', true).order('position'),
    client.from('course_quiz_attempts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);
  if (quizError) throw quizError;
  return { course, enrollment, progress: progress || [], xp: xp || [], quizzes: quizzes || [], attempts: attempts || [], ids: [], metadata: [], currentIndex: 0, watchPercent: 0 };
}

async function renderLearn(slug) {
  if (!authContext.session) return navigate(`/auth?next=${encodeURIComponent(`/learn/${slug}`)}`, true);
  const course = await getCourse(slug);
  const enrollment = await getEnrollment(course.id);
  if (!hasPaidAccess(enrollment)) return navigate(`/checkout/${slug}`, true);
  currentCourseState = await loadLearningState(course, enrollment);
  cleanupPlayer();
  app.innerHTML = `<div class="app-shell">${appHeader('home')}<div class="learn-layout">
    <aside class="quest-sidebar"><div class="eyebrow" style="color:var(--acid)">QUEST MAP</div><h2>${escapeHtml(course.title)}</h2><div class="quest-progress"><strong id="learn-percent">0%</strong><div class="progress-track"><i id="learn-progress" style="width:0"></i></div><span class="muted">Course completion</span></div><div id="route-list" class="route-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></aside>
    <main class="learn-main"><header class="learn-head"><div><div class="eyebrow" style="color:var(--acid)">PAID LEARNING SPACE</div><h1 id="lesson-heading">Loading the playlist…</h1><p id="lesson-copy">Your route, quizzes and progress are being prepared.</p></div><div class="xp-chip"><span id="learn-xp">${currentCourseState.xp.reduce((s, x) => s + Number(x.amount || 0), 0)}</span> XP</div></header>
    <section id="player-card" class="player-card"><div id="youtube-player" class="youtube-player"></div><div class="lesson-info"><div><div class="eyebrow" style="color:var(--acid)" id="lesson-position">LESSON</div><h2 id="lesson-title">Preparing video</h2><p id="lesson-description">Watch at least 80% to complete the checkpoint and unlock the next lesson.</p></div><div class="watch-meter"><span id="watch-label">0% watched</span><div class="progress-track"><i id="watch-progress" style="width:0"></i></div><button id="complete-lesson" class="btn acid" disabled>Complete checkpoint</button></div></div></section>
    <section id="quiz-area"></section>
    </main></div></div>`;
  initializeYouTube(course.youtube_playlist_id);
}

function initializeYouTube(playlistId) {
  const create = () => {
    if (!window.YT?.Player || player) return;
    player = new window.YT.Player('youtube-player', {
      width: '100%', height: '100%',
      playerVars: { listType: 'playlist', list: playlistId, rel: 0, modestbranding: 1, playsinline: 1 },
      events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange, onError: () => toast('This playlist could not be loaded from YouTube.', 'error') },
    });
  };
  window.onYouTubeIframeAPIReady = create;
  if (window.YT?.Player) create();
  else setTimeout(() => { if (!player) create(); }, 1200);
}

async function onPlayerReady(event) {
  playerReady = true;
  currentCourseState.ids = event.target.getPlaylist() || [];
  if (!currentCourseState.ids.length) return toast('YouTube returned no videos for this playlist.', 'error');
  if (authContext.profile?.role === 'admin' && Number(currentCourseState.course.lesson_count || 0) !== currentCourseState.ids.length) {
    client.from('challenges').update({ lesson_count: currentCourseState.ids.length, total_xp: currentCourseState.ids.length * 20 + currentCourseState.quizzes.reduce((s, q) => s + q.xp_reward, 0) }).eq('id', currentCourseState.course.id).then(() => {});
  }
  renderLearningRoute();
  hydrateMetadata(currentCourseState.ids);
  const firstIncomplete = currentCourseState.ids.findIndex((id) => !completedIds().has(id));
  selectLesson(firstIncomplete < 0 ? 0 : firstIncomplete, false);
}

async function hydrateMetadata(ids) {
  const metadata = new Array(ids.length).fill(null);
  const worker = async (id, index) => {
    try {
      const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('metadata unavailable');
      const item = await response.json();
      metadata[index] = { title: item.title, author: item.author_name, thumbnail: item.thumbnail_url };
    } catch { metadata[index] = { title: `Lesson ${String(index + 1).padStart(2, '0')}`, author: 'YouTube playlist', thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }; }
  };
  for (let start = 0; start < ids.length; start += 6) await Promise.all(ids.slice(start, start + 6).map((id, offset) => worker(id, start + offset)));
  currentCourseState.metadata = metadata;
  renderLearningRoute();
  updateLessonCopy();
}

function completedIds() {
  return new Set(currentCourseState.progress.filter((p) => p.status === 'completed').map((p) => p.video_id));
}

function passedQuizIds() {
  return new Set(currentCourseState.attempts.filter((a) => a.passed).map((a) => a.quiz_id));
}

function lessonUnlocked(index) {
  if (index === 0) return true;
  return completedIds().has(currentCourseState.ids[index - 1]);
}

function quizUnlocked(quiz) {
  return completedIds().size >= Number(quiz.unlock_after_video || 0);
}
