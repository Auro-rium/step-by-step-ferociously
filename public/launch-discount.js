(() => {
  const PUBLIC_PATHS = ['/', '/catalog', '/course/', '/checkout/'];

  function promotionVisible() {
    const path = window.location.pathname;
    return PUBLIC_PATHS.some((prefix) => prefix === '/' ? path === '/' : path.startsWith(prefix));
  }

  function ensureBanner() {
    let banner = document.querySelector('.launch-strip');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'launch-strip';
      banner.setAttribute('role', 'status');
      banner.innerHTML = '<b>Founding launch</b><i></i><span>50% off every course route</span><i></i><span class="launch-worldwide">₹79 India · $1 worldwide</span>';
      const root = document.getElementById('root');
      if (root) document.body.insertBefore(banner, root);
    }
    banner.hidden = !promotionVisible();
  }

  function parseCurrency(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (/₹|INR/i.test(clean)) return { current: clean, compare: '₹159' };
    if (/\$|USD|US\$/i.test(clean)) return { current: clean, compare: '$2' };
    return null;
  }

  function decoratePrice(element) {
    if (!(element instanceof HTMLElement)) return;
    if (element.querySelector('.launch-price-current')) return;
    const text = element.textContent || '';
    if (/owned|unlocked/i.test(text)) return;
    const price = parseCurrency(text);
    if (!price) return;

    element.classList.add('launch-price');
    element.setAttribute('aria-label', `${price.current}, launch price, regular price ${price.compare}`);
    element.replaceChildren();

    const current = document.createElement('span');
    current.className = 'launch-price-current';
    current.textContent = price.current;

    const compare = document.createElement('span');
    compare.className = 'launch-price-compare';
    compare.textContent = price.compare;

    const badge = document.createElement('span');
    badge.className = 'launch-price-badge';
    badge.textContent = '50% off';

    element.append(current, compare, badge);
  }

  function decorateAll() {
    ensureBanner();
    document.querySelectorAll('.card-bottom > strong, .course-price strong, .payment-card > strong').forEach(decoratePrice);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorateAll();
    });
  }

  const nativePush = history.pushState;
  const nativeReplace = history.replaceState;
  history.pushState = function (...args) {
    nativePush.apply(this, args);
    window.dispatchEvent(new Event('finish-route-change'));
  };
  history.replaceState = function (...args) {
    nativeReplace.apply(this, args);
    window.dispatchEvent(new Event('finish-route-change'));
  };

  window.addEventListener('popstate', schedule);
  window.addEventListener('finish-route-change', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
