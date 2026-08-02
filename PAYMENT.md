# FINISH payment setup

FINISH uses **PayPal only** for every customer. Checkout is globally priced in USD and is never selected or priced using IP address, country headers, browser location, device location or geolocation.

Do not place private credentials in Vercel environment variables or frontend source. Payment credentials belong in **Supabase Edge Function Secrets** because checkout creation, capture and webhook reconciliation run server-side.

## 1. PayPal credentials

Create a PayPal Business account and a REST application in the PayPal Developer Dashboard.

Add these secrets in Supabase Dashboard → Edge Functions → Secrets:

```text
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENV=sandbox
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id
SITE_URL=https://finish-landing-nine.vercel.app
```

Use `PAYPAL_ENV=sandbox` while testing. Change it to `live` only after a successful sandbox purchase, capture, enrollment unlock, cancellation test, refund test and duplicate-callback test.

The PayPal webhook URL is:

```text
https://ijkdhrznxukawugeoocs.supabase.co/functions/v1/payment-webhook
```

Subscribe the PayPal application to at least:

```text
CHECKOUT.ORDER.APPROVED
PAYMENT.CAPTURE.COMPLETED
PAYMENT.CAPTURE.PENDING
PAYMENT.CAPTURE.DENIED
PAYMENT.CAPTURE.REFUNDED
PAYMENT.CAPTURE.REVERSED
```

Copy the resulting webhook ID into `PAYPAL_WEBHOOK_ID`.

## 2. Frontend variables

The Vercel project needs only public Supabase values:

```text
VITE_SUPABASE_URL=https://ijkdhrznxukawugeoocs.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_supabase_key
```

Never add `PAYPAL_CLIENT_SECRET`, Supabase secret/service-role keys or webhook secrets to Vercel browser variables.

## 3. Required verification

Before accepting money, test all of these:

1. Every user sees the same PayPal USD checkout.
2. No network request or application branch reads IP-country headers for payment routing or pricing.
3. Cancelling checkout does not grant enrollment.
4. A completed payment creates or updates `payment_orders` to `paid`.
5. A completed payment grants `enrollments.access_status = 'paid'`.
6. Replaying a callback or webhook does not create duplicate orders or enrollment rows.
7. A failed, denied, pending, reversed or refunded payment never leaves paid course access active.
8. The captured PayPal amount and currency match the stored order before access is granted.

## 4. Secret management

Supabase makes updated secrets available to Edge Functions without committing them to GitHub. Keep sandbox and live credentials separate, and rotate any credential that has appeared in a chat, screenshot, commit, build log or frontend bundle.
