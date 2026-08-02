(() => {
  const consentId = 'finish-purchase-consent';

  function applyCheckoutConsent() {
    const checkout = document.querySelector('.checkout-page');
    if (!checkout || !window.location.pathname.startsWith('/checkout/')) return;
    const grid = checkout.querySelector('.checkout-grid');
    if (!grid) return;

    let consent = checkout.querySelector('.checkout-policy-consent');
    if (!consent) {
      consent = document.createElement('section');
      consent.className = 'checkout-policy-consent';
      consent.setAttribute('aria-label', 'Purchase acknowledgement');
      consent.innerHTML = `
        <label for="${consentId}">
          <input id="${consentId}" type="checkbox" />
          <span>I agree to the <a href="/terms.html" target="_blank" rel="noopener">Terms of Use</a>, <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>, and <a href="/refund-policy.html" target="_blank" rel="noopener">Refund & Cancellation Policy</a>. I understand this is a one-time digital purchase, not a subscription, and ordinary cancellation does not apply after access is granted.</span>
        </label>
        <small>Payment-provider dispute rights and mandatory legal rights remain unaffected.</small>`;
      grid.before(consent);
    }

    const checkbox = consent.querySelector(`#${consentId}`);
    if (!(checkbox instanceof HTMLInputElement)) return;

    const sync = () => checkout.classList.toggle('policy-locked', !checkbox.checked);
    if (checkbox.dataset.bound !== 'true') {
      checkbox.dataset.bound = 'true';
      checkbox.addEventListener('change', sync);
    }
    sync();
  }

  const observer = new MutationObserver(applyCheckoutConsent);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', applyCheckoutConsent);
  window.addEventListener('popstate', () => window.setTimeout(applyCheckoutConsent, 0));
  document.addEventListener('click', (event) => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (anchor && anchor.getAttribute('href')?.startsWith('/')) window.setTimeout(applyCheckoutConsent, 100);
  });
  applyCheckoutConsent();
})();
