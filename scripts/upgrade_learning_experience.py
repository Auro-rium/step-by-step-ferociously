from pathlib import Path

main_path = Path('src/main.tsx')
source = main_path.read_text()

old_select = """  const selectLesson = (lessonIndex: number) => { if (!canOpenLesson(lessonIndex)) return; setIndex(lessonIndex); setWatched(0); setActiveQuiz(null); setQuizResult(null); player.current?.playVideoAt(lessonIndex); };\n\n  const completeLesson = async () => {"""
new_select = """  const openLesson = (lessonIndex: number, force = false) => {\n    if (!force && !canOpenLesson(lessonIndex)) return;\n    setIndex(lessonIndex);\n    setWatched(0);\n    setActiveQuiz(null);\n    setQuizResult(null);\n    setError('');\n    player.current?.playVideoAt(lessonIndex);\n    window.scrollTo({ top: 0, behavior: 'smooth' });\n  };\n  const selectLesson = (lessonIndex: number) => openLesson(lessonIndex);\n\n  const continueFromLesson = (lessonIndex = index, newlyCompleted = false) => {\n    if (!state) return;\n    const completedCount = completed.size + (newlyCompleted && !completed.has(videoIds[lessonIndex] || '') ? 1 : 0);\n    const nextQuiz = state.quizzes.find((quiz) => Number(quiz.unlock_after_video || 0) === lessonIndex + 1 && !passed.has(quiz.id));\n    if (nextQuiz && completedCount >= Number(nextQuiz.unlock_after_video || 0)) {\n      setActiveQuiz(nextQuiz);\n      setQuizResult(null);\n      setError('');\n      window.scrollTo({ top: 0, behavior: 'smooth' });\n      return;\n    }\n    if (videoIds[lessonIndex + 1]) openLesson(lessonIndex + 1, true);\n  };\n\n  const continueFromQuiz = (quiz: Quiz) => {\n    const nextLesson = Number(quiz.unlock_after_video || 0);\n    if (videoIds[nextLesson]) openLesson(nextLesson, true);\n  };\n\n  const completeLesson = async () => {"""
if old_select not in source:
    raise SystemExit('select lesson anchor not found')
source = source.replace(old_select, new_select)

old_complete = """    setBusy(false); if (result.error) return setError(result.error.message);\n    const awarded = Number(Array.isArray(result.data) ? result.data[0]?.awarded_xp : result.data?.awarded_xp || 0);\n    setState((current) => current ? { ...current, progress: current.progress.some((item) => item.video_id === id) ? current.progress : [...current.progress, { video_id: id, challenge_id: current.course.id, status: 'completed', position: index }], xp: awarded ? [...current.xp, { amount: awarded }] : current.xp } : current);\n    const nextQuiz = state.quizzes.find((quiz) => Number(quiz.unlock_after_video || 0) === index + 1 && !passed.has(quiz.id));\n    window.setTimeout(() => { if (nextQuiz) { setActiveQuiz(nextQuiz); setQuizResult(null); } else if (videoIds[index + 1]) { selectLesson(index + 1); } }, 250);\n  };"""
new_complete = """    setBusy(false);\n    if (result.error) return setError(result.error.message);\n    setError('');\n    const awarded = Number(Array.isArray(result.data) ? result.data[0]?.awarded_xp : result.data?.awarded_xp || 0);\n    setState((current) => current ? { ...current, progress: current.progress.some((item) => item.video_id === id) ? current.progress : [...current.progress, { video_id: id, challenge_id: current.course.id, status: 'completed', position: index }], xp: awarded ? [...current.xp, { amount: awarded }] : current.xp } : current);\n    window.setTimeout(() => continueFromLesson(index, true), 180);\n  };"""
if old_complete not in source:
    raise SystemExit('complete lesson anchor not found')
source = source.replace(old_complete, new_complete)

old_quiz = """    if (Boolean(result.data?.passed)) { const nextLesson = Number(activeQuiz.unlock_after_video || 0); window.setTimeout(() => { if (videoIds[nextLesson]) selectLesson(nextLesson); }, 350); }\n  };"""
new_quiz = """    if (Boolean(result.data?.passed)) {\n      setError('');\n      window.setTimeout(() => continueFromQuiz(activeQuiz), 500);\n    }\n  };"""
if old_quiz not in source:
    raise SystemExit('quiz advance anchor not found')
