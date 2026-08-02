(() => {
  const WHY_PATH = '/why';

  const addWhyLinks = () => {
    document.querySelectorAll('nav, .desktop-nav, .company-footer, footer').forEach((container) => {
      if (container.querySelector('a[data-finish-why-link="true"], a[href="/why"], a[href="/why.html"]')) return;

      const anchors = [...container.querySelectorAll('a')];
      const method = anchors.find(
        (link) =>
          /how it works|method/i.test((link.textContent || '').trim()) ||
          link.getAttribute('href') === '#method'
      );

      if (method) {
        const why = document.createElement('a');
        why.href = WHY_PATH;
        why.textContent = 'Why FINISH';
        why.dataset.finishWhyLink = 'true';
        method.insertAdjacentElement('afterend', why);
        return;
      }

      if (container.matches('footer, .company-footer')) {
        const legal = anchors.find((link) => /terms|privacy/i.test((link.textContent || '').trim()));
        if (legal) {
          const why = document.createElement('a');
          why.href = WHY_PATH;
          why.textContent = 'Why FINISH';
          why.dataset.finishWhyLink = 'true';
          legal.insertAdjacentElement('beforebegin', why);
        }
      }
    });
  };

  addWhyLinks();
  const observer = new MutationObserver(addWhyLinks);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', addWhyLinks, { once: true });
})();
