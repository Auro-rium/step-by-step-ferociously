from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
main_path = root / 'src' / 'main.tsx'
product_path = root / 'src' / 'course-product.tsx'
region_path = root / 'api' / 'region.ts'
readme_path = root / 'README.md'

main = main_path.read_text()
product = product_path.read_text()
region = region_path.read_text()
readme = readme_path.read_text()

# Payment provider migration in frontend and region model.
main = main.replace("type PaymentProvider = 'stripe' | 'razorpay' | 'crypto' | string;", "type PaymentProvider = 'paypal' | 'razorpay' | 'crypto' | string;")
main = main.replace("useState({ stripe: false, razorpay: false })", "useState({ paypal: false, razorpay: false })")
main = main.replace("setReadiness({ stripe: Boolean(result.data?.stripe), razorpay: Boolean(result.data?.razorpay) })", "setReadiness({ paypal: Boolean(result.data?.paypal), razorpay: Boolean(result.data?.razorpay) })")
main = main.replace("provider: 'stripe' | 'razorpay'", "provider: 'paypal' | 'razorpay'")
main = main.replace("provider === 'stripe'", "provider === 'paypal'")
main = main.replace("provider === 'razorpay' ? 'Razorpay in INR' : 'Stripe in USD'", "provider === 'razorpay' ? 'Razorpay in INR' : 'PayPal in USD'")
main = main.replace("price.provider === 'stripe'", "price.provider === 'paypal'")
main = main.replace("Secure hosted checkout through Stripe.", "Secure international checkout through PayPal.")
main = main.replace("Pay with Stripe", "Pay with PayPal")
main = main.replace("Stripe setup pending", "PayPal setup pending")
main = main.replace("readiness.stripe", "readiness.paypal")
main = main.replace("busy === 'stripe'", "busy === 'paypal'")
main = main.replace("pay('stripe')", "pay('paypal')")
main = main.replace("region.provider === 'stripe'", "region.provider === 'paypal'")
main = main.replace("Stripe", "PayPal")

product = product.replace("provider: 'stripe' | 'razorpay';", "provider: 'paypal' | 'razorpay';")
product = product.replace("provider: 'stripe',", "provider: 'paypal',")
region = region.replace("provider: india ? 'razorpay' : 'stripe'", "provider: india ? 'razorpay' : 'paypal'")
readme = readme.replace('Stripe and Razorpay', 'PayPal and Razorpay').replace('Stripe for USD', 'PayPal for USD').replace('STRIPE_SECRET_KEY=', 'PAYPAL_CLIENT_ID=\nPAYPAL_CLIENT_SECRET=\nPAYPAL_ENV=sandbox\nPAYPAL_WEBHOOK_ID=').replace('STRIPE_WEBHOOK_SECRET=\n', '')

# Quizzes are mandatory gates before the lesson after their unlock milestone.
old_gate = "const canOpenLesson = (lessonIndex: number) => lessonIndex === 0 || completed.has(videoIds[lessonIndex - 1] || '');"
new_gate = "const canOpenLesson = (lessonIndex: number) => { if (lessonIndex === 0) return true; if (!completed.has(videoIds[lessonIndex - 1] || '')) return false; return state?.quizzes.filter((quiz) => Number(quiz.unlock_after_video || 0) <= lessonIndex).every((quiz) => passed.has(quiz.id)) ?? true; };"
if old_gate not in main:
    raise SystemExit('Lesson gate anchor missing')
main = main.replace(old_gate, new_gate)

old_complete = "setState((current) => current ? { ...current, progress: current.progress.some((item) => item.video_id === id) ? current.progress : [...current.progress, { video_id: id, challenge_id: current.course.id, status: 'completed', position: index }], xp: awarded ? [...current.xp, { amount: awarded }] : current.xp } : current);"
new_complete = old_complete + "\n    const nextQuiz = state.quizzes.find((quiz) => Number(quiz.unlock_after_video || 0) === index + 1 && !passed.has(quiz.id));\n    window.setTimeout(() => { if (nextQuiz) { setActiveQuiz(nextQuiz); setQuizResult(null); } else if (videoIds[index + 1]) { selectLesson(index + 1); } }, 250);"
if old_complete not in main:
    raise SystemExit('Checkpoint completion anchor missing')
