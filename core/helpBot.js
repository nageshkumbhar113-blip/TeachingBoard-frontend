/* ════════════════════════════════════════
   helpBot.js — "❓ मदत / Help" on the login pages (student app / website, shop panel)
   Global: HELP_BOT (and HELP_DEFAULTS for Admin > 🤖 Help)

   No AI and no paid service: ready answers with buttons, in मराठी or English
   (switch at the top; the phone remembers it). The admin can change the
   answers (Admin > 🤖 Help); the phone keeps the last copy for offline.
   "Code / PIN विसरलो": name + parent's mobile + THIS phone (the account must be
   bound to it) are checked on the server; then the code is shown and a new PIN
   can be set here. Otherwise (new phone, teacher, shop) a request goes to the admin.
════════════════════════════════════════ */

const HELP_DEFAULTS = [
  { id: 'login', icon: '🔑', title: 'Login / Code / PIN', title_en: 'Login / Code / PIN', items: [
    { id: 'forgot', action: 'forgot',
      q: 'Student Code / PIN विसरलो', a: 'नाव, पालकांचा नंबर आणि हा phone तपासून तुमचा code दाखवतो आणि नवीन PIN ठेवता येतो.',
      q_en: 'I forgot my Student Code / PIN', a_en: 'We check the name, the parent\'s number and this phone, then show your code and let you set a new PIN.' },
    { id: 'move', action: 'move',
      q: '📱 हे app नवीन phone वर वापरायचं आहे', a: 'हे जुन्या phone वरूनच करा (ज्या phone वर आत्ता app चालतं). नाव आणि पालकांचा नंबर तपासल्यावर account नवीन phone साठी मोकळं होतं; या phone वरून logout होईल आणि इथली सगळी माहिती पुसली जाईल. मग नवीन phone वर Student Code + PIN ने login करा. जुना phone हरवला / बंद असेल तर Admin ला request पाठवा.',
      q_en: '📱 I want to use this app on a new phone', a_en: 'Do this from the OLD phone (the one where the app works now). After the name and the parent\'s number are checked, the account is freed for the new phone; this phone is logged out and its saved data is erased. Then log in on the new phone with the Student Code + PIN. If the old phone is lost or dead, send a request to the admin.' },
    { id: 'bound', action: 'request',
      q: '"दुसऱ्या phone ला जोडलेलं आहे" असं येतं', a: 'एक account एका phone वर चालतं. जुना phone हातात असेल तर त्या phone वरच्या app मध्ये ❓ मदत → "📱 हे app नवीन phone वर वापरायचं आहे" करा. जुना phone हरवला असेल तर खालचं "Admin ला request पाठवा" दाबा — admin जुना phone काढून नवीन PIN पाठवतील.',
      q_en: 'It says "linked to another phone"', a_en: 'One account works on one phone. If you still have the old phone, open ❓ Help in the app there → "📱 I want to use this app on a new phone". If the old phone is lost, tap "Send a request to the admin" below — the admin will remove the old phone and send you a new PIN.' },
    { id: 'wrong',
      q: 'Login ला "चुकीचा code / PIN" येतं', a: 'Code मोठ्या इंग्रजी अक्षरात आहे का पाहा (उदा. RAH123). PIN 4 अंकी आहे. आठवत नसेल तर "Student Code / PIN विसरलो" वापरा.',
      q_en: 'Login says "wrong code / PIN"', a_en: 'Check the code is in capital letters (e.g. RAH123). The PIN has 4 digits. If you do not remember it, use "I forgot my Student Code / PIN".' },
    { id: 'parent', action: 'parent',
      q: 'Parent म्हणून login कसं करायचं?', a: 'Login मध्ये "👨‍👩‍👧 Parent" निवडा आणि पाल्याचाच Student Code आणि PIN टाका.',
      q_en: 'How do parents log in?', a_en: 'On the login screen choose "👨‍👩‍👧 Parent" and enter the child\'s Student Code and PIN.' },
    { id: 'teacher', action: 'request_teacher',
      q: 'Teacher / दुकानाचा PIN विसरलो', a: 'नाव आणि mobile नंबर पाठवा — admin नवीन PIN WhatsApp वर पाठवतील.',
      q_en: 'Teacher / shop forgot the PIN', a_en: 'Send your name and mobile number — the admin will send a new PIN on WhatsApp.' },
  ] },
  { id: 'register', icon: '🆕', title: 'Registration', title_en: 'Registration', items: [
    { id: 'how', action: 'register',
      q: 'Register कसं करायचं?', a: 'Login screen वर "🆕 Register" → नाव, पालकांचा नंबर, शाळा, class → 4 अंकी PIN ठेवा → Student Code मिळेल. तो code लिहून ठेवा.',
      q_en: 'How do I register?', a_en: 'On the login screen tap "🆕 Register" → name, parent\'s number, school, class → choose a 4-digit PIN → you get a Student Code. Write the code down.' },
    { id: 'exists', action: 'forgot',
      q: '"हा student आधीच registered आहे" येतं', a: 'याच नंबरवर हे नाव आधी registered आहे. "Student Code / PIN विसरलो" वापरून तुमचा code मिळवा.',
      q_en: 'It says "this student is already registered"', a_en: 'This name is already registered on this number. Use "I forgot my Student Code / PIN" to get your code.' },
    { id: 'code',
      q: 'Teacher / दुकानाचा code कुठे टाकायचा?', a: 'Register करताना "Teacher किंवा मित्राचा code" मध्ये टाका. आधीच account असेल तर Home वरच्या "👩‍🏫 माझे Teachers" मध्ये teacher code टाका.',
      q_en: 'Where do I enter a teacher / shop code?', a_en: 'While registering, in "Teacher or friend code". If you already have an account, enter the teacher code in the "👩‍🏫 माझे Teachers" (My Teachers) card on Home.' },
    { id: 'class', action: 'admin',
      q: 'माझा class चुकला / बदलायचा आहे', a: 'Admin class बदलून देतील.',
      q_en: 'My class is wrong / I want to change it', a_en: 'The admin will change the class for you.' },
  ] },
  { id: 'pay', icon: '💳', title: 'Payment / Subscription', title_en: 'Payment / Subscription', items: [
    { id: 'price',
      q: 'किती पैसे आहेत? कोणते plans?', a: 'प्रत्येक class ची किंमत app मध्ये 🔒 chapter वर tap केल्यावर दिसते. Monthly आणि Yearly plans आहेत — Yearly स्वस्त पडतो.',
      q_en: 'How much does it cost? Which plans?', a_en: 'Each class\'s price shows when you tap a 🔒 chapter in the app. There are Monthly and Yearly plans — Yearly works out cheaper.' },
    { id: 'free',
      q: 'काय free आहे?', a: 'प्रत्येक विषयाचा पहिला chapter free — notes, exercise आणि tests. दर आठवड्याचा महा-Test पण free. Login न करता "🎁 Free tests try करा" पण आहे.',
      q_en: 'What is free?', a_en: 'The first chapter of every subject is free — notes, exercise and tests. The weekly Maha-Test is free too, and "🎁 Try free tests" works without logging in.' },
    { id: 'howpay',
      q: 'Payment कसं करायचं?', a: '🔒 chapter → Plan निवडा → सुरक्षित payment page (Razorpay): UPI / Card / Net banking.',
      q_en: 'How do I pay?', a_en: '🔒 chapter → choose a plan → secure payment page (Razorpay): UPI / Card / Net banking.' },
    { id: 'cut', action: 'admin',
      q: 'पैसे कापले पण chapters उघडले नाहीत', a: 'बहुतेक वेळा काही मिनिटांत आपोआप उघडतं. Login करून Home खाली ओढा (refresh). 15 मिनिटांनी पण नाही उघडलं तर Admin ला कळवा — payment ची वेळ आणि रक्कम लिहा.',
      q_en: 'Money was taken but chapters did not open', a_en: 'It usually opens by itself within a few minutes. Log in and pull Home down to refresh. If it is still locked after 15 minutes, tell the admin — write the payment time and amount.' },
    { id: 'expiry',
      q: 'Plan केव्हा संपतो?', a: 'Login केल्यावर Me → Profile मध्ये शेवटची तारीख दिसते. संपण्याआधी app आठवण करून देतं.',
      q_en: 'When does my plan end?', a_en: 'After logging in, see Me → Profile for the end date. The app reminds you before it ends.' },
    { id: 'refund', action: 'refund',
      q: 'Refund मिळेल का?', a: 'Refund चे नियम Refund Policy पानावर आहेत.',
      q_en: 'Can I get a refund?', a_en: 'The refund rules are on the Refund Policy page.' },
    { id: 'offer',
      q: '50% offer कोणाला मिळतो?', a: 'Free test पूर्ण केल्यावर पहिल्या payment वर 24 तासांसाठी. नंतरचे payments पूर्ण किमतीत.',
      q_en: 'Who gets the 50% offer?', a_en: 'After finishing a free test — on the first payment, for 24 hours. Later payments are at the full price.' },
  ] },
  { id: 'app', icon: '📱', title: 'App वापर', title_en: 'Using the app', items: [
    { id: 'offline',
      q: 'Internet नसताना चालतं का?', a: 'हो — एकदा उघडलेले notes आणि tests offline पण चालतात.',
      q_en: 'Does it work without internet?', a_en: 'Yes — notes and tests you opened once also work offline.' },
    { id: 'missing', action: 'play',
      q: 'Notes / tests दिसत नाहीत', a: 'Internet चालू करून Home खाली ओढा (refresh). App update आहे का ते Play Store वर पाहा.',
      q_en: 'Notes / tests are not showing', a_en: 'Turn on the internet and pull Home down to refresh. Check the Play Store for an app update.' },
    { id: 'update', action: 'play',
      q: 'App update कसा करायचा?', a: 'Play Store वर "Nks EduOrbit" उघडून Update दाबा.',
      q_en: 'How do I update the app?', a_en: 'Open "Nks EduOrbit" on the Play Store and tap Update.' },
    { id: 'notif',
      q: 'Notification येत नाहीत', a: 'Phone च्या Settings → Apps → Nks EduOrbit → Notifications चालू करा.',
      q_en: 'I do not get notifications', a_en: 'Turn them on in the phone\'s Settings → Apps → Nks EduOrbit → Notifications.' },
  ] },
  { id: 'weekly', icon: '🏆', title: 'महा-Test / Free test', title_en: 'Maha-Test / Free test', items: [
    { id: 'what',
      q: 'महा-Test म्हणजे काय?', a: 'दर आठवड्याला ठराविक वेळी सगळ्या class चा free test. Result वेळी rank list आणि Top 10 Home वर दिसतात.',
      q_en: 'What is the Maha-Test?', a_en: 'A free test for the whole class every week at a fixed time. At result time the rank list and the Top 10 show on Home.' },
    { id: 'reg',
      q: 'महा-Test ला register कसं करायचं?', a: 'Home वरच्या 🏆 महा-Test card वर "Register करा". वेळ झाली की तिथे "सुरू करा" येईल.',
      q_en: 'How do I register for the Maha-Test?', a_en: 'Tap "Register" on the 🏆 Maha-Test card on Home. At the start time a "Start" button appears there.' },
    { id: 'hidden', action: 'admin',
      q: 'माझं नाव toppers मध्ये लपवलेलं का?', a: 'पहिल्या registration वेळी "माझं नाव दाखवा" tick केलं नसेल तर नाव लपवलं जातं. बदलायचं असेल तर Admin ला सांगा.',
      q_en: 'Why is my name hidden in the toppers?', a_en: 'If "Show my name" was not ticked at the first registration, the name stays hidden. Ask the admin to change it.' },
  ] },
  { id: 'refer', icon: '🎁', title: 'Refer & Earn', title_en: 'Refer & Earn', items: [
    { id: 'prize',
      q: 'मित्र जोडल्यावर काय मिळतं?', a: 'तुमच्या link ने आलेल्या मित्रांनी pay केलं की बक्षीस: उदा. 5 मित्र → Compass box, 8 → Stationery kit, 15 → School bag. सध्याचे आकडे login करून Me → Refer & Earn मध्ये दिसतात.',
      q_en: 'What do I get for inviting friends?', a_en: 'When friends who came through your link pay, you get prizes: e.g. 5 friends → Compass box, 8 → Stationery kit, 15 → School bag. The current numbers are in Me → Refer & Earn after logging in.' },
  ] },
];

