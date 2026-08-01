# FINISH.

FINISH turns public YouTube playlists into paid, structured learning challenges with ordered lessons, mandatory quizzes, persistent progress, XP and streaks.

**Live:** https://finish-landing-nine.vercel.app

## Product routes

- `/` — public landing page; signed-in users are redirected to `/app`
- `/app` — personal user home with purchased courses, progress, XP and streaks
- `/catalog` — public course catalog
- `/course/:slug` — public course details and purchase CTA
- `/checkout/:slug` — authenticated checkout
- `/learn/:slug` — paid/granted learners only; sequential lessons, quizzes, XP and progress
- `/admin` — admin role only; course, quiz and payment management

## Access rules

- Public users can read published courses and active prices.
- Authentication is required for checkout and personal pages.
- Paid or granted enrollment is required for the learning route, lesson completion, quizzes and XP.
- Quiz checkpoints block later lessons until passed.
- Admin UI appears only when `profiles.role = 'admin'`.
- Admin writes are separately protected by Supabase RLS and admin-checking RPCs.
- Stripe and Razorpay grant course access only after signed verification or a verified webhook.

## Stack

- Static SPA deployed on Vercel
- Supabase Auth, PostgreSQL and RLS
- Supabase Edge Functions for payments
- YouTube IFrame Player API and oEmbed metadata
- Stripe for USD
- Razorpay for INR
- Crypto pricing staged, not live

## Current launch state

The product, routing, catalog, authentication, personal home, paid course gates, lesson tracking, quizzes, XP, admin tools and payment integrations are deployed.

Real checkout is intentionally disabled until provider credentials are configured. The checkout page reads `payment-readiness` and disables unavailable rails instead of showing customers a broken payment flow.

See [PAYMENTS.md](./PAYMENTS.md) for the activation checklist.

## Local run

```bash
python -m http.server 3000
```

For direct SPA paths, use a server that falls back to `index.html` or deploy through the included Vercel route manifest.

The Supabase publishable key in the frontend is expected to be public. Authorization is enforced by RLS and server-side functions.