source = source.replace(old_quiz, new_quiz)

old_controls = """<button className=\"button button-acid button-large\" disabled={busy || watched < 80 || completed.has(videoIds[index] || '')} onClick={completeLesson}>{completed.has(videoIds[index] || '') ? <><Check />Checkpoint complete</> : <><CirclePlay />Complete checkpoint</>}</button>"""
new_controls = """<button className=\"button button-acid button-large\" disabled={busy || (!completed.has(videoIds[index] || '') && watched < 80)} onClick={() => completed.has(videoIds[index] || '') ? continueFromLesson() : void completeLesson()}>{busy ? <><LoaderCircle className=\"spin\" />Saving progress…</> : completed.has(videoIds[index] || '') ? <><ArrowRight />Continue to next step</> : <><CirclePlay />Complete and continue</>}</button>"""
if old_controls not in source:
    raise SystemExit('lesson controls anchor not found')
source = source.replace(old_controls, new_controls)

old_result = """{quizResult && <div className={`quiz-result ${quizResult.passed ? 'pass' : 'fail'}`}><strong>{quizResult.passed ? 'Passed' : 'Not passed'} · {String(quizResult.score_percent)}%</strong><p>{String(quizResult.correct_count)} of {String(quizResult.total_count)} correct. {Number(quizResult.awarded_xp || 0) > 0 ? `+${String(quizResult.awarded_xp)} XP` : ''}</p></div>}"""
new_result = """{quizResult && <div className={`quiz-result ${quizResult.passed ? 'pass' : 'fail'}`}><strong>{quizResult.passed ? 'Checkpoint passed' : 'Not passed yet'} · {String(quizResult.score_percent)}%</strong><p>{String(quizResult.correct_count)} of {String(quizResult.total_count)} correct. {Number(quizResult.awarded_xp || 0) > 0 ? `+${String(quizResult.awarded_xp)} XP` : ''}</p>{Boolean(quizResult.passed) && <button type=\"button\" className=\"button button-acid\" onClick={() => continueFromQuiz(activeQuiz)}>Continue to next lesson <ArrowRight /></button>}</div>}"""
if old_result not in source:
    raise SystemExit('quiz result anchor not found')
source = source.replace(old_result, new_result)

old_header = """<p>{activeQuiz ? activeQuiz.description || 'Prove what you understood before moving on.' : 'Watch intentionally. Complete 80% to unlock the checkpoint.'}</p>"""
new_header = """<p>{activeQuiz ? activeQuiz.description || 'Pass this checkpoint to unlock the next lesson.' : completed.has(videoIds[index] || '') ? 'Completed. Continue to the next required step.' : 'Watch at least 80%, then complete the lesson to advance.'}</p>"""
if old_header not in source:
    raise SystemExit('lesson header anchor not found')
source = source.replace(old_header, new_header)

main_path.write_text(source)

styles_path = Path('src/styles.css')
styles = styles_path.read_text()
marker = '/* FINISH LEARN V2 */'
if marker not in styles:
    styles += """

/* FINISH LEARN V2 */
.lesson-controls { gap: 24px; align-items: center; }
.lesson-controls .button { min-width: 230px; justify-content: center; }
.quiz-result .button { margin-top: 14px; }
.lesson-list button { transition: transform .18s ease, border-color .18s ease, background .18s ease; }
.lesson-list button:not(:disabled):hover { transform: translateX(3px); }
.lesson-list button.active { box-shadow: inset 3px 0 0 currentColor; }
.form-message.error { position: relative; z-index: 2; }
@media (max-width: 900px) {
  .learn-page { display: block; }
  .quest-map { position: relative; width: 100%; height: auto; max-height: 42vh; overflow: auto; border-right: 0; border-bottom: 1px solid var(--line); }
  .lesson-workspace { min-width: 0; padding: 24px 18px 48px; }
  .lesson-header { gap: 16px; align-items: flex-start; }
  .lesson-controls { align-items: stretch; flex-direction: column; }
  .lesson-controls .button { width: 100%; min-width: 0; }
  .player-shell { border-radius: 16px; }
}
"""
styles_path.write_text(styles)
print('FINISH learning experience upgraded')
