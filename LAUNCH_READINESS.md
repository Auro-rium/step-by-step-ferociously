# FINISH Launch Readiness

Status: product freeze for payment activation.

Deployment retry requested: 2026-08-03 00:14 IST.

## Verified product state

- 84 published and route-ready courses
- 2,216 canonical lessons
- 168 graded quizzes
- 3,360 quiz questions with server-protected answer keys
- 84 applied final projects
- 84 valid course covers
- One global USD catalogue price
- PayPal is the only active payment provider in product and pricing data
- No IP, country, timezone, locale, or device-location pricing
- Public policy suite is linked from the product
- Public catalogue and course pages are indexable with canonical metadata
- Authenticated account, checkout, dashboard, learning, and admin routes are noindex
- Project submission language supports reports, spreadsheets, notebooks, documents, live builds, and repositories
- Dashboard lesson progress is not presented as full course completion

## Build contract

Every development, type-check, and production build must:

1. Apply the deterministic product patches.
2. Run `npm run verify:launch`.
3. Pass TypeScript validation.
4. Complete the Vite production build.

The launch verifier blocks builds that reintroduce INR pricing, Razorpay UI, location pricing, stale catalogue statistics, incomplete policy links, coding-only project language, incorrect progress labels, or private-route indexing.

## Remaining payment activation work

1. Add valid PayPal live client credentials to Supabase Edge Function secrets.
2. Add and verify the PayPal webhook ID.
3. Confirm the PayPal API base is live rather than sandbox.
4. Run one real $1 USD purchase through checkout.
5. Confirm capture, payment order status, webhook idempotency, enrollment creation, course unlock, and dashboard visibility.
6. Run one refund and confirm access and order status follow the published refund policy.

No further catalogue, policy, architecture, pricing, or feature changes are planned before payment activation.
