# 🔢 Version Bump Checklist — कोणत्या files मध्ये version बदलायचं

> पुढच्या release ला फक्त ही file उघडा, खालचे ६ ठिकाणं बदला. Search करायची गरज नाही.

**सध्याची version (last updated 2026-09-03):** `7.4.29` · versionCode `126` · SW `v126`

---

## ✋ MANUAL — हे ५ ठिकाणं स्वतः बदलायचे

| # | File | Line | काय बदलायचं | उदाहरण |
|---|------|------|-------------|--------|
| 1 | `env.js` | 2 | `window.APP_VERSION = 'X.X.X'` | `'7.0.0'` |
| 2 | `package.json` | 3 | `"version": "X.X.X"` | `"7.0.0"` |
| 3 | `build-student.bat` | 7–8 | `set VERSION=X.X.X` **+** `set VERSION_CODE=XX` | `7.0.0` / `70` |
| 4 | `build-admin.bat` | 7–8 | `set VERSION=X.X.X` **+** `set VERSION_CODE=XX` | `7.0.0` / `70` |
| 5 | `sw.js` | 1 | `const SW_VERSION = 'vXX'` (**+1**) | `v44` → `v45` |

> ⚠️ दोन्ही `.bat` files मध्ये VERSION **same** ठेवा.

---

## 🤖 AUTO-PATCHED — यांना हात लावू नका

`build-student.bat` / `build-admin.bat` चालवल्यावर हे आपोआप patch होतात (VERSION + VERSION_CODE मधून):

| File | काय auto होतं | Note |
|------|---------------|------|
| `android/app/build.gradle` | `versionCode` + `versionName` | **gitignored** — manually edit/commit करू नका |
| `env.js` (APP_VERSION) | bat पुन्हा patch करते | पण #1 मध्ये manually पण ठेवा (web deploy साठी) |

> ⚠️ **APK build करण्याआधी `build-student.bat` चालवणं mandatory** — नाहीतर `build.gradle` जुन्या version वर राहील.

---

## 🚫 VERSION नसतं — इथे काही बदलायचं नाही

- `capacitor.config.ts`, `capacitor-student.config.ts`, `capacitor-admin.config.ts` → फक्त `appId` / `appName` (version नाही)
- `TeachingBoard-backend/package.json` → backend version (`1.0.0`), user-facing नाही, बदलायची गरज नाही

---

## 📏 नियम

- **versionCode** दर release ला **वाढलाच पाहिजे** (Android install साठी). Pattern: major × 10 → `5.0.x=51`, `6.0.0=60`, `7.0.0=70`.
- **SW_VERSION** — कोणताही JS/CSS/HTML बदलला तर **+1** mandatory (नाहीतर users ला जुने cached files मिळतात).
- **Semver:** bug fix → `x.x.+1` · नवीन feature → `x.+1.0` · मोठा redesign → `+1.0.0`

---

## 🚀 Release order (थोडक्यात)

1. Code changes + verify
2. वरचे ६ ठिकाणं बदला (ही file बघून)
3. `git commit` + `git push` (frontend **आणि** backend दोन्ही)
4. Backend changes असतील → Render auto-deploy होतो (env vars set आहेत का बघा)
5. `build-student.bat` चालवा → Android Studio → Signed APK
6. `build-admin.bat` (फक्त `admin-app/`, `core/`, `sw.js` बदलले असतील तर)
7. GitHub Release: tag `vX.X.X` + APK upload
8. Admin app → App Updates → GitHub वरून Fetch → Save

---

## 📜 Version इतिहास

