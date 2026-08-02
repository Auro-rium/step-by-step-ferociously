(() => {
  if (window.__finishPerformanceRuntime) return;
  window.__finishPerformanceRuntime = true;

  let queued = false;
  const notify = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      window.dispatchEvent(new Event('finish-route-change'));
    });
  };

  const patchHistory = (method) => {
    const native = history[method];
    if (typeof native !== 'function') return;
    history[method] = function (...args) {
      const result = native.apply(this, args);
      notify();
      return result;
    };
  };

  patchHistory('pushState');
  patchHistory('replaceState');
  window.addEventListener('popstate', notify, { passive: true });

  window.finishIdle = (callback, timeout = 1200) => {
    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, { timeout });
    }
    return window.setTimeout(callback, Math.min(timeout, 120));
  };
})();
