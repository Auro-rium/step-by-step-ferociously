from __future__ import annotations

import re
from pathlib import Path

PATH = Path('src/main.tsx')
text = PATH.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)


def regex_once(pattern: str, replacement: str, label: str) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: expected one regex match, found {count}')


replace_once(
    "import './styles.css';",
    "import './styles.css';\nimport { AdminProjectReviews, FinalProjectPanel, regionalPrice, useRegion, type CourseProject, type CourseStep, type ProjectSubmission, type RegionalOffer } from './course-product';",
    'course product import',
)

replace_once(
    "  created_at?: string | null;\n  challenge_prices?: ChallengePrice[];",
    "  created_at?: string | null;\n  source_title?: string | null;\n  source_channel?: string | null;\n  source_url?: string | null;\n  difficulty?: string | null;\n  project_required?: boolean | null;\n  challenge_prices?: ChallengePrice[];",
    'challenge source fields',
)

regex_once(
    r"export async function getLearningData\(userId: string, challengeId: string\) \{.*?\n\}\n\nexport async function getAdminData",
    """export async function getLearningData(userId: string, challengeId: string) {
  const [progress, xp, quizzes, attempts, steps, project, submission] = await Promise.all([
    withTimeout(supabase.from('playlist_video_progress').select('*').eq('user_id', userId).eq('challenge_id', challengeId), 8000, 'Progress'),
    withTimeout(supabase.from('xp_events').select('*').eq('user_id', userId).eq('challenge_id', challengeId), 8000, 'XP'),
    withTimeout(supabase.from('course_quizzes').select('*, course_quiz_questions(*)').eq('challenge_id', challengeId).eq('published', true).order('position'), 8000, 'Quizzes'),
    withTimeout(supabase.from('course_quiz_attempts').select('*').eq('user_id', userId).order('created_at', { ascending: false }), 8000, 'Attempts'),
    withTimeout(supabase.from('challenge_steps').select('*').eq('challenge_id', challengeId).order('position'), 8000, 'Lessons'),
    withTimeout(supabase.from('course_projects').select('*').eq('challenge_id', challengeId).maybeSingle(), 8000, 'Final project'),
    withTimeout(supabase.from('course_project_submissions').select('*').eq('user_id', userId).eq('challenge_id', challengeId).maybeSingle(), 8000, 'Project submission'),
  ]);
  if (progress.error) throw progress.error;
  if (quizzes.error) throw quizzes.error;
  if (steps.error) throw steps.error;
  if (project.error) throw project.error;
  if (submission.error) throw submission.error;
  return {
    progress: (progress.data ?? []) as VideoProgress[],
    xp: (xp.data ?? []) as XpEvent[],
    quizzes: (quizzes.data ?? []) as Quiz[],
    attempts: (attempts.data ?? []) as QuizAttempt[],
    steps: (steps.data ?? []) as CourseStep[],
    project: project.data as CourseProject | null,
    submission: submission.data as ProjectSubmission | null,
  };
}

export async function getAdminData""",
    'learning data expansion',
)

regex_once(
    r"function priceFor\(course: Challenge\) \{.*?\n\}",
    """function priceFor(course: Challenge, region: RegionalOffer) {
  return regionalPrice(course.challenge_prices ?? [], region);
}""",
    'regional price function',
)

replace_once(
    "function CourseCard({ course, enrollment }: { course: Challenge; enrollment?: Enrollment | null }) {\n  const price = priceFor(course);",
    "function CourseCard({ course, enrollment }: { course: Challenge; enrollment?: Enrollment | null }) {\n  const region = useRegion();\n  const price = priceFor(course, region);",
    'course card region',
)

replace_once(
    "  const { slug = '' } = useParams();\n  const { user } = useSession();\n  const [course, setCourse]",
    "  const { slug = '' } = useParams();\n  const { user } = useSession();\n  const region = useRegion();\n  const [course, setCourse]",
    'course page region',
)
replace_once("  const price = priceFor(course);", "  const price = priceFor(course, region);", 'course page price')
replace_once(
    '<p className="course-lead">{course.description}</p><div className="course-pills">',
    '<p className="course-lead">{course.description}</p><p className="regional-note">Source: {course.source_title || course.title} · {course.source_channel || \'YouTube educator\'}</p><div className="course-pills">',
    'course attribution',
)
replace_once(
    '<Pill>Progress + XP</Pill>',
    '<Pill>Progress + XP</Pill><Pill>{course.difficulty || \'Advanced\'}</Pill><Pill>Reviewed final project</Pill>',
    'course product pills',
)
replace_once(
    "['Complete playlist route','Saved lesson progress','Quiz checkpoints','XP and streak tracking','Personal learner dashboard','Permanent course access']",
    "['Complete named lecture route','Saved lesson progress','Authored quiz checkpoints','Cumulative final assessment','Reviewed final project','XP and streak tracking','Permanent course access']",
    'included product list',
)

