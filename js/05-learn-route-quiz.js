function renderLearningRoute() {
  if (!currentCourseState?.ids?.length) return;
  const done = completedIds();
  const passed = passedQuizIds();
  const milestones = new Map();
  currentCourseState.quizzes.forEach((quiz) => {
    const key = Number(quiz.unlock_after_video || 0);
    if (!milestones.has(key)) milestones.set(key, []);
    milestones.get(key).push(quiz);
  });
  let html = '';
  currentCourseState.ids.forEach((id, index) => {
    const metadata = currentCourseState.metadata[index];
    const unlocked = lessonUnlocked(index);
    html += `<button class="route-item ${done.has(id) ? 'done' : ''} ${currentCourseState.currentIndex === index ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-lesson="${index}"><span class="route-num">${done.has(id) ? '✓' : String(index + 1).padStart(2, '0')}</span><span class="route-copy"><strong>${escapeHtml(metadata?.title || `Lesson ${String(index + 1).padStart(2, '0')}`)}</strong><small>${unlocked ? (done.has(id) ? 'Checkpoint complete' : 'Video checkpoint · 20 XP') : 'Complete the previous lesson'}</small></span></button>`;
    const after = index + 1;
    (milestones.get(after) || []).forEach((quiz) => {
      const unlockedQuiz = quizUnlocked(quiz);
      html += `<button class="route-item quiz ${passed.has(quiz.id) ? 'done' : ''} ${unlockedQuiz ? '' : 'locked'}" data-quiz="${quiz.id}"><span class="route-num">${passed.has(quiz.id) ? '✓' : '?'}</span><span class="route-copy"><strong>${escapeHtml(quiz.title)}</strong><small>${unlockedQuiz ? `${quiz.pass_percent}% to pass · ${quiz.xp_reward} XP` : `Unlocks after ${quiz.unlock_after_video} lessons`}</small></span></button>`;
    });
  });
  document.querySelector('#route-list').innerHTML = html;
  document.querySelectorAll('[data-lesson]').forEach((button) => button.onclick = () => {
    const index = Number(button.dataset.lesson);
    if (!lessonUnlocked(index)) return toast('Complete the previous lesson first.');
    selectLesson(index, true);
  });
  document.querySelectorAll('[data-quiz]').forEach((button) => button.onclick = () => {
    const quiz = currentCourseState.quizzes.find((q) => q.id === button.dataset.quiz);
    if (!quizUnlocked(quiz)) return toast(`Complete ${quiz.unlock_after_video} lessons first.`);
    openQuiz(quiz);
  });
  const total = currentCourseState.ids.length + currentCourseState.quizzes.length;
  const finished = done.size + passed.size;
  const percent = total ? Math.round((finished / total) * 100) : 0;
  document.querySelector('#learn-percent').textContent = `${percent}%`;
  document.querySelector('#learn-progress').style.width = `${percent}%`;
  document.querySelector('#learn-xp').textContent = currentCourseState.xp.reduce((s, x) => s + Number(x.amount || 0), 0);
}

