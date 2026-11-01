# Shop partners (guide / book shops) — plan (approved 2026-11-02)

Shopkeepers who sell guides and books offline share the free test and the app
with parents, and earn a commission when those students pay.

## Decisions
- Only the admin creates a shop (no self-registration). Admin > Partners > 🏪 Shops.
- Commission is set per shop when it is created (editable later):
  first payment %, renewal % (0 = nothing on renewals). Counted on the amount the
  parent actually paid (after the 50 % offer).
- One student, one owner: the code that reached the student first keeps it
  (referred_by_teacher is set once). The shop's own mobile never earns.
- Payouts reuse the partner ledger: hold days, monthly statement, UPI, refunds as
  adjustments (Admin > Partners statements).
- QR poster: made on the phone (no server load), size chosen by the admin
  (A5 / A4 / A3); admin prints it, the shop can download it again from its panel.
- Not now: target bonus, activation (cash) cards.

## Build
- A shop is a `User` with role `teacher`, `partner_type: 'shop'`
  (`institute_name` = shop name, `shop_area`, `commission_renewal_value`).
  Blocked from every teacher tool like a YouTube partner; only `/api/partners/me/*`
  and `/api/shop/me*` are open. Login: mobile (or shop code) + PIN.
- Links carry the shop code: free test `?free=1&shop=CODE` (guest source `shop`),
  app `get-app.html?teacher=CODE` (Install Referrer → registration code).
- `/api/shop/me` — shop panel: counts, invites, free-test visitors, students
  (name, class, masked mobile, paid / free), earnings via `/api/partners/me/earnings`.
- `/api/shop/me/invite` — logs a number the shopkeeper sent the link to (WhatsApp
  opens on the shopkeeper's own phone; no WhatsApp API).
- `/api/shop/admin/*` — create / edit / list shops with the same counts.
- Page `shop.html` (`/shop`) for the shopkeeper; `core/shopPoster.js` draws the
  poster for both the admin and the shop.
- TDS (194H) above ₹15,000 a year: PAN field in the payout profile; check with CA.
