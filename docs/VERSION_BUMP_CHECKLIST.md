# 🔢 Version Bump Checklist — कोणत्या files मध्ये version बदलायचं

> पुढच्या release ला फक्त ही file उघडा, खालचे ६ ठिकाणं बदला. Search करायची गरज नाही.

**सध्याची version (last updated 2026-08-13):** `7.4.1` · versionCode `98` · SW `v98`

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