main = main.replace(old_complete, new_complete, 1)

old_submit = "setState((current) => current ? { ...current, attempts: [{ quiz_id: activeQuiz.id, passed: Boolean(result.data?.passed), score_percent: Number(result.data?.score_percent || 0) }, ...current.attempts], xp: Number(result.data?.awarded_xp || 0) ? [...current.xp, { amount: Number(result.data.awarded_xp) }] : current.xp } : current);"
new_submit = old_submit + "\n    if (Boolean(result.data?.passed)) { const nextLesson = Number(activeQuiz.unlock_after_video || 0); window.setTimeout(() => { if (videoIds[nextLesson]) selectLesson(nextLesson); }, 350); }"
if old_submit not in main:
    raise SystemExit('Quiz submit anchor missing')
main = main.replace(old_submit, new_submit, 1)

# Build one ordered route: lessons, milestone quizzes, then the final project panel below.
insert_anchor = "  if (error && !state) return <main className=\"app-page shell\"><PageError message={error} /></main>;"
route_code = """  const routeNodes = videoIds.flatMap((id, lessonIndex) => [
    { type: 'lesson' as const, id, lessonIndex },
    ...state?.quizzes.filter((quiz) => Number(quiz.unlock_after_video || 0) === lessonIndex + 1).map((quiz) => ({ type: 'quiz' as const, quiz })) ?? [],
  ]);

"""
if route_code.strip() not in main:
    if insert_anchor not in main:
        raise SystemExit('Route insertion anchor missing')
    main = main.replace(insert_anchor, route_code + insert_anchor, 1)

nav_pattern = re.compile(r'<nav className="lesson-list">.*?</nav></aside>', re.S)
nav_replacement = '''<nav className="lesson-list">{videoIds.length ? routeNodes.map((node) => {
      if (node.type === 'lesson') { const done = completed.has(node.id); const unlocked = canOpenLesson(node.lessonIndex); return <button key={`lesson-${node.id}`} className={`${index === node.lessonIndex && !activeQuiz ? 'active' : ''} ${done ? 'done' : ''}`} disabled={!unlocked} onClick={() => selectLesson(node.lessonIndex)}><i>{done ? <Check /> : unlocked ? node.lessonIndex + 1 : <LockKeyhole />}</i><span><b>{state.steps[node.lessonIndex]?.title || `Lesson ${String(node.lessonIndex + 1).padStart(2, '0')}`}</b><small>{done ? 'Checkpoint complete' : unlocked ? 'Video checkpoint' : 'Pass the previous checkpoint'}</small></span></button>; }
      const quiz = node.quiz; const unlocked = completed.size >= Number(quiz.unlock_after_video || 0); const done = passed.has(quiz.id); return <button key={`quiz-${quiz.id}`} className={`quiz-step ${activeQuiz?.id === quiz.id ? 'active' : ''} ${done ? 'done' : ''}`} disabled={!unlocked} onClick={() => { setActiveQuiz(quiz); setQuizResult(null); }}><i>{done ? <Check /> : unlocked ? '?' : <LockKeyhole />}</i><span><b>{quiz.title}</b><small>{unlocked ? `${quiz.pass_percent}% to pass · ${quiz.xp_reward} XP` : `Unlocks after ${quiz.unlock_after_video} lessons`}</small></span></button>;
    }) : <div className="mini-loader">Loading playlist…</div>}</nav></aside>'''
main, count = nav_pattern.subn(nav_replacement, main, count=1)
if count != 1:
    raise SystemExit(f'Ordered route replacement failed: {count}')

main_path.write_text(main)
product_path.write_text(product)
region_path.write_text(region)
readme_path.write_text(readme)
print('FINISH progression and PayPal patch applied.')
