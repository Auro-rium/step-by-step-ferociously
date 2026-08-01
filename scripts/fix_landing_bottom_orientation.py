from pathlib import Path

path = Path('src/styles.css')
text = path.read_text()
marker = '/* FINISH landing bottom orientation fix */'
css = r'''

/* FINISH landing bottom orientation fix */
.method-section,
.value-section,
.footer {
  overflow: clip;
}

.method-grid {
  align-items: stretch;
}

.method-grid article {
  min-width: 0;
}

.value-card {
  grid-template-columns: minmax(0, 1.15fr) minmax(220px, .85fr);
}

.value-card > * {
  min-width: 0;
}

.value-number {
  align-self: center;
}

.footer-inner {
  flex-wrap: wrap;
}

@media (max-width: 980px) {
  .method-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .method-grid article {
    min-height: auto;
    padding: 30px;
  }

  .method-grid svg {
    margin: 34px 0 32px;
  }

  .value-card {
    grid-template-columns: 1fr;
    gap: 48px;
    padding: 56px;
  }

  .value-number {
    justify-items: start;
  }

  .value-number strong {
    font-size: clamp(120px, 26vw, 190px);
  }
}

@media (max-width: 720px) {
  .section {
    padding: 88px 0;
  }

  .section-heading h2,
  .value-card h2 {
    font-size: clamp(42px, 13vw, 62px);
    line-height: .96;
  }

  .method-grid {
    margin-top: 46px;
  }

  .method-grid article {
    padding: 26px 22px;
    border-radius: 20px;
  }

  .value-card {
    min-height: 0;
    padding: 34px 24px;
    border-radius: 24px;
  }

  .value-card p:not(.eyebrow) {
    font-size: 16px;
  }

  .value-card .button {
    width: 100%;
  }

  .value-number {
    gap: 8px;
  }

  .value-number strong {
    font-size: clamp(104px, 34vw, 150px);
  }

  .footer-inner {
    min-height: auto;
    padding: 34px 0;
    flex-direction: column;
    align-items: flex-start;
  }

  .footer-inner p {
    max-width: none;
    margin: 0;
  }

  .manifesto-inner {
    justify-content: flex-start;
    gap: 20px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .manifesto-inner::-webkit-scrollbar {
    display: none;
  }
}
'''

if marker not in text:
    path.write_text(text.rstrip() + css + '\n')
