# ✅ v5.0.1 पासून झालेले सर्व बदल — Verification Checklist

> Build: v7.0.1 (code 71, SW auto-tied to versionCode). प्रत्येक item DevTools (CDP) + device वर verify करायचा.

## 🔧 Build / Release (bat files, APK)
- [ ] Admin applicationId = `com.teachingboard.admin`, Student = `com.nkseduorbit.student` (वेगळे — replace होत नाही)
- [ ] versionName/versionCode खरंच patch होतात (cmd.exe caret-escaping बग fixed)
- [ ] APK finalize self-verifying (चुकीचं "ready" दाखवत नाही)
- [ ] gradle-daemon-jvm.properties auto-cleanup (CLI build अडत नाही)
- [ ] SW_VERSION आता प्रत्येक build ला auto `v${versionCode}` होतो (cache guaranteed bust)

## 📱 Frontend — Offline / SW
- [ ] SW precache मध्ये notesViewer.js/.css, conceptManager.js, batchPricingManager.js + css सर्व आहेत
- [ ] जुनी `teachingboard-*` cache नवीन SW activate वर आपोआप delete होते

## 📝 Notes feature (मोठा rewire)
- [ ] PDF notes (notesPlayer.js) पूर्ण काढला — student-app + admin-app दोन्हीकडून
- [ ] Student "Notes" tab → SLS concept viewer उघडतो (screen-notes)
- [ ] `window.NOTES_VIEWER` global expose (inline onclick काम करतात)
- [ ] notesViewer raw `fetch()` ऐवजी API wrapper वापरतो (Android वर चालतो, auth token जातो)
- [ ] notesViewer योग्य DB methods वापरतो (getAllBatches/getChaptersByBatchSubject)
- [ ] नवीन backend `GET /api/sls/chapters` — chapters list दाखवतो
- [ ] Chapters क्लिक → concepts लोड होतात (`GET /api/sls/chapters/:id/concepts`)

## 🐛 window.APP dead-code bug (5 ठिकाणी fix)
- [ ] payment.js `_toast()` — आता दिसतो (आधी दोन्ही branch नेहमी false होते)
- [ ] vocabPlayer.js Notes tab navigate — काम करतं
- [ ] vocabPlayer.js back button loadHome — काम करतं
- [ ] wordTestPlayer.js 3 error toasts — दिसतात

## 🐛 Classes/Batches reseed bug
- [ ] Admin सर्व demo classes (Std 5-10) delete करतो → app restart करूनही परत येत नाहीत
- [ ] Factory "Reset All" केलं तरच परत seed होतात (intended)

## 🆕 नवीन feature — Teacher ला Unassigned Students Assign
- [ ] Backend: `GET /api/teachers/unassigned-students`
- [ ] Admin Teachers screen वर "☑️ Pick Unassigned Students" बटण
- [ ] Modal उघडतो, search करता येतो, checkbox निवडता येतात
- [ ] "Assign Selected" — existing teacher असेल तर लगेच save होतं
- [ ] नवीन teacher (unsaved) असेल तर textarea मध्ये codes भरतात

## 🧹 Cleanup (functional impact नाही, पण verify)
- [ ] Admin "Notes" (जुना PDF upload) nav entry गायब
- [ ] dead `js/` folder (14 files) काढलेले — काहीही तुटलेलं नाही
- [ ] Windows/Electron build पूर्ण काढलेला

## ⚙️ Backend performance
- [ ] wordController vocab-scores — N+1 नाही (batched query)
- [ ] studentController expiry-propagation — N+1 नाही (batched + bulkWrite)

---
## Verification method
प्रत्येक item Chrome DevTools (CDP, port 9222 forward) + प्रत्यक्ष click द्वारे तपासायचा, त्यानंतर screenshot/log नोंदवायचा.
