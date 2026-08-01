function finishRouteTimeout(promise, label, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function renderRoute() {
  cleanupPlayer();
  const route = routeInfo();

  if (route.name === 'landing') {
    renderLanding();
    bindGlobalActions();
    scrollToCurrentHash();

    finishRouteTimeout(refreshAuth(), 'Authentication', 3500).then(() => {
      if (authContext.session && location.pathname === '/') navigate('/app', true);
    }).catch(() => {});
    return;
  }

  app.innerHTML = '<div class="boot-screen">Loading FINISH.</div>';

  try {
    try {
      await finishRouteTimeout(refreshAuth(), 'Authentication', 3500);
    } catch {
      authContext = { session: null, profile: null };
    }

    if (route.name === 'auth') await renderAuth(route.query);
    else if (route.name === 'home') await finishRouteTimeout(renderHome(), 'Your courses', 10000);
    else if (route.name === 'catalog') await finishRouteTimeout(renderCatalog(), 'Course catalog', 10000);
    else if (route.name === 'course') await finishRouteTimeout(renderCourseDetail(route.slug), 'Course page', 10000);
    else if (route.name === 'checkout') await finishRouteTimeout(renderCheckout(route.slug), 'Checkout', 10000);
    else if (route.name === 'learn') await finishRouteTimeout(renderLearn(route.slug), 'Course player', 12000);
    else if (route.name === 'admin') await finishRouteTimeout(renderAdmin(), 'Admin page', 12000);
    else renderNotFound();

    bindGlobalActions();
    scrollToCurrentHash();
  } catch (error) {
    console.error(error);
    app.innerHTML = `${publicHeader()}<main class="shell"><section class="page-head"><div class="eyebrow">PAGE ERROR</div><h1 class="display">This page could not open.</h1><p class="lead">${escapeHtml(error?.message || String(error))}</p><div class="hero-actions"><a class="btn" href="/" data-link>Back home</a><button class="btn ghost" onclick="location.reload()">Reload</button></div></section></main>${footer()}`;
    bindGlobalActions();
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

  document.querySelectorAll('[data-signout]').forEach((button) => {
    button.onclick = async () => {
      try {
        await finishRouteTimeout(client.auth.signOut({ scope: 'local' }), 'Sign out', 1500);
      } catch {
        try {
          Object.keys(localStorage)
            .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
            .forEach((key) => localStorage.removeItem(key));
        } catch {}
      }
      authContext = { session: null, profile: null };
      navigate('/', true);
    };
  });
}

window.addEventListener('popstate', renderRoute);
client.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') authContext = { session: null, profile: null };
  if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
    authContext = { session, profile: authContext.profile };
  }
});
renderRoute();
