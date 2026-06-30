# PLAN — Razorpay Subscriptions (Monthly/Yearly) + Auto-Activation

**Date:** 2026-06-30
**Status:** In progress

## Product decisions (from user)
- **Subscription model, Jio/Hotstar style:** every batch has a **monthly** price and a **yearly** price. Student picks the plan.
- **No free batches** — removed. The only free access is a **1-day trial** per batch.
- **Auto-activation:** payment success → account `active` automatically. **No admin approval.**
- Durations: trial → 1 day, monthly → 30 days, yearly → 365 days. Renewals stack (extend from current expiry).

## Why login can't gate payment
`authController.login` blocks `pending` AND `expired` students. A new/expired student therefore can't get a JWT to pay. So payment endpoints are **public but authenticated by `student_code` + `PIN`** (verified server-side via `User.verifyPin`), and rate-limited. Works for new, pending, and renewing students.

## Backend (DONE — foundation)
- `models/Batch.js` — added `monthly_price`, `yearly_price`, `trial_days` (default 1). Legacy `base_price`/`discount` kept.
- `models/StudentSubscription.js` — NEW. Keyed by string `student_user_id`/`student_code`/`batch` name (matches codebase). Fields: period (trial/monthly/yearly), amount, razorpay_order_id, razorpay_payment_id (unique sparse), payment_verified, status, start/expiry. Static `computeExpiry()`.
- `utils/razorpay.js` — NEW. `createOrder()` (REST API, no SDK), `verifyWebhookSignature()` (raw body HMAC), `verifyPaymentSignature()`. Reads `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`.
- `controllers/paymentController.js` — NEW. `getConfig`, `createOrder`, `startTrial`, `webhook`, `getStatus`. Server computes amount from batch price (never trusts client). Webhook is idempotent (Razorpay retries). Activates student: status=active, push batch to assigned_batches, extend expiry.
- `routes/paymentRoutes.js` — NEW. `/config`, `/order`, `/trial`, `/status` (rate-limited). `/webhook` mounted in `app.js`.
- `app.js` — capture `req.rawBody` in express.json verify hook (for webhook signature); mount `/api/payment/webhook` + `/api/payment`.

## Remaining
- [x] `batchController` — accept `monthly_price`/`yearly_price`/`trial_days`; drop free option from create/update pricing.
- [x] Admin Pricing tab UI — Monthly + Yearly inputs + trial days (Free radio removed).
- [x] `core/helpers.js` — `getPaymentConfig`, `getBatchPlans`, `createPaymentOrder`, `startTrial`, `getSubscriptionStatus`.
- [x] Student frontend — `payment.js` plan-select sheet (Trial / Monthly / Yearly), Razorpay Checkout, poll status → login.
- [x] Razorpay checkout script loaded in `student-app/index.html`.
- [x] `payment.js` added to SW CORE_ASSETS; SW bumped v43→v44.

## ⏳ Before it works live — YOU must:
1. Razorpay Dashboard → API Keys → copy **Test** Key ID + Secret.
2. Razorpay Dashboard → Webhooks → add `https://teachingboard-backend.onrender.com/api/payment/webhook`, set a **secret**, select `payment.captured` + `order.paid`.
3. Set env vars (local `.env` + Render): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
4. Admin app → Pricing tab → set Monthly/Yearly price per batch.
5. Test: register a student → "Plan निवडा" → Trial works immediately; Monthly/Yearly needs the keys above.

## Env vars needed (Render + local .env)
```
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=whsec_xxx   # you set this when creating the webhook
```
Webhook URL to register in Razorpay Dashboard:
`https://teachingboard-backend.onrender.com/api/payment/webhook`
Events: `payment.captured`, `order.paid`.

## Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET  | /api/payment/config | public | key_id + configured flag |
| POST | /api/payment/order  | code+PIN | create Razorpay order { student_code, pin, batch, period } |
| POST | /api/payment/trial  | code+PIN | start 1-day trial { student_code, pin, batch } |
| POST | /api/payment/status | code+PIN | subscription status |
| POST | /api/payment/webhook | signature | Razorpay → auto-activate |

## Notes / follow-ups
- Pre-existing Mongoose duplicate-index warnings in SLS models (ConceptMarks etc.) — not in scope, noted.
- Admin approval gate stays in code but is bypassed by payment activation; once flow is verified end-to-end we can simplify.
