from pathlib import Path

path = Path('src/main.tsx')
text = path.read_text()

old_guard = """  useEffect(() => {
    if (!state || !videoIds.length) return;
"""
new_guard = """  useEffect(() => {
    if (!state || !videoIds.length || activeQuiz) return;
"""
if old_guard not in text:
    raise SystemExit('YouTube player effect guard not found')
text = text.replace(old_guard, new_guard, 1)

old_deps = """  }, [state?.course.id, videoIds.length]);
"""
new_deps = """  }, [state?.course.id, videoIds.length, activeQuiz?.id, index]);
"""
if old_deps not in text:
    raise SystemExit('YouTube player effect dependency list not found')
text = text.replace(old_deps, new_deps, 1)

old_open = """    setError('');
    player.current?.cueVideoById(exactVideoId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
"""
new_open = """    setError('');
    // The player is recreated after the quiz panel unmounts. Calling a stale
    // iframe reference here caused the next lecture to render as a blank area.
    window.scrollTo({ top: 0, behavior: 'smooth' });
"""
if old_open not in text:
    raise SystemExit('openLesson stale player call not found')
text = text.replace(old_open, new_open, 1)

path.write_text(text)
