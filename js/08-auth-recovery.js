(() => {
  function nextPath() {
    try {
      const value = new URLSearchParams(location.search).get('next') || '/app';
      return typeof internalPath === 'function' ? internalPath(value) : value;
    } catch {
      return '/app';
    }
  }

  async function createConfirmedAccount({ email, password, displayName }) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/signup-no-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({
        email,
        password,
        display_name: displayName,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.error) {
      throw new Error(result.error || 'Could not create account');
    }
    return result;
  }

  function installImmediateSignup() {
    const form = document.querySelector('#auth-form');
    const nameInput = document.querySelector('#auth-name');
    if (!form || !nameInput || form.dataset.immediateSignup === '1') return;

    form.dataset.immediateSignup = '1';

    const intro = document.querySelector('.auth-inner > p.muted');
    if (intro) intro.textContent = 'Your account opens immediately. No email verification.';

    const confirmationPanel = document.querySelector('#confirm-panel');
    if (confirmationPanel) confirmationPanel.remove();

    form.onsubmit = async (event) => {
      event.preventDefault();

      const email = document.querySelector('#auth-email')?.value.trim().toLowerCase() || '';
      const password = document.querySelector('#auth-password')?.value || '';
      const displayName = nameInput.value.trim();
      const submit = document.querySelector('#auth-submit');

      if (!email || !password || !displayName) {
        toast('Complete every field first.', 'error');
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Creating account…';

      try {
        await createConfirmedAccount({ email, password, displayName });

        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;

        await refreshAuth();
        toast('Account created. You are signed in.', 'success');
        navigate(nextPath(), true);
      } catch (error) {
        toast(error?.message || String(error), 'error');
      } finally {
        submit.disabled = false;
        submit.textContent = 'Create account';
      }
    };
  }

  const observer = new MutationObserver(() => queueMicrotask(installImmediateSignup));
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', installImmediateSignup);
  installImmediateSignup();
})();
