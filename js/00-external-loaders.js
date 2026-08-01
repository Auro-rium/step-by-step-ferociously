(() => {
  const loads = new Map();

  window.finishLoadExternal = function finishLoadExternal(key, source, timeoutMs = 9000) {
    if (loads.has(key)) return loads.get(key);

    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-finish-external="${key}"]`);
      if (existing?.dataset.loaded === '1') return resolve();

      const script = existing || document.createElement('script');
      const timeout = setTimeout(() => {
        script.remove();
        loads.delete(key);
        reject(new Error(`${key} took too long to load`));
      }, timeoutMs);

      script.async = true;
      script.src = source;
      script.dataset.finishExternal = key;
      script.onload = () => {
        clearTimeout(timeout);
        script.dataset.loaded = '1';
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        loads.delete(key);
        reject(new Error(`${key} could not be loaded`));
      };

      if (!existing) document.head.append(script);
    });

    loads.set(key, promise);
    return promise;
  };

  const originalInitializeYouTube = initializeYouTube;
  initializeYouTube = async function initializeYouTubeOnDemand(playlistId) {
    try {
      await window.finishLoadExternal('YouTube player', 'https://www.youtube.com/iframe_api', 10000);
      return originalInitializeYouTube(playlistId);
    } catch (error) {
      const target = document.querySelector('#youtube-player');
      if (target) {
        target.innerHTML = `<div style="min-height:320px;display:grid;place-items:center;padding:28px;text-align:center"><div><strong>YouTube could not load.</strong><p class="muted">Check the connection, then reload this lesson.</p></div></div>`;
      }
      if (typeof toast === 'function') toast(error.message, 'error');
    }
  };

  const originalStartPayment = startPayment;
  startPayment = async function startPaymentOnDemand(provider, course) {
    if (provider === 'razorpay' && !window.Razorpay) {
      try {
        await window.finishLoadExternal('Razorpay checkout', 'https://checkout.razorpay.com/v1/checkout.js', 10000);
      } catch (error) {
        if (typeof toast === 'function') toast(error.message, 'error');
        return;
      }
    }
    return originalStartPayment(provider, course);
  };
})();
