# FINISH reliability rebuild

## What was actually broken

The visible landing page was static HTML, while the real application was assembled after page load from a Supabase vendor request, a Vercel function, raw GitHub files, and previously third-party CDNs. The page could therefore look loaded while the router never started. Cached HTML also pinned old runtime URLs, making each patch create another possible startup combination.

This was an architecture failure, not a copy or CSS failure.

## Target architecture

1. **Build once during deployment.** Install a pinned Supabase SDK and combine it with FINISH source files in the Vercel build.
2. **Serve static, fingerprinted assets.** Browsers receive `index.html` plus immutable `/assets/*` files from the same deployment and origin.
3. **No runtime source assembly.** The browser never fetches application code from GitHub, jsDelivr, unpkg, or a serverless bundling function.
4. **Public shell renders immediately.** The landing page remains useful before authentication or database calls complete.
5. **Authentication cannot own routing.** Session validation may update account state, but a failed or stale session cannot redirect public routes or block navigation.
6. **External integrations are lazy.** YouTube and Razorpay load only inside the player and checkout routes.

## Implementation sequence

### Phase 1: deterministic deployment bundle

- Pin `@supabase/supabase-js` to an exact version.
- Build one browser bundle during `npm run build`.
- Compile-check the bundle and fail deployment on syntax errors.
- Fingerprint JavaScript and CSS assets.
- Remove `/api/app`, `/api/static`, and `/api/vendor` runtime proxies.

### Phase 2: route isolation

- Landing and authentication routes render without catalog queries.
- Catalog, course, learner, checkout, and admin data calls each have a bounded timeout and a route-specific error state.
- No global auth event is allowed to force navigation.
- Direct URLs such as `/catalog` and `/auth` use the same static bundle and SPA fallback.

### Phase 3: automated browser gates

Before production promotion, test:

- `/` renders and both primary buttons navigate.
- `/catalog` opens with zero courses and with published courses.
- `/auth` opens with no session, a valid session, and a deleted-user token in local storage.
- Direct reloads work on `/catalog`, `/auth`, `/app`, and `/admin`.
- Blocking Supabase requests produces a visible route error, never an endless loading screen.
- Theme persists across routes and reloads.
- Admin navigation is absent for non-admin users.

### Phase 4: deployment and rollback

- Deploy to a preview URL first.
- Run browser smoke tests against the preview.
- Promote only the tested deployment to production.
- Keep the previous production deployment available for immediate rollback.
- Never patch production with files that are not committed to `main`.

## Release acceptance criteria

A release is acceptable only when:

- The initial page requests no application code from third-party CDNs or GitHub.
- Navigation handlers are installed from one same-origin fingerprinted bundle.
- No route shows `Loading FINISH.` for more than four seconds.
- A stale auth token cannot freeze or redirect public pages.
- All public and authenticated routes have visible failure states.
- The deployed commit and repository `main` are identical.
