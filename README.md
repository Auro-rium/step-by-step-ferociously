# FINISH.

FINISH turns public YouTube playlists into paid, structured learning challenges.

## Product routes

- `/` — public landing page; signed-in users are redirected to `/app`
- `/app` — personal user home with purchased courses, progress, XP and streaks
- `/catalog` — public course catalog
- `/course/:slug` — public course details and purchase CTA
- `/checkout/:slug` — authenticated checkout
- `/learn/:slug` — paid/granted learners only; ordered lessons, quizzes, XP and progress
- `/admin` — admin role only; course, quiz and payment management

## Security rules

- Public users can read published courses and active prices.
- Authentication is required for checkout and personal pages.
- Paid or granted enrollment is required for learning routes, lesson completion, quizzes and XP.
- Admin UI is shown only when `profiles.role = 'admin'`.
- Admin writes are also protected by Supabase RLS and security-definer RPC checks.
- Stripe and Razorpay unlock access only after verified signatures/webhooks.

## Stack

- Static SPA deployed on Vercel
- Supabase Auth + PostgreSQL + RLS
- Supabase Edge Functions for payments
- YouTube IFrame Player API and oEmbed metadata
- Stripe for USD
- Razorpay for INR
- Crypto pricing staged, not live

## Local run

```bash
python -m http.server 3000
```

For SPA route testing, use a server that rewrites all paths to `index.html` or deploy to Vercel with the included `vercel.json`.

## Required production secrets

```text
SITE_URL=https://finish-landing-nine.vercel.app
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

The publishable Supabase key in the frontend is safe to expose; authorization is enforced by RLS and server-side functions.
