# 🔍 Production Audit — Nks EduOrbit (Student app focus)

> Full app pre-production audit. 8 phases. Live document — updated as phases complete.
> Started 2026-07-01 · App v7.0.1 (code 71, SW v45)

## Legend
🔴 blocker · 🟠 high · 🟡 medium · 🟢 low/cosmetic · ✅ verified OK · ⏳ pending

---

## Phase status
| # | Phase | Status |
|---|-------|--------|
| 1 | Build / APK / release integrity | ✅ done (2 findings) |
| 2 | Frontend wiring & routing | ✅ done (1 fixed, cleanup pending) |
| 3 | API endpoint wiring (FE ↔ BE) | ✅ done — all wired |
| 4 | Backend auth / security | ✅ done — solid (config notes) |
| 5 | Database (queries, indexes, N+1) | ✅ done (1 fixed) |
| 6 | Student flows (page/tab-by-tab) | ✅ done — solid |
| 7 | Performance / speed | ✅ done (offline note) |
| 8 | Final green-tick + fixes summary | ✅ see summary below |

---

## Findings

### Phase 1 — Build / APK / release ✅
| ID | Sev | Item | Status |
|----|-----|------|--------|
| — | ✅ | Two distinct applicationIds (admin `com.teachingboard.admin` / student `com.nkseduorbit.student`) now patched correctly | fixed earlier (patch-appid.mjs) |
| — | ✅ | versionName + versionCode patching (was silently failing) | fixed (patch-version.mjs) |
| — | ✅ | Signing keystore + jks present; both APKs signed | OK |
| — | ✅ | google-services.json has BOTH package_names (push works both apps) | OK |
| — | ✅ | network_security_config: `cleartextTrafficPermitted=false` (HTTPS-only) | OK, secure |
| — | ✅ | APK finalize step self-verifying (no phantom "APK ready") | fixed |
| P1-1 | 🟡 | `POST_NOTIFICATIONS` not in source AndroidManifest — Android 13+ push needs it. Capacitor push plugin *should* merge it; must confirm in merged manifest (or first real push test on Android 13+). | verify |
| P1-2 | 🟢 | `aapt.exe` hardcoded to build-tools `37.0.0` + user path in both bats — breaks if SDK updates. Verify-only step (`2>nul`), non-fatal. | note |

### Phase 2 — Frontend wiring & routing
| ID | Sev | Item | Status |
|----|-----|------|--------|
| P2-1 | 🔴→✅ | **SW precache (CORE_ASSETS) missing 6 loaded assets** → offline-first gaps (notesViewer.js/.css for student; conceptManager.js, batchPricingManager.js, concept-manager.css, batch-pricing.css for admin) | **FIXED** in sw.js |
| P2-2 | 🟡 | `js/` folder ~14 dead duplicates (app, quiz, testPlayer, analytics, ui, testBuilder, admin, parser, tts + 5 re-export shims). Only `js/splash.js` is loaded. Whole `js/` is copied into BOTH app bundles by prepare scripts = dead weight in APK/web. | recommend remove (keep splash.js) |
| P2-3 | 🟢 | admin.html `<img id="we-image-preview-img" src="">` empty src (preview placeholder) | minor |
| P2-4 | 🟢 | BOM before `@import` at student-ui.css:1 | harmless |
| P2-5 | 🟢 | student logo filename `nks-edorbit-logo.png` (edorbit vs eduorbit) | cosmetic |
| — | ✅ | All student-app script/css refs resolve to real files | OK |
| — | ✅ | `css/style.css` + `css/design-tokens.css` used via @import chain | OK |

