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
      // Private browsing may block storage. The app still continues signed out.
    }
    authContext = { session: null, profile: null };
    return authContext;
  }

  function clearLocalSession() {
    purgeStoredSession();
    Promise.race([
      client.auth.signOut({ scope: 'local' }),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]).catch(() => {});
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
      return clearLocalSession();
    }

    if (session) {
      try {
        const profileResult = await withTimeout(
          client.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
          'Profile lookup',
        );

        if (profileResult.error) throw profileResult.error;
        profile = profileResult.data || null;

        if (!profile) {
          const userResult = await withTimeout(client.auth.getUser(), 'Session validation');
          if (userResult.error || !userResult.data?.user) return clearLocalSession();
        }
      } catch {
        return clearLocalSession();
      }
    }

    authContext = { session, profile };
    return authContext;
  };
})();
