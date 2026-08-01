(() => {
  function nextPath() {
    try {
      const value = new URLSearchParams(location.search).get('next') || '/app';
      return typeof internalPath === 'function' ? internalPath(value) : value;
    } catch {
      return '/app';
    }
  }

  function enhanceConfirmationPanel() {
    const panel = document.querySelector('#confirm-panel');
    if (!panel || panel.dataset.finishRecoveryReady === '1') return;
    panel.dataset.finishRecoveryReady = '1';

    const explanation = document.createElement('p');
    explanation.className = 'muted';
    explanation.innerHTML = '<b>Important:</b> if the confirmation button opens localhost or a blank page, the email was still verified. Return to this tab and continue below.';

    const continueButton = document.createElement('button');
    continueButton.type = 'button';
    continueButton.id = 'continue-after-confirmation';
    continueButton.className = 'btn';
    continueButton.textContent = 'I confirmed it — continue';

    continueButton.onclick = async () => {
      const email = document.querySelector('#auth-email')?.value.trim().toLowerCase();
      const password = document.querySelector('#auth-password')?.value || '';
      if (!email || !password) {
        toast('Keep your email and password filled in, then continue.', 'error');
        return;
      }

      continueButton.disabled = true;
      continueButton.textContent = 'Checking confirmation…';
      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await refreshAuth();
        navigate(nextPath(), true);
      } catch (error) {
        const message = error?.message || String(error);
        if (message.toLowerCase().includes('email not confirmed')) {
          toast('The email is not confirmed yet. Open the newest confirmation message, then return here.', 'error');
        } else {
          toast(message, 'error');
        }
      } finally {
        continueButton.disabled = false;
        continueButton.textContent = 'I confirmed it — continue';
      }
    };

    panel.append(explanation, continueButton);
  }

  const observer = new MutationObserver(enhanceConfirmationPanel);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden'],
  });

  document.addEventListener('DOMContentLoaded', enhanceConfirmationPanel);
  enhanceConfirmationPanel();
})();