replace_once(
    "function Checkout() {\n  const { slug = '' } = useParams(); const { user, refresh } = useSession(); const navigate = useNavigate();",
    "function Checkout() {\n  const { slug = '' } = useParams(); const { user, refresh } = useSession(); const navigate = useNavigate(); const region = useRegion();",
    'checkout region hook',
)
replace_once(
    "    if (!course) return; setBusy(provider); setError('');",
    "    if (!course) return; if (provider !== region.provider) return; setBusy(provider); setError('');",
    'checkout provider enforcement',
)
replace_once(
    '<p>One payment. Permanent access. Progress, quizzes and XP unlock only after verified payment.</p>',
    '<p>One payment. Permanent access. {region.countryName} checkout uses {region.provider === \'razorpay\' ? \'Razorpay in INR\' : \'Stripe in USD\'}.</p>',
    'checkout market copy',
)
replace_once('<section className="checkout-grid">\n    <article className="payment-card">', '<section className="checkout-grid">\n    {region.provider === \'stripe\' && <article className="payment-card">', 'stripe conditional start')
replace_once('</button></article>\n    <article className="payment-card recommended">', '</button></article>}\n    {region.provider === \'razorpay\' && <article className="payment-card recommended">', 'payment conditional bridge')
replace_once('</button></article>\n  </section><div className="secure-note">', '</button></article>}\n  </section><div className="secure-note">', 'razorpay conditional end')

replace_once(
    "interface LearningState { course: Challenge; progress: VideoProgress[]; xp: XpEvent[]; quizzes: Quiz[]; attempts: QuizAttempt[]; }",
    "interface LearningState { course: Challenge; progress: VideoProgress[]; xp: XpEvent[]; quizzes: Quiz[]; attempts: QuizAttempt[]; steps: CourseStep[]; project: CourseProject | null; submission: ProjectSubmission | null; }",
    'learning state projects',
)
replace_once(
    "<b>Lesson {String(lessonIndex + 1).padStart(2, '0')}</b>",
    "<b>{state.steps[lessonIndex]?.title || `Lesson ${String(lessonIndex + 1).padStart(2, '0')}`}</b>",
    'named lesson navigation',
)
replace_once(
    "<h1>{activeQuiz ? activeQuiz.title : `Lesson ${index + 1}`}</h1>",
    "<h1>{activeQuiz ? activeQuiz.title : state.steps[index]?.title || `Lesson ${index + 1}`}</h1>",
    'named lesson header',
)

learn_end = "\n    </section>\n  </main>;\n}\n\n// ---- src/pages/Admin.tsx ----"
if text.count(learn_end) != 1:
    raise RuntimeError(f'learn ending: expected one match, found {text.count(learn_end)}')
project_markup = """
      <FinalProjectPanel
        supabase={supabase}
        project={state.project}
        submission={state.submission}
        unlocked={completed.size >= Number(state.course.lesson_count || 0) && state.quizzes.every((quiz) => passed.has(quiz.id))}
        onSubmitted={(submission) => setState((current) => current ? { ...current, submission } : current)}
      />
    </section>
  </main>;
}

// ---- src/pages/Admin.tsx ----"""
text = text.replace(learn_end, '\n' + project_markup, 1)

replace_once(
    "useState<'course' | 'quiz' | 'orders'>('course')",
    "useState<'course' | 'quiz' | 'projects' | 'orders'>('course')",
    'admin project tab type',
)
replace_once(
    "<button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ReceiptText />Orders</button>",
    "<button className={tab === 'projects' ? 'active' : ''} onClick={() => setTab('projects')}><ClipboardList />Project reviews</button><button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ReceiptText />Orders</button>",
    'admin project tab button',
)
replace_once(
    "    {tab === 'orders' && <section className=\"panel orders-panel\">",
    "    {tab === 'projects' && <AdminProjectReviews supabase={supabase} />}\n    {tab === 'orders' && <section className=\"panel orders-panel\">",
    'admin project review panel',
)

PATH.write_text(text, encoding='utf-8')
print('FINISH course product integration applied successfully.')
