import { StrictMode, Component, createContext, useContext, useEffect, useMemo, useRef, useState, type ErrorInfo, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, type Session, type User } from '@supabase/supabase-js';
import { createBrowserRouter, RouterProvider, Link, NavLink, Outlet, useNavigate, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, BookPlus, Check, CheckCircle2, ChevronLeft, ChevronRight, CirclePlay, ClipboardList, Clock3, CreditCard, Flame, Gauge, IndianRupee, Infinity as InfinityIcon, LayoutDashboard, Layers3, LoaderCircle, LockKeyhole, LogOut, Moon, PlayCircle, Plus, ReceiptText, ShieldCheck, Sparkles, Sun, Trash2, Trophy, WalletCards } from 'lucide-react';
import './styles.css';
import { AdminProjectReviews, FinalProjectPanel, regionalPrice, useRegion, type CourseProject, type CourseStep, type ProjectSubmission, type RegionalOffer } from './course-product';

// ---- src/lib/types.ts ----
type Currency = 'USD' | 'INR' | 'USDT' | string;
type PaymentProvider = 'paypal' | 'razorpay' | 'crypto' | string;

interface ChallengePrice {
  id?: string;
  challenge_id?: string;
  provider: PaymentProvider;
  currency: Currency;
  amount: number;
  active?: boolean;
}

interface Challenge {
  id: string;
  slug: string;
  title: string;
  description: string;
  outcome?: string | null;
  eyebrow?: string | null;
  duration_label?: string | null;
  cover_image_url?: string | null;
  youtube_playlist_id?: string | null;
  lesson_count?: number | null;
  total_xp?: number | null;
  status?: string | null;
  is_featured?: boolean | null;
  created_at?: string | null;
  source_title?: string | null;
  source_channel?: string | null;
  source_url?: string | null;
  difficulty?: string | null;
  project_required?: boolean | null;
  challenge_prices?: ChallengePrice[];
}

interface Profile {
  id: string;
  display_name?: string | null;
  role?: 'admin' | 'learner' | string | null;
  current_streak?: number | null;
}

interface Enrollment {
  id?: string;
  challenge_id: string;
  user_id: string;
  access_status: 'paid' | 'granted' | 'pending' | string;
  created_at?: string;
  challenges?: Challenge;
}

interface VideoProgress {
  video_id: string;
  challenge_id: string;
  status: string;
  position?: number;
  watched_percent?: number;
}

interface XpEvent {
  amount: number;
  challenge_id?: string;
}

interface QuizQuestion {
  id: string;
  position: number;
  prompt: string;
  options: string[];
}

interface Quiz {
  id: string;
  challenge_id: string;
  position: number;
  title: string;
  description?: string | null;
  unlock_after_video?: number | null;
  pass_percent: number;
  xp_reward: number;
  course_quiz_questions?: QuizQuestion[];
}

interface QuizAttempt {
  quiz_id: string;
  passed: boolean;
  score_percent: number;
  created_at?: string;
}

interface PaymentOrder {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  challenges?: { title?: string } | null;
}

// ---- src/lib/supabase.ts ----

const FALLBACK_URL = 'https://ijkdhrznxukawugeoocs.supabase.co';
const FALLBACK_KEY = 'sb_publishable_kwSezylj6T63a7nIMtuxcg_0bQWm6-8';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
  global: {
    headers: { 'x-client-info': 'finish-web/2.0' },
  },
});