function selectLesson(index, autoplay = true) {
  if (!playerReady || !currentCourseState.ids[index]) return;
  currentCourseState.currentIndex = index;
  currentCourseState.watchPercent = 0;
  if (autoplay) player.playVideoAt(index);
  else player.cueVideoById(currentCourseState.ids[index]);
  updateLessonCopy();
  updateWatchMeter();
  renderLearningRoute();
  document.querySelector('#quiz-area').innerHTML = '';
  document.querySelector('#player-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateLessonCopy() {
  if (!currentCourseState?.ids?.length) return;
  const index = currentCourseState.currentIndex;
  const meta = currentCourseState.metadata[index];
  document.querySelector('#lesson-heading').textContent = meta?.title || `Lesson ${index + 1}`;
  document.querySelector('#lesson-copy').textContent = meta?.author ? `From ${meta.author}. Complete the checkpoint to move forward.` : 'Complete the checkpoint to move forward.';
  document.querySelector('#lesson-position').textContent = `LESSON ${String(index + 1).padStart(2, '0')} OF ${currentCourseState.ids.length}`;
  document.querySelector('#lesson-title').textContent = meta?.title || `Playlist lesson ${index + 1}`;
  const button = document.querySelector('#complete-lesson');
  const done = completedIds().has(currentCourseState.ids[index]);
  button.textContent = done ? 'Checkpoint complete ✓' : 'Complete checkpoint';
  button.disabled = done || currentCourseState.watchPercent < 80;
  button.onclick = completeCurrentLesson;
}

function onPlayerStateChange(event) {
  clearInterval(playerTimer);
  if (event.data === window.YT.PlayerState.PLAYING) {
    playerTimer = setInterval(() => {
      const duration = Number(player.getDuration() || 0);
      const current = Number(player.getCurrentTime() || 0);
      currentCourseState.watchPercent = duration ? Math.min(100, Math.round((current / duration) * 100)) : 0;
      updateWatchMeter();
    }, 1000);
  }
  if (event.data === window.YT.PlayerState.ENDED) {
    currentCourseState.watchPercent = 100;
    updateWatchMeter();
  }
}

function updateWatchMeter() {
  const value = currentCourseState?.watchPercent || 0;
  const label = document.querySelector('#watch-label');
  const bar = document.querySelector('#watch-progress');
  const button = document.querySelector('#complete-lesson');
  if (!label || !bar || !button) return;
  label.textContent = `${value}% watched${value >= 80 ? ' · checkpoint ready' : ''}`;
  bar.style.width = `${value}%`;
  const id = currentCourseState.ids[currentCourseState.currentIndex];
  button.disabled = completedIds().has(id) || value < 80;
}

async function completeCurrentLesson() {
  const state = currentCourseState;
  const videoId = state.ids[state.currentIndex];
  if (!videoId || state.watchPercent < 80) return toast('Watch at least 80% first.');
  const button = document.querySelector('#complete-lesson');
  button.disabled = true;
  const { data, error } = await client.rpc('complete_playlist_video', { p_challenge_id: state.course.id, p_video_id: videoId, p_position: state.currentIndex });
  if (error) { button.disabled = false; return toast(error.message, 'error'); }
  if (!state.progress.some((p) => p.video_id === videoId)) state.progress.push({ video_id: videoId, status: 'completed', position: state.currentIndex });
  const award = Array.isArray(data) ? data[0]?.awarded_xp : data?.awarded_xp;
  if (Number(award || 0) > 0) state.xp.push({ amount: Number(award) });
  toast(Number(award || 0) ? `Checkpoint saved. +${award} XP` : 'Checkpoint was already complete.', 'success');
  renderLearningRoute();
  updateLessonCopy();
  const next = state.currentIndex + 1;
  if (state.ids[next]) setTimeout(() => selectLesson(next, false), 650);
}

function openQuiz(quiz) {
  const questions = (quiz.course_quiz_questions || []).sort((a, b) => a.position - b.position);
  const previous = currentCourseState.attempts.find((a) => a.quiz_id === quiz.id && a.passed);
  document.querySelector('#quiz-area').innerHTML = `<section class="quiz-panel"><div class="eyebrow">KNOWLEDGE CHECKPOINT ${quiz.position}</div><h2>${escapeHtml(quiz.title)}</h2><p class="muted">${escapeHtml(quiz.description || '')} Score ${quiz.pass_percent}% or higher to pass and earn ${quiz.xp_reward} XP.</p>${previous ? `<div class="quiz-result pass"><strong>Already passed · ${previous.score_percent}%</strong><p>You can retake it, but XP is awarded only once.</p></div>` : ''}<form id="quiz-form">${questions.map((q, index) => `<article class="question"><div class="eyebrow">QUESTION ${index + 1}</div><h3>${escapeHtml(q.prompt)}</h3><div class="options">${(q.options || []).map((option, optionIndex) => `<label class="option"><input type="radio" name="q-${q.id}" value="${optionIndex}" required><span>${escapeHtml(option)}</span></label>`).join('')}</div></article>`).join('')}<button class="btn" type="submit">Submit quiz</button></form><div id="quiz-result"></div></section>`;
  document.querySelector('#quiz-form').onsubmit = (event) => submitQuiz(event, quiz, questions);
  document.querySelector('#quiz-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitQuiz(event, quiz, questions) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const answers = questions.map((q) => ({ question_id: q.id, selected_index: Number(new FormData(event.currentTarget).get(`q-${q.id}`)) }));
  const { data, error } = await client.rpc('submit_course_quiz', { p_quiz_id: quiz.id, p_answers: answers });
  button.disabled = false;
  if (error) return toast(error.message, 'error');
  currentCourseState.attempts.unshift({ quiz_id: quiz.id, passed: data.passed, score_percent: data.score_percent });
  if (Number(data.awarded_xp || 0) > 0) currentCourseState.xp.push({ amount: Number(data.awarded_xp) });
  const result = document.querySelector('#quiz-result');
  result.innerHTML = `<div class="quiz-result ${data.passed ? 'pass' : 'fail'}"><strong>${data.passed ? 'Passed' : 'Not passed'} · ${data.score_percent}%</strong><p>${data.correct_count} of ${data.total_count} correct. ${data.awarded_xp ? `+${data.awarded_xp} XP` : ''}</p>${(data.feedback || []).map((f, i) => `<div class="feedback-item"><b>Question ${i + 1}: ${f.correct ? 'Correct' : 'Review'}</b><br>${escapeHtml(f.explanation)}</div>`).join('')}</div>`;
  toast(data.passed ? 'Quiz passed.' : 'Review the feedback and try again.', data.passed ? 'success' : 'error');
  renderLearningRoute();
}

function cleanupPlayer() {
  clearInterval(playerTimer);
  playerTimer = null;
  if (player?.destroy) player.destroy();
  player = null;
  playerReady = false;
}
