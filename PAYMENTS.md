# Payment activation

The payment code is deployed, but real checkout stays disabled until provider credentials are added to Supabase Edge Function secrets.

## Required secrets

```text
SITE_URL=https://finish-landing-nine.vercel.app
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Never place these values in the browser, GitHub source, Vercel public environment variables, or chat history.

## Stripe, USD

1. Create or activate a Stripe account.
2. Obtain the live secret key.
3. Create a webhook endpoint:

```text
https://ijkdhrznxukawugeoocs.supabase.co/functions/v1/payment-webhook
```

4. Subscribe to `checkout.session.completed`.
5. Copy the webhook signing secret.
6. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to Supabase Edge Function secrets.
7. Run one low-value live purchase and confirm:
   - `payment_orders.status = paid`
   - an enrollment exists with `access_status = paid`
   - `/learn/:slug` opens for that buyer

## Razorpay, INR

1. Activate a Razorpay account and complete KYC.
2. Create live API keys.
3. Create the webhook endpoint using the same URL:

```text
https://ijkdhrznxukawugeoocs.supabase.co/functions/v1/payment-webhook
```

4. Subscribe to `payment.captured` and `order.paid`.
5. Create a webhook signing secret.
6. Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` to Supabase Edge Function secrets.
7. Run one low-value UPI or card purchase and verify the same order and enrollment records.

## Readiness behavior

The authenticated `payment-readiness` Edge Function returns only booleans. Checkout buttons remain disabled until the required secrets exist. Once the secrets are configured, the corresponding rail becomes available without changing frontend code.

## Crypto

Crypto is deliberately not live. Before enabling USDT or USDC, add:

- supported network selection
- unique payment intents
- confirmation-depth rules
- on-chain transaction verification
- duplicate transaction protection
- expiry and underpayment handling
- refund and support policy

Do not unlock courses from screenshots or manually pasted transaction hashes.
