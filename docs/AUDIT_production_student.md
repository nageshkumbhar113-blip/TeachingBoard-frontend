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
| 3 | API endpoint wiring (FE ↔ BE) | 🟡 mount-level ✅, deep pending |
| 4 | Backend auth / security | ⏳ pending |
| 5 | Database (queries, indexes, N+1) | ⏳ pending |
| 6 | Student flows (page/tab-by-tab) | ⏳ pending |
| 7 | Performance / speed | ⏳ pending |
| 8 | Final green-tick + fixes summary | ⏳ pending |

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
| P3-? | ⏳ | Deep per-endpoint check (each sub-path + HTTP method + auth middleware) — 53+ BE endpoints vs FE calls | pending |

---

## Backend inventory (for phases 3–5)
- Mounts: 24 `app.use('/api/...')` · ~53+ endpoints
- 20 controllers · 26 models · 16 route files · engine (TestAssembler, DistractorGenerator...) · middleware (auth, errorHandler, rateLimiter)
- Route files with non-standard router style (0 `router.X` matches — define routers differently, NOT empty): noteRoutes, parentRoutes, slsRoutes, teacherRoutes, wordRoutes, wordTestRoutes

## Frontend inventory
- student-app: 22 files (~15k lines) · admin-app: 15 (~11k) · core: 6 (~5.7k) · js: 20 (mostly dead)
- Offline-first: core/db.js (IndexedDB) + core/sync.js (server sync) + core/helpers.js (API wrapper)
