async function renderRoute() {
  cleanupPlayer();
  app.innerHTML = '<div class="boot-screen">Loading FINISH.</div>';
  try {
    await refreshAuth();
    const route = routeInfo();
    if (route.name === 'landing') await renderLanding();
    else if (route.name === 'auth') await renderAuth(route.query);
    else if (route.name === 'home') await renderHome();
    else if (route.name === 'catalog') await renderCatalog();
    else if (route.name === 'course') await renderCourseDetail(route.slug);
    else if (route.name === 'checkout') await renderCheckout(route.slug);
    else if (route.name === 'learn') await renderLearn(route.slug);
    else if (route.name === 'admin') await renderAdmin();
    else renderNotFound();
    bindGlobalActions();
    scrollToCurrentHash();
  } catch (error) {
    console.error(error);
    app.innerHTML = `${publicHeader()}<main class="shell"><section class="page-head"><div class="eyebrow">PRODUCT ERROR</div><h1 class="display">Something broke.</h1><p class="lead">${escapeHtml(error?.message || String(error))}</p><button class="btn" onclick="location.reload()">Reload</button></section></main>`;
  }
}

function scrollToCurrentHash() {
  if (!location.hash) {
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }
  const id = decodeURIComponent(location.hash.slice(1));
  requestAnimationFrame(() => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function bindGlobalActions() {
  document.querySelectorAll('a[data-link]').forEach((link) => link.addEventListener('click', (event) => {
    const url = new URL(link.href, location.origin);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  }));
  document.querySelectorAll('[data-signout]').forEach((button) => button.onclick = async () => { await client.auth.signOut(); authContext = { session: null, profile: null }; navigate('/', true); });
}

window.addEventListener('popstate', renderRoute);
client.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') navigate('/', true);
});
renderRoute();
