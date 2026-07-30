# Offline Support + Encrypted Local Cache — Phase Plan

**Date**: 2026-07-30
**Goal**: Let students keep using content they've already viewed (Notes, Word
Tests, Exercise, Dictionary) even when the backend is unreachable, while
protecting admin's proprietary content from casual local extraction.
Login/session resume was already confirmed offline-capable (JWT + local PIN
check, no code change needed there). Payment, first-time login, brand-new
content, and the Admin app itself stay online-only by design.

## Shared building blocks (used by every phase)

- **`core/crypto.js`** (new, built first) — `CRYPTO.encrypt(obj)` /
  `CRYPTO.decrypt(packed)`, AES-256-GCM via Web Crypto, key derived from an
  embedded passphrase + a per-install random salt (persisted once via
  `DB.setSetting('local_cache_salt', ...)`). Verified via round-trip +
  tamper test (tampered ciphertext returns `null`, never throws).
- **Cache-first pattern** (mirrors the already-proven
  `testPlayer.js:_resolveQuizForStart`): read local cache → if present,
  return immediately + fire-and-forget background refresh if online → if
  absent + online, fetch live + write cache → if absent + offline, throw a
  clear Marathi/English error.
- **Isolation**: every new IndexedDB store gets added to
  `DB.clearStudentLocalData()` and `DB.resetAll()`'s store lists, so
  switching student accounts on a shared device wipes all of it — same
  mechanism already used for `notes_cache`/`test_attempts`/`sync_queue`.
- **No visible UX change** — cache-hit rendering stays instant, background
  refresh is silent (matches the existing quiz-cache convention; no "stale"
  banner today, so none is added here either).

## Phase 0 — Exercise script precache fix

Add `'./student-app/exerciseViewer.js'` to `sw.js`'s `CORE_ASSETS`
(currently missing even though `index.html` loads it), bump `SW_VERSION`.
One-line, near-zero risk — ships regardless of sequencing below.

## Phase 1 — Notes (SLS Concepts) offline caching

- `core/db.js`: bump `DB_VERSION` 10→11, add `sls_chapters` (keyPath
  `chapterId`) and `sls_concepts` (keyPath `_id`, index `chapterId`) stores.
  New functions: `saveChaptersCache`, `getCachedChapters`,
  `saveConceptsCache`, `getCachedConcepts`, `saveConceptCache`,
  `getCachedConcept` — each record encrypted via `CRYPTO.encrypt` before
  `_put`, decrypted via `CRYPTO.decrypt` after `_get`/`_getAll`.
- `core/sync.js`: new `refreshSlsChapters()`, `refreshSlsConcepts(chapterId)`,
  `refreshSlsConcept(conceptId)`, mirroring `refreshQuiz` — fetch live,
  write through the new encrypted-cache functions, prune stale entries
  (mirrors `fetchQuizzes`'s stale-removal).
- `student-app/notesViewer.js`: rewrite `_loadChapters`, `_loadConcepts`,
  `viewConcept` to the cache-first pattern. `_searchConcepts` stays
  network-only (no sensible offline full-text search) but gets an explicit
  offline error instead of a silent console warning.
- **Self-check**: view a note online → go offline → reopen the same note
  (should render from cache) → confirm chapter/concept list works offline
  → switch to a different student account → confirm the previous student's
  cached notes are gone (isolation).

## Phase 2 — Word Test submission queue

- `core/db.js`: new `word_test_attempts` store (keyPath `local_id`),
  encrypted records, functions `saveWordTestAttempt`, `getWordTestAttempt`,
  `getWordTestAttemptsByTest`. Added to both wipe-lists.
- `core/sync.js`: new `submitWordTestAttempt(localAttempt)` +
  `_doSubmitWordTestAttempt`, mirroring the classic quiz's
  `submitAttempt`/`_doSubmitAttempt` — online → submit live; offline or
  network error → queue via the existing `sync_queue`/`_drainQueue`
  machinery (new `op: 'submitWordTestAttempt'` branch; `_enqueue`'s dedupe
  key extended to include `payload?.local_id`).
- `student-app/wordTestPlayer.js`: `_doSubmitTest` routes through
  `SYNC.submitWordTestAttempt` instead of calling `API.submitWordTestAttempt`
  directly; new `_showPendingScoreView()` for the "submitted, will show
  score once back online" state (word-test score can only be known from the
  server response, unlike the classic quiz which scores client-side).
- **Self-check**: complete a word test in airplane mode → confirm "pending"
  state shown, no answers lost → restore network → confirm auto-submit
  completes and the real score appears without re-opening the test.

## Phase 3 — Exercise tab caching

- `core/db.js`: new `exercise_questions_cache` store (keyPath `chapter_id`),
  encrypted, separate from Notes' stores (different backend model —
  `SLSQuestion` vs `Concept` — and different natural cache key).
- `student-app/exerciseViewer.js`: `_loadExerciseGroups` rewritten to a
  `_resolveExerciseQuestions(chapterId)` resolver, same cache-first shape.
- **Self-check**: open an Exercise group online → go offline → reopen the
  same chapter's Exercise tab (groups + Q&A should render from cache).

## Phase 4 — Word/Dictionary caching

- `core/db.js`: new `words_cache` store keyed by `batch+subject`, encrypted.
- `student-app/dictionary.js`: `_loadPage` becomes cache-first (cache holds
  the whole batch/subject word list; search filters client-side against the
  cached set instead of relying on server-side `q=` pagination when offline).
- **Self-check**: browse a batch/subject's word bank online → go offline →
  reopen the same batch/subject (words + search should still work locally).

## Phase 5 — Teacher Dashboard caching

- Same pattern applied to `student-app/teacherDashboard.js`'s read paths
  (student list, per-student attempts, notification history, vocab scores)
  — new `teacher_dashboard_cache` store(s), cache-first reads.
- **Self-check**: load teacher dashboard sections online → go offline →
  reopen (previously-loaded sections should still render).

## Phase 6 — Parent Dashboard caching

- Same pattern applied to `student-app/parentDashboard.js` (children list,
  child attempts, child fee records) — new `parent_dashboard_cache` store.
- **Self-check**: same shape as Phase 5, for the parent-facing screens.

## Final pass

Re-verify all phases together on a real device build (not just isolated
per-phase tests), confirm no regression to anything already working,
version bump, build both APKs, commit, push.
