# FINISH

A premium structured-learning product built with React, TypeScript, Vite and Supabase.

## Product surfaces

- `/` premium landing page
- `/catalog` published courses
- `/course/:slug` sales and outcome page
- `/auth` sign in and immediate account creation
- `/app` learner dashboard
- `/checkout/:slug` PayPal / Razorpay checkout
- `/learn/:slug` paid ordered route with lessons, quiz gates, progress, XP and final project
- `/admin` admin-only course, quiz, project review and order management

## Payment routing

- India: Razorpay in INR
- International: PayPal in USD

Private payment credentials belong in Supabase Edge Function Secrets. See `PAYMENT.md`.

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
