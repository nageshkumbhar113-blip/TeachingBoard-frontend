# TeachingBoard — Full Project Audit Plan

> **Rule:** एक audit पूर्ण → bugs fix → check → DONE mark → next audit

---

## Audit Status

| # | Audit | Status | Bugs Found | Bugs Fixed |
|---|-------|--------|-----------|-----------|
| 1 | Security | ✅ Done | 4 | 4 |
| 2 | Offline / PWA | ⏳ In Progress | - | - |
| 3 | Data Integrity | ⬜ Pending | - | - |
| 4 | API Contract | ⬜ Pending | - | - |
| 5 | Performance | ⬜ Pending | - | - |
| 6 | Mobile / Device | ⬜ Pending | - | - |
| 7 | Accessibility | ⬜ Pending | - | - |
| 8 | Cross-Browser | ⬜ Pending | - | - |
| 9 | Error Handling | ⬜ Pending | - | - |
| 10 | Board Mode | ⬜ Pending | - | - |

---

## Audit 1 — Security

### Checklist
- [ ] JWT token expiry + missing auth on routes
- [ ] Admin PIN brute-force protection
- [ ] Student self-registration abuse
- [ ] Unauthenticated API endpoints
- [ ] MongoDB injection / input sanitization
- [ ] CORS config (production)
- [ ] Sensitive data in IndexedDB
- [ ] Hardcoded secrets / debug routes

### Findings
| # | Severity | Issue |
|---|----------|-------|
| S1 | 🔴 Critical | `admin_pin` stored in IndexedDB with default `'1234'` fallback |
| S2 | 🔴 Critical | Backend had no security headers (X-Content-Type-Options, X-Frame-Options) |
| S3 | 🟡 Medium | No pagination on `/api/questions`, `/api/students` — full table scan |
| S4 | 🟢 Low | `X-Powered-By: Express` header exposed server info |

### Fixes Applied
| Fix | File | Change |
|-----|------|--------|
| S1 | `core/sync.js:550` | Default '1234' → '' (empty). Missing PIN → skip sync with warning |
| S2 | `TeachingBoard-backend/src/app.js` | Added X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| S3 | `src/controllers/questionController.js` | Added `?limit&skip` pagination (max 2000) |
| S3 | `src/controllers/studentController.js` | Added `?limit&skip` pagination (max 1000) |
| S4 | `TeachingBoard-backend/src/app.js` | `app.disable('x-powered-by')` |

### Passed ✅
- JWT HMAC-SHA256 signed, 12h expiry, signature verified on every request
- PIN stored as HMAC hash in MongoDB (never plaintext)
- CORS configured with allowedOrigins whitelist
- Rate limiting: auth (30/15min), self-register (5/hour)
- No MongoDB injection (Mongoose schema enforces types, String() casting)
- No eval/exec usage
- Device binding prevents account sharing
- Input sanitized everywhere (String(), trim(), regex validation)

---

## Audit 2 — Offline / PWA

### Checklist
- [ ] Service worker cache list matches current files
- [ ] Offline quiz attempt works end-to-end
- [ ] Sync conflict resolution
- [ ] IndexedDB schema migration safe on update
- [ ] App installable (manifest correct)
- [ ] Offline fallback page

### Findings
_TBD_

### Fixes Applied
_TBD_

---

## Audit 3 — Data Integrity

### Checklist
- [ ] Quiz publish → questions deleted → attempt behavior
- [ ] Network fail during submit → data lost?
- [ ] Sync queue stuck items
- [ ] MongoDB + IndexedDB consistency
- [ ] Duplicate attempt prevention
- [ ] Score calculation edge cases (0 questions, all skipped)

### Findings
_TBD_

### Fixes Applied
_TBD_

---

## Audit 4 — API Contract

### Checklist
- [ ] Every frontend API call has matching backend route
- [ ] HTTP error codes consistent
- [ ] Pagination for large datasets
- [ ] Request size limits
- [ ] Response shape matches what frontend expects

### Findings
_TBD_

### Fixes Applied
_TBD_

---

## Audit 5 — Performance

### Checklist
- [ ] JS file sizes
- [ ] IndexedDB query speed on large data
- [ ] CSS animation on low-end devices
- [ ] No memory leaks (event listeners)
- [ ] Image/icon optimization

### Findings
_TBD_

### Fixes Applied
_TBD_

---

## Audit 6 — Mobile / Device

### Checklist
- [ ] 360px width — no overflow
- [ ] All buttons ≥44px touch targets
- [ ] Capacitor Android APK screens
- [ ] iOS Safari fixed/backdrop-filter issues
- [ ] Keyboard does not block inputs
- [ ] Landscape mode

### Findings
_TBD_

### Fixes Applied
_TBD_

---

## Audit 7 — Accessibility

### Checklist
- [ ] ARIA labels on all interactive elements
- [ ] Color contrast WCAG AA
- [ ] Focus trap in modals
- [ ] High contrast theme completeness
- [ ] Keyboard navigation flows

### Findings
_TBD_

### Fixes Applied
_TBD_

---

## Audit 8 — Cross-Browser

### Checklist
- [ ] Chrome, Firefox, Safari, Edge
- [ ] backdrop-filter fallback
- [ ] CSS Grid older Android
- [ ] IndexedDB behavior
- [ ] Font rendering

### Findings
_TBD_

### Fixes Applied
_TBD_

---

## Audit 9 — Error Handling

### Checklist
- [ ] Network error → user message
- [ ] Backend down → admin panel behavior
- [ ] Invalid/corrupt data → no crash
- [ ] Session expire → graceful logout
- [ ] Unhandled promise rejections

### Findings
_TBD_

### Fixes Applied
_TBD_

---

## Audit 10 — Board Mode

### Checklist
- [ ] Board mode all screens work
- [ ] Zoom level stable
- [ ] 1080p / 4K resolution
- [ ] Auto-scroll behavior
- [ ] No UI overlap with board controls

### Findings
_TBD_

### Fixes Applied
_TBD_

---

_Last updated: 2026-06-17_
