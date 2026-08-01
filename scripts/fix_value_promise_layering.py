from pathlib import Path

path = Path('src/styles.css')
text = path.read_text()
marker = '/* FINISH value promise layering fix */'
css = r'''

/* FINISH value promise layering fix */
.value-card {
  position: relative;
  overflow: hidden;
}
.value-card > div:first-child {
  position: relative;
  z-index: 2;
}
.value-number {
  position: relative;
  z-index: 1;
  min-height: 360px;
  display: grid;
  place-items: center;
  align-content: center;
  isolation: isolate;
}
.value-number::before {
  content: '1';
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -52%);
  z-index: -1;
  pointer-events: none;
  font: 500 clamp(220px, 32vw, 520px)/.72 'Newsreader', serif;
  color: var(--acid);
  opacity: .14;
}
.value-number strong {
  display: none;
}
.value-number small,
.value-number span {
  position: relative;
  z-index: 2;
  text-align: center;
}
.value-number small {
  margin-bottom: 150px;
}
.value-number span {
  margin-top: 150px;
}
@media (max-width: 980px) {
  .value-number {
    min-height: 300px;
    width: 100%;
  }
  .value-number::before {
    font-size: clamp(190px, 48vw, 330px);
    opacity: .12;
  }
  .value-number small {
    margin-bottom: 110px;
  }
  .value-number span {
    margin-top: 110px;
  }
}
@media (max-width: 560px) {
  .value-number {
    min-height: 250px;
  }
  .value-number::before {
    font-size: clamp(160px, 62vw, 250px);
    opacity: .11;
  }
  .value-number small {
    margin-bottom: 86px;
  }
  .value-number span {
    margin-top: 86px;
  }
}
'''

if marker not in text:
    path.write_text(text.rstrip() + css + '\n')
