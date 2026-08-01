(() => {
  const STORAGE_KEY = 'finish-theme';

  const sunIcon = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;

  const moonIcon = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20.2 15.4A8.4 8.4 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;

  function currentTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function syncButtons() {
    const theme = currentTheme();
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      button.innerHTML = nextTheme === 'dark' ? moonIcon : sunIcon;
      button.setAttribute('aria-label', `Use ${nextTheme} theme`);
      button.setAttribute('title', `Use ${nextTheme} theme`);
    });
  }

  function applyTheme(theme, persist = true) {
    const safeTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = safeTheme;
    document.documentElement.style.colorScheme = safeTheme;
    if (persist) localStorage.setItem(STORAGE_KEY, safeTheme);
    syncButtons();
  }

  function makeToggle() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.dataset.themeToggle = 'true';
    button.addEventListener('click', () => {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
    return button;
  }

  function enhanceHeaders() {
    document.querySelectorAll('.topbar').forEach((header) => {
      if (header.querySelector('[data-theme-toggle]')) return;

      const toggle = makeToggle();
      const userControls = header.querySelector('.nav-user');

      if (userControls) {
        userControls.prepend(toggle);
      } else {
        const action = header.lastElementChild;
        const group = document.createElement('div');
        group.className = 'topbar-actions';
        header.insertBefore(group, action);
        group.append(toggle, action);
      }
    });

    syncButtons();
  }

  const observer = new MutationObserver(() => queueMicrotask(enhanceHeaders));
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', enhanceHeaders);
  enhanceHeaders();
})();
