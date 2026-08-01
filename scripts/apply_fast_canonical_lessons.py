from pathlib import Path

path = Path('src/main.tsx')
text = path.read_text()

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

old_interface = "interface YouTubePlayer { getPlaylist: () => string[]; getDuration: () => number; getCurrentTime: () => number; playVideoAt: (index: number) => void; cueVideoById: (id: string) => void; destroy: () => void; }"
new_interface = "interface YouTubePlayer { getDuration: () => number; getCurrentTime: () => number; cueVideoById: (id: string) => void; destroy: () => void; }"
if old_interface in text:
    text = text.replace(old_interface, new_interface, 1)

old_load = """  useEffect(() => { if (!user) return; let active = true; (async () => { try { const course = await getCourse(slug); const enrollment = await getEnrollment(user.id, course.id); if (!hasPaidAccess(enrollment)) return navigate(`/checkout/${slug}`, { replace: true }); const data = await getLearningData(user.id, course.id); if (active) setState({ course, ...data }); } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'The course player could not load.'); } })(); return () => { active = false; }; }, [slug, user, navigate]);
"""
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
  } })(); return () => { active = false; }; }, [slug, user, navigate]);
"""
if old_load not in text:
    raise SystemExit('learning load block not found')
text = text.replace(old_load, new_load, 1)

start = text.find("  useEffect(() => { if (!state?.course.youtube_playlist_id) return;")
end_marker = "  const completed = useMemo("
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('YouTube effect block not found')
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
  }, [state?.course.id, videoIds.length]);

"""
text = text[:start] + new_player + text[end:]

old_select = "const selectLesson = (lessonIndex: number) => { if (!canOpenLesson(lessonIndex)) return; setIndex(lessonIndex); setWatched(0); setActiveQuiz(null); setQuizResult(null); player.current?.playVideoAt(lessonIndex); };"
new_select = "const selectLesson = (lessonIndex: number) => { if (!canOpenLesson(lessonIndex)) return; const exactVideoId = videoIds[lessonIndex]; if (!exactVideoId) return setError('This lesson is missing its video link.'); setError(''); setIndex(lessonIndex); setWatched(0); setActiveQuiz(null); setQuizResult(null); player.current?.cueVideoById(exactVideoId); };"
if old_select not in text:
    raise SystemExit('selectLesson block not found')
text = text.replace(old_select, new_select, 1)

path.write_text(text)
