from pathlib import Path

path = Path('src/main.tsx')
text = path.read_text()

text = text.replace(
    "YT?: { Player: new (id: string, options: Record<string, unknown>) => YouTubePlayer; PlayerState: { PLAYING: number; ENDED: number } };",
    "YT?: { Player: new (target: string | HTMLElement, options: Record<string, unknown>) => YouTubePlayer; PlayerState: { PLAYING: number; ENDED: number } };",
    1,
)

old_refs = """  const player = useRef<YouTubePlayer | null>(null); const watchTimer = useRef<number | null>(null);
"""
new_refs = """  const player = useRef<YouTubePlayer | null>(null); const watchTimer = useRef<number | null>(null); const playerHost = useRef<HTMLDivElement | null>(null);
"""
if old_refs not in text:
    raise SystemExit('player refs anchor not found')
text = text.replace(old_refs, new_refs, 1)

old_create = """      const initialVideoId = videoIds[index] || videoIds[0];
      player.current = new window.YT.Player('youtube-player', {
"""
new_create = """      const initialVideoId = videoIds[index] || videoIds[0];
      const host = playerHost.current;
      if (!host) return;
      host.replaceChildren();
      const mount = document.createElement('div');
      mount.className = 'youtube-player-mount';
      host.appendChild(mount);
      player.current = new window.YT.Player(mount, {
"""
if old_create not in text:
    raise SystemExit('YouTube constructor anchor not found')
text = text.replace(old_create, new_create, 1)

old_cleanup = """      player.current?.destroy();
      player.current = null;
"""
new_cleanup = """      // Never call YT.Player.destroy() on a node React owns. The iframe API
      // replaces its mount element, which makes React remove a non-child and crash.
      player.current = null;
      playerHost.current?.replaceChildren();
"""
if old_cleanup not in text:
    raise SystemExit('unsafe player cleanup not found')
text = text.replace(old_cleanup, new_cleanup, 1)

old_render = """<div className=\"player-shell\"><div key={videoIds[index]} id=\"youtube-player\" /></div>"""
new_render = """<div className=\"player-shell\"><div ref={playerHost} className=\"youtube-player-host\" /></div>"""
if old_render not in text:
    raise SystemExit('player render anchor not found')
text = text.replace(old_render, new_render, 1)

path.write_text(text)
