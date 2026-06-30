# PLAN — Admin Pricing Tab + Student Self-Registration Fixes

**Date:** 2026-06-30
**Status:** In progress
**Scope:** Free-of-cost fixes only (no paid SMS/CAPTCHA services)

---

## Verification of earlier audit (AUDIT_v5_EXTENSIONS.md)

The first audit was re-checked against the actual code. Corrections:

| Earlier claim | Reality |
|---------------|---------|
| C3 — No rate limiting on `/students/register` | ❌ FALSE — `registerLimiter` (5/hour/IP) already exists in `studentRoutes.js:16` |
| (missed) | 🔴 **Pricing tab is orphaned** — `batchPricingManager.js` is never loaded; no "Pricing" tab in `admin.html` |
| (missed) | 🔴 **Wrong token key** — reads `admin_token`, but API stores `teachingboard_admin_token` → every pricing call 401s |
| (missed) | 🔴 **`createBatch` drops pricing** — new-batch POST sends pricing, controller only saves name+icon |
| (missed) | 🔴 **Hard-coded `window.TEACHINGBOARD_API_URL`** instead of `API.getApiUrl()` |

Backend is otherwise ready: `Batch` model has pricing fields, routes `/batches/:name/pricing` (GET+PUT) exist, `updateBatchPricing`/`getBatchPricing` controllers work.

---

## Phase A — Admin Pricing Tab

| ID | Issue | Severity | File | Status |
|----|-------|----------|------|--------|
| A1 | Pricing tab not wired into admin shell | 🔴 | `admin-app/admin.html`, `admin-app/admin.js` | ☐ |
| A2 | Wrong token key (`admin_token`) | 🔴 | `admin-app/batchPricingManager.js` | ☐ |
| A3 | Hard-coded API URL global | 🔴 | `admin-app/batchPricingManager.js` | ☐ |
| A4 | `createBatch` ignores pricing on new batch | 🔴 | `TeachingBoard-backend/src/controllers/batchController.js` | ☐ |
| A5 | Native `confirm()` blocked on Android | 🟡 | `admin-app/batchPricingManager.js:402` | ☐ |
| A6 | XSS — unescaped `name`/`description` in innerHTML + onclick | 🟡 | `admin-app/batchPricingManager.js` | ☐ |
| A7 | Form state not reset between edits | 🟡 | `admin-app/batchPricingManager.js` | ☐ |
| A8 | No double-submit guard | 🟡 | `admin-app/batchPricingManager.js` | ☐ |

### A1 detail
- Add `<button class="atab" data-tab="pricing">💰 Pricing</button>` to the tab bar
- Add `<div class="atab-content hidden" id="atab-pricing">` containing the markup from `batch-pricing-ui.html` (inline, minus the duplicate `<style>` which can stay)
- Add `<script src="batchPricingManager.js" defer>` before `admin.js`
- Add `if (tab.dataset.tab === 'pricing') window.BATCH_PRICING?.init();` in `_initTabs()`
- Remove the file's bottom auto-init (it runs on DOMContentLoaded before the tab exists / token is set) and rely on tab-activation init instead.

### A4 detail
`createBatch` must accept `pricing_type`, `base_price`, `discount`, `description` and compute `discounted_price` (reuse the same logic as `updateBatchPricing`).

---

## Phase B — Student Self-Registration

| ID | Issue | Severity | File | Status |
|----|-------|----------|------|--------|
| B1 | Rate limiting | ✅ already done | `studentRoutes.js` | — |
| B2 | Weak/trivial PINs allowed (0000, 1234…) | 🟡 | `studentController.js`, `student-app/app.js` | ☐ |
| B3 | No Terms/consent checkbox | 🟡 | `student-app/index.html`, `student-app/app.js` | ☐ |
| B4 | Success screen lacks guidance + copy button | 🟡 | `student-app/app.js` | ☐ |
| B5 | Weak mobile validation | 🟡 | `student-app/app.js`, `studentController.js` | ☐ |
| B6 | No email/mobile verification | 🟢 | backend + frontend | ☐ (assess) |

### B6 decision — BLOCKED (needs payment system first)
User's choice: **remove admin approval; auto-activate the account once the student pays** ("payment done झालं की लगेच admin app मध्ये कळेल; admin approve नको, auto असुदे").

**Finding:** The payment system does **not** exist in code yet.
- No `Payment` / `Purchase` / `Subscription` / `Order` model in `TeachingBoard-backend/src/models/`
- No payment-gateway / webhook / order endpoints in `src/`
- Only **plans** exist: `docs/MASTER_PAYMENT_REGISTRATION_PLAN.md`, `docs/COMPLETE_IMPLEMENTATION_ROADMAP.md`, `docs/IMPLEMENTATION_*.js` (not integrated)

**Why I did NOT remove the `status: 'pending'` gate now:**
If the admin-approval gate is removed today, every self-registration becomes **immediately active with no payment and no approval** — i.e. free full access to anyone. That is the opposite of "activate after payment" and a security/revenue hole.

**Correct order (future work, separate task):**
1. Implement payment system (Payment/Subscription model + gateway + webhook) per `MASTER_PAYMENT_REGISTRATION_PLAN.md`
2. On verified payment webhook → set student `status: 'active'` automatically + create purchase record (shows in admin app instantly)
3. Then remove the manual admin-approval gate
4. Keep `status: 'pending'` as the safe default until payment is confirmed

Until the payment system exists, the admin-approval gate stays as the only thing preventing free unlimited access.

---

## Out of scope (not free / needs product decision)
- Paid reCAPTCHA / SMS gateway
- Concurrent-edit conflict detection (needs `updated_at` plumbing) — deferred
- Full WCAG accessibility pass on pricing modal — partial ARIA added with A1

---

## Verification steps
1. `node -c` syntax check on every edited backend/JS file
2. Manual read-through of admin tab wiring
3. Confirm token + URL helpers resolve correctly
4. Stage only the touched files; commit only after the above pass
