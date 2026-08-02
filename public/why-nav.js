(() => {
  const WHY_PATH = '/why';
  let observer = null;
  let timeout = 0;

  function isPublicRoute() {
    const path = window.location.pathname;
    return path === '/' || path === '/catalog' || path.startsWith('/course/');
  }

  function addWhyLinks() {
    let changed = false;
    document.querySelectorAll('.desktop-nav, footer, .company-footer').forEach((container) => {
      if (container.querySelector('a[data-finish-why-link="true"], a[href="/why"]')) return;
      const anchors = [...container.querySelectorAll('a')];
      const method = anchors.find((link) =>
        /how it works|method/i.test((link.textContent || '').trim()) ||
        link.getAttribute('href') === '#method' ||
        link.getAttribute('href') === '/#method'
      );

      if (method) {
        const why = document.createElement('a');
        why.href = WHY_PATH;
        why.textContent = 'Why FINISH';
        why.dataset.finishWhyLink = 'true';
        method.insertAdjacentElement('afterend', why);
        changed = true;
      }
    });
    return changed || Boolean(document.querySelector('.desktop-nav a[href="/why"]'));
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    if (timeout) window.clearTimeout(timeout);
    timeout = 0;
  }

  function activate() {
    stop();
    if (!isPublicRoute()) return;
    if (addWhyLinks()) return;
    const root = document.getElementById('root');
    if (!root) return;
    observer = new MutationObserver(() => {
      if (addWhyLinks()) stop();
    });
    observer.observe(root, { childList: true, subtree: true });
    timeout = window.setTimeout(stop, 5000);
  }

  window.addEventListener('finish-route-change', activate);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once: true });
  else activate();
})();
