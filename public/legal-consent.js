(() => {
  const consentId = 'finish-purchase-consent';
  let observer = null;
  let timeout = 0;

  function applyCheckoutConsent() {
    if (!window.location.pathname.startsWith('/checkout/')) return false;
    const checkout = document.querySelector('.checkout-page');
    const grid = checkout?.querySelector('.checkout-grid');
    if (!checkout || !grid) return false;

    let consent = checkout.querySelector('.checkout-policy-consent');
    if (!consent) {
      consent = document.createElement('section');
      consent.className = 'checkout-policy-consent';
      consent.setAttribute('aria-label', 'Purchase acknowledgement');
      consent.innerHTML = `
        <label for="${consentId}">
          <input id="${consentId}" type="checkbox" />
          <span>I agree to the <a href="/terms" target="_blank" rel="noopener">Terms of Use</a>, <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>, and <a href="/refunds" target="_blank" rel="noopener">Refund & Cancellation Policy</a>. I understand this is a one-time digital purchase, not a subscription, and ordinary cancellation does not apply after access is granted.</span>
        </label>
        <small>Payment-provider dispute rights and mandatory legal rights remain unaffected.</small>`;
      grid.before(consent);
    }

    const checkbox = consent.querySelector(`#${consentId}`);
    if (!(checkbox instanceof HTMLInputElement)) return false;
    const sync = () => checkout.classList.toggle('policy-locked', !checkbox.checked);
    if (checkbox.dataset.bound !== 'true') {
      checkbox.dataset.bound = 'true';
      checkbox.addEventListener('change', sync);
    }
    sync();
    return true;
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    if (timeout) window.clearTimeout(timeout);
    timeout = 0;
  }

  function activate() {
    stop();
    if (!window.location.pathname.startsWith('/checkout/')) return;
    if (applyCheckoutConsent()) return;
    const root = document.getElementById('root');
    if (!root) return;
    observer = new MutationObserver(() => {
      if (applyCheckoutConsent()) stop();
    });
    observer.observe(root, { childList: true, subtree: true });
    timeout = window.setTimeout(stop, 5000);
  }

  window.addEventListener('finish-route-change', activate);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once: true });
  else activate();
})();