const HELP_BOT = (() => {
  const WHATSAPP = '918390484545';
  const SITE = 'https://nkseduorbit.in';
  const PLAY = 'https://play.google.com/store/apps/details?id=com.nkseduorbit.student';
  const CACHE = 'tb_help_faq';
  const LANG_KEY = 'tb_help_lang';
  const MOVED_KEY = 'tb_moved_to_new_phone';
  let _opts = { role: 'student', api: () => 'https://teachingboard-backend.onrender.com/api' };
  let _faq = null;
  let _layer = null;
  let _lang = (() => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'mr'; } catch { return 'mr'; } })();

  // Words of the bot itself
  const UI = {
    mr: {
      link: '❓ मदत', head: 'मदत · Nks EduOrbit', hello: 'नमस्कार 🙏 कशात मदत हवी आहे? खालून निवडा.', which: 'कोणता प्रश्न?', menu: '⬅ मुख्य menu',
      ok: '👍 झालं, धन्यवाद', okReply: '😊 छान! अजून काही असेल तर menu उघडा.', stuck: '❌ अजून problem आहे → Admin ला कळवा',
      doNow: '🔑 आत्ता करू', sendReq: '📨 Admin ला request पाठवा', reqTeacher: '📨 Teacher म्हणून request', reqShop: '📨 दुकान म्हणून request',
      openReg: '🆕 Register उघडा', openParent: '👨‍👩‍👧 Parent login उघडा', openPlay: '📲 Play Store उघडा', waAdmin: '💬 Admin ला WhatsApp करा',
      waText: (topic, code) => `नमस्कार 🙏 मला NKs EduOrbit मध्ये मदत हवी आहे.\nप्रश्न: ${topic}${code ? `\nStudent Code: ${code}` : ''}\nनाव:\nनंबर:\n(थोडक्यात problem लिहा)`,
      waDone: 'WhatsApp उघडलं — नाव, नंबर आणि problem लिहून पाठवा. Admin लवकरच उत्तर देतील.',
      forgotIntro: 'ठीक आहे. विद्यार्थ्याचं नाव आणि पालकांचा mobile नंबर (register करताना दिलेला) लिहा. हा phone पण तपासला जाईल.',
      studentName: 'विद्यार्थ्याचं नाव', parentMobile: 'पालकांचा mobile', check: '🔍 तपासा', needName: 'नाव लिहा', needMobile: '10 अंकी नंबर लिहा',
      notMatched: '😕 हे नाव आणि नंबर जुळले नाहीत. Register करताना दिलेलं नाव आणि पालकांचा नंबरच लिहा.',
      otherDevice: '📱 नाव आणि नंबर बरोबर आहेत, पण हे account या phone वर नाही — ज्या phone वर student login करतो त्या phone च्या app मधून हेच करा. Phone बदलला / हरवला असेल तर खालून Admin ला request पाठवा.',
      reqNewPin: '📨 Admin ला request पाठवा (नवीन PIN WhatsApp वर)', retry: '🔁 पुन्हा प्रयत्न',
      matched: n => `✅ खात्री झाली! <b>${n}</b> चा Student Code:`, setPin: 'नवीन 4 अंकी PIN ठेवा (10 मिनिटांत):', newPin: 'नवीन PIN', pinAgain: 'PIN पुन्हा',
      savePin: '💾 PIN Save करा', need4: '4 अंकी PIN लिहा', notSame: 'दोन्ही PIN सारखे नाहीत', pinDone: '🎉 PIN बदलला! Code आणि PIN login मध्ये भरले आहेत — "Continue" दाबा.', toLogin: '✅ Login कडे जा',
      who: { student: 'विद्यार्थ्याचं', teacher: 'Teacher चं', shop: 'दुकानाचं / मालकाचं' },
      reqIntro: (who, role) => `${who} नाव आणि ${role === 'student' ? 'पालकांचा' : 'तुमचा'} mobile नंबर लिहा. Admin तपासून नवीन PIN WhatsApp वर पाठवतील.`,
      name: 'नाव', mobile: 'Mobile', codeOpt: 'Code आठवत असेल तर (optional)', send: '📨 Request पाठवा', reqDone: '✅ Request गेली! Admin तपासून नवीन PIN या नंबरवर WhatsApp करतील.',
      eg: 'उदा. Rahul Patil',
      moveIntro: 'हे जुन्या phone वरूनच होतं (ज्या phone वर आत्ता app चालतं). विद्यार्थ्याचं नाव आणि पालकांचा mobile नंबर (register करताना दिलेला) लिहा.',
      moveNotHere: '📱 नाव आणि नंबर बरोबर आहेत, पण हा phone या account ला जोडलेला नाही. Shift फक्त ज्या phone वर app आत्ता चालतं त्याच phone वरून होतं. तो phone हरवला / बंद असेल तर Admin ला request पाठवा.',
      moveMatched: n => `✅ खात्री झाली! <b>${n}</b> चा Student Code (नवीन phone वर हाच टाका):`,
      pinKnow: 'नवीन phone वर login साठी PIN लागेल. PIN आठवतो का?', pinYes: '✅ हो, PIN आठवतो', pinNo: '🔑 नवीन PIN ठेवतो',
      pinSaved: '✅ नवीन PIN save झाला. तो लक्षात ठेवा.',
      moveWarn: c => `⚠️ "Shift" केल्यावर या phone वरून logout होईल आणि इथले notes, tests व माहिती पुसली जाईल. नवीन phone वर Code <b>${c}</b> आणि PIN ने login करा. (30 दिवसांत 2 वेळाच shift करता येतं.)`,
      moveBtn: '📱 नवीन phone वर shift करा', moveSure: '⚠️ पक्कं? पुन्हा tap करा',
      movePending: n => `तुमचे ${n} test results अजून upload झाले नाहीत. Internet चालू ठेवून थोड्या वेळाने पुन्हा करा.`,
      moveDone: '✅ Shift झालं! आता नवीन phone वर Code आणि PIN ने login करा.',
      moved: c => `✅ Account <b>${c}</b> नवीन phone वर shift झालं. या phone वर ते आता वापरता येणार नाही.`,
    },
    en: {
      link: '❓ Help', head: 'Help · Nks EduOrbit', hello: 'Hello 🙏 What do you need help with? Choose below.', which: 'Which question?', menu: '⬅ Main menu',
      ok: '👍 Solved, thanks', okReply: '😊 Great! Open the menu if you need anything else.', stuck: '❌ Still a problem → tell the admin',
      doNow: '🔑 Do it now', sendReq: '📨 Send a request to the admin', reqTeacher: '📨 Request as a teacher', reqShop: '📨 Request as a shop',
      openReg: '🆕 Open Register', openParent: '👨‍👩‍👧 Open Parent login', openPlay: '📲 Open the Play Store', waAdmin: '💬 WhatsApp the admin',
      waText: (topic, code) => `Hello 🙏 I need help with NKs EduOrbit.\nQuestion: ${topic}${code ? `\nStudent Code: ${code}` : ''}\nName:\nNumber:\n(describe the problem briefly)`,
      waDone: 'WhatsApp is open — write your name, number and the problem and send it. The admin will reply soon.',
      forgotIntro: 'OK. Write the student\'s name and the parent\'s mobile number (the one given at registration). This phone will be checked too.',
      studentName: 'Student\'s name', parentMobile: 'Parent\'s mobile', check: '🔍 Check', needName: 'Write the name', needMobile: 'Write a 10-digit number',
      notMatched: '😕 This name and number do not match. Use the name and the parent\'s number given at registration.',
      otherDevice: '📱 The name and number are right, but this account is not on this phone — do this from the app on the phone where the student logs in. If the phone was changed or lost, send a request to the admin below.',
      reqNewPin: '📨 Send a request to the admin (new PIN on WhatsApp)', retry: '🔁 Try again',
      matched: n => `✅ Confirmed! <b>${n}</b>'s Student Code:`, setPin: 'Set a new 4-digit PIN (within 10 minutes):', newPin: 'New PIN', pinAgain: 'PIN again',
      savePin: '💾 Save PIN', need4: 'Write a 4-digit PIN', notSame: 'The two PINs are not the same', pinDone: '🎉 PIN changed! The code and PIN are filled in the login — tap "Continue".', toLogin: '✅ Go to login',
      who: { student: 'Student\'s', teacher: 'Teacher\'s', shop: 'Shop / owner\'s' },
      reqIntro: (who, role) => `Write the ${who.toLowerCase()} name and ${role === 'student' ? 'the parent\'s' : 'your'} mobile number. The admin will check and send a new PIN on WhatsApp.`,
      name: 'name', mobile: 'Mobile', codeOpt: 'Code, if you remember it (optional)', send: '📨 Send request', reqDone: '✅ Request sent! The admin will check and WhatsApp a new PIN to this number.',
      eg: 'e.g. Rahul Patil',
      moveIntro: 'This is done from the OLD phone (the one where the app works now). Write the student\'s name and the parent\'s mobile number (the one given at registration).',
      moveNotHere: '📱 The name and number are right, but this phone is not the one linked to the account. Moving works only from the phone where the app works now. If that phone is lost or dead, send a request to the admin.',
      moveMatched: n => `✅ Confirmed! <b>${n}</b>'s Student Code (type this on the new phone):`,
      pinKnow: 'The new phone will need the PIN to log in. Do you remember the PIN?', pinYes: '✅ Yes, I remember it', pinNo: '🔑 I\'ll set a new PIN',
      pinSaved: '✅ New PIN saved. Remember it.',
      moveWarn: c => `⚠️ After "Move", this phone is logged out and its notes, tests and data are erased. On the new phone log in with Code <b>${c}</b> and your PIN. (You can move at most 2 times in 30 days.)`,
      moveBtn: '📱 Move to the new phone', moveSure: '⚠️ Sure? Tap again',
      movePending: n => `${n} test result${n > 1 ? 's are' : ' is'} not uploaded yet. Keep the internet on and try again in a little while.`,
      moveDone: '✅ Moved! Now log in on the new phone with the Code and PIN.',
      moved: c => `✅ Account <b>${c}</b> was moved to a new phone. It can no longer be used on this phone.`,
    },
  };
  const t = k => UI[_lang][k];
  // an answer in the chosen language (falls back to मराठी when the English one is missing)
  const L = (o, f) => (_lang === 'en' && o?.[`${f}_en`]) || o?.[f] || '';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // the same id the app uses for login (student-app/app.js _getDeviceId); made here if this phone has none yet
  const _deviceId = () => {
    try {
      let id = localStorage.getItem('_tbDevice');
      if (!id) {
        id = crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        localStorage.setItem('_tbDevice', id);
      }
      return id;
    } catch { return ''; }
  };
  const _native = () => !!window.Capacitor?.isNativePlatform?.();

  function _css() {
    if (document.getElementById('hb-css')) return;
    const st = document.createElement('style');
    st.id = 'hb-css';
    st.textContent = `
      .hb-link{position:absolute;top:10px;right:12px;z-index:5;background:none;border:0;padding:4px 6px;font:600 .78rem system-ui,sans-serif;color:inherit;opacity:.75;cursor:pointer;text-decoration:underline}
      .hb-link:hover{opacity:1}
      .hb-layer{position:fixed;inset:0;z-index:99990;background:rgba(15,10,40,.55);display:flex;align-items:flex-end;justify-content:center;animation:hbFade .18s ease both}
      .hb-panel{width:min(480px,100%);max-height:88vh;display:flex;flex-direction:column;background:#fff;color:#1b1340;border-radius:20px 20px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.3);font-family:'Baloo 2','Noto Sans Devanagari',system-ui,sans-serif}
      @media (min-width:640px){.hb-layer{align-items:center}.hb-panel{border-radius:20px}}
      .hb-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #ece6ff}
      .hb-head b{flex:1;font-size:1.05rem}
      .hb-lang{display:flex;border:2px solid #e7e1ff;border-radius:10px;overflow:hidden}
      .hb-lang button{background:#fff;border:0;padding:4px 8px;font:700 .8rem inherit;font-family:inherit;color:#5b3fd1;cursor:pointer}
      .hb-lang button.on{background:#7b2ff7;color:#fff}
      .hb-x{background:#f3efff;border:0;border-radius:10px;min-width:36px;height:36px;font-size:1rem;cursor:pointer;color:#5b3fd1}
      .hb-body{overflow-y:auto;padding:12px 14px 18px;display:flex;flex-direction:column;gap:8px}
      .hb-bot{align-self:flex-start;max-width:92%;background:#f3efff;border-radius:4px 16px 16px 16px;padding:9px 12px;line-height:1.45;font-weight:600}
      .hb-me{align-self:flex-end;max-width:85%;background:#7b2ff7;color:#fff;border-radius:16px 4px 16px 16px;padding:8px 12px;font-weight:700}
      .hb-opts{display:flex;flex-direction:column;gap:6px;margin-top:2px}
      .hb-opt{text-align:left;background:#fff;border:2px solid #e7e1ff;border-radius:14px;padding:10px 12px;font:700 .95rem inherit;font-family:inherit;color:#1b1340;cursor:pointer}
      .hb-opt:hover{border-color:#7b2ff7}
      .hb-opt.hb-main{background:linear-gradient(135deg,#ff7a18,#ff3d77 55%,#7b2ff7);color:#fff;border:0}
      .hb-opt.hb-wa{background:#25d366;color:#fff;border:0}
      .hb-field{display:flex;flex-direction:column;gap:4px;font-weight:700;font-size:.9rem}
      .hb-field input{min-height:46px;border-radius:12px;border:2px solid #e7e1ff;padding:8px 12px;font:700 1.05rem inherit;font-family:inherit;background:#faf8ff;color:#1b1340}
      .hb-code{font:800 1.8rem monospace;letter-spacing:.08em;text-align:center;padding:8px;border:2px dashed #7b2ff7;border-radius:14px;background:#faf8ff}
      .hb-msg{color:#e11d48;font-weight:700;min-height:1.1em}
      .hb-ok{color:#16a34a;font-weight:800}
      .hb-moved{display:flex;gap:8px;align-items:flex-start;background:#dcfce7;color:#14532d;border:2px solid #16a34a;border-radius:14px;padding:10px 12px;margin:30px 0 12px;font-weight:700;line-height:1.4}
      .hb-moved span{flex:1}
      .hb-moved button{background:none;border:0;font-size:1rem;cursor:pointer;color:inherit}
      @keyframes hbFade{from{opacity:0}to{opacity:1}}`;
    document.head.appendChild(st);
  }

  async function _loadFaq() {
    try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (Array.isArray(c)) _faq = c; } catch { /* ignore */ }
    if (!navigator.onLine) return;
    try {
      const r = await fetch(`${_opts.api()}/help/faq`);
      const b = await r.json();
      _faq = Array.isArray(b.faq) && b.faq.length ? b.faq : null;
      try { if (_faq) localStorage.setItem(CACHE, JSON.stringify(_faq)); else localStorage.removeItem(CACHE); } catch { /* ignore */ }
    } catch { /* offline: keep the copy */ }
  }
  // the admin's own FAQ copy may be older than the "new phone" item — it is always offered
  const MOVE_ITEM = HELP_DEFAULTS[0].items.find(i => i.action === 'move');
  const sections = () => {
    const all = (_faq || HELP_DEFAULTS).map(s => s.id !== 'login' || s.items.some(i => i.action === 'move') ? s
      : { ...s, items: [s.items[0], MOVE_ITEM, ...s.items.slice(1)].filter(Boolean) });
    // the shop panel only needs the login part
    return _opts.role === 'shop' ? all.filter(s => s.id === 'login').map(s => ({ ...s, items: s.items.filter(i => i.action === 'request_teacher') })) : all;
  };

  function _post(path, body) {
    return fetch(`${_opts.api()}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.json().catch(() => ({})).then(b => { if (!r.ok) throw new Error(b.message || (_lang === 'en' ? 'Something went wrong' : 'काहीतरी चूक झाली')); return b; }));
  }
  const _hit = (id, unresolved) => _post('/help/hit', { id, unresolved: !!unresolved }).catch(() => {});

  function _wa(text) {
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
    if (_native()) window.open(url, '_system'); else window.open(url, '_blank', 'noopener');
  }
  function _open(url) {
    const B = window.Capacitor?.Plugins?.Browser;
    if (B) B.open({ url }); else window.open(url, '_blank', 'noopener');
  }

  // ── chat panel ──────────────────────────────────────────
  function _body() { return _layer.querySelector('.hb-body'); }
  function _say(html, cls = 'hb-bot') {
    const d = document.createElement('div');
    d.className = cls; d.innerHTML = html;
    _body().appendChild(d);
    _body().scrollTop = _body().scrollHeight;
    return d;
  }
  function _options(list) {
    const box = document.createElement('div');
    box.className = 'hb-opts';
    list.forEach(([label, fn, cls]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'hb-opt' + (cls ? ' ' + cls : ''); b.textContent = label;
      b.onclick = () => { box.querySelectorAll('button').forEach(x => { x.disabled = true; }); _say(esc(label), 'hb-me'); fn(); };
      box.appendChild(b);
    });
    _body().appendChild(box);
    _body().scrollTop = _body().scrollHeight;
  }

  function _menu() {
    _say(t('hello'));
    _options(sections().map(s => [`${s.icon || '❓'} ${L(s, 'title')}`, () => _section(s)]));
  }

  function _section(s) {
    _say(`${s.icon || ''} <b>${esc(L(s, 'title'))}</b> — ${t('which')}`);
    _options([...s.items.map((it, i) => [`${i + 1}. ${L(it, 'q')}`, () => _answer(s, it)]), [t('menu'), _menu]]);
  }

  function _answer(s, it) {
    _hit(`${s.id}_${it.id}`);
    _say(esc(L(it, 'a')));
    const after = () => _options([
      [t('ok'), () => { _say(t('okReply')); _options([[t('menu'), _menu]]); }],
      [t('stuck'), () => { _hit(`${s.id}_${it.id}`, true); _toAdmin(L(it, 'q')); }, 'hb-wa'],
      [t('menu'), _menu],
    ]);
    switch (it.action) {
      case 'forgot': return _options([[t('doNow'), () => _forgot()], [t('menu'), _menu]]);
      case 'move': return _options([[t('doNow'), () => _move()], [t('menu'), _menu]]);
      case 'request': return _options([[t('sendReq'), () => _requestForm('student', 'new_phone')], [t('menu'), _menu]]);
      case 'request_teacher': return _options([[t('reqTeacher'), () => _requestForm('teacher', 'teacher')], [t('reqShop'), () => _requestForm('shop', 'shop')], [t('menu'), _menu]]);
      case 'register': return _options([[t('openReg'), () => { close(); document.getElementById('ob-tab-register')?.click(); }], [t('menu'), _menu]]);
      case 'parent': return _options([[t('openParent'), () => { close(); document.querySelector('.ob-role-tab[data-role="parent"]')?.click(); }], [t('menu'), _menu]]);
      case 'refund': _open(`${SITE}/refund-policy.html`); return after();
      case 'play': return _options([[t('openPlay'), () => { _open(PLAY); after(); }], [t('menu'), _menu]]);
      case 'admin': return _options([[t('waAdmin'), () => _toAdmin(L(it, 'q')), 'hb-wa'], [t('menu'), _menu]]);
      default: return after();
    }
  }

  function _toAdmin(topic) {
    const code = (document.getElementById('ob-student-code')?.value || '').trim();
    _wa(t('waText')(topic, code));
    _say(t('waDone'));
    _options([[t('menu'), _menu]]);
  }

  async function _phoneHint(input) {
    if (input.value.trim() || input.dataset.hinted) return;
    input.dataset.hinted = '1';
    try {
      const P = window.Capacitor?.Plugins?.PhoneHint;
      if (!P) return;
      const r = await P.pick();
      const d = String(r?.phone || '').replace(/\D/g, '').slice(-10);
      if (d.length === 10 && !input.value.trim()) input.value = d;
    } catch { /* type it */ }
  }

  function _form(html) {
    const d = _say(html);
    d.style.alignSelf = 'stretch'; d.style.maxWidth = '100%';
    return d;
  }

  // name + mobile + this phone -> code + new PIN
  function _forgot() {
    _say(t('forgotIntro'));
    const f = _form(`<div class="hb-field">${t('studentName')}<input id="hb-name" autocomplete="name" maxlength="40" placeholder="${esc(t('eg'))}" /></div>
      <div class="hb-field" style="margin-top:6px">${t('parentMobile')}<input id="hb-mob" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="98XXXXXXXX" /></div>
      <p class="hb-msg" id="hb-msg"></p><button type="button" class="hb-opt hb-main" id="hb-go">${t('check')}</button>`);
    const mob = f.querySelector('#hb-mob');
    mob.addEventListener('focus', () => _phoneHint(mob));
    f.querySelector('#hb-go').onclick = async e => {
      const name = f.querySelector('#hb-name').value.trim();
      const m = mob.value.replace(/\D/g, '').slice(-10);
      const msg = f.querySelector('#hb-msg');
      if (name.length < 2) { msg.textContent = t('needName'); return; }
      if (m.length !== 10) { msg.textContent = t('needMobile'); return; }
      e.target.disabled = true; msg.textContent = '';
      try {
        const r = await _post('/help/recover', { name, mobile: m, device_id: _deviceId() });
        f.querySelectorAll('input').forEach(x => { x.disabled = true; });
        if (r.ok) return _newPin(r);
        _say(t(r.reason === 'other_device' ? 'otherDevice' : 'notMatched'));
        _options([[t('reqNewPin'), () => _requestForm('student', 'not_matched', { name, mobile: m })], [t('retry'), _forgot], [t('menu'), _menu]]);
      } catch (err) {
        e.target.disabled = false; msg.textContent = err.message;
      }
    };
  }

  // onSaved: the "new phone" steps continue after the PIN instead of going to the login form
  function _newPin(r, onSaved) {
    if (!onSaved) _say(t('matched')(esc(r.name)));
    const f = _form(`${onSaved ? '' : `<div class="hb-code">${esc(r.student_code)}</div>`}
      <p style="margin:8px 0 4px;font-weight:700">${t('setPin')}</p>
      <div class="hb-field">${t('newPin')}<input id="hb-p1" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••" /></div>
      <div class="hb-field" style="margin-top:6px">${t('pinAgain')}<input id="hb-p2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••" /></div>
      <p class="hb-msg" id="hb-msg2"></p><button type="button" class="hb-opt hb-main" id="hb-save">${t('savePin')}</button>`);
    f.querySelector('#hb-save').onclick = async e => {
      const p1 = f.querySelector('#hb-p1').value.trim(), p2 = f.querySelector('#hb-p2').value.trim();
      const msg = f.querySelector('#hb-msg2');
      if (!/^\d{4}$/.test(p1)) { msg.textContent = t('need4'); return; }
      if (p1 !== p2) { msg.textContent = t('notSame'); return; }
      e.target.disabled = true; msg.textContent = '';
      try {
        await _post('/help/reset-pin', { student_code: r.student_code, ticket: r.ticket, pin: p1 });
        if (onSaved) { _say(t('pinSaved'), 'hb-bot hb-ok'); return onSaved(); }
        _say(t('pinDone'), 'hb-bot hb-ok');
        const code = document.getElementById('ob-student-code'), pin = document.getElementById('ob-pin');
        document.querySelector('.ob-role-tab[data-role="student"]')?.click();
        if (code) code.value = r.student_code;
        if (pin) pin.value = p1;
        const lock = document.getElementById('pin-lock-input');   // the PIN lock screen of a saved account
        if (lock && lock.offsetParent !== null) lock.value = p1;
        _options([[t('toLogin'), close, 'hb-main']]);
      } catch (err) {
        e.target.disabled = false; msg.textContent = err.message;
      }
    };
  }

  // ── "📱 हे app नवीन phone वर" — from the OLD phone ──────────
  // Same check as "PIN विसरलो" (name + parent's mobile + this must be the linked phone), then the code
  // is shown, a new PIN can be set, and after two taps the account is freed for the new phone and
  // this phone is logged out and wiped.
  function _move() {
    _say(t('moveIntro'));
    const f = _form(`<div class="hb-field">${t('studentName')}<input id="hb-name" autocomplete="name" maxlength="40" placeholder="${esc(t('eg'))}" /></div>
      <div class="hb-field" style="margin-top:6px">${t('parentMobile')}<input id="hb-mob" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="98XXXXXXXX" /></div>
      <p class="hb-msg" id="hb-msg"></p><button type="button" class="hb-opt hb-main" id="hb-go">${t('check')}</button>`);
    const mob = f.querySelector('#hb-mob');
    mob.addEventListener('focus', () => _phoneHint(mob));
    f.querySelector('#hb-go').onclick = async e => {
      const name = f.querySelector('#hb-name').value.trim();
      const m = mob.value.replace(/\D/g, '').slice(-10);
      const msg = f.querySelector('#hb-msg');
      if (name.length < 2) { msg.textContent = t('needName'); return; }
      if (m.length !== 10) { msg.textContent = t('needMobile'); return; }
      e.target.disabled = true; msg.textContent = '';
      try {
        const r = await _post('/help/recover', { name, mobile: m, device_id: _deviceId() });
        f.querySelectorAll('input').forEach(x => { x.disabled = true; });
        if (r.ok) return _moveMatched(r, name, m);
        if (r.reason === 'other_device') {
          _say(t('moveNotHere'));
          return _options([[t('sendReq'), () => _requestForm('student', 'new_phone', { name, mobile: m })], [t('menu'), _menu]]);
        }
        _say(t('notMatched'));
        _options([[t('retry'), _move], [t('menu'), _menu]]);
      } catch (err) {
        e.target.disabled = false; msg.textContent = err.message;
      }
    };
  }

  function _moveMatched(r, name, mobile) {
    _say(t('moveMatched')(esc(r.name)));
    _form(`<div class="hb-code">${esc(r.student_code)}</div>`);
    _say(t('pinKnow'));
    _options([
      [t('pinYes'), () => _confirmMove(r)],
      // the PIN change uses up the check, so it is made again (same phone, same details) before moving
      [t('pinNo'), () => _newPin(r, async () => {
        try {
          const r2 = await _post('/help/recover', { name, mobile, device_id: _deviceId() });
          if (r2.ok) return _confirmMove(r2);
          _say(t('notMatched'));
        } catch (err) { _say(esc(err.message)); }
        _options([[t('retry'), _move], [t('menu'), _menu]]);
      })],
    ]);
  }

  function _confirmMove(r) {
    _say(t('moveWarn')(esc(r.student_code)));
    const f = _form(`<p class="hb-msg" id="hb-mm"></p><button type="button" class="hb-opt hb-main" id="hb-move">${t('moveBtn')}</button>`);
    const b = f.querySelector('#hb-move'), msg = f.querySelector('#hb-mm');
    let armed = false;
    const disarm = () => { armed = false; b.disabled = false; b.textContent = t('moveBtn'); };
    b.onclick = async () => {
      if (!armed) { armed = true; b.textContent = t('moveSure'); return; }
      b.disabled = true; msg.textContent = '';
      try {
        // results not uploaded yet would be lost with the wipe: upload them first, or stop
        const fl = await (window.SYNC?.flushOwnResults?.() ?? Promise.resolve({ pending: 0 })).catch(() => ({ pending: 0 }));
        if (fl?.pending) { msg.textContent = t('movePending')(fl.pending); disarm(); return; }
        await _post('/help/move-device', { student_code: r.student_code, ticket: r.ticket, device_id: _deviceId() });
        _say(t('moveDone'), 'hb-bot hb-ok');
        await _wipeThisPhone(r.student_code);
      } catch (err) {
        disarm(); msg.textContent = err.message;
      }
    };
  }

  // Logged out, the account's data erased from this phone; the login screen then says it moved.
  async function _wipeThisPhone(code) {
    try { window.SYNC?.stopStudentAutoSync?.(); } catch { /* ignore */ }
    try { const db = typeof DB !== 'undefined' ? DB : window.DB; await db?.resetAll?.(); } catch { /* ignore */ }   // DB is a plain global (not on window)
    try { await window.API?.clearStudentProfile?.(); } catch { /* ignore */ }
    try { window.API?.clearStudentToken?.(); } catch { /* ignore */ }
    // saved pictures etc.; the app's own files (service worker caches) stay so it still opens offline
    try { if (window.caches) for (const k of await caches.keys()) if (!/^(nkseduorbit|teachingboard)-(static|runtime)-/.test(k)) await caches.delete(k); } catch { /* ignore */ }
    try {
      const keep = new Set(['_tbDevice', LANG_KEY, 'teachingboard_api_url']);
      Object.keys(localStorage).forEach(k => { if (!keep.has(k)) localStorage.removeItem(k); });
      localStorage.setItem(MOVED_KEY, code);
    } catch { /* ignore */ }
    setTimeout(() => location.reload(), 1800);
  }

  function _requestForm(role, reason, pre = {}) {
    const who = t('who')[role];
    _say(t('reqIntro')(who, role));
    const f = _form(`<div class="hb-field">${who} ${t('name')}<input id="hb-rn" maxlength="60" value="${esc(pre.name || '')}" /></div>
      <div class="hb-field" style="margin-top:6px">${t('mobile')}<input id="hb-rm" type="tel" inputmode="tel" maxlength="16" value="${esc(pre.mobile || '')}" placeholder="98XXXXXXXX" /></div>
      <div class="hb-field" style="margin-top:6px">${t('codeOpt')}<input id="hb-rc" maxlength="20" /></div>
      <p class="hb-msg" id="hb-msg3"></p><button type="button" class="hb-opt hb-main" id="hb-send">${t('send')}</button>`);
    const mob = f.querySelector('#hb-rm');
    mob.addEventListener('focus', () => _phoneHint(mob));
    f.querySelector('#hb-send').onclick = async e => {
      const msg = f.querySelector('#hb-msg3');
      const name = f.querySelector('#hb-rn').value.trim(), m = mob.value.replace(/\D/g, '').slice(-10);
      if (name.length < 2) { msg.textContent = t('needName'); return; }
      if (m.length !== 10) { msg.textContent = t('needMobile'); return; }
      e.target.disabled = true; msg.textContent = '';
      try {
        await _post('/help/pin-request', { role, name, mobile: m, code: f.querySelector('#hb-rc').value.trim(), reason });
        f.querySelectorAll('input').forEach(x => { x.disabled = true; });
        _say(t('reqDone'), 'hb-bot hb-ok');
        _options([[t('menu'), _menu]]);
      } catch (err) {
        e.target.disabled = false; msg.textContent = err.message;
      }
    };
  }

  function _setLang(lang) {
    _lang = lang === 'en' ? 'en' : 'mr';
    try { localStorage.setItem(LANG_KEY, _lang); } catch { /* ignore */ }
    document.querySelectorAll('.hb-link').forEach(b => { b.textContent = t('link'); });
    if (_layer) { open(); }
  }

  function open(start) {
    _css();
    close();
    _layer = document.createElement('div');
    _layer.className = 'hb-layer';
    _layer.innerHTML = `<div class="hb-panel" role="dialog" aria-modal="true" aria-label="${esc(t('head'))}">
      <div class="hb-head"><span style="font-size:1.4rem">🤖</span><b>${esc(t('head'))}</b>
        <div class="hb-lang" role="group" aria-label="Language"><button type="button" data-lang="mr" class="${_lang === 'mr' ? 'on' : ''}">मराठी</button><button type="button" data-lang="en" class="${_lang === 'en' ? 'on' : ''}">English</button></div>
        <button type="button" class="hb-x" aria-label="Close">✕</button></div>
      <div class="hb-body"></div></div>`;
    _layer.addEventListener('click', e => { if (e.target === _layer) close(); });
    _layer.querySelector('.hb-x').onclick = close;
    _layer.querySelectorAll('[data-lang]').forEach(b => { b.onclick = () => { if (b.dataset.lang !== _lang) _setLang(b.dataset.lang); }; });
    document.body.appendChild(_layer);
    _loadFaq().finally(() => { if (_layer) (typeof start === 'function' ? start : _menu)(); });
  }

  function close() { _layer?.remove(); _layer = null; }

  // Adds the small "❓ मदत / Help" link in the corner of `host`.
  function mount(host, opts = {}) {
    _opts = { ..._opts, ...opts };
    if (!host || host.querySelector('.hb-link')) return;
    _css();
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hb-link'; b.textContent = t('link');
    b.onclick = open;
    host.appendChild(b);
  }

  // After a move this phone opens on the login screen: say why, once.
  function showMovedNotice(host) {
    let code = '';
    try { code = localStorage.getItem(MOVED_KEY) || ''; } catch { /* ignore */ }
    if (!code || !host || host.querySelector('.hb-moved')) return;
    _css();
    const d = document.createElement('div');
    d.className = 'hb-moved'; d.setAttribute('role', 'status');
    d.innerHTML = `<span>${t('moved')(esc(code))}</span><button type="button" aria-label="Close">✕</button>`;
    d.querySelector('button').onclick = () => d.remove();
    host.prepend(d);
    try { localStorage.removeItem(MOVED_KEY); } catch { /* ignore */ }
  }

  return { mount, open, close, openForgot: () => open(_forgot), openMove: () => open(_move), showMovedNotice };
})();
window.HELP_BOT = HELP_BOT;
window.HELP_DEFAULTS = HELP_DEFAULTS;
// Student app / website login screen: the corner link
document.addEventListener('DOMContentLoaded', () => {
  const card = document.querySelector('#onboarding-screen .onboarding-card');
  if (card) HELP_BOT.mount(card, { role: 'student', api: () => window.API?.getApiUrl?.() || 'https://teachingboard-backend.onrender.com/api' });
  if (card) HELP_BOT.showMovedNotice(card);
  // PIN lock screen (saved account): "PIN विसरलात?" goes straight to the forgot-PIN steps
  document.getElementById('pin-lock-forgot')?.addEventListener('click', () => HELP_BOT.openForgot());
});
