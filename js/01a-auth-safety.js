(() => {
  const AUTH_TIMEOUT_MS = 5000;

  function withTimeout(promise, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out`)), AUTH_TIMEOUT_MS);
      }),
    ]);
  }

  async function clearLocalSession() {
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch {
      try {
        Object.keys(localStorage)
          .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
          .forEach((key) => localStorage.removeItem(key));
      } catch {
        // Storage can be unavailable in private browsing. The app still continues signed out.
      }
    }
    authContext = { session: null, profile: null };
  }

  refreshAuth = async function refreshAuthSafely() {
    let session = null;
    let profile = null;

    try {
      const { data, error } = await withTimeout(client.auth.getSession(), 'Authentication');
      if (error) throw error;
      session = data?.session || null;
    } catch {
      await clearLocalSession();
      return authContext;
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
          if (userResult.error || !userResult.data?.user) {
            await clearLocalSession();
            return authContext;
          }
        }
      } catch {
        await clearLocalSession();
        return authContext;
      }
    }

    authContext = { session, profile };
    return authContext;
  };
})();
