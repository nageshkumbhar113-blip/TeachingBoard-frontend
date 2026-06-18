# TeachingBoard — Bugs & Fix Plan
_Last updated: 2026-06-18_

---

## ADMIN APP

### 🔴 HIGH — Data not syncing to backend

| # | Issue | Location | Status |
|---|-------|----------|--------|
| A1 | **Classes/Batches** — `_addBatch()` saves only to IndexedDB (`DB.saveBatch()`). No backend route exists (`/api/batches`). New empty batch won't appear on other devices. | `admin-app/admin.js:1198` | ❌ LocalDB only |
| A2 | **Subjects** — `_addBatchSubject()` saves only to IndexedDB. | `admin-app/admin.js:460` | ❌ LocalDB only |
| A3 | **Chapters** — `_addSubjectChapter()` saves only to IndexedDB. | `admin-app/admin.js:478` | ❌ LocalDB only |
| A4 | **Delete Batch/Subject/Chapter** — also LocalDB only | `admin-app/admin.js` | ❌ LocalDB only |

**Root cause:** Backend has NO model or route for batches/subjects/chapters.

**Fix plan:**
1. Create `TeachingBoard-backend/src/models/Batch.js` (store in Settings collection OR new collection)
2. Create `TeachingBoard-backend/src/routes/batchRoutes.js` — GET `/api/batches`, POST `/api/batches`, DELETE `/api/batches/:id`
3. Wire `_addBatch()`, `_addBatchSubject()`, `_addSubjectChapter()` → `API.request('/batches', ...)`
4. On admin load: fetch batches from backend, merge into local IndexedDB

---

### 🟡 MEDIUM — UX / Functional gaps

| # | Issue | Location | Status |
|---|-------|----------|--------|
| A5 | **`btn-qe-save` (Save Question) click** — button is `type="submit"` inside `#qedit-form`. Form submit IS wired → `_saveQEditor`. Works correctly. | `admin.html:693` | ✅ OK (form submit) |
| A6 | **`bulk-batch` / `bulk-subject` / `bulk-chapter` selects in Bulk Import** — ARE populated via `_loadBatchOptions()` at line 246. | `admin.js:246` | ✅ OK |
| A7 | **Admin Attempts page** — `fetchAttempts()` exists in helpers.js but admin panel has no UI to view/filter student attempts. | `core/helpers.js:696` | ❌ No UI |
| A8 | **Student approval: no email/WhatsApp notification** — Approve just updates DB status, no notify to student. | `admin.js:1597` | ⚠️ Nice-to-have |
| A9 | **Batch icon always random** — `_addBatch()` assigns a random emoji, no choice for teacher. | `admin.js:1196` | ⚠️ Minor UX |

---

## STUDENT APP

### 🔴 HIGH — Broken features

| # | Issue | Location | Status |
|---|-------|----------|--------|
| S1 | **`btn-back` button** — exists in HTML topbar as `class="nav-back hidden"` but is NEVER shown or given a click handler. Relies on per-screen back buttons (`an-back`, `tp-btn-home`, `btn-home-from-results`). No unified back navigation. Android back gesture also not handled. | `student-app/index.html:159`, `app.js:560` | ❌ Not wired |
| S2 | **Analytics uses local DB only** — `DB.getAllAttempts()` only reads IndexedDB. On a new device (fresh install), analytics is completely empty even if student has attempts on the server. Backend has GET `/api/attempts` (admin only) — no student-facing fetch. | `analytics.js:64`, `attemptRoutes.js:7` | ❌ No server sync |
| S3 | **Offline quiz flow** — Throws `'Quiz not available offline. Please connect once to download it.'` with no graceful UI. Student sees an error toast but the app shows a blank quiz screen. | `testPlayer.js:132` | ❌ No fallback UI |

---

### 🟡 MEDIUM — UX gaps

| # | Issue | Location | Status |
|---|-------|----------|--------|
| S4 | **Profile edit → re-opens onboarding modal** — `_openProfileSettings()` calls `_showOnboarding(..., { force: true })`. Teacher sees the same login form, not a dedicated profile edit modal. | `app.js:478` | ⚠️ UX issue |
| S5 | **Screen breadcrumb not updating** — `showScreen()` sets breadcrumb to 'Home' on home, `null` elsewhere. Non-home screens (quiz, results, test-player) show blank breadcrumb. | `app.js:582` | ⚠️ Minor UX |
| S6 | **TTS (Text-to-Speech) button** — `btn-tts` fires `TTS.toggle()`. If TTS fails (no browser support), no visible error. | `app.js:524` | ⚠️ Silent fail |
| S7 | **Flag state lost across sessions** — `flagCurrent()` → `DB.toggleFlag(q_id)` saves locally. Works across sessions on same device. But cross-device sync of flagged questions not done. | `quiz.js:559` | ⚠️ Single-device only |

---

### ✅ Already Working (confirmed)

| Feature | How it works |
|---------|-------------|
| Quiz submit → backend | `SYNC.submitAttempt()` with offline queue |
| Flag button | `DB.toggleFlag()` persists in IndexedDB |
| PDF export (quiz) | `PDF.exportQuestionPaper()` wired at quiz end |
| Shuffle / Revision mode | Fully wired |
| All 20 student buttons | All have click handlers (except btn-back) |
| Offline queue for attempts | `_enqueue('submitAttempt')` → drained on reconnect |
| Student self-register → admin approve | Full flow working |

---

## BACKEND — Missing Routes

| Route needed | Purpose | Status |
|-------------|---------|--------|
| `GET /api/batches` | Fetch all batches for admin | ❌ Missing |
| `POST /api/batches` | Create batch | ❌ Missing |
| `DELETE /api/batches/:id` | Delete batch | ❌ Missing |
| `GET /api/attempts/my` | Student fetches own attempts | ❌ Missing |

---

## FIX PRIORITY ORDER

```
Priority 1 (Backend required):
  → A1-A4: Add /api/batches route + model (backend + frontend both)
  → S2: Add GET /api/attempts/my (student token) + call from analytics

Priority 2 (Frontend only):
  → S1: Wire btn-back with screen stack (_prevScreen tracking in showScreen())
  → S3: Offline quiz graceful UI (show "downloaded quizzes" list when offline)

Priority 3 (Polish):
  → S4: Profile modal (separate from onboarding)
  → S5: Breadcrumb per screen
  → A7: Admin attempts viewer
  → A9: Batch icon picker
```

---

## FILES TO CHANGE

| File | Change needed |
|------|--------------|
| `TeachingBoard-backend/src/models/Batch.js` | NEW — Batch mongoose model |
| `TeachingBoard-backend/src/routes/batchRoutes.js` | NEW — CRUD batch routes |
| `TeachingBoard-backend/src/controllers/batchController.js` | NEW — controller |
| `TeachingBoard-backend/src/app.js` | Register batch routes |
| `TeachingBoard-backend/src/routes/attemptRoutes.js` | Add GET /my route for student |
| `core/helpers.js` | Add `syncBatches()`, `fetchMyAttempts()` |
| `admin-app/admin.js` | Wire `_addBatch()` etc. to API |
| `student-app/analytics.js` | Call `fetchMyAttempts()` on open |
| `student-app/app.js` | Add screen stack, wire `btn-back` |
