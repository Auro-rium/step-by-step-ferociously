# FINISH payment setup

FINISH uses **PayPal only** for every customer. Checkout is globally priced in USD and is never selected or priced using IP address, country headers, browser location, device location or geolocation.

All successfully captured course purchases are final. FINISH does not offer voluntary refunds. Verified duplicate, unauthorized or incorrect charges may be corrected, and PayPal, card-network or legally required reversals must still be handled safely.

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

Use `PAYPAL_ENV=sandbox` while testing. Change it to `live` only after a successful sandbox purchase, capture, enrollment unlock, cancellation test, reversal-event test and duplicate-callback test.

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

`PAYMENT.CAPTURE.REFUNDED` remains subscribed because PayPal, a bank, a card network or mandatory law can reverse a transaction even though FINISH does not offer voluntary refunds.

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
3. Checkout clearly states **All sales are final** and links the No-Refund Policy before redirecting to PayPal.
4. Cancelling checkout does not grant enrollment.
5. A completed payment creates or updates `payment_orders` to `paid`.
6. A completed payment grants `enrollments.access_status = 'paid'`.
7. Replaying a callback or webhook does not create duplicate orders or enrollment rows.
8. A failed, denied, pending, reversed or provider-refunded payment never leaves paid course access active.
9. The captured PayPal amount and currency match the stored order before access is granted.
10. A simulated duplicate or unauthorized-charge correction updates the order and access state without creating a general refund workflow.

## 4. Secret management

Supabase makes updated secrets available to Edge Functions without committing them to GitHub. Keep sandbox and live credentials separate, and rotate any credential that has appeared in a chat, screenshot, commit, build log or frontend bundle.
