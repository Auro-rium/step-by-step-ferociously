# FINISH payment setup

FINISH uses **Razorpay for India** and **PayPal for international checkout**. Stripe is not part of the active payment path.

Do not place private credentials in Vercel environment variables or frontend source. Payment credentials belong in **Supabase Edge Function secrets** because checkout creation and payment capture run server-side.

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

Use `PAYPAL_ENV=sandbox` while testing. Change it to `live` only after a successful sandbox purchase, capture, enrollment unlock, cancellation test, and duplicate-callback test.

The PayPal webhook URL is:

```text
https://ijkdhrznxukawugeoocs.supabase.co/functions/v1/payment-webhook
```

Subscribe the PayPal application to at least:

```text
CHECKOUT.ORDER.APPROVED
PAYMENT.CAPTURE.COMPLETED
PAYMENT.CAPTURE.DENIED
PAYMENT.CAPTURE.REFUNDED
```

Copy the resulting webhook ID into `PAYPAL_WEBHOOK_ID`.

## 2. Razorpay credentials

Add these Supabase Edge Function secrets:

```text
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
SITE_URL=https://finish-landing-nine.vercel.app
```

The Razorpay webhook URL is the same payment webhook endpoint:

```text
https://ijkdhrznxukawugeoocs.supabase.co/functions/v1/payment-webhook
```

## 3. Frontend variables

The Vercel project needs only public Supabase values:

```text
VITE_SUPABASE_URL=https://ijkdhrznxukawugeoocs.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_supabase_key
```

Never add `PAYPAL_CLIENT_SECRET`, `RAZORPAY_KEY_SECRET`, Supabase secret/service-role keys, or webhook secrets to Vercel browser variables.

## 4. Required verification

Before accepting money, test all of these:

1. International user receives PayPal USD pricing.
2. Indian user receives Razorpay INR pricing.
3. Cancelling checkout does not grant enrollment.
4. A completed payment creates or updates `payment_orders` to `paid`.
5. A completed payment grants `enrollments.access_status = 'paid'`.
6. Replaying a callback or webhook does not grant duplicate XP, orders, or enrollment rows.
7. A failed, denied, pending, or refunded payment never unlocks course access.

## 5. Secret management

Credentials can be pasted together in Supabase Edge Function Secrets. Supabase makes updated secrets available to functions without committing them to GitHub. Keep sandbox and live credentials separate, rotate any credential that has ever appeared in a chat, screenshot, commit, build log, or frontend bundle.