| Version | versionCode | SW | तारीख | काय |
|---------|-------------|----|-------|-----|
| 5.0.1 | 51 | v43 | 2026-06-29 | Login bug fixes |
| 6.0.0 | 60 | v43 | — | (bat मध्ये set, build न करता) |
| **7.0.0** | **70** | **v44** | **2026-06-30** | Razorpay subscriptions, self-registration, SLS fixes |
| ... | ... | ... | ... | (history gap — table not kept current between 7.0.0 and 7.3.0) |
| **7.4.0** | **97** | **v97** | **2026-08-13** | MCQ Mixed Test Paper Builder + Paper Pattern, YouTube Teacher Partner Portal, Android TV remote support, --text1 CSS contrast fix |
| **7.4.1** | **98** | **v98** | **2026-08-13** | Live-testing fixes: random-pick order shuffle, 4 explicit Paper Modes (Regular/Whole Chapter/Whole Subject/Paper Pattern), labeled section fields, AI bulk-paste prompt, visible Pattern Name field |
| **7.4.2** | **99** | **v99** | **2026-08-13** | Mixed-test student visibility fix, Subject-optional for Paper Pattern, Exam Instructions gate + AI pattern import, PDF export margin fix + realistic layout (Roll No/Seat No box, 2-column, question/option images) |
| **7.4.3** | **100** | **v100** | **2026-08-15** | Exercise Manager Preview/Publish/PDF + optional diagram upload, Notes PDF export, markdown table support, new 📚 Books tab (Notes/Exercise/Subject-wise/Chapter-wise/Paper Pattern Books with hard page-break-per-section + printed-workbook style) |
| **7.4.4** | **101** | **v101** | **2026-08-15** | Notes Book fix: Revision-Box-only / Exam-Tags-only notes were silently dropped as "empty" (real bug found live testing 8th NMMS batch) |
| **7.4.5** | **102** | **v102** | **2026-08-15** | Notes Book follow-up: a bare examTags tag alone no longer counts as "content" — was letting title-only stub notes through as a practically-blank PDF (real bug, found from an actual generated PDF) |
| **7.4.6** | **103** | **v103** | **2026-08-15** | Books real root-cause fix: Notes Book was reading the concept LIST endpoint (title/tags only, backend deliberately strips content) instead of fetching each concept's full detail — real content was never being read at all. Also fixed silent 20-item pagination truncation on the Exercise questions endpoint (Books + Exercise Manager) |
| **7.4.7** | **104** | **v104** | **2026-08-16** | Notes Book: fixed half-empty pages — dropped multi-column note-body layout (both CSS auto-balance and a fixed grid left visible empty space with real, unevenly-sized content); single column now, no gaps |
| **7.4.8** | **105** | **v105** | **2026-08-16** | PDF exports (Exercise/Quiz/Notes) now render KaTeX math instead of printing raw $...$ LaTeX text — real bug found from an actual exported PDF ("acceleration of $2,m/s^2$" printed literally) |
| **7.4.9** | **106** | **v106** | **2026-08-16** | YouTube Teacher Portal: real embedded video preview on both admin Approvals (was plain text link, admin couldn't see the video before approving) and teacher's Add Exercise Video screen (was no preview at all before submitting) |
| **7.4.10** | **107** | **v107** | **2026-08-16** | YouTube Teacher Portal "My Videos": added Edit button (was missing entirely — approved videos couldn't be edited at all). Reuses existing backend live/pending-edit pattern — editing an approved video locks Batch/Subject/Chapter/Exercise/Part (identity), lets teacher change only the link, resubmits to pending, and the old approved video stays visible to students until the edit is re-approved |
| **7.4.11** | **108** | **v108** | **2026-08-16** | Admin "YouTube Teachers → Video Gaps" Subject dropdown was rendering blank/empty options — real bug found live: it read subjects as `{name}` objects but `GET /batches` returns them as plain strings; fixed the mapping |
| **7.4.12** | **109** | **v109** | **2026-08-16** | YouTube Teacher videos now support Notes Concepts, not just Exercises: Add Video form gets an Exercise/Concept toggle; My Teaching Areas gets a "View Content" list (every Exercise+Concept in a Subject, ✅ marks what you've covered, tap to add/edit); Notes concept screen gets the same "🎬 N Videos Available" button exercises already have; Admin Approvals shows Concept videos correctly |
| **7.4.13** | **110** | **v110** | **2026-08-16** | YouTube Teacher plan pricing is now admin-editable (Admin → YouTube Teachers → ⚙️ Plan Pricing) — was hardcoded in backend code with no admin UI at all; Teacher Portal landing page + plan-select screen now show the live admin-configured prices instead of static ₹499/₹3999/₹199/3-day text |
| **7.4.14** | **111** | **v111** | **2026-08-17** | Exercise question/answer labels now match the actual content language instead of always Marathi — real bug found live: an English-only question printed with a Marathi "प्रश्न N." label; now "Q N."/"Answer" for English content, "प्रश्न N."/"उत्तर" for Marathi, in both the Exercise PDF export and admin Exercise Manager's question lists |
| **7.4.15** | **112** | **v112** | **2026-09-02** | Admin Classes: Subject and Chapter names had no Edit button (only add/delete) — added Edit everywhere, backed by new rename endpoints that cascade the name into every collection that stores it, including the composite chapterId (SLSQuestion/Concept) so existing Notes/Exercises stay linked instead of orphaning |
| **7.4.16** | **113** | **v113** | **2026-09-02** | Student Notes: added a "Next →" button beside "← Back" on a concept — moves to the next concept in the chapter's list directly (reuses viewConcept), only shown when one exists |
| **7.4.17** | **114** | **v114** | **2026-09-02** | Student bottom nav: moved Notes out from under Words (was vocab-tab-notes, nested inside the Words screen's own tab bar) to its own "Notes" tab in the main bottom navigation, alongside Home/Stats/Board/Words/Exercise/Me |
| **7.4.18** | **115** | **v115** | **2026-09-02** | Home search (new): one search bar on Home finds both Notes concepts and Exercise questions together — new backend text-search endpoint for Exercise questions (Notes/concept search already existed), new homeSearch.js combining both, clicking a result jumps straight to that concept or scrolls to + highlights that exact question |
| **7.4.19** | **116** | **v116** | **2026-09-03** | Real bug found live: deleted "Std N" demo batches kept coming back. `initDefaultBatches()` was reseeding 6 hardcoded demo batches (Std 5-10) on any fresh/cleared local storage, guarded by a flag stored in that SAME storage — cache-clear/reinstall wiped the guard too, so it looked like "never seeded" and reseeded. App has real admin-managed batches now; demo seeding permanently disabled (no-op) |
| **7.4.20** | **117** | **v117** | **2026-09-03** | Admin Concepts (SLS): new "📚 Auto-fill Lesson (सगळे Concepts)" — paste a whole multi-concept lesson file (split on "# Concept N: Title" headings) and it creates every concept as a Draft in one go, reusing the existing single-concept parser per chunk + existing-title dedup. Existing single-concept "✨ Auto-fill करा" untouched |
| **7.4.21** | **118** | **v118** | **2026-09-03** | Admin Concepts (SLS) editor had no way back to the list without scrolling to a buried "Cancel" button — added a "← Back to list" + "Next: <title> →" bar at the top of the editor (Next moves to the following concept in the current chapter's list — useful for reviewing/publishing a batch just created via Bulk Lesson Import one after another) |
| **7.4.22** | **119** | **v119** | **2026-09-03** | Real bug found live right after 7.4.21 shipped: Publish/Save was force-closing the concept editor back to the list (it reused `_onChapterChange`, which was built for actual chapter-dropdown switches and unconditionally hides the editor), defeating the "Next" button added in 7.4.21. Extracted a non-disruptive `_refreshConceptsList()` so Publish/Save now reloads the list in the background but keeps the editor open — Next can now actually be used to review a batch of concepts one after another (e.g. after Bulk Lesson Import) |
| **7.4.23** | **120** | **v120** | **2026-09-03** | Real bug found live: a newly-added Exercise (e.g. Mathematics I → Linear Equations in Two Variables) never showed up in the student app — "Select Subject" rendered completely empty. Root cause: the student app's local Subject/Chapter dropdowns were built only from `DB.syncHierarchyFromExisting()`, which reconstructs the hierarchy purely from locally-cached legacy MCQ Question/Quiz data — a subject/chapter with only Notes/Exercise content (no MCQ quiz ever cached) never made it in. `GET /batches` already has the real catalog but is teacher/admin-only and includes pricing. Added a new student-safe `GET /batches/student/hierarchy` (own assigned batches only, no pricing) + a matching client-side sync, called at Home load/refresh alongside the existing local repair pass |
| **7.4.24** | **121** | **v121** | **2026-09-03** | Student Notes had no Subject selection — every subject's chapters rendered together in one mixed grid (Std 9/10, Science/Maths all combined, no way to narrow down). Added a Subjects grid as the new top level (grouped by batch+subject, so a same-named subject in two different batches — e.g. two different "Science I"s — stays correctly separated), then that subject's Chapters, then Concepts as before. Back/title/search-clear all updated to match the new level. Verified with a Playwright harness against the real module, including the same-subject-different-batch isolation case |
| **7.4.25** | **122** | **v122** | **2026-09-03** | Admin Exercise Manager: real bug found live — deleting several questions then re-adding the same ones via Auto-fill wrongly reported them all as "already existed" (duplicates skipped), even though the deletes had genuinely gone through on the server. Root cause: each Delete click's list-refresh is an independent fetch, and an earlier click's slower response could resolve AFTER a later click's, silently overwriting the current (correct) in-memory list with stale (pre-delete) data — a classic out-of-order-response race, more likely the more questions were deleted in quick succession. Fixed with a monotonic request-token guard so only the most-recently-started refresh's response is ever applied. Verified with a Playwright test that deterministically reproduces the exact race (an engineered stale-but-slow response vs a fresh-but-fast one) and confirms the fresh one always wins |
| **7.4.26** | **123** | **v123** | **2026-09-03** | Admin Exercise Manager: new questions (Manual Save + Auto-fill) were saved with `status:'published'` — live to students immediately, before the "Publish All" button was ever clicked. User confirmed this wasn't intended (asked directly, given it changes when students see new content) — changed both creation paths to `status:'draft'`, matching the "Publish All" button's own implied workflow and the same draft-first pattern already used by Concepts/Notes. Verified with a Playwright test confirming both paths now create as draft |
| **7.4.27** | **124** | **v124** | **2026-09-03** | Admin Exercise Manager: added "🗑 Delete Exercise" — deletes every question under the currently-selected Exercise No. in one go (confirm dialog shows the count first), instead of having to delete each question one at a time. Loops the existing single-question delete endpoint (no new bulk-delete API), then refreshes the Exercise No. chip list so the emptied one drops out on its own. New `.btn-danger` style added (matches the existing lightweight `.btn`/`.btn-small` system used by its sibling Preview/PDF buttons). Verified with a Playwright test: declining the confirm deletes nothing; confirming deletes only the selected Exercise No.'s questions and leaves a sibling Exercise No. untouched |
| **7.4.28** | **125** | **v125** | **2026-09-03** | Student app: real gap found — the app never called `navigator.storage.persist()`, so Android/Chrome could opportunistically evict the offline Notes/Exercise IndexedDB cache under storage pressure, most noticeable after fully closing and reopening the app ("cached content works once, then disappears"). Now requested once at startup, best-effort/fire-and-forget — degrades the same as before if unsupported or denied |
| **7.4.29** | **126** | **v126** | **2026-09-03** | Student app: added a one-time background "full offline sync" — right after login/home-load, every Note's full content + every Exercise question for the student's own batch(es) downloads and caches in one background pass (non-blocking, student keeps using the app meanwhile), instead of needing to open each one individually while online first. Backed by a new single-request backend endpoint (`GET /sls/full-sync`, own commit in TeachingBoard-backend) rather than one request per chapter. Runs once per assigned-batch set (tracked locally), safely re-attempts later if a previous try never completed (e.g. no internet at the time). Verified with a Playwright test: no-batches no-ops, first run caches everything and sets the flag, a repeat run with the same batches is skipped, a changed batch set re-runs |
