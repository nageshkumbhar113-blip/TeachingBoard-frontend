# 🔢 Version Bump Checklist — कोणत्या files मध्ये version बदलायचं

> पुढच्या release ला फक्त ही file उघडा, खालचे ६ ठिकाणं बदला. Search करायची गरज नाही.

**सध्याची version (last updated 2026-09-02):** `7.4.16` · versionCode `113` · SW `v113`

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
