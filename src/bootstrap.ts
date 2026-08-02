import './routes/routes.css';

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';

async function start() {
  if (normalizedPath === '/') {
    const { mountLanding } = await import('./routes/landing');
    mountLanding();
    return;
  }

  if (normalizedPath === '/catalog') {
    const { mountCatalog } = await import('./routes/catalog');
    await mountCatalog();
    return;
  }

  await import('./main');
}

start().catch((error: unknown) => {
  console.error('FINISH route bootstrap failed', error);
  const root = document.getElementById('root');
  if (!root) return;
  const message = error instanceof Error ? error.message : 'The page could not load.';
  root.innerHTML = `<main class="fatal-shell"><p class="eyebrow">APPLICATION ERROR</p><h1>This page failed safely.</h1><p>${message.replace(/[&<>"']/g, '')}</p><div class="fatal-actions"><button class="button button-primary" onclick="location.reload()">Reload FINISH</button><a class="button button-soft" href="/">Return home</a></div></main>`;
});
