# FINISH

A premium structured-learning product built with React, TypeScript, Vite and Supabase.

## Product surfaces

- `/` premium landing page
- `/catalog` published courses
- `/course/:slug` sales and outcome page
- `/auth` sign in and immediate account creation
- `/app` learner dashboard
- `/checkout/:slug` Stripe / Razorpay checkout
- `/learn/:slug` paid playlist route, progress, XP and quizzes
- `/admin` admin-only course, quiz and order management

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

The production Supabase URL and public key have safe browser fallbacks in `src/lib/supabase.ts`. Set Vercel environment variables to override them.

## Validation

```bash
npm run typecheck
npm run build
```
