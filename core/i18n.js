/* ════════════════════════════════════════
   i18n.js — Multi-language Support
   Languages: English · Hindi · Marathi
   Global: I18N
════════════════════════════════════════ */

const I18N = (() => {
  const translations = {
    en: {
      'home.title'      : 'Select Class & Subject',
      'home.sub'        : 'Choose your batch to begin',
      'subjects'        : 'Subjects',
      'chapters'        : 'Chapters',
      'correct'         : 'Correct!',
      'wrong'           : 'Wrong! Correct answer:',
      'next'            : 'Next →',
      'prev'            : '← Prev',
      'skip'            : 'Skip ⊘',
      'results.title'   : 'Session Complete!',
      'results.correct' : 'Correct',
      'results.wrong'   : 'Wrong',
      'results.skipped' : 'Skipped',
      'results.time'    : 'Time',
      'retry'           : '🔄 Retry',
      'revision'        : '🔖 Revision Mode',
      'export.pdf'      : '📄 Export PDF',
      'home.btn'        : '🏠 Home',
      'loading'         : 'Loading...',
      'no.questions'    : 'No questions found. Add questions in Admin panel.',
      'weak.only'       : 'Showing weak/flagged questions only',
      'shuffle.on'      : 'Shuffle ON',
      'shuffle.off'     : 'Shuffle OFF',
      'timer.reveal'    : 'Time up! Revealing answer...',
      'flagged'         : 'Question flagged for revision',
      'unflagged'       : 'Flag removed',
      'splash.tagline'  : 'Smart MCQ Teaching Platform',
      'admin.pin.error' : '❌ Wrong PIN. Try again.',
      'import.success'  : '✅ Imported {n} questions successfully',
      'import.dup'      : '⚠️ {n} duplicates skipped',
      'save.success'    : '✅ Question saved',
      'delete.confirm'  : 'Delete this question?',
      'reset.confirm'   : 'Reset ALL data? This cannot be undone!',
      'pin.saved'       : '✅ PIN updated',
      'no.batches'      : 'No classes found',
      'fib.placeholder' : 'Type your answer...',
      'fib.submit'      : 'Submit ↵',
      'revision.mode'   : 'Revision Mode',
      'practice.mode'   : 'Practice',
    },

    hi: {
      'home.title'      : 'कक्षा और विषय चुनें',
      'home.sub'        : 'शुरू करने के लिए अपनी बैच चुनें',
      'subjects'        : 'विषय',
      'chapters'        : 'अध्याय',
      'correct'         : 'सही है! ✅',
      'wrong'           : 'गलत! सही उत्तर:',
      'next'            : 'अगला →',
      'prev'            : '← पिछला',
      'skip'            : 'छोड़ें ⊘',
      'results.title'   : 'सत्र पूरा हुआ!',
      'results.correct' : 'सही',
      'results.wrong'   : 'गलत',
      'results.skipped' : 'छोड़े',
      'results.time'    : 'समय',
      'retry'           : '🔄 फिर से',
      'revision'        : '🔖 दोहराएं',
      'export.pdf'      : '📄 PDF निर्यात',
      'home.btn'        : '🏠 होम',
      'loading'         : 'लोड हो रहा है...',
      'no.questions'    : 'कोई प्रश्न नहीं मिला। Admin panel में प्रश्न जोड़ें।',
      'weak.only'       : 'केवल कमज़ोर/चिह्नित प्रश्न दिखा रहे हैं',
      'shuffle.on'      : 'शफल चालू',
      'shuffle.off'     : 'शफल बंद',
      'timer.reveal'    : 'समय खत्म! उत्तर दिखा रहे हैं...',
      'flagged'         : 'प्रश्न दोहराने के लिए चिह्नित किया',
      'unflagged'       : 'चिह्न हटा दिया',
      'splash.tagline'  : 'स्मार्ट MCQ टीचिंग प्लेटफ़ॉर्म',
      'admin.pin.error' : '❌ गलत PIN। फिर से प्रयास करें।',
      'import.success'  : '✅ {n} प्रश्न सफलतापूर्वक आयात किए',
      'import.dup'      : '⚠️ {n} डुप्लिकेट छोड़े गए',
      'save.success'    : '✅ प्रश्न सहेजा गया',
      'delete.confirm'  : 'यह प्रश्न हटाएं?',
      'reset.confirm'   : 'सभी डेटा रीसेट करें? यह वापस नहीं किया जा सकता!',
      'pin.saved'       : '✅ PIN अपडेट किया गया',
      'no.batches'      : 'कोई कक्षा नहीं मिली',
      'fib.placeholder' : 'अपना उत्तर टाइप करें...',
      'fib.submit'      : 'जमा करें ↵',
      'revision.mode'   : 'पुनरावृत्ति मोड',
      'practice.mode'   : 'अभ्यास',
    },

    mr: {
      'home.title'      : 'वर्ग आणि विषय निवडा',
      'home.sub'        : 'सुरू करण्यासाठी आपला बॅच निवडा',
      'subjects'        : 'विषय',
      'chapters'        : 'प्रकरणे',
      'correct'         : 'बरोबर! ✅',
      'wrong'           : 'चुकीचे! बरोबर उत्तर:',
      'next'            : 'पुढे →',
      'prev'            : '← मागे',
      'skip'            : 'वगळा ⊘',
      'results.title'   : 'सत्र पूर्ण!',
      'results.correct' : 'बरोबर',
      'results.wrong'   : 'चुकीचे',
      'results.skipped' : 'वगळले',
      'results.time'    : 'वेळ',
      'retry'           : '🔄 पुन्हा प्रयत्न',
      'revision'        : '🔖 उजळणी मोड',
      'export.pdf'      : '📄 PDF निर्यात',
      'home.btn'        : '🏠 मुख्यपृष्ठ',
      'loading'         : 'लोड होत आहे...',
      'no.questions'    : 'प्रश्न सापडले नाहीत. Admin panel मध्ये प्रश्न जोडा.',
      'weak.only'       : 'फक्त कमकुवत/चिन्हांकित प्रश्न दाखवत आहे',
      'shuffle.on'      : 'शफल चालू',
      'shuffle.off'     : 'शफल बंद',
      'timer.reveal'    : 'वेळ संपली! उत्तर दाखवत आहे...',
      'flagged'         : 'प्रश्न उजळणीसाठी चिन्हांकित केला',
      'unflagged'       : 'चिन्ह काढले',
      'splash.tagline'  : 'स्मार्ट MCQ टीचिंग प्लॅटफॉर्म',
      'admin.pin.error' : '❌ चुकीचा PIN. पुन्हा प्रयत्न करा.',
      'import.success'  : '✅ {n} प्रश्न यशस्वीरित्या आयात केले',
      'import.dup'      : '⚠️ {n} डुप्लिकेट वगळले',
      'save.success'    : '✅ प्रश्न जतन केला',
      'delete.confirm'  : 'हा प्रश्न हटवायचा?',
      'reset.confirm'   : 'सर्व डेटा रीसेट करायचा? हे परत करता येणार नाही!',
      'pin.saved'       : '✅ PIN अपडेट केला',
      'no.batches'      : 'कोणतेही वर्ग सापडले नाहीत',
      'fib.placeholder' : 'आपले उत्तर टाइप करा...',
      'fib.submit'      : 'सबमिट करा ↵',
      'revision.mode'   : 'उजळणी मोड',
      'practice.mode'   : 'सराव',
    },
  };

  let currentLang = 'en';

  const LANGS = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'हिंदी',   flag: '🇮🇳' },
    { code: 'mr', label: 'मराठी',   flag: '🏵️' },
  ];

  // ════════════════════════
  // CORE
  // ════════════════════════

  function t(key, vars = {}) {
    const lang = translations[currentLang] || translations.en;
    let str    = lang[key] || translations.en[key] || key;
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v);
    }
    return str;
  }

  function getLang() { return currentLang; }

  function setLang(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    document.documentElement.lang = lang;
    document.body.setAttribute('data-lang', lang);
    DB.setSetting('lang', lang);
    applyToDOM();
  }

  function cycleLang() {
    const idx  = LANGS.findIndex(l => l.code === currentLang);
    const next = LANGS[(idx + 1) % LANGS.length];
    setLang(next.code);
    return next;
  }

  function applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
  }

  async function init() {
    currentLang = await DB.getSetting('lang', 'en');
    applyToDOM();
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return { t, setLang, getLang, init, cycleLang, LANGS };
})();

window.I18N = I18N;
