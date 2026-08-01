from pathlib import Path

main_path = Path('src/main.tsx')
css_path = Path('src/styles.css')
main = main_path.read_text()
css = css_path.read_text()

main = main.replace(', Moon,', ',')
main = main.replace(', Sun,', ',')

start = main.find('// ---- src/contexts/ThemeContext.tsx ----')
end = main.find('// ---- src/components/ErrorBoundary.tsx ----')
if start == -1 or end == -1:
    raise SystemExit('Theme context block not found')
main = main[:start] + "// FINISH is intentionally dark-only.\n\n" + main[end:]

main = main.replace("  const { theme, toggle } = useTheme();\n", '')
old_toggle = '''          <button className="icon-button" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
'''
if old_toggle not in main:
    raise SystemExit('Theme toggle button not found')
main = main.replace(old_toggle, '')

old_root = '''      <ThemeProvider>
        <SessionProvider><App /></SessionProvider>
      </ThemeProvider>'''
if old_root not in main:
    raise SystemExit('Theme provider root not found')
main = main.replace(old_root, '<SessionProvider><App /></SessionProvider>')

marker = '/* FINISH dark-only premium landing */'
dark_css = r'''

/* FINISH dark-only premium landing */
:root,
:root[data-theme="light"],
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #09090b;
  --bg-2: #111114;
  --panel: #151519;
  --ink: #f7f3ea;
  --muted: #a8a39d;
  --line: rgba(255,255,255,.11);
  --purple: #8c72ff;
  --purple-2: #b7a7ff;
  --acid: #d8ff52;
  --dark: #09090b;
  --dark-2: #111114;
  --white: #fff;
  --shadow: 0 28px 100px rgba(0,0,0,.38);
}
html, body, #root { background: var(--bg); }
body { color: var(--ink); }
.site-header { background: rgba(9,9,11,.82); border-bottom-color: rgba(255,255,255,.08); }
.site-header .desktop-nav a { color: #aaa5a0; }
.site-header .desktop-nav a:hover,
.site-header .desktop-nav a.active { color: #fff; }
.button-dark { background: #f7f3ea; color: #0a0a0c; }
.button-soft { background: rgba(255,255,255,.04); color: #fff; }
.icon-button { color: #fff; }
.footer { background: #09090b; }

.hero {
  min-height: 820px;
  grid-template-columns: minmax(0, .92fr) minmax(520px, 1.08fr);
  gap: clamp(54px, 7vw, 104px);
  padding-top: 84px;
  padding-bottom: 110px;
}
.hero-copy h1 {
  max-width: 760px;
  margin: 24px 0 28px;
  font-size: clamp(68px, 7.4vw, 110px);
  color: #f7f3ea;
}
.hero-copy h1 em { color: var(--purple-2); }
.hero-copy > p { max-width: 650px; color: #b8b3ad; }
.status-line { color: #d8d3cb; }
.hero-actions { margin-top: 38px; }
.text-link { color: #e2ddd5; }
.trust-row { color: #8f8b86; }
.hero-stage { min-height: 650px; }
.hero-stage:before { opacity: .34; filter: blur(56px); }
.stage-orbit { opacity: .5; }
.product-window {
  max-width: 690px;
  border-color: rgba(255,255,255,.16);
  box-shadow: 0 48px 140px rgba(0,0,0,.56);
  transform: perspective(1500px) rotateY(-4deg) rotateX(1.5deg);
}
.window-body { min-height: 430px; }
.preview-sidebar { background: #09090c; }
.preview-content { padding: 38px; }
.preview-video { height: 220px; }
.floating-card {
  background: rgba(20,20,24,.9);
  border-color: rgba(255,255,255,.12);
  color: #fff;
  backdrop-filter: blur(18px);
}
.floating-card span { color: #9d9893; }
.manifesto { background: var(--acid); }
.method-section .section-heading h2,
.method-section .section-heading p,
.value-section h2 { color: #f7f3ea; }
.method-grid article {
  background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018));
  border-color: rgba(255,255,255,.1);
}
.method-grid article:hover { border-color: rgba(140,114,255,.5); transform: translateY(-4px); }
.method-grid p { color: #9f9a95; }
.value-card {
  background: radial-gradient(circle at 84% 85%, rgba(140,114,255,.38), transparent 38%), #111114;
  border: 1px solid rgba(255,255,255,.1);
}
.value-card:before { display: none; }

@media (max-width: 980px) {
  .hero { grid-template-columns: 1fr; min-height: auto; padding-top: 64px; }
  .hero-copy { max-width: 760px; }
  .hero-stage { min-height: 570px; }
  .product-window { transform: none; }
}
@media (max-width: 720px) {
  .hero { padding-top: 42px; padding-bottom: 74px; gap: 44px; }
  .hero-copy h1 { font-size: clamp(52px, 16vw, 76px); }
  .hero-copy > p { font-size: 17px; }
  .hero-actions { align-items: flex-start; flex-direction: column; }
  .hero-stage { min-height: 430px; }
  .window-body { grid-template-columns: 1fr; min-height: 360px; }
  .preview-sidebar { display: none; }
  .preview-content { padding: 24px; }
  .preview-video { height: 180px; }
  .floating-card { display: none; }
  .manifesto-inner { overflow: hidden; justify-content: flex-start; gap: 22px; }
}
'''
if marker not in css:
    css = css.rstrip() + dark_css + '\n'

main_path.write_text(main)
css_path.write_text(css)