function withTimeout<T>(promise: PromiseLike<T>, ms = 8000, label = 'Request'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out.`)), ms);
    Promise.resolve(promise).then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

// ---- src/lib/api.ts ----

export async function getProfile(userId: string): Promise<Profile | null> {
  const result = await withTimeout(
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    6000,
    'Profile',
  );
  if (result.error) throw result.error;
  return result.data as Profile | null;
}

export async function getCatalog(): Promise<Challenge[]> {
  const result = await withTimeout(
    supabase
      .from('challenges')
      .select('*, challenge_prices(*)')
      .eq('status', 'published')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: true }),
    9000,
    'Catalog',
  );
  if (result.error) throw result.error;
  return (result.data ?? []) as Challenge[];
}

export async function getCourse(slug: string): Promise<Challenge> {
  const result = await withTimeout(
    supabase.from('challenges').select('*, challenge_prices(*)').eq('slug', slug).eq('status', 'published').single(),
    9000,
    'Course',
  );
  if (result.error) throw result.error;
  return result.data as Challenge;
}

export async function getEnrollment(userId: string, challengeId: string): Promise<Enrollment | null> {
  const result = await withTimeout(
    supabase.from('enrollments').select('*').eq('user_id', userId).eq('challenge_id', challengeId).maybeSingle(),
    6000,
    'Access check',
  );
  if (result.error) throw result.error;
  return result.data as Enrollment | null;
}

function hasPaidAccess(enrollment: Enrollment | null): boolean {
  return enrollment?.access_status === 'paid' || enrollment?.access_status === 'granted';
}

export async function getDashboard(userId: string) {
  const [enrollments, xp, attempts] = await Promise.all([
    withTimeout(
      supabase.from('enrollments').select('*, challenges(*, challenge_prices(*))').eq('user_id', userId).in('access_status', ['paid', 'granted']),
      9000,
      'Courses',
    ),
    withTimeout(supabase.from('xp_events').select('amount, challenge_id').eq('user_id', userId), 7000, 'XP'),
    withTimeout(supabase.from('course_quiz_attempts').select('quiz_id, passed, score_percent').eq('user_id', userId), 7000, 'Quiz history'),
  ]);
  if (enrollments.error) throw enrollments.error;
  const rows = (enrollments.data ?? []) as Enrollment[];
  const ids = rows.map((row) => row.challenge_id);
  let progress: VideoProgress[] = [];
  if (ids.length) {
    const result = await withTimeout(
      supabase.from('playlist_video_progress').select('*').eq('user_id', userId).in('challenge_id', ids),
      8000,
      'Progress',
    );
    if (result.error) throw result.error;
    progress = (result.data ?? []) as VideoProgress[];
  }
  return {
    enrollments: rows,
    xp: (xp.data ?? []) as XpEvent[],
    attempts: (attempts.data ?? []) as QuizAttempt[],
    progress,
  };
}

export async function getLearningData(userId: string, challengeId: string) {
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

export async function getLearningRoute(slug: string): Promise<LearningState> {
  const result = await withTimeout(
    supabase.rpc('get_learning_route', { p_slug: slug }),
    7000,
    'Learning route',
  );
  if (result.error) throw result.error;
  const data = result.data as LearningState | null;
  if (!data?.course) throw new Error('The learning route is incomplete.');
  return data;
}

export async function getAdminData() {
  const [courses, orders] = await Promise.all([
    withTimeout(supabase.from('challenges').select('*, challenge_prices(*)').order('created_at', { ascending: false }), 9000, 'Courses'),
    withTimeout(supabase.from('payment_orders').select('*, challenges(title)').order('created_at', { ascending: false }).limit(30), 9000, 'Orders'),
  ]);
  if (courses.error) throw courses.error;
  if (orders.error) throw orders.error;
  return { courses: (courses.data ?? []) as Challenge[], orders: (orders.data ?? []) as PaymentOrder[] };
}

// ---- src/contexts/SessionContext.tsx ----

interface SessionState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = async (nextSession?: Session | null) => {
    try {
      const resolved = nextSession === undefined
        ? (await withTimeout(supabase.auth.getSession(), 4500, 'Authentication')).data.session
        : nextSession;
      setSession(resolved);
      if (resolved?.user) {
        try { setProfile(await getProfile(resolved.user.id)); }
        catch { setProfile(null); }
      } else {
        setProfile(null);
      }
    } catch {
      setSession(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void hydrate();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrate(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<SessionState>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    refresh: () => hydrate(),
    signOut: async () => {
      setLoading(true);
      try { await withTimeout(supabase.auth.signOut({ scope: 'local' }), 2500, 'Sign out'); }
      finally { setSession(null); setProfile(null); setLoading(false); }
    },
  }), [session, profile, loading]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}

// ---- src/contexts/ThemeContext.tsx ----

type Theme = 'light' | 'dark';
interface ThemeState { theme: Theme; toggle: () => void; }
const ThemeContext = createContext<ThemeState | null>(null);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('finish-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('finish-theme', theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, toggle: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider.');
  return value;
}

// ---- src/components/ErrorBoundary.tsx ----

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('FINISH render error', error, info); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-shell">
        <p className="eyebrow">APPLICATION ERROR</p>
        <h1>This page failed safely.</h1>
        <p>{this.state.error.message}</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>Reload FINISH</button>
      </main>
    );
  }
}

// ---- src/components/ui.tsx ----

function PageLoader({ label = 'Loading FINISH' }: { label?: string }) {
  return <div className="page-loader"><LoaderCircle size={22} className="spin" /><span>{label}</span></div>;
}

function PageError({ title = 'This page could not open.', message, action }: { title?: string; message: string; action?: ReactNode }) {
  return <section className="page-error panel"><p className="eyebrow">PAGE ERROR</p><h1>{title}</h1><p>{message}</p>{action}</section>;
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="empty-state panel"><p className="eyebrow">NOTHING HERE YET</p><h2>{title}</h2><p>{copy}</p>{action}</div>;
}

function ProgressBar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return <div className="progress" aria-label={`${safe}% complete`}><span style={{ width: `${safe}%` }} /></div>;
}

function Pill({ children }: { children: ReactNode }) { return <span className="pill">{children}</span>; }

// ---- src/components/Layout.tsx ----

function Brand() { return <Link to="/" className="brand" aria-label="FINISH home">FINISH<span>.</span></Link>; }

function SiteHeader({ app = false }: { app?: boolean }) {
  const { user, profile, signOut } = useSession();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const name = profile?.display_name || user?.email?.split('@')[0] || 'Learner';

  const leave = async () => { await signOut(); navigate('/', { replace: true }); };

  return (
    <header className={`site-header ${app ? 'site-header-app' : ''}`}>
      <div className="shell header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Primary navigation">
          {app ? <>
            <NavLink to="/app">My learning</NavLink>
            <NavLink to="/catalog">Catalog</NavLink>
            {profile?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          </> : <>
            <NavLink to="/catalog">Courses</NavLink>
            <a href="/#method">How it works</a>
          </>}
        </nav>
        <div className="header-actions">
          <button className="icon-button" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {app && user ? <>
            <div className="user-chip"><span>{name.slice(0, 1).toUpperCase()}</span><b>{name}</b></div>
            <button className="icon-button" onClick={leave} aria-label="Sign out"><LogOut size={18} /></button>
          </> : user ? (
            <Link className="button button-soft" to="/app"><LayoutDashboard size={16} />My learning</Link>
          ) : (
            <Link className="button button-dark" to="/auth">Sign in <ArrowUpRight size={16} /></Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return <footer className="footer"><div className="shell footer-inner"><Brand /><p>Structured learning on top of excellent YouTube courses.</p><span>© {new Date().getFullYear()} FINISH</span></div></footer>;
}

function PublicLayout() { return <><SiteHeader /><Outlet /><Footer /></>; }
function AppLayout() { return <div className="app-surface"><SiteHeader app /><Outlet /></div>; }

// ---- src/components/RequireAuth.tsx ----

function RequireAuth() {
  const { user, loading } = useSession();
  const location = useLocation();
  if (loading) return <PageLoader label="Opening your learning space" />;
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { user, profile, loading } = useSession();
  if (loading) return <PageLoader label="Checking admin access" />;
  if (!user) return <Navigate to="/auth?next=%2Fadmin" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/app" replace />;
  return <Outlet />;
}

// ---- src/components/CourseCard.tsx ----

function priceFor(course: Challenge, region: RegionalOffer) {
  return regionalPrice(course.challenge_prices ?? [], region);
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: currency === 'INR' ? 0 : 2 }).format(amount); }
  catch { return `${currency} ${amount}`; }
}

function CourseArtwork({ course, compact = false }: { course: Challenge; compact?: boolean }) {
  return <div className={`course-artwork ${compact ? 'compact' : ''}`}>
    {course.cover_image_url ? <img src={course.cover_image_url} alt="" loading="lazy" /> : null}
    <div className="artwork-glow" />
    <div className="artwork-grid" />
    <div className="artwork-copy"><small>{course.eyebrow || 'FINISH ORIGINAL'}</small><strong>{course.title}</strong></div>
  </div>;
}

function CourseCard({ course, enrollment }: { course: Challenge; enrollment?: Enrollment | null }) {
  const region = useRegion();
  const price = priceFor(course, region);
  const owned = hasPaidAccess(enrollment ?? null);
  return <article className="course-card">
    <CourseArtwork course={course} />
    <div className="course-card-body">
      <div className="course-meta"><Pill><Clock3 size={13} />{course.duration_label || 'Self-paced'}</Pill><Pill><PlayCircle size={13} />{course.lesson_count || 'Playlist'} lessons</Pill></div>
      <h2>{course.title}</h2>
      <p>{course.description}</p>
      <div className="card-bottom">
        <strong>{owned ? <span className="owned"><CheckCircle2 size={16} />Owned</span> : formatMoney(price.amount, price.currency)}</strong>
        <Link className="button button-primary" to={owned ? `/learn/${course.slug}` : `/course/${course.slug}`}>{owned ? 'Continue' : 'Explore course'} <ArrowUpRight size={16} /></Link>
      </div>
    </div>
  </article>;
}

// ---- src/pages/Landing.tsx ----

function Landing() {
  return <main>
    <section className="hero shell">
      <div className="hero-copy">
        <div className="status-line"><span /><b>One serious course. One visible finish line.</b></div>
        <h1>Stop saving tutorials.<br /><em>Finish the course.</em></h1>
        <p>FINISH turns excellent YouTube playlists into structured learning routes with ordered lessons, knowledge checks, progress, XP and a result you can point to.</p>
        <div className="hero-actions">
          <Link className="button button-primary button-large" to="/catalog">Explore courses <ArrowUpRight size={18} /></Link>
          <a className="text-link" href="#method">See the method <ArrowRight size={16} /></a>
        </div>
        <div className="trust-row"><span><Check size={15} />No subscription trap</span><span><Check size={15} />Lifetime course access</span><span><Check size={15} />Progress saved</span></div>
      </div>
      <div className="hero-stage" aria-label="FINISH product preview">
        <div className="stage-orbit orbit-one" /><div className="stage-orbit orbit-two" />
        <div className="product-window">
          <div className="window-top"><span /><span /><span /><b>finish.course/learn</b></div>
          <div className="window-body">
            <aside className="preview-sidebar"><small>QUEST MAP</small><h3>Computer Networks</h3>{['The network edge','Packet switching','Delay and loss','Knowledge check','Protocol layers'].map((item, index) => <div className={`preview-step ${index < 2 ? 'done' : index === 2 ? 'active' : ''}`} key={item}><i>{index < 2 ? '✓' : index + 1}</i><span>{item}</span></div>)}</aside>
            <div className="preview-content"><div className="preview-label">LESSON 03 OF 18</div><h2>Delay, loss and throughput</h2><div className="preview-video"><CirclePlay size={58} /><span>42% watched</span></div><div className="preview-progress"><span style={{ width: '42%' }} /></div><div className="preview-bottom"><b>Complete 80% to unlock the checkpoint</b><span>240 XP</span></div></div>
          </div>
        </div>
        <div className="floating-card float-a"><Gauge size={18} /><div><b>68%</b><span>course complete</span></div></div>
        <div className="floating-card float-b"><Sparkles size={18} /><div><b>+60 XP</b><span>quiz passed</span></div></div>
      </div>
    </section>

    <section className="manifesto"><div className="shell manifesto-inner"><p>WATCH WITH INTENT</p><span>•</span><p>PROVE WHAT STUCK</p><span>•</span><p>BUILD MOMENTUM</p><span>•</span><p>FINISH</p></div></section>

    <section id="method" className="section shell method-section">
      <div className="section-heading"><p className="eyebrow">THE METHOD</p><h2>A playlist gives you content.<br />FINISH gives you a route.</h2><p>The original videos stay where they belong. We add the structure that turns passive watching into completed learning.</p></div>
      <div className="method-grid">
        <article><span>01</span><Layers3 /><h3>Follow one ordered route</h3><p>No tab wandering, no guessing what to watch next. Each lesson has a clear place and a clear checkpoint.</p></article>
        <article><span>02</span><Gauge /><h3>See real progress</h3><p>Your course home remembers the exact lesson, completion percentage, earned XP and quiz history.</p></article>
        <article><span>03</span><Sparkles /><h3>Prove understanding</h3><p>Short knowledge checks interrupt passive consumption and reward comprehension, not background playback.</p></article>
      </div>
    </section>

    <section className="section shell value-section">
      <div className="value-card"><div><p className="eyebrow">NOT ANOTHER CONTENT LIBRARY</p><h2>Pay for completion, not access to 9,000 things you will never open.</h2><p>Each FINISH course is a focused learning product: one curated route, one price, permanent access and one concrete outcome.</p><Link className="button button-acid button-large" to="/catalog">Browse the catalog <ArrowUpRight size={18} /></Link></div><div className="value-number"><small>THE PROMISE</small><strong>1</strong><span>course at a time</span></div></div>
    </section>
  </main>;
}

// ---- src/pages/Catalog.tsx ----

function Catalog() {
  const { user } = useSession();
  const [courses, setCourses] = useState<Challenge[]>([]);
  const [enrollments, setEnrollments] = useState<Map<string, Enrollment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await getCatalog();
        let map = new Map<string, Enrollment>();
        if (user) {
          const result = await supabase.from('enrollments').select('*').eq('user_id', user.id);
          map = new Map(((result.data ?? []) as Enrollment[]).map((row) => [row.challenge_id, row]));
        }
        if (active) { setCourses(rows); setEnrollments(map); }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'The catalog could not load.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user]);

  if (loading) return <PageLoader label="Loading the catalog" />;
  return <main className="page shell">
    <header className="page-hero"><p className="eyebrow">THE CATALOG</p><h1>Choose one thing worth finishing.</h1><p>Focused learning products built around strong YouTube courses. One route, clear checkpoints and permanent access.</p></header>
    {error ? <PageError message={error} action={<button className="button button-primary" onClick={() => window.location.reload()}>Try again</button>} /> : courses.length ? <section className="catalog-grid">{courses.map((course) => <CourseCard key={course.id} course={course} enrollment={enrollments.get(course.id)} />)}</section> : <EmptyState title="No courses are published." copy="The catalog is ready. The first course still needs to be published from the admin workspace." action={<Link className="button button-primary" to="/">Return home</Link>} />}
  </main>;
}

// ---- src/pages/Course.tsx ----

function CoursePage() {
  const { slug = '' } = useParams();
  const { user } = useSession();
  const region = useRegion();
  const [course, setCourse] = useState<Challenge | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const next = await getCourse(slug);
        const access = user ? await getEnrollment(user.id, next.id) : null;
        if (active) { setCourse(next); setEnrollment(access); }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'This course could not load.'); }
    })();
    return () => { active = false; };
  }, [slug, user]);

  if (error) return <main className="page shell"><PageError message={error} /></main>;
  if (!course) return <PageLoader label="Opening the course" />;
  const owned = hasPaidAccess(enrollment);
  const price = priceFor(course, region);
  const destination = owned ? `/learn/${course.slug}` : user ? `/checkout/${course.slug}` : `/auth?next=${encodeURIComponent(`/checkout/${course.slug}`)}`;

  return <main className="page shell course-page">
    <div className="breadcrumb"><Link to="/catalog">Catalog</Link><ChevronRight size={14} /><span>{course.title}</span></div>
    <section className="course-hero">
      <CourseArtwork course={course} />
      <div className="course-hero-copy"><p className="eyebrow">{course.eyebrow || 'FINISH COURSE'}</p><h1>{course.title}</h1><p className="course-lead">{course.description}</p><p className="regional-note">Source: {course.source_title || course.title} · {course.source_channel || 'YouTube educator'}</p><div className="course-pills"><Pill>{course.lesson_count || 'Full playlist'} lessons</Pill><Pill>Knowledge checks</Pill><Pill>Progress + XP</Pill><Pill>{course.difficulty || 'Advanced'}</Pill><Pill>Reviewed final project</Pill></div><div className="course-price"><div><small>{owned ? 'YOUR ACCESS' : 'ONE-TIME PRICE'}</small><strong>{owned ? 'Unlocked' : formatMoney(price.amount, price.currency)}</strong><span>{owned ? 'Return whenever you need it.' : 'No subscription. Permanent access.'}</span></div><Link className="button button-acid button-large" to={destination}>{owned ? 'Continue learning' : 'Start this course'} <ArrowUpRight size={18} /></Link></div></div>
    </section>
    <section className="course-outcome-grid"><div><p className="eyebrow">THE OUTCOME</p><h2>{course.outcome || 'Finish the playlist with a tested mental model, not a vague memory of having watched it.'}</h2></div><div className="benefit-list"><article><ShieldCheck /><div><h3>A route that stays coherent</h3><p>Lessons remain ordered and the next useful action is always obvious.</p></div></article><article><Trophy /><div><h3>Progress that means something</h3><p>Checkpoints and quizzes distinguish completion from passive playback.</p></div></article><article><InfinityIcon /><div><h3>Lifetime access</h3><p>Pay once. Revisit the course, quizzes and progress whenever needed.</p></div></article></div></section>
    <section className="included-panel"><p className="eyebrow">INCLUDED</p><div>{['Complete named lecture route','Saved lesson progress','Authored quiz checkpoints','Cumulative final assessment','Reviewed final project','XP and streak tracking','Permanent course access'].map((item) => <span key={item}><Check size={17} />{item}</span>)}</div></section>
  </main>;
}

// ---- src/pages/Auth.tsx ----

function safeNext(value: string | null) { return value?.startsWith('/') && !value.startsWith('//') ? value : '/app'; }

function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [params] = useSearchParams();
  const { user, refresh } = useSession();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));

  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, navigate, next]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const displayName = String(form.get('name') || '').trim();
    try {
      if (mode === 'signup') {
        const response = await withTimeout(fetch(`${supabaseUrl}/functions/v1/signup-no-confirm`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
          body: JSON.stringify({ email, password, display_name: displayName }),
        }), 10000, 'Account creation');
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok || payload.error) throw new Error(payload.error || 'The account could not be created.');
      }
      const result = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 10000, 'Sign in');
      if (result.error) throw result.error;
      await refresh();
      navigate(next, { replace: true });
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Authentication failed.', type: 'error' });
    } finally { setBusy(false); }
  };

  return <main className="auth-shell shell">
    <section className="auth-story"><Link className="brand auth-brand" to="/">FINISH<span>.</span></Link><div><p className="eyebrow">YOUR LEARNING HOME</p><h1>Continue from the exact place you stopped.</h1><p>One account holds your purchased courses, lesson progress, quiz results, XP and streaks.</p><div className="auth-benefits"><span><Check />No verification gate</span><span><Check />No subscription</span><span><Check />Permanent course access</span></div></div><div className="auth-quote"><Sparkles /><p>“The difference between another saved playlist and a finished course is a system that remembers the next step.”</p></div></section>
    <section className="auth-card panel"><div className="auth-card-head"><div className="auth-icon"><LockKeyhole /></div><p className="eyebrow">FINISH ACCOUNT</p><h2>{mode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h2><p>{mode === 'signin' ? 'Open your courses and continue.' : 'Your account opens immediately. No email confirmation.'}</p></div>
      <form className="form" onSubmit={submit}>
        {mode === 'signup' && <label>NAME<input name="name" autoComplete="name" placeholder="Your name" required /></label>}
        <label>EMAIL<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
        <label>PASSWORD<input name="password" type="password" minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 8 characters" required /></label>
        {message && <div className={`form-message ${message.type}`}>{message.text}</div>}
        <button className="button button-primary button-large full" disabled={busy}>{busy ? <><LoaderCircle className="spin" />Working…</> : <>{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight /></>}</button>
      </form>
      <button className="auth-switch" onClick={() => { setMode((current) => current === 'signin' ? 'signup' : 'signin'); setMessage(null); }}>{mode === 'signin' ? 'New to FINISH? Create an account' : 'Already have an account? Sign in'}</button>
    </section>
  </main>;
}

// ---- src/pages/Dashboard.tsx ----

interface Data { enrollments: Enrollment[]; xp: XpEvent[]; attempts: QuizAttempt[]; progress: VideoProgress[]; }

function Dashboard() {
  const { user, profile } = useSession();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (!user) return; let active = true; getDashboard(user.id).then((value) => active && setData(value)).catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Your dashboard could not load.')); return () => { active = false; }; }, [user]);
  if (error) return <main className="app-page shell"><PageError message={error} /></main>;
  if (!data || !user) return <PageLoader label="Building your dashboard" />;
  const xp = data.xp.reduce((sum, event) => sum + Number(event.amount || 0), 0);
  const passed = data.attempts.filter((attempt) => attempt.passed).length;
  const name = profile?.display_name || user.email?.split('@')[0] || 'Learner';

  return <main className="app-page shell">
    <section className="dashboard-hero"><div><p className="eyebrow">YOUR FINISH HOME</p><h1>Welcome back, {name}.</h1><p>No sales loop. No giant library. Just the courses you own and the next useful action.</p></div><div className="stats-grid"><article><BookOpen /><strong>{data.enrollments.length}</strong><span>owned courses</span></article><article><Trophy /><strong>{xp}</strong><span>total XP</span></article><article><Flame /><strong>{profile?.current_streak || 0}</strong><span>day streak</span></article></div></section>
    <section className="dashboard-section"><div className="section-row"><div><p className="eyebrow">MY COURSES</p><h2>Your active learning stack.</h2></div><Link className="button button-soft" to="/catalog">Browse catalog <ArrowUpRight size={16} /></Link></div>
      {data.enrollments.length ? <div className="owned-grid">{data.enrollments.map((enrollment) => {
        const course = enrollment.challenges; if (!course) return null;
        const completed = data.progress.filter((item) => item.challenge_id === course.id && item.status === 'completed').length;
        const total = Number(course.lesson_count || Math.max(completed, 1));
        const percent = Math.min(100, Math.round((completed / total) * 100));
        return <article className="owned-card" key={course.id}><CourseArtwork course={course} compact /><div className="owned-card-copy"><p className="eyebrow">IN PROGRESS</p><h3>{course.title}</h3><p>{completed} of {total} lessons completed</p><ProgressBar value={percent} /><div><span>{percent}% complete</span><Link className="button button-acid" to={`/learn/${course.slug}`}>{completed ? 'Continue' : 'Start course'} <ArrowUpRight size={16} /></Link></div></div></article>;
      })}</div> : <EmptyState title="Your learning stack is empty." copy="Choose one course from the catalog. Once unlocked, it lives here permanently." action={<Link className="button button-acid" to="/catalog">Open catalog <ArrowUpRight size={16} /></Link>} />}
    </section>
    <section className="dashboard-note panel"><Trophy /><div><h3>{passed} quiz checkpoint{passed === 1 ? '' : 's'} passed.</h3><p>Every passed checkpoint is evidence that you did more than leave the video running in another tab.</p></div></section>
  </main>;
}

// ---- src/pages/Checkout.tsx ----

declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void }; } }

function loadScript(src: string) { return new Promise<void>((resolve, reject) => { const existing = document.querySelector(`script[src="${src}"]`); if (existing) return resolve(); const script = document.createElement('script'); script.src = src; script.onload = () => resolve(); script.onerror = () => reject(new Error('Payment checkout could not load.')); document.head.append(script); }); }

function Checkout() {
  const { slug = '' } = useParams(); const { user, refresh } = useSession(); const navigate = useNavigate(); const region = useRegion();
  const [course, setCourse] = useState<Challenge | null>(null); const [readiness, setReadiness] = useState({ paypal: false, razorpay: false }); const [busy, setBusy] = useState(''); const [error, setError] = useState('');

  useEffect(() => { if (!user) return; let active = true; (async () => { try { const next = await getCourse(slug); const enrollment = await getEnrollment(user.id, next.id); if (hasPaidAccess(enrollment)) return navigate(`/learn/${slug}`, { replace: true }); const result = await supabase.functions.invoke('payment-readiness', { body: {} }); if (active) { setCourse(next); setReadiness({ paypal: Boolean(result.data?.paypal), razorpay: Boolean(result.data?.razorpay) }); } } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Checkout could not load.'); } })(); return () => { active = false; }; }, [slug, user, navigate]);

  const pay = async (provider: 'paypal' | 'razorpay') => {
    if (!course) return; if (provider !== region.provider) return; setBusy(provider); setError('');
    try {
      const result = await supabase.functions.invoke('payment-checkout', { body: { challenge_slug: course.slug, provider, success_url: `${location.origin}/learn/${course.slug}`, cancel_url: location.href } });
      if (result.error || result.data?.error) throw new Error(result.error?.message || result.data?.error || 'Checkout could not be created.');
      if (provider === 'paypal') { location.assign(result.data.checkout_url); return; }
      await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      if (!window.Razorpay) throw new Error('Razorpay did not start.');
      new window.Razorpay({ key: result.data.key_id, amount: result.data.amount, currency: 'INR', order_id: result.data.provider_order_id, name: 'FINISH', description: course.title, handler: async (payment: Record<string, string>) => { const verification = await supabase.functions.invoke('razorpay-verify', { body: { internal_order_id: result.data.order_id, ...payment } }); if (verification.error || verification.data?.error) { setError(verification.error?.message || verification.data?.error); return; } await refresh(); navigate(`/learn/${course.slug}`, { replace: true }); }, theme: { color: '#7c5cff' } }).open();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Payment could not start.'); }
    finally { setBusy(''); }
  };

  if (error && !course) return <main className="app-page shell"><PageError message={error} /></main>;
  if (!course) return <PageLoader label="Preparing secure checkout" />;
  const usd = course.challenge_prices?.find((price) => price.provider === 'paypal' && price.currency === 'USD')?.amount ?? 2;
  const inr = course.challenge_prices?.find((price) => price.provider === 'razorpay' && price.currency === 'INR')?.amount ?? 159;

  return <main className="app-page shell checkout-page"><Link className="back-link" to={`/course/${course.slug}`}><ArrowLeft size={16} />Back to course</Link><header className="checkout-heading"><p className="eyebrow">SECURE CHECKOUT</p><h1>Unlock {course.title}.</h1><p>One payment. Permanent access. {region.countryName} checkout uses {region.provider === 'razorpay' ? 'Razorpay in INR' : 'PayPal in USD'}.</p></header>{error && <div className="form-message error">{error}</div>}<section className="checkout-grid">
    {region.provider === 'paypal' && <article className="payment-card"><div className="payment-icon"><CreditCard /></div><p className="eyebrow">INTERNATIONAL</p><h2>Pay by card</h2><strong>{formatMoney(usd, 'USD')}</strong><p>Secure international checkout through PayPal.</p><ul>{['Lifetime course access','Verified webhook unlock','All quizzes and progress'].map((item) => <li key={item}><Check />{item}</li>)}</ul><button className="button button-primary button-large full" disabled={!readiness.paypal || !!busy} onClick={() => pay('paypal')}>{busy === 'paypal' ? <LoaderCircle className="spin" /> : <WalletCards />} {readiness.paypal ? 'Pay with PayPal' : 'PayPal setup pending'}</button></article>}
    {region.provider === 'razorpay' && <article className="payment-card recommended"><span className="recommended-label">BEST IN INDIA</span><div className="payment-icon acid"><IndianRupee /></div><p className="eyebrow">INDIA</p><h2>UPI, cards and more</h2><strong>{formatMoney(inr, 'INR')}</strong><p>Fast domestic checkout through Razorpay.</p><ul>{['UPI and Indian cards','Signed payment verification','Permanent access'].map((item) => <li key={item}><Check />{item}</li>)}</ul><button className="button button-acid button-large full" disabled={!readiness.razorpay || !!busy} onClick={() => pay('razorpay')}>{busy === 'razorpay' ? <LoaderCircle className="spin" /> : <IndianRupee />} {readiness.razorpay ? 'Pay with Razorpay' : 'Razorpay setup pending'}</button></article>}
  </section><div className="secure-note"><ShieldCheck /><span>Access is granted server-side after payment verification. Screenshots and manual transaction hashes cannot unlock a course.</span></div></main>;
}

// ---- src/pages/Learn.tsx ----

declare global {
  interface Window {
    YT?: { Player: new (id: string, options: Record<string, unknown>) => YouTubePlayer; PlayerState: { PLAYING: number; ENDED: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}
interface YouTubePlayer { getDuration: () => number; getCurrentTime: () => number; cueVideoById: (id: string) => void; destroy: () => void; }
interface LearningState { course: Challenge; progress: VideoProgress[]; xp: XpEvent[]; quizzes: Quiz[]; attempts: QuizAttempt[]; steps: CourseStep[]; project: CourseProject | null; submission: ProjectSubmission | null; }

function loadYouTubeApi() { return new Promise<void>((resolve, reject) => { if (window.YT?.Player) return resolve(); const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]'); const timeout = window.setTimeout(() => reject(new Error('YouTube took too long to load.')), 12000); window.onYouTubeIframeAPIReady = () => { window.clearTimeout(timeout); resolve(); }; if (!existing) { const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.onerror = () => reject(new Error('YouTube could not load.')); document.head.append(script); } }); }

function Learn() {
  const { slug = '' } = useParams(); const { user } = useSession(); const navigate = useNavigate();
  const [state, setState] = useState<LearningState | null>(null); const [videoIds, setVideoIds] = useState<string[]>([]); const [index, setIndex] = useState(0); const [watched, setWatched] = useState(0); const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null); const [quizResult, setQuizResult] = useState<Record<string, unknown> | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const player = useRef<YouTubePlayer | null>(null); const watchTimer = useRef<number | null>(null);

  useEffect(() => { if (!user) return; let active = true; (async () => { try {
    const data = await getLearningRoute(slug);
    if (!active) return;
    const orderedSteps = [...data.steps].sort((a, b) => a.position - b.position);
    const ids = orderedSteps.map((step) => step.youtube_video_id || '').filter(Boolean);
    if (!ids.length || ids.length !== orderedSteps.length) throw new Error('One or more lessons are missing their canonical video link.');
    const done = new Set(data.progress.filter((item) => item.status === 'completed').map((item) => item.video_id));
    const firstIncomplete = ids.findIndex((id) => !done.has(id));
    setState({ ...data, steps: orderedSteps });
    setVideoIds(ids);
    setIndex(firstIncomplete >= 0 ? firstIncomplete : Math.max(0, ids.length - 1));
  } catch (reason) {
    if (!active) return;
    const message = reason instanceof Error ? reason.message : 'The course player could not load.';
    if (message.toLowerCase().includes('payment required')) navigate(`/checkout/${slug}`, { replace: true });
    else setError(message);
  } })(); return () => { active = false; }; }, [slug, user, navigate]);

  useEffect(() => {
    if (!state || !videoIds.length || activeQuiz) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT) return;
      const initialVideoId = videoIds[index] || videoIds[0];
      player.current = new window.YT.Player('youtube-player', {
        width: '100%',
        height: '100%',
        videoId: initialVideoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: (event: { target: YouTubePlayer }) => event.target.cueVideoById(initialVideoId),
          onStateChange: (event: { data: number }) => {
            if (!window.YT) return;
            if (watchTimer.current) window.clearInterval(watchTimer.current);
            if (event.data === window.YT.PlayerState.PLAYING) watchTimer.current = window.setInterval(() => {
              const duration = player.current?.getDuration() || 0;
              const current = player.current?.getCurrentTime() || 0;
              setWatched(duration ? Math.min(100, Math.round((current / duration) * 100)) : 0);
            }, 1000);
            if (event.data === window.YT.PlayerState.ENDED) setWatched(100);
          },
        },
      });
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'YouTube could not load.'));
    return () => {
      cancelled = true;
      if (watchTimer.current) window.clearInterval(watchTimer.current);
      player.current?.destroy();
      player.current = null;
    };
  }, [state?.course.id, videoIds.length, activeQuiz?.id, index]);

  const completed = useMemo(() => new Set(state?.progress.filter((item) => item.status === 'completed').map((item) => item.video_id) ?? []), [state?.progress]);
  const passed = useMemo(() => new Set(state?.attempts.filter((item) => item.passed).map((item) => item.quiz_id) ?? []), [state?.attempts]);
  const xp = state?.xp.reduce((sum, event) => sum + Number(event.amount || 0), 0) ?? 0;
  const totalSteps = Math.max(1, videoIds.length + (state?.quizzes.length ?? 0)); const progressPercent = Math.round(((completed.size + passed.size) / totalSteps) * 100);
  const routeComplete = videoIds.length > 0 && completed.size >= videoIds.length && (state?.quizzes.every((quiz) => passed.has(quiz.id)) ?? false);

  const canOpenLesson = (lessonIndex: number) => { if (lessonIndex === 0) return true; if (!completed.has(videoIds[lessonIndex - 1] || '')) return false; return state?.quizzes.filter((quiz) => Number(quiz.unlock_after_video || 0) <= lessonIndex).every((quiz) => passed.has(quiz.id)) ?? true; };
  const openLesson = (lessonIndex: number, force = false) => {
    if (!force && !canOpenLesson(lessonIndex)) return;
    const exactVideoId = videoIds[lessonIndex];
    if (!exactVideoId) return setError('This lesson is missing its canonical video link.');
    setIndex(lessonIndex);
    setWatched(0);
    setActiveQuiz(null);
    setQuizResult(null);
    setError('');
    // The player is recreated after the quiz panel unmounts. Calling a stale
    // iframe reference here caused the next lecture to render as a blank area.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const selectLesson = (lessonIndex: number) => openLesson(lessonIndex);

  const continueFromLesson = (lessonIndex = index, newlyCompleted = false) => {
    if (!state) return;
    const completedCount = completed.size + (newlyCompleted && !completed.has(videoIds[lessonIndex] || '') ? 1 : 0);
    const nextQuiz = state.quizzes.find((quiz) => Number(quiz.unlock_after_video || 0) === lessonIndex + 1 && !passed.has(quiz.id));
    if (nextQuiz && completedCount >= Number(nextQuiz.unlock_after_video || 0)) {
      setActiveQuiz(nextQuiz);
      setQuizResult(null);
      setError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (videoIds[lessonIndex + 1]) openLesson(lessonIndex + 1, true);
  };

  const continueFromQuiz = (quiz: Quiz) => {
    const nextLesson = Number(quiz.unlock_after_video || 0);
    if (videoIds[nextLesson]) openLesson(nextLesson, true);
  };

  const completeLesson = async () => {
    if (!state || !user || watched < 80) return; const id = videoIds[index]; if (!id) return; setBusy(true);
    const result = await supabase.rpc('complete_playlist_video', { p_challenge_id: state.course.id, p_video_id: id, p_position: index });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    setError('');
    const awarded = Number(Array.isArray(result.data) ? result.data[0]?.awarded_xp : result.data?.awarded_xp || 0);
    setState((current) => current ? { ...current, progress: current.progress.some((item) => item.video_id === id) ? current.progress : [...current.progress, { video_id: id, challenge_id: current.course.id, status: 'completed', position: index }], xp: awarded ? [...current.xp, { amount: awarded }] : current.xp } : current);
    window.setTimeout(() => continueFromLesson(index, true), 180);
  };

  const submitQuiz = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!activeQuiz) return; setBusy(true); const form = new FormData(event.currentTarget); const questions = [...(activeQuiz.course_quiz_questions ?? [])].sort((a, b) => a.position - b.position); const answers = questions.map((question) => ({ question_id: question.id, selected_index: Number(form.get(`q-${question.id}`)) })); const result = await supabase.rpc('submit_course_quiz', { p_quiz_id: activeQuiz.id, p_answers: answers }); setBusy(false); if (result.error) return setError(result.error.message); setQuizResult(result.data as Record<string, unknown>); setState((current) => current ? { ...current, attempts: [{ quiz_id: activeQuiz.id, passed: Boolean(result.data?.passed), score_percent: Number(result.data?.score_percent || 0) }, ...current.attempts], xp: Number(result.data?.awarded_xp || 0) ? [...current.xp, { amount: Number(result.data.awarded_xp) }] : current.xp } : current);
    if (Boolean(result.data?.passed)) {
      setError('');
      window.setTimeout(() => continueFromQuiz(activeQuiz), 500);
    }
  };

  const routeNodes = videoIds.flatMap((id, lessonIndex) => [
    { type: 'lesson' as const, id, lessonIndex },
    ...state?.quizzes.filter((quiz) => Number(quiz.unlock_after_video || 0) === lessonIndex + 1).map((quiz) => ({ type: 'quiz' as const, quiz })) ?? [],
  ]);

  if (error && !state) return <main className="app-page shell"><PageError message={error} /></main>;
  if (!state || !user) return <PageLoader label="Opening the learning route" />;

  return <main className="learn-page"><aside className="quest-map"><Link className="back-link" to="/app"><ChevronLeft />My learning</Link><p className="eyebrow">QUEST MAP</p><h2>{state.course.title}</h2><div className="quest-progress"><div><strong>{progressPercent}%</strong><span>{xp} XP</span></div><ProgressBar value={progressPercent} /></div><nav className="lesson-list">{videoIds.length ? routeNodes.map((node) => {
      if (node.type === 'lesson') { const done = completed.has(node.id); const unlocked = canOpenLesson(node.lessonIndex); return <button key={`lesson-${node.id}`} className={`${index === node.lessonIndex && !activeQuiz ? 'active' : ''} ${done ? 'done' : ''}`} disabled={!unlocked} onClick={() => selectLesson(node.lessonIndex)}><i>{done ? <Check /> : unlocked ? node.lessonIndex + 1 : <LockKeyhole />}</i><span><b>{state.steps[node.lessonIndex]?.title || `Lesson ${String(node.lessonIndex + 1).padStart(2, '0')}`}</b><small>{done ? 'Checkpoint complete' : unlocked ? 'Video checkpoint' : 'Pass the previous checkpoint'}</small></span></button>; }
      const quiz = node.quiz; const unlocked = completed.size >= Number(quiz.unlock_after_video || 0); const done = passed.has(quiz.id); return <button key={`quiz-${quiz.id}`} className={`quiz-step ${activeQuiz?.id === quiz.id ? 'active' : ''} ${done ? 'done' : ''}`} disabled={!unlocked} onClick={() => { setActiveQuiz(quiz); setQuizResult(null); }}><i>{done ? <Check /> : unlocked ? '?' : <LockKeyhole />}</i><span><b>{quiz.title}</b><small>{unlocked ? `${quiz.pass_percent}% to pass · ${quiz.xp_reward} XP` : `Unlocks after ${quiz.unlock_after_video} lessons`}</small></span></button>;
    }) : <div className="mini-loader">Loading playlist…</div>}</nav></aside>
    <section className="lesson-workspace"><header className="lesson-header"><div><p className="eyebrow">PAID LEARNING SPACE</p><h1>{activeQuiz ? activeQuiz.title : state.steps[index]?.title || `Lesson ${index + 1}`}</h1><p>{activeQuiz ? activeQuiz.description || 'Pass this checkpoint to unlock the next lesson.' : completed.has(videoIds[index] || '') ? 'Completed. Continue to the next required step.' : 'Watch at least 80%, then complete the lesson to advance.'}</p></div><div className="xp-badge"><Trophy /><strong>{xp}</strong><span>XP</span></div></header>{error && <div className="form-message error">{error}</div>}
      {!activeQuiz ? <><div className="player-shell"><div id="youtube-player" /></div><div className="lesson-controls panel"><div><p className="eyebrow">WATCH CHECKPOINT</p><h3>{completed.has(videoIds[index] || '') ? 'Lesson complete.' : `${watched}% watched`}</h3><ProgressBar value={watched} /></div><button className="button button-acid button-large" disabled={busy || (!completed.has(videoIds[index] || '') && watched < 80)} onClick={() => completed.has(videoIds[index] || '') ? continueFromLesson() : void completeLesson()}>{busy ? <><LoaderCircle className="spin" />Saving progress…</> : completed.has(videoIds[index] || '') ? <><ArrowRight />Continue to next step</> : <><CirclePlay />Complete and continue</>}</button></div></> : <section className="quiz-panel panel"><div className="quiz-title"><Trophy /><div><p className="eyebrow">KNOWLEDGE CHECK</p><h2>{activeQuiz.title}</h2><p>Score {activeQuiz.pass_percent}% or higher to pass and earn {activeQuiz.xp_reward} XP.</p></div></div><form onSubmit={submitQuiz}>{[...(activeQuiz.course_quiz_questions ?? [])].sort((a, b) => a.position - b.position).map((question, questionIndex) => <fieldset key={question.id}><legend><span>{questionIndex + 1}</span>{question.prompt}</legend>{question.options.map((option, optionIndex) => <label key={option}><input type="radio" name={`q-${question.id}`} value={optionIndex} required /><span>{option}</span></label>)}</fieldset>)}<button className="button button-primary button-large" disabled={busy}>Submit quiz</button></form>{quizResult && <div className={`quiz-result ${quizResult.passed ? 'pass' : 'fail'}`}><strong>{quizResult.passed ? 'Checkpoint passed' : 'Not passed yet'} · {String(quizResult.score_percent)}%</strong><p>{String(quizResult.correct_count)} of {String(quizResult.total_count)} correct. {Number(quizResult.awarded_xp || 0) > 0 ? `+${String(quizResult.awarded_xp)} XP` : ''}</p>{Boolean(quizResult.passed) && <button type="button" className="button button-acid" onClick={() => continueFromQuiz(activeQuiz)}>Continue to next lesson <ArrowRight /></button>}</div>}</section>}

      {routeComplete && state.project && <section className="route-finale">
        <div className="route-finale-intro"><p className="eyebrow">COURSE ROUTE COMPLETE</p><h2>Build the final proof.</h2><p>You have finished every lesson and passed every checkpoint. The project is now the only remaining step.</p></div>
        <FinalProjectPanel
          supabase={supabase}
          project={state.project}
          submission={state.submission}
          unlocked
          onSubmitted={(submission) => setState((current) => current ? { ...current, submission } : current)}
        />
      </section>}
    </section>
  </main>;
}

// ---- src/pages/Admin.tsx ----

interface QuestionDraft { prompt: string; options: string; correct: number; explanation: string; }
const blankQuestion = (): QuestionDraft => ({ prompt: '', options: '', correct: 1, explanation: '' });

function Admin() {
  const [tab, setTab] = useState<'course' | 'quiz' | 'projects' | 'orders'>('course'); const [courses, setCourses] = useState<Challenge[]>([]); const [orders, setOrders] = useState<PaymentOrder[]>([]); const [questions, setQuestions] = useState<QuestionDraft[]>([blankQuestion(), blankQuestion(), blankQuestion()]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const load = async () => { setLoading(true); try { const data = await getAdminData(); setCourses(data.courses); setOrders(data.orders); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Admin data could not load.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const publishCourse = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setMessage(''); const form = new FormData(event.currentTarget); let playlist = ''; try { playlist = new URL(String(form.get('playlist'))).searchParams.get('list') || ''; } catch { setError('Use a valid YouTube playlist URL.'); setBusy(false); return; } const result = await supabase.rpc('create_challenge_from_playlist', { p_title: form.get('title'), p_slug: form.get('slug'), p_description: form.get('description'), p_outcome: form.get('outcome'), p_playlist_id: playlist, p_cover_image_url: form.get('cover') || null, p_lesson_count: 0, p_usd: Number(form.get('usd')), p_inr: Number(form.get('inr')) }); setBusy(false); if (result.error) return setError(result.error.message); setMessage('Course published.'); event.currentTarget.reset(); await load(); };
  const publishQuiz = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setMessage(''); const form = new FormData(event.currentTarget); const payload = questions.map((question) => ({ prompt: question.prompt, options: question.options.split('\n').map((item) => item.trim()).filter(Boolean), correct_index: question.correct - 1, explanation: question.explanation })); const result = await supabase.rpc('admin_create_course_quiz', { p_challenge_slug: form.get('course'), p_title: form.get('title'), p_description: form.get('description'), p_position: Number(form.get('position')), p_unlock_after_video: Number(form.get('unlock')), p_pass_percent: Number(form.get('pass')), p_xp_reward: Number(form.get('xp')), p_questions: payload }); setBusy(false); if (result.error) return setError(result.error.message); setMessage('Quiz published.'); setQuestions([blankQuestion(), blankQuestion(), blankQuestion()]); event.currentTarget.reset(); };
  if (loading) return <PageLoader label="Opening the admin workspace" />;
  if (error && !courses.length) return <main className="app-page shell"><PageError message={error} /></main>;

  return <main className="app-page shell admin-page"><header className="admin-hero"><div><p className="eyebrow">PRIVATE ADMIN</p><h1>Build the catalog.</h1><p>Publish courses, add knowledge checks and inspect payment activity.</p></div><div className="admin-count"><strong>{courses.length}</strong><span>courses in the database</span></div></header><div className="admin-tabs"><button className={tab === 'course' ? 'active' : ''} onClick={() => setTab('course')}><BookPlus />Add course</button><button className={tab === 'quiz' ? 'active' : ''} onClick={() => setTab('quiz')}><ClipboardList />Add quiz</button><button className={tab === 'projects' ? 'active' : ''} onClick={() => setTab('projects')}><ClipboardList />Project reviews</button><button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ReceiptText />Orders</button></div>{message && <div className="form-message success">{message}</div>}{error && <div className="form-message error">{error}</div>}
    {tab === 'course' && <section className="admin-grid"><form className="panel form admin-form" onSubmit={publishCourse}><p className="eyebrow">COURSE BUILDER</p><h2>Publish a playlist course.</h2><label>TITLE<input name="title" required onChange={(event) => { const slug = event.currentTarget.form?.elements.namedItem('slug') as HTMLInputElement | null; if (slug) slug.value = event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }} /></label><label>SLUG<input name="slug" pattern="[a-z0-9-]+" required /></label><label>YOUTUBE PLAYLIST URL<input name="playlist" type="url" required /></label><label>DESCRIPTION<textarea name="description" required /></label><label>OUTCOME<textarea name="outcome" required /></label><label>COVER IMAGE URL<input name="cover" type="url" /></label><div className="form-columns"><label>USD PRICE<input name="usd" type="number" step="0.01" defaultValue="2" required /></label><label>INR PRICE<input name="inr" type="number" step="1" defaultValue="159" required /></label></div><button className="button button-primary button-large" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Plus />}Publish course</button></form><aside className="panel current-catalog"><p className="eyebrow">CURRENT CATALOG</p><h2>{courses.length} course{courses.length === 1 ? '' : 's'}.</h2>{courses.map((course) => <article key={course.id}><span>{course.status}</span><h3>{course.title}</h3><p>{course.youtube_playlist_id || 'No playlist ID'}</p></article>)}</aside></section>}
    {tab === 'quiz' && <form className="panel form admin-form quiz-builder" onSubmit={publishQuiz}><p className="eyebrow">QUIZ BUILDER</p><h2>Add a paid checkpoint.</h2><div className="form-columns"><label>COURSE<select name="course" required>{courses.map((course) => <option key={course.id} value={course.slug}>{course.title}</option>)}</select></label><label>QUIZ TITLE<input name="title" required /></label></div><label>DESCRIPTION<textarea name="description" /></label><div className="four-columns"><label>POSITION<input name="position" type="number" min="1" defaultValue="1" /></label><label>AFTER LESSON<input name="unlock" type="number" min="0" defaultValue="2" /></label><label>PASS %<input name="pass" type="number" min="1" max="100" defaultValue="70" /></label><label>XP<input name="xp" type="number" min="0" defaultValue="60" /></label></div><div className="question-stack">{questions.map((question, index) => <article className="question-builder" key={index}><div className="question-head"><p className="eyebrow">QUESTION {index + 1}</p><button type="button" className="icon-button" disabled={questions.length === 1} onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></div><label>PROMPT<input value={question.prompt} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} required /></label><label>OPTIONS, ONE PER LINE<textarea value={question.options} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value } : item))} required /></label><div className="form-columns"><label>CORRECT OPTION NUMBER<input type="number" min="1" value={question.correct} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, correct: Number(event.target.value) } : item))} required /></label><label>EXPLANATION<input value={question.explanation} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, explanation: event.target.value } : item))} required /></label></div></article>)}</div><div className="admin-actions"><button type="button" className="button button-soft" onClick={() => setQuestions((current) => [...current, blankQuestion()])}><Plus />Add question</button><button className="button button-primary button-large" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Plus />}Publish quiz</button></div></form>}
    {tab === 'projects' && <AdminProjectReviews supabase={supabase} />}
    {tab === 'orders' && <section className="panel orders-panel"><p className="eyebrow">LATEST PAYMENT ACTIVITY</p><h2>{orders.length} recent order{orders.length === 1 ? '' : 's'}.</h2>{orders.length ? orders.map((order) => <article key={order.id}><div><strong>{order.challenges?.title || 'Course'}</strong><span>{order.provider} · {order.currency} {order.amount} · {new Date(order.created_at).toLocaleString()}</span></div><b className={`order-status ${order.status}`}>{order.status}</b></article>) : <p>No payment attempts yet.</p>}</section>}
  </main>;
}

// ---- src/pages/NotFound.tsx ----
function NotFound() { return <main className="not-found shell"><p className="eyebrow">404</p><h1>This route does not exist.</h1><p>At least this dead end is honest about being a dead end.</p><Link className="button button-primary" to="/"><ArrowLeft />Return home</Link></main>; }

const router = createBrowserRouter([
  { element: <PublicLayout />, children: [
    { path: '/', element: <Landing /> },
    { path: '/catalog', element: <Catalog /> },
    { path: '/course/:slug', element: <CoursePage /> },
  ] },
  { path: '/auth', element: <Auth /> },
  { element: <RequireAuth />, children: [
    { element: <AppLayout />, children: [
      { path: '/app', element: <Dashboard /> },
      { path: '/checkout/:slug', element: <Checkout /> },
    ] },
    { path: '/learn/:slug', element: <Learn /> },
  ] },
  { element: <RequireAdmin />, children: [{ element: <AppLayout />, children: [{ path: '/admin', element: <Admin /> }] }] },
  { path: '*', element: <NotFound /> },
]);

function App() { return <RouterProvider router={router} />; }

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('FINISH root element is missing.');
createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <SessionProvider><App /></SessionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
