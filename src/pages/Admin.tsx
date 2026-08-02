import { useEffect, useState, type FormEvent } from 'react';
import { BookPlus, ClipboardList, LoaderCircle, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { AdminProjectReviews } from '../course-product';
import {
  getAdminData,
  PageError,
  PageLoader,
  supabase,
  type Challenge,
  type PaymentOrder,
} from '../main';

interface QuestionDraft {
  prompt: string;
  options: string;
  correct: number;
  explanation: string;
}

const blankQuestion = (): QuestionDraft => ({
  prompt: '',
  options: '',
  correct: 1,
  explanation: '',
});

export default function Admin() {
  const [tab, setTab] = useState<'course' | 'quiz' | 'projects' | 'orders'>('course');
  const [courses, setCourses] = useState<Challenge[]>([]);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    blankQuestion(),
    blankQuestion(),
    blankQuestion(),
  ]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminData();
      setCourses(data.courses);
      setOrders(data.orders);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Admin data could not load.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const publishCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    let playlist = '';
    try {
      playlist = new URL(String(form.get('playlist'))).searchParams.get('list') || '';
    } catch {
      setError('Use a valid YouTube playlist URL.');
      setBusy(false);
      return;
    }
    const result = await supabase.rpc('create_challenge_from_playlist', {
      p_title: form.get('title'),
      p_slug: form.get('slug'),
      p_description: form.get('description'),
      p_outcome: form.get('outcome'),
      p_playlist_id: playlist,
      p_cover_image_url: form.get('cover') || null,
      p_lesson_count: 0,
      p_usd: Number(form.get('usd')),
      p_inr: Number(form.get('inr')),
    });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    setMessage('Course published.');
    event.currentTarget.reset();
    await load();
  };

  const publishQuiz = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const payload = questions.map((question) => ({
      prompt: question.prompt,
      options: question.options.split('\n').map((item) => item.trim()).filter(Boolean),
      correct_index: question.correct - 1,
      explanation: question.explanation,
    }));
    const result = await supabase.rpc('admin_create_course_quiz', {
      p_challenge_slug: form.get('course'),
      p_title: form.get('title'),
      p_description: form.get('description'),
      p_position: Number(form.get('position')),
      p_unlock_after_video: Number(form.get('unlock')),
      p_pass_percent: Number(form.get('pass')),
      p_xp_reward: Number(form.get('xp')),
      p_questions: payload,
    });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    setMessage('Quiz published.');
    setQuestions([blankQuestion(), blankQuestion(), blankQuestion()]);
    event.currentTarget.reset();
  };

  if (loading) return <PageLoader label="Opening the admin workspace" />;
  if (error && !courses.length) {
    return <main className="app-page shell"><PageError message={error} /></main>;
  }

  return (
    <main className="app-page shell admin-page">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">PRIVATE ADMIN</p>
          <h1>Build the catalog.</h1>
          <p>Publish courses, add knowledge checks and inspect payment activity.</p>
        </div>
        <div className="admin-count"><strong>{courses.length}</strong><span>courses in the database</span></div>
      </header>

      <div className="admin-tabs">
        <button className={tab === 'course' ? 'active' : ''} onClick={() => setTab('course')}><BookPlus />Add course</button>
        <button className={tab === 'quiz' ? 'active' : ''} onClick={() => setTab('quiz')}><ClipboardList />Add quiz</button>
        <button className={tab === 'projects' ? 'active' : ''} onClick={() => setTab('projects')}><ClipboardList />Project reviews</button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ReceiptText />Orders</button>
      </div>

      {message && <div className="form-message success">{message}</div>}
      {error && <div className="form-message error">{error}</div>}

      {tab === 'course' && (
        <section className="admin-grid">
          <form className="panel form admin-form" onSubmit={publishCourse}>
            <p className="eyebrow">COURSE BUILDER</p>
            <h2>Publish a playlist course.</h2>
            <label>
              TITLE
              <input
                name="title"
                required
                onChange={(event) => {
                  const slug = event.currentTarget.form?.elements.namedItem('slug') as HTMLInputElement | null;
                  if (slug) {
                    slug.value = event.target.value
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '');
                  }
                }}
              />
            </label>
            <label>SLUG<input name="slug" pattern="[a-z0-9-]+" required /></label>
            <label>YOUTUBE PLAYLIST URL<input name="playlist" type="url" required /></label>
            <label>DESCRIPTION<textarea name="description" required /></label>
            <label>OUTCOME<textarea name="outcome" required /></label>
            <label>COVER IMAGE URL<input name="cover" type="url" /></label>
            <div className="form-columns">
              <label>USD PRICE<input name="usd" type="number" step="0.01" defaultValue="2" required /></label>
              <label>INR PRICE<input name="inr" type="number" step="1" defaultValue="159" required /></label>
            </div>
            <button className="button button-primary button-large" disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <Plus />}Publish course
            </button>
          </form>

          <aside className="panel current-catalog">
            <p className="eyebrow">CURRENT CATALOG</p>
            <h2>{courses.length} course{courses.length === 1 ? '' : 's'}.</h2>
            {courses.map((course) => (
              <article key={course.id}>
                <span>{course.status}</span>
                <h3>{course.title}</h3>
                <p>{course.youtube_playlist_id || 'No playlist ID'}</p>
              </article>
            ))}
          </aside>
        </section>
      )}

      {tab === 'quiz' && (
        <form className="panel form admin-form quiz-builder" onSubmit={publishQuiz}>
          <p className="eyebrow">QUIZ BUILDER</p>
          <h2>Add a paid checkpoint.</h2>
          <div className="form-columns">
            <label>
              COURSE
              <select name="course" required>
                {courses.map((course) => <option key={course.id} value={course.slug}>{course.title}</option>)}
              </select>
            </label>
            <label>QUIZ TITLE<input name="title" required /></label>
          </div>
          <label>DESCRIPTION<textarea name="description" /></label>
          <div className="four-columns">
            <label>POSITION<input name="position" type="number" min="1" defaultValue="1" /></label>
            <label>AFTER LESSON<input name="unlock" type="number" min="0" defaultValue="2" /></label>
            <label>PASS %<input name="pass" type="number" min="1" max="100" defaultValue="70" /></label>
            <label>XP<input name="xp" type="number" min="0" defaultValue="60" /></label>
          </div>

          <div className="question-stack">
            {questions.map((question, index) => (
              <article className="question-builder" key={index}>
                <div className="question-head">
                  <p className="eyebrow">QUESTION {index + 1}</p>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={questions.length === 1}
                    onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 />
                  </button>
                </div>
                <label>
                  PROMPT
                  <input
                    value={question.prompt}
                    onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))}
                    required
                  />
                </label>
                <label>
                  OPTIONS, ONE PER LINE
                  <textarea
                    value={question.options}
                    onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value } : item))}
                    required
                  />
                </label>
                <div className="form-columns">
                  <label>
                    CORRECT OPTION NUMBER
                    <input
                      type="number"
                      min="1"
                      value={question.correct}
                      onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, correct: Number(event.target.value) } : item))}
                      required
                    />
                  </label>
                  <label>
                    EXPLANATION
                    <input
                      value={question.explanation}
                      onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, explanation: event.target.value } : item))}
                      required
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>

          <div className="admin-actions">
            <button type="button" className="button button-soft" onClick={() => setQuestions((current) => [...current, blankQuestion()])}>
              <Plus />Add question
            </button>
            <button className="button button-primary button-large" disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <Plus />}Publish quiz
            </button>
          </div>
        </form>
      )}

      {tab === 'projects' && <AdminProjectReviews supabase={supabase} />}

      {tab === 'orders' && (
        <section className="panel orders-panel">
          <p className="eyebrow">LATEST PAYMENT ACTIVITY</p>
          <h2>{orders.length} recent order{orders.length === 1 ? '' : 's'}.</h2>
          {orders.length ? orders.map((order) => (
            <article key={order.id}>
              <div>
                <strong>{order.challenges?.title || 'Course'}</strong>
                <span>{order.provider} · {order.currency} {order.amount} · {new Date(order.created_at).toLocaleString()}</span>
              </div>
              <b className={`order-status ${order.status}`}>{order.status}</b>
            </article>
          )) : <p>No payment attempts yet.</p>}
        </section>
      )}
    </main>
  );
}
