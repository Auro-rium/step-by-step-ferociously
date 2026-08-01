(() => {
  const AUTH_TIMEOUT_MS = 3000;

  function withTimeout(promise, label, timeoutMs = AUTH_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      Promise.resolve(promise).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  function purgeStoredSession() {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage can be unavailable in private browsing. Continue signed out.
    }
    authContext = { session: null, profile: null };
    return authContext;
  }

  refreshAuth = async function refreshAuthSafely() {
    let session = null;
    let profile = null;

    try {
      const { data, error } = await withTimeout(client.auth.getSession(), 'Authentication');
      if (error) throw error;
      session = data?.session || null;
    } catch {
      return purgeStoredSession();
    }

    if (!session) {
      authContext = { session: null, profile: null };
      return authContext;
    }

    try {
      const profileResult = await withTimeout(
        client.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        'Profile lookup',
      );

      if (!profileResult.error) profile = profileResult.data || null;

      if (!profile) {
        const userResult = await withTimeout(client.auth.getUser(), 'Session validation');
        if (userResult.error || !userResult.data?.user) return purgeStoredSession();
      }
    } catch {
      // A temporary profile/API failure must not log the user out or redirect public routes.
      profile = null;
    }

    authContext = { session, profile };
    return authContext;
  };
})();
