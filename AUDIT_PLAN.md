# TeachingBoard — Full Project Audit Plan

> **Rule:** एक audit पूर्ण → bugs fix → check → DONE mark → next audit

---

## Audit Status

| # | Audit | Status | Bugs Found | Bugs Fixed |
|---|-------|--------|-----------|-----------|
| 1 | Security | ✅ Done | 4 | 4 |
| 2 | Offline / PWA | ✅ Done | 2 | 2 |
| 3 | Data Integrity | ✅ Done | 3 | 3 |
| 4 | API Contract | ✅ Done | 2 | 2 |
| 5 | Performance | ✅ Done | 0 | 0 |
| 6 | Mobile / Device | ✅ Done | 0 | 0 |
| 7 | Accessibility | ✅ Done | 0 | 0 |
| 8 | Cross-Browser | ✅ Done | 2 | 2 |
| 9 | Error Handling | ✅ Done | 0 | 0 |
| 10 | Board Mode | ✅ Done | 0 | 0 |

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

## Audit 2 — Offline / PWA ✅

### Findings
| # | Severity | Issue |
|---|----------|-------|
| P1 | 🔴 Critical | `sw.js` missing `./css/design-tokens.css` — offline UI broken (CSS vars undefined) |
| P2 | 🔴 Critical | `sw.js` missing `./admin-app/admin-mobile.js` — offline admin no hamburger |

### Fixes Applied
| Fix | File | Change |
|-----|------|--------|
| P1 | `sw.js` | Added `./css/design-tokens.css` to CORE_ASSETS |
| P2 | `sw.js` | Added `./admin-app/admin-mobile.js` to CORE_ASSETS |
| SW | `sw.js` | Bumped SW_VERSION v8 → v9 (forces cache refresh on all users) |

### Passed ✅
- Navigation offline fallback works (student/admin HTML)
- Sync queue persists offline attempts in IndexedDB
- Old cache versions auto-deleted on activate
- App manifest correct (icons, display, categories)
- skipWaiting on install for fast updates

---

## Audit 3 — Data Integrity ✅

### Findings
| # | Severity | Issue |
|---|----------|-------|
| D1 | 🟡 Medium | 0-question quiz could be attempted — score=0/0 meaningless |
| D2 | 🟡 Medium | Retry sync could create duplicate attempt (network timeout after success) |
| D3 | 🟡 Medium | Attempt list no pagination — thousands of rows in memory |

### Fixes Applied
| Fix | File | Change |
|-----|------|--------|
| D1 | `src/controllers/attemptController.js` | Throw 400 if `quiz.questions.length === 0` |
| D2 | `src/controllers/attemptController.js` | Accept `attempt_id` from client — return existing if already saved (idempotent) |
| D3 | `src/controllers/attemptController.js` | Added `?limit/?skip` pagination (max 1000) |

### Passed ✅
- `attempt_id` unique index in MongoDB prevents double-save
- Sync checks `synced === true` before re-submitting
- Quiz has embedded questions — deleting question from Question collection doesn't corrupt quiz
- All skipped → score=0, wrong=0, skipped=N (correct math)
- `strict: "throw"` on Attempt schema prevents unknown fields

---

## Audit 4 — API Contract ✅

### Findings
| # | Severity | Issue |
|---|----------|-------|
| A1 | 🔴 Critical | `helpers.js` all admin write functions had `pin = '1234'` default — silently uses weak PIN |
| A2 | 🔴 Critical | `helpers.js:_resolveAdminPin()` had `'1234'` as final fallback |

### Fixes Applied
| Fix | File | Change |
|-----|------|--------|
| A1 | `core/helpers.js` | Changed all `pin = '1234'` defaults → `pin = ''` |
| A2 | `core/helpers.js:_resolveAdminPin` | Removed '1234' fallback; throws error if PIN not set |

### Passed ✅
- All frontend API paths match backend routes
- Error codes: 400 (bad input), 401 (unauth), 403 (forbidden), 404 (not found), 429 (rate limit)
- Request size limit: 2MB (app.js)
- Response shapes consistent (success/data/count pattern)
- `/auth/login`, `/auth/me`, `/quizzes`, `/attempts`, `/lessons`, `/questions`, `/students` all wired

---

## Audit 5 — Performance ✅

### Passed ✅
- `content-visibility: auto` on heavy sections (style.css)
- SW pre-caches all static assets — instant repeat loads
- `DB.getSetting()` cached in IndexedDB (fast reads)
- No memory leaks found: event listeners cleaned on screen transitions
- Global error handler in app.js prevents silent crashes

---

## Audit 6 — Mobile / Device ✅

### Passed ✅
- Admin hamburger sidebar working on ≤768px
- Quiz options min-height: 60px (above 44px minimum)
- Onboarding inputs min-height: 48px
- Capacitor Android config updated (`com.teachingboard.student`)
- `viewport` meta tag with `width=device-width` on all HTML pages
- `env(safe-area-inset-*)` used in toast container CSS

---

## Audit 7 — Accessibility ✅

### Passed (no critical issues) ✅
- All form inputs have `id` and are associated with labels or `aria-label`
- Admin sidebar: `aria-label="Admin navigation"` present
- Admin tab buttons: `role="tab"`, `aria-controls`, `aria-selected` present
- Student app: `unhandledrejection` caught globally
- Note: 15 buttons in student HTML have no `aria-label` but are in contexts with visible text labels

---

## Audit 8 — Cross-Browser ✅

### Findings
| # | Severity | Issue |
|---|----------|-------|
| B1 | 🟡 Medium | `student-ui.css`: 7 `backdrop-filter` rules missing `-webkit-backdrop-filter` |
| B2 | 🟡 Medium | `admin-ui.css`: 1 `backdrop-filter` rule missing `-webkit-backdrop-filter` |

### Fixes Applied
| Fix | File | Change |
|-----|------|--------|
| B1 | `student-app/student-ui.css` | Added `-webkit-backdrop-filter` prefix to all 7 missing rules |
| B2 | `admin-app/admin-ui.css` | Added `-webkit-backdrop-filter` to `.creds-modal-overlay` |

### Passed ✅
- CSS Grid: supported in Chrome 57+, Firefox 52+, Safari 10.1+, Edge 16+
- IndexedDB: supported in all modern browsers
- CSS custom properties: supported everywhere
- `@import` in CSS: works in all browsers

---

## Audit 9 — Error Handling ✅

### Passed ✅
- Global `window.addEventListener('unhandledrejection')` in app.js
- Global `window.addEventListener('error')` in admin-shell.js
- Network errors → queued in IndexedDB sync queue
- Backend down → offline fallback from SW cache
- Session expire → `markExpired()` → graceful logout flow
- DB errors → `.catch(() => null)` pattern throughout
- `asyncHandler` wrapper in backend prevents uncaught async throws

---

## Audit 10 — Board Mode ✅

### Passed ✅
- Board mode CSS at lines 1-93 in student-ui.css — UNTOUCHED
- `--board-zoom` variable at line 5 intact
- Board mode selectors: 11 CSS rules verified present
- New premium CSS added AFTER line 1086 (no conflict)
- Board mode toggle in admin preserved

---

_Last updated: 2026-06-17_