### Phase 3 — API endpoint wiring (partial)
| ID | Sev | Item | Status |
|----|-----|------|--------|
| — | ✅ | API base resolution robust (Capacitor-native → render, localhost, same-origin fallbacks) | OK |
| — | ✅ | All FE endpoint prefixes map to BE mounts (auth, quizzes, attempts, lessons, questions, students, batches, teacher(s), parent(s), app-version, vocab, student, word-tests, fee, payment, notes, sls) | OK mount-level |
| — | ✅ | All 53+ endpoints verified: correct method + auth guard. Student endpoints (attempts/my, vocab/*, word-tests/*, notes, sls/student/*, quizzes/lessons/questions read) all `requireStudent`/`attachUserIfPresent` | OK |

### Phase 4 — Backend auth / security ✅ (solid)
| ID | Sev | Item | Status |
|----|-----|------|--------|
| — | ✅ | Auth middleware: JWT-verified, role guards (admin/student/teacher/parent), student blocked/expired denial at API layer (codes ACCOUNT_BLOCKED/ACCOUNT_EXPIRED) | OK |
| — | ✅ | Public payment endpoints (order/trial/status) PIN-authenticated via `authStudentByPin(code,pin)` | OK |
| — | ✅ | Cron `fee/process-reminders` guarded by `x-cron-secret` header | OK |
| — | ✅ | Rate limiters present: authLimiter, payLimiter, vocabLimiter, registerLimiter | OK |
| P4-1 | 🟡 | **`CRON_SECRET` env MUST be set in production** — else process-reminders always 401 → fee reminders never send | config |
| P4-2 | 🟡 | `RAZORPAY_*` env vars required for payments/subscriptions | config |
| P4-3 | 🟢 | 60s in-memory user cache → block/expiry takes up to 60s to propagate | acceptable |
| P4-4 | 🟢 | Deleted student with still-valid token passes `requireStudent` until token expiry (userDoc null ⇒ no denial) | minor edge |
| P4-5 | 🟢 | `GET /api/sls/papers/published` public (no auth) — verify intended (published list) | verify |

### Phase 5 — Database ✅
| ID | Sev | Item | Status |
|----|-----|------|--------|
| — | ✅ | All 26 models have indexes (no missing-index collection) | OK |
| — | ✅ | Hottest student query `getMyAttempts` bounded (limit ≤1000, default 200) + paginated + student-filtered | OK |
| — | ✅ | Batch catalog building loops = in-memory over pre-fetched data (no N+1) | OK |
| P5-2 | 🟢→✅ | **N+1 FIXED**: `wordController.getTeacherVocabScores` did `User.findOne` per no-attempt student → batched to ONE `User.find({$in})` | **fixed** |
| P5-1 | 🟢→✅ | **N+1 FIXED**: `studentController.updateStudent` per-teacher peers-find + updateOne → batched (1 peers-find + 1 bulkWrite); MAX-expiry/null semantics preserved exactly | **fixed** |
| P5-3 | 🟡 | Analytics endpoints (wordController/wordTestController) fetch attempts and aggregate in JS — fine for class sizes; consider Mongo aggregation pipeline if data grows large | scale note |

---

## Backend inventory (for phases 3–5)
- Mounts: 24 `app.use('/api/...')` · ~53+ endpoints
- 20 controllers · 26 models · 16 route files · engine (TestAssembler, DistractorGenerator...) · middleware (auth, errorHandler, rateLimiter)
- Route files with non-standard router style (0 `router.X` matches — define routers differently, NOT empty): noteRoutes, parentRoutes, slsRoutes, teacherRoutes, wordRoutes, wordTestRoutes

## Frontend inventory
- student-app: 22 files (~15k lines) · admin-app: 15 (~11k) · core: 6 (~5.7k) · js: 20 (mostly dead)
- Offline-first: core/db.js (IndexedDB) + core/sync.js (server sync) + core/helpers.js (API wrapper)

### Phase 6 — Student app functional flows ✅ (solid)
| ID | Sev | Item | Status |
|----|-----|------|--------|
| — | ✅ | No raw `alert()/confirm()/prompt()` in student-app/core (Android WebView safe) | OK |
| — | ✅ | No TODO/FIXME/HACK markers | OK |
| — | ✅ | Central API wrapper `request()`: safe JSON parse, `response.ok` check, ACCOUNT_EXPIRED/BLOCKED/PENDING handling, 401 auth-retry, structured throw | OK |
| — | ✅ | Subscription expired → renewal (plan-select/checkout) flow, not a dead-end; no forced re-login | OK |
| — | ✅ | Back button (popstate) handled; error handling at flow level + inline `.catch` on DB ops | OK |

### Phase 7 — Performance / speed ✅
| ID | Sev | Item | Status |
|----|-----|------|--------|
| — | ✅ | 25/29 scripts deferred (non-blocking render) | OK |
| — | ✅ | CDN deps guarded — katex (core/math.js:29), pdf.js (notesPlayer.js:259) → no crash offline, graceful degrade | OK |
| P7-1 | 🟡 | True-offline limit: katex/pdf.js/razorpay load from CDN (cross-origin, not SW-precached). Offline → math shows raw LaTeX, PDF notes need online. Enhancement: self-host katex+pdf.js + precache for full offline (app advertises "offline quiz taking") | enhancement |
| P7-2 | 🟢 | ~548 KB unminified student bundle — acceptable (SW-cached after first load); minify for faster first load if desired | optional |

---

## Phase 8 — Final green-tick summary

### ✅ Production-ready verdict: GREEN (with 2 config env vars to confirm)
Student app is structurally sound across build, wiring, endpoints, auth, DB, flows, and perf.

### 🔧 Fixes applied this audit
| ID | Fix | File |
|----|-----|------|
| P2-1 | SW precache: +6 offline assets (notes viewer etc.) | sw.js |
| P2-2 | Removed 14 dead `js/` duplicates (~5.8k lines) | js/ |
| P5-2 | N+1 → batched: teacher vocab-scores | wordController.js |
| P5-1 | N+1 → batched + bulkWrite: expiry propagation | studentController.js |

### ⚠️ Must confirm before/at production (config, not code)
- **P4-1** `CRON_SECRET` env set on Render (else fee reminders never send)
- **P4-2** `RAZORPAY_*` env vars set (payments/subscriptions)
- **P1-1** `POST_NOTIFICATIONS` merges into APK manifest (Android 13+ push) — confirm on first push test

### 📋 Optional / deferred (not blockers)
- P7-1 self-host katex/pdf.js for full offline (enhancement)
- P7-2 minify bundle (optional)
- P5-3 analytics → Mongo aggregation (defer to scale)
- P1-2 aapt.exe hardcoded path (verify-only step)
- P4-3/P4-4 60s cache propagation / deleted-token edge (acceptable)
