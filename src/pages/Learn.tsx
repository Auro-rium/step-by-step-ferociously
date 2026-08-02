import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronLeft, CirclePlay, LoaderCircle, LockKeyhole, Trophy } from 'lucide-react';
import { FinalProjectPanel } from '../course-product';
import {
  getLearningRoute,
  PageError,
  PageLoader,
  ProgressBar,
  supabase,
  useSession,
  type LearningState,
  type Quiz,
} from '../main';

declare global {
  interface Window {
    YT?: {
      Player: new (target: string | HTMLElement, options: Record<string, unknown>) => YouTubePlayer;
      PlayerState: { PLAYING: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubePlayer {
  getDuration: () => number;
  getCurrentTime: () => number;
  cueVideoById: (id: string) => void;
  destroy: () => void;
}

function loadYouTubeApi() {
  return new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) return resolve();
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    const timeout = window.setTimeout(() => reject(new Error('YouTube took too long to load.')), 12000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => reject(new Error('YouTube could not load.'));
      document.head.append(script);
    }
  });
}

export default function Learn() {
  const { slug = '' } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const [state, setState] = useState<LearningState | null>(null);
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [watched, setWatched] = useState(0);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizResult, setQuizResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const player = useRef<YouTubePlayer | null>(null);
  const watchTimer = useRef<number | null>(null);
  const playerHost = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const data = await getLearningRoute(slug);
        if (!active) return;
        const orderedSteps = [...data.steps].sort((a, b) => a.position - b.position);
        const ids = orderedSteps.map((step) => step.youtube_video_id || '').filter(Boolean);
        if (!ids.length || ids.length !== orderedSteps.length) {
          throw new Error('One or more lessons are missing their canonical video link.');
        }
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
      }
    })();
    return () => { active = false; };
  }, [slug, user, navigate]);

  useEffect(() => {
    if (!state || !videoIds.length || activeQuiz) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT) return;
      const initialVideoId = videoIds[index] || videoIds[0];
      const host = playerHost.current;
      if (!host) return;
      host.replaceChildren();
      const mount = document.createElement('div');
      mount.className = 'youtube-player-mount';
      host.appendChild(mount);
      player.current = new window.YT.Player(mount, {
        width: '100%',
        height: '100%',
        videoId: initialVideoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: (event: { target: YouTubePlayer }) => event.target.cueVideoById(initialVideoId),
          onStateChange: (event: { data: number }) => {
            if (!window.YT) return;
            if (watchTimer.current) window.clearInterval(watchTimer.current);
            if (event.data === window.YT.PlayerState.PLAYING) {
              watchTimer.current = window.setInterval(() => {
                const duration = player.current?.getDuration() || 0;
                const current = player.current?.getCurrentTime() || 0;
                setWatched(duration ? Math.min(100, Math.round((current / duration) * 100)) : 0);
              }, 1000);
            }
            if (event.data === window.YT.PlayerState.ENDED) setWatched(100);
          },
        },
      });
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'YouTube could not load.'));
    return () => {
      cancelled = true;
      if (watchTimer.current) window.clearInterval(watchTimer.current);
      player.current = null;
      playerHost.current?.replaceChildren();
    };
  }, [state?.course.id, videoIds.length, activeQuiz?.id, index]);

  const completed = useMemo(
    () => new Set(state?.progress.filter((item) => item.status === 'completed').map((item) => item.video_id) ?? []),
    [state?.progress],
  );
  const passed = useMemo(
    () => new Set(state?.attempts.filter((item) => item.passed).map((item) => item.quiz_id) ?? []),
    [state?.attempts],
  );
  const xp = state?.xp.reduce((sum, event) => sum + Number(event.amount || 0), 0) ?? 0;
  const totalSteps = Math.max(1, videoIds.length + (state?.quizzes.length ?? 0));
  const progressPercent = Math.round(((completed.size + passed.size) / totalSteps) * 100);
  const routeComplete = videoIds.length > 0
    && completed.size >= videoIds.length
    && (state?.quizzes.every((quiz) => passed.has(quiz.id)) ?? false);

  const canOpenLesson = (lessonIndex: number) => {
    if (lessonIndex === 0) return true;
    if (!completed.has(videoIds[lessonIndex - 1] || '')) return false;
    return state?.quizzes
      .filter((quiz) => Number(quiz.unlock_after_video || 0) <= lessonIndex)
      .every((quiz) => passed.has(quiz.id)) ?? true;
  };

  const openLesson = (lessonIndex: number, force = false) => {
    if (!force && !canOpenLesson(lessonIndex)) return;
    const exactVideoId = videoIds[lessonIndex];
    if (!exactVideoId) return setError('This lesson is missing its canonical video link.');
    setIndex(lessonIndex);
    setWatched(0);
    setActiveQuiz(null);
    setQuizResult(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const continueFromLesson = (lessonIndex = index, newlyCompleted = false) => {
    if (!state) return;
    const completedCount = completed.size + (newlyCompleted && !completed.has(videoIds[lessonIndex] || '') ? 1 : 0);
    const nextQuiz = state.quizzes.find(
      (quiz) => Number(quiz.unlock_after_video || 0) === lessonIndex + 1 && !passed.has(quiz.id),
    );
    if (nextQuiz && completedCount >= Number(nextQuiz.unlock_after_video || 0)) {
      setActiveQuiz(nextQuiz);
      setQuizResult(null);
      setError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (videoIds[lessonIndex + 1]) openLesson(lessonIndex + 1, true);
  };

  const continueFromServerStep = (nextStep: Record<string, unknown> | null | undefined) => {
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

  const completeLesson = async () => {
    if (!state || !user || watched < 80) return;
    const id = videoIds[index];
    if (!id) return;
    setBusy(true);
    const result = await supabase.rpc('complete_playlist_video', {
      p_challenge_id: state.course.id,
      p_video_id: id,
      p_position: index,
    });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    setError('');
    const awarded = Number(Array.isArray(result.data) ? result.data[0]?.awarded_xp : result.data?.awarded_xp || 0);
    setState((current) => current ? {
      ...current,
      progress: current.progress.some((item) => item.video_id === id)
        ? current.progress
        : [...current.progress, { video_id: id, challenge_id: current.course.id, status: 'completed', position: index }],
      xp: awarded ? [...current.xp, { amount: awarded }] : current.xp,
    } : current);
    window.setTimeout(() => continueFromLesson(index, true), 180);
  };

  const submitQuiz = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeQuiz) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const questions = [...(activeQuiz.course_quiz_questions ?? [])].sort((a, b) => a.position - b.position);
    const answers = questions.map((question) => ({
      question_id: question.id,
      selected_index: Number(form.get(`q-${question.id}`)),
    }));
    const result = await supabase.rpc('submit_course_quiz', { p_quiz_id: activeQuiz.id, p_answers: answers });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    const payload = result.data as Record<string, unknown>;
    setQuizResult(payload);
    setState((current) => current ? {
      ...current,
      attempts: [{ quiz_id: activeQuiz.id, passed: Boolean(payload.passed), score_percent: Number(payload.score_percent || 0) }, ...current.attempts],
      xp: Number(payload.awarded_xp || 0) ? [...current.xp, { amount: Number(payload.awarded_xp) }] : current.xp,
    } : current);
    if (Boolean(payload.passed)) {
      setError('');
      window.setTimeout(() => continueFromServerStep(payload.next_step as Record<string, unknown> | undefined), 250);
    }
  };

  const routeNodes = videoIds.flatMap((id, lessonIndex) => [
    { type: 'lesson' as const, id, lessonIndex },
    ...(state?.quizzes
      .filter((quiz) => Number(quiz.unlock_after_video || 0) === lessonIndex + 1)
      .map((quiz) => ({ type: 'quiz' as const, quiz })) ?? []),
  ]);

  if (error && !state) return <main className="app-page shell"><PageError message={error} /></main>;
  if (!state || !user) return <PageLoader label="Opening the learning route" />;

  return (
    <main className="learn-page">
      <aside className="quest-map">
        <Link className="back-link" to="/app"><ChevronLeft />My learning</Link>
        <p className="eyebrow">QUEST MAP</p>
        <h2>{state.course.title}</h2>
        <div className="quest-progress">
          <div><strong>{progressPercent}%</strong><span>{xp} XP</span></div>
          <ProgressBar value={progressPercent} />
        </div>
        <nav className="lesson-list">
          {videoIds.length ? routeNodes.map((node) => {
            if (node.type === 'lesson') {
              const done = completed.has(node.id);
              const unlocked = canOpenLesson(node.lessonIndex);
              return (
                <button
                  key={`lesson-${node.id}`}
                  className={`${index === node.lessonIndex && !activeQuiz ? 'active' : ''} ${done ? 'done' : ''}`}
                  disabled={!unlocked}
                  onClick={() => openLesson(node.lessonIndex)}
                >
                  <i>{done ? <Check /> : unlocked ? node.lessonIndex + 1 : <LockKeyhole />}</i>
                  <span>
                    <b>{state.steps[node.lessonIndex]?.title || `Lesson ${String(node.lessonIndex + 1).padStart(2, '0')}`}</b>
                    <small>{done ? 'Checkpoint complete' : unlocked ? 'Video checkpoint' : 'Pass the previous checkpoint'}</small>
                  </span>
                </button>
              );
            }
            const quiz = node.quiz;
            const unlocked = completed.size >= Number(quiz.unlock_after_video || 0);
            const done = passed.has(quiz.id);
            return (
              <button
                key={`quiz-${quiz.id}`}
                className={`quiz-step ${activeQuiz?.id === quiz.id ? 'active' : ''} ${done ? 'done' : ''}`}
                disabled={!unlocked}
                onClick={() => { setActiveQuiz(quiz); setQuizResult(null); }}
              >
                <i>{done ? <Check /> : unlocked ? '?' : <LockKeyhole />}</i>
                <span>
                  <b>{quiz.title}</b>
                  <small>{unlocked ? `${quiz.pass_percent}% to pass · ${quiz.xp_reward} XP` : `Unlocks after ${quiz.unlock_after_video} lessons`}</small>
                </span>
              </button>
            );
          }) : <div className="mini-loader">Loading playlist…</div>}
        </nav>
      </aside>

      <section className="lesson-workspace">
        <header className="lesson-header">
          <div>
            <p className="eyebrow">PAID LEARNING SPACE</p>
            <h1>{activeQuiz ? activeQuiz.title : state.steps[index]?.title || `Lesson ${index + 1}`}</h1>
            <p>{activeQuiz
              ? activeQuiz.description || 'Pass this checkpoint to unlock the next lesson.'
              : completed.has(videoIds[index] || '')
                ? 'Completed. Continue to the next required step.'
                : 'Watch at least 80%, then complete the lesson to advance.'}</p>
          </div>
          <div className="xp-badge"><Trophy /><strong>{xp}</strong><span>XP</span></div>
        </header>

        {error && <div className="form-message error">{error}</div>}

        {!activeQuiz ? (
          <>
            <div className="player-shell"><div ref={playerHost} className="youtube-player-host" /></div>
            <div className="lesson-controls panel">
              <div>
                <p className="eyebrow">WATCH CHECKPOINT</p>
                <h3>{completed.has(videoIds[index] || '') ? 'Lesson complete.' : `${watched}% watched`}</h3>
                <ProgressBar value={watched} />
              </div>
              <button
                className="button button-acid button-large"
                disabled={busy || (!completed.has(videoIds[index] || '') && watched < 80)}
                onClick={() => completed.has(videoIds[index] || '') ? continueFromLesson() : void completeLesson()}
              >
                {busy
                  ? <><LoaderCircle className="spin" />Saving progress…</>
                  : completed.has(videoIds[index] || '')
                    ? <><ArrowRight />Continue to next step</>
                    : <><CirclePlay />Complete and continue</>}
              </button>
            </div>
          </>
        ) : (
          <section className="quiz-panel panel">
            <div className="quiz-title">
              <Trophy />
              <div>
                <p className="eyebrow">KNOWLEDGE CHECK</p>
                <h2>{activeQuiz.title}</h2>
                <p>Score {activeQuiz.pass_percent}% or higher to pass and earn {activeQuiz.xp_reward} XP.</p>
              </div>
            </div>
            <form onSubmit={submitQuiz}>
              {[...(activeQuiz.course_quiz_questions ?? [])]
                .sort((a, b) => a.position - b.position)
                .map((question, questionIndex) => (
                  <fieldset key={question.id}>
                    <legend><span>{questionIndex + 1}</span>{question.prompt}</legend>
                    {question.options.map((option, optionIndex) => (
                      <label key={option}>
                        <input type="radio" name={`q-${question.id}`} value={optionIndex} required />
                        <span>{option}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              <button className="button button-primary button-large" disabled={busy}>Submit quiz</button>
            </form>
            {quizResult && (
              <div className={`quiz-result ${quizResult.passed ? 'pass' : 'fail'}`}>
                <strong>{quizResult.passed ? 'Checkpoint passed' : 'Not passed yet'} · {String(quizResult.score_percent)}%</strong>
                <p>{String(quizResult.correct_count)} of {String(quizResult.total_count)} correct. {Number(quizResult.awarded_xp || 0) > 0 ? `+${String(quizResult.awarded_xp)} XP` : ''}</p>
                {Boolean(quizResult.passed) && (
                  <button
                    type="button"
                    className="button button-acid"
                    onClick={() => continueFromServerStep(quizResult.next_step as Record<string, unknown> | undefined)}
                  >
                    Continue to next step <ArrowRight />
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {routeComplete && state.project && (
          <section className="route-finale">
            <div className="route-finale-intro">
              <p className="eyebrow">COURSE ROUTE COMPLETE</p>
              <h2>Build the final proof.</h2>
              <p>You have finished every lesson and passed every checkpoint. The project is now the only remaining step.</p>
            </div>
            <FinalProjectPanel
              supabase={supabase}
              project={state.project}
              submission={state.submission}
              unlocked
              onSubmitted={(submission) => setState((current) => current ? { ...current, submission } : current)}
            />
          </section>
        )}
      </section>
    </main>
  );
}
