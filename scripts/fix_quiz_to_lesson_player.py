from pathlib import Path

path = Path('src/main.tsx')
text = path.read_text()

# Player lifecycle belongs to the generic learning engine. It must not exist
# while a quiz replaces its DOM host, and must be recreated for the canonical
# lesson selected after the quiz.
text = text.replace(
    "if (!state || !videoIds.length) return;",
    "if (!state || !videoIds.length || activeQuiz) return;",
    1,
)
text = text.replace(
    "}, [state?.course.id, videoIds.length]);",
    "}, [state?.course.id, videoIds.length, activeQuiz?.id, index]);",
    1,
)
text = text.replace(
    "    player.current?.cueVideoById(exactVideoId);\n",
    "",
    1,
)
text = text.replace(
    '<div id="youtube-player" />',
    '<div key={videoIds[index]} id="youtube-player" />',
    1,
)

old_continue = """  const continueFromQuiz = (quiz: Quiz) => {
    const nextLesson = Number(quiz.unlock_after_video || 0);
    if (videoIds[nextLesson]) openLesson(nextLesson, true);
  };
"""
new_continue = """  const continueFromServerStep = (nextStep: Record<string, unknown> | null | undefined) => {
    if (!nextStep) return setError('The next course step could not be resolved.');
    if (nextStep.type === 'lesson') {
      const nextIndex = Number(nextStep.position) - 1;
      if (!Number.isInteger(nextIndex) || nextIndex < 0 || !videoIds[nextIndex]) {
        return setError('The next lesson is missing from the canonical course route.');
      }
      openLesson(nextIndex, true);
      return;
    }
    if (nextStep.type === 'final_project') {
      setActiveQuiz(null);
      setQuizResult(null);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }
    setError('The next course step is not available yet.');
  };
"""
if old_continue not in text:
    raise SystemExit('Legacy quiz continuation controller not found')
text = text.replace(old_continue, new_continue, 1)

old_submit_tail = """setQuizResult(result.data as Record<string, unknown>); setState((current) => current ? { ...current, attempts: [{ quiz_id: activeQuiz.id, passed: Boolean(result.data?.passed), score_percent: Number(result.data?.score_percent || 0) }, ...current.attempts], xp: Number(result.data?.awarded_xp || 0) ? [...current.xp, { amount: Number(result.data.awarded_xp) }] : current.xp } : current);
    if (Boolean(result.data?.passed)) {
      setError('');
      window.setTimeout(() => continueFromQuiz(activeQuiz), 500);
    }
"""
new_submit_tail = """const payload = result.data as Record<string, unknown>; setQuizResult(payload); setState((current) => current ? { ...current, attempts: [{ quiz_id: activeQuiz.id, passed: Boolean(payload.passed), score_percent: Number(payload.score_percent || 0) }, ...current.attempts], xp: Number(payload.awarded_xp || 0) ? [...current.xp, { amount: Number(payload.awarded_xp) }] : current.xp } : current);
    if (Boolean(payload.passed)) {
      setError('');
      window.setTimeout(() => continueFromServerStep(payload.next_step as Record<string, unknown> | undefined), 250);
    }
"""
if old_submit_tail not in text:
    raise SystemExit('Quiz submission continuation block not found')
text = text.replace(old_submit_tail, new_submit_tail, 1)

old_button = "onClick={() => continueFromQuiz(activeQuiz)}>Continue to next lesson"
new_button = "onClick={() => continueFromServerStep(quizResult.next_step as Record<string, unknown> | undefined)}>Continue to next step"
if old_button not in text:
    raise SystemExit('Quiz continuation button not found')
text = text.replace(old_button, new_button, 1)

required = [
    "activeQuiz?.id, index",
    "key={videoIds[index]}",
    "continueFromServerStep",
    "payload.next_step",
]
for marker in required:
    if marker not in text:
        raise SystemExit(f'Missing systemic progression marker: {marker}')

path.write_text(text)
