from pathlib import Path

path = Path('src/styles.css')
text = path.read_text()
marker = '/* FINISH stable YouTube player sizing */'
css = r'''

/* FINISH stable YouTube player sizing */
.player-shell {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  min-height: 0;
  overflow: hidden;
  background: #000;
}
.youtube-player-host,
.youtube-player-mount,
.youtube-player-host iframe {
  position: absolute !important;
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 100% !important;
  min-height: 100% !important;
  border: 0 !important;
}
@media (max-width: 720px) {
  .player-shell { aspect-ratio: 16 / 9; }
}
'''

if marker not in text:
    path.write_text(text.rstrip() + css + '\n')

# This script is idempotent and defines the player dimensions for all courses.
