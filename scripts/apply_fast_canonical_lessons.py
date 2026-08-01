from pathlib import Path

main_path = Path('src/main.tsx')
text = main_path.read_text()

anchor = "export async function getAdminData() {"
insert = """export async function getLearningRoute(slug: string): Promise<LearningState> {
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

"""
if insert not in text:
    if anchor not in text:
        raise SystemExit('getAdminData anchor not found')
    text = text.replace(anchor, insert + anchor, 1)

text = text.replace(
    "interface YouTubePlayer { getPlaylist: () => string[]; getDuration: () => number; getCurrentTime: () => number; playVideoAt: (index: number) => void; cueVideoById: (id: string) => void; destroy: () => void; }",
    "interface YouTubePlayer { getDuration: () => number; getCurrentTime: () => number; cueVideoById: (id: string) => void; destroy: () => void; }",
    1,
)

load_start = text.find("  useEffect(() => { if (!user) return; let active = true; (async () => { try { const course = await getCourse(slug);")
load_end = text.find("\n\n  useEffect(() => { if (!state?.course.youtube_playlist_id)", load_start)
if load_start >= 0 and load_end >= 0:
    new_load = """  useEffect(() => { if (!user) return; let active = true; (async () => { try {
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
  } })(); return () => { active = false; }; }, [slug, user, navigate]);"""
    text = text[:load_start] + new_load + text[load_end:]
elif "const data = await getLearningRoute(slug);" not in text:
    raise SystemExit('learning data effect not found')

player_start = text.find("  useEffect(() => { if (!state?.course.youtube_playlist_id) return;")
player_end = text.find("\n\n  const completed = useMemo(", player_start)
if player_start >= 0 and player_end >= 0:
    new_player = """  useEffect(() => {
    if (!state || !videoIds.length) return;
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
  }, [state?.course.id, videoIds.length]);"""
    text = text[:player_start] + new_player + text[player_end:]
elif "videoId: initialVideoId" not in text:
    raise SystemExit('YouTube player effect not found')

open_start = text.find("  const openLesson = (lessonIndex: number, force = false) => {")
open_end = text.find("\n  const selectLesson", open_start)
if open_start >= 0 and open_end >= 0:
    new_open = """  const openLesson = (lessonIndex: number, force = false) => {
    if (!force && !canOpenLesson(lessonIndex)) return;
    const exactVideoId = videoIds[lessonIndex];
    if (!exactVideoId) return setError('This lesson is missing its canonical video link.');
    setIndex(lessonIndex);
    setWatched(0);
    setActiveQuiz(null);
    setQuizResult(null);
    setError('');
    player.current?.cueVideoById(exactVideoId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };"""
    text = text[:open_start] + new_open + text[open_end:]
elif "player.current?.cueVideoById(exactVideoId)" not in text:
    raise SystemExit('openLesson controller not found')

progress_line = "  const totalSteps = Math.max(1, videoIds.length + (state?.quizzes.length ?? 0)); const progressPercent = Math.round(((completed.size + passed.size) / totalSteps) * 100);"
if "const routeComplete =" not in text:
    if progress_line not in text:
        raise SystemExit('progress calculation not found')
    text = text.replace(progress_line, progress_line + "\n  const routeComplete = videoIds.length > 0 && completed.size >= videoIds.length && (state?.quizzes.every((quiz) => passed.has(quiz.id)) ?? false);", 1)

project_start = text.find("      <FinalProjectPanel\n")
project_end = text.find("      />", project_start)
if project_start >= 0 and project_end >= 0:
    project_end += len("      />")
    new_project = """      {routeComplete && state.project && <section className=\"route-finale\">
        <div className=\"route-finale-intro\"><p className=\"eyebrow\">COURSE ROUTE COMPLETE</p><h2>Build the final proof.</h2><p>You have finished every lesson and passed every checkpoint. The project is now the only remaining step.</p></div>
        <FinalProjectPanel
          supabase={supabase}
          project={state.project}
          submission={state.submission}
          unlocked
          onSubmitted={(submission) => setState((current) => current ? { ...current, submission } : current)}
        />
      </section>}"""
    text = text[:project_start] + new_project + text[project_end:]
elif "route-finale" not in text:
    raise SystemExit('final project block not found')

main_path.write_text(text)

styles_path = Path('src/styles.css')
styles = styles_path.read_text()
css = """
/* Premium learning route */
.lesson-workspace{min-width:0}
.player-shell{background:#050506;box-shadow:0 24px 80px rgba(0,0,0,.3)}
.lesson-controls{position:sticky;bottom:18px;z-index:12;backdrop-filter:blur(18px);background:color-mix(in srgb,var(--panel) 91%,transparent)}
.lesson-controls .button{min-width:210px}
.lesson-header h1{max-width:900px}
.lesson-header>div:first-child>p:last-child{max-width:760px}
.route-finale{margin-top:44px;padding-top:44px;border-top:1px solid var(--line)}
.route-finale-intro{max-width:760px;margin-bottom:24px}
.route-finale-intro h2{margin:0 0 12px;font:600 clamp(38px,5vw,64px)/.95 'Newsreader',serif;letter-spacing:-.04em}
.route-finale-intro p:last-child{color:var(--muted);line-height:1.65}
@media(max-width:900px){
  .lesson-controls{bottom:10px;display:grid;gap:16px}
  .lesson-controls .button{width:100%;min-width:0}
  .quest-map{max-height:42vh;overflow:auto}
  .lesson-workspace{padding-top:24px}
}
"""
if "/* Premium learning route */" not in styles:
    styles += "\n" + css
styles_path.write_text(styles)

index_path = Path('index.html')
index = index_path.read_text()
extra = """    <link rel=\"dns-prefetch\" href=\"//www.youtube.com\" />
    <link rel=\"preconnect\" href=\"https://i.ytimg.com\" crossorigin />
    <link rel=\"preconnect\" href=\"https://www.google.com\" crossorigin />
"""
if 'https://i.ytimg.com' not in index:
    index = index.replace('    <link rel="preconnect" href="https://www.youtube.com" crossorigin />\n', '    <link rel="preconnect" href="https://www.youtube.com" crossorigin />\n' + extra)
index_path.write_text(index)
