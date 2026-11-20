/* ════════════════════════════════════════
   schStock.js — 📚 साठा वाढवा: the admin grows the 4थी शिष्यवृत्ती मराठी / English banks (owner 2026-11-20).
   Flow: "📋 AI साठी prompt" (copy, give to ChatGPT / Claude outside the app) → paste the whole answer in ONE box →
   "तपासा": every line is parsed by its [section], compared with what is already there (built-in banks of
   schLang.js + saved stock) → ✅ new / ➕ partly new / ⏭️ already there / ⚠️ wrong / 🔍 doubtful (needs a tick) →
   "Save" as one batch on the server (/api/sch-stock). A batch can be paused (review) or removed in one click.
   No AI inside the app: only the pasted text is read.
   Global: SCHSTOCK
════════════════════════════════════════ */
const SCHSTOCK = (() => {
  'use strict';
  const EXAM = '4';
  const S = window.SCH;
  const B = () => S.LANG_B, LG = () => S.LANG;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // duplicate key: same word whatever the spaces, quotes, full stops, zero-width marks or capitals
  const NORM = s => String(s ?? '').normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/[\s"'“”‘’`.,!?।:;()[\]{}\-–—_*]+/g, ' ').trim().toLowerCase();
  const nk = s => NORM(s).replace(/ /g, '');
  const list = s => String(s).split(/[,،]/).map(x => x.trim()).filter(Boolean);
  const eq = line => { const i = line.indexOf('='); if (i < 0) throw 'मध्ये "=" हवा'; const a = line.slice(0, i).trim(), b = line.slice(i + 1).trim(); if (!a || !b) throw '"=" च्या दोन्ही बाजूला मजकूर हवा'; return [a, b]; };
  const bar = (line, n) => { const p = line.split('|').map(x => x.trim()); if (p.length < n || p.slice(0, n).some(x => !x)) throw `"|" ने वेगळे केलेले ${n} भाग हवेत`; return p; };
  const words = s => NORM(s).split(' ').filter(Boolean);
  const jacc = (a, b) => { const x = new Set(words(a)), y = new Set(words(b)); let c = 0; x.forEach(w => y.has(w) && c++); return c / Math.max(1, x.size + y.size - c); };

  /* ───────────── kinds ───────────── */
  const K = [];
  // a = b; the left word (and with both:true the right one too) must be new
  function pair(o) {
    K.push({ type: 'line', ...o,
      parse: line => { const [a, b] = eq(line); if (nk(a) === nk(b)) throw 'दोन्ही बाजू सारख्याच आहेत'; o.valid?.(a, b); return [a, b]; },
      keys: e => o.both ? [nk(e[0]), nk(e[1])] : [nk(e[0])],
      have: () => { const s = new Set(); B()[o.bank].forEach(x => { s.add(nk(x[0])); if (o.both) s.add(nk(x[1])); }); return s; },
      show: e => `${e[0]} = ${e[1]}`, apply: e => B()[o.bank].push([e[0], e[1]]), count: () => B()[o.bank].length,
      list: () => B()[o.bank].map(x => x[0]) });
  }
  function word(o) {
    K.push({ type: 'line', ...o,
      parse: line => { const w = line.trim(); if (/[=|]/.test(w) || w.split(/\s+/).length > (o.maxWords || 2)) throw 'एका ओळीत एकच शब्द'; o.valid?.(w); return o.upper ? w.toUpperCase() : w; },
      keys: e => [nk(e)], have: () => new Set(B()[o.bank].map(nk)), show: e => e, apply: e => B()[o.bank].push(e), count: () => B()[o.bank].length, list: () => B()[o.bank].slice() });
  }
  // passage / poem / conversation / advertisement: text, then "? question | answer | wrong | wrong | wrong | उकल"
  function block(o) {
    K.push({ type: 'block', ...o,
      parse: chunk => {
        const lines = chunk.split('\n'), text = [], qs = [];
        for (const raw of lines) {
          const l = raw.replace(/\*\*/g, '').trimEnd();
          const m = l.match(/^\s*(?:\?|प्रश्न\s*\d*\s*[:.)]|Q\s*\d*\s*[:.)])\s*(.+)$/i);
          if (m) {
            let p = m[1].split('|').map(x => x.trim()).filter(Boolean);
            if (p.length === 3 && p[2].includes(',')) p = [p[0], p[1], ...list(p[2])];
            if (p.length < 5) throw `प्रश्न "${p[0] || ''}": प्रश्न | उत्तर | 3 चुकीचे पर्याय हवेत`;
            const [q, a, w1, w2, w3, why] = p;
            if (new Set([a, w1, w2, w3].map(nk)).size < 4) throw `प्रश्न "${q}": चारही पर्याय वेगळे हवेत`;
            qs.push([q, a, [w1, w2, w3], why || `उत्तर: ${a}`]);
          } else if (!qs.length) text.push(l);
          else if (l.trim()) throw 'प्रश्नांच्या मध्ये मजकूर आला आहे — उतारा आधी, प्रश्न नंतर';
        }
        const t = text.join('\n').replace(/^\n+|\n+$/g, '');
        if (t.length < 40) throw 'उतारा / कविता खूपच लहान आहे';
        if (qs.length < 3) throw 'प्रत्येक उताऱ्यावर किमान 3 प्रश्न हवेत';
        return [t, qs];
      },
      keys: e => [nk(e[0]).slice(0, 300)],
      dupOf: e => { const all = ['MR_PASS', 'MR_POEM', 'MR_DIALOG', 'MR_AD', 'EN_PASS', 'EN_POEM', 'EN_DIALOG', 'EN_AD'].flatMap(b => B()[b]); return all.some(x => jacc(x[0], e[0]) >= 0.8); },
      note: e => { const miss = e[1].filter(([q, a]) => !NORM(e[0]).includes(NORM(a)) && !/शीर्षक|title|अर्थ|meaning|opposite|विरुद्धार्थी|समानार्थी|how many|किती|गुण|odd|rhym|यमक|म्हण/i.test(q)); return miss.length ? `${miss.length} प्रश्नांचे उत्तर उताऱ्यात शब्दशः नाही — एकदा तपासा` : ''; },
      have: () => new Set(B()[o.bank].map(x => nk(x[0]).slice(0, 300))),
      show: e => `${e[0].split('\n')[0].slice(0, 70)}… (${e[1].length} प्रश्न)`, apply: e => B()[o.bank].push(e), count: () => B()[o.bank].length,
      list: () => B()[o.bank].map(x => x[0].split('\n')[0].slice(0, 40) + '…') });
  }
  const MR = 'मराठी', EN = 'English';

  // मराठी
  K.push({ id: 'mrSyn', sub: MR, type: 'line', h: ['समानार्थी', 'समानार्थी शब्द'], fmt: 'शब्द = समानार्थी1, समानार्थी2, समानार्थी3', ex: ['पाणी = जल, नीर, उदक', 'सूर्य = रवी, भास्कर, दिनकर'], ask: 'प्रत्येक शब्दाला किमान 2 (शक्यतो 3) समानार्थी शब्द',
    parse: line => { const [w, r] = eq(line), s = list(r).filter(x => nk(x) !== nk(w)); if (!s.length) throw 'समानार्थी शब्द हवा'; return [w, s]; },
    keys: e => [nk(e[0])], have: () => new Set(B().SYN.map(x => nk(x[0]))),
    merge: e => { const old = B().SYN.find(x => nk(x[0]) === nk(e[0])); if (!old) return null; const add = e[1].filter(x => !old[1].some(y => nk(y) === nk(x))); return add.length ? [e[0], add] : 'dup'; },
    sus: e => { const a = B().ANT.find(x => nk(x[0]) === nk(e[0]) || nk(x[1]) === nk(e[0])); return a && e[1].some(x => nk(x) === nk(a[0]) || nk(x) === nk(a[1])) ? `"${e[0]}" चा विरुद्धार्थी शब्द समानार्थी म्हणून आला आहे` : ''; },
    show: e => `${e[0]} = ${e[1].join(', ')}`, apply: e => { const old = B().SYN.find(x => nk(x[0]) === nk(e[0])); if (old) e[1].forEach(x => old[1].includes(x) || old[1].push(x)); else B().SYN.push([e[0], e[1].slice()]); },
    count: () => B().SYN.length, list: () => B().SYN.map(x => x[0]) });
  pair({ id: 'mrAnt', sub: MR, h: ['विरुद्धार्थी', 'विरुद्धार्थी शब्द'], bank: 'ANT', fmt: 'शब्द = विरुद्धार्थी शब्द', ex: ['उंच = ठेंगणा', 'सुख = दुःख'], ask: 'प्रत्येक ओळीत एक जोडी',
    sus: e => { const s = B().SYN.find(x => nk(x[0]) === nk(e[0])); return s && s[1].some(y => nk(y) === nk(e[1])) ? `"${e[1]}" हा "${e[0]}" चा समानार्थी शब्द आहे` : ''; } });
  pair({ id: 'mrOneWord', sub: MR, h: ['शब्दसमूह', 'शब्दसमूहाबद्दल एक शब्द'], bank: 'ONEWORD', both: true, fmt: 'शब्दसमूह = एक शब्द', ex: ['कधीही न मरणारा = अमर', 'ज्याला आई-वडील नाहीत असा = अनाथ'], ask: 'डावीकडे शब्दसमूह, उजवीकडे त्यासाठी एक शब्द' });
  K.push({ id: 'mrMulti', sub: MR, type: 'line', h: ['अनेकार्थी', 'अनेकार्थी शब्द'], fmt: 'शब्द = अर्थ1, अर्थ2', ex: ['वर्ण = रंग, अक्षर', 'हार = माळ, पराभव'], ask: 'प्रत्येक शब्दाचे नेमके 2 वेगळे अर्थ',
    parse: line => { const [w, r] = eq(line), m = list(r); if (m.length !== 2) throw 'नेमके 2 अर्थ हवेत'; return [w, m[0], m[1]]; },
    keys: e => [nk(e[0])], have: () => new Set(B().MULTI.map(x => nk(x[0]))), show: e => `${e[0]} = ${e[1]}, ${e[2]}`, apply: e => B().MULTI.push(e), count: () => B().MULTI.length, list: () => B().MULTI.map(x => x[0]) });
  pair({ id: 'mrLoan', sub: MR, h: ['इंग्रजी शब्द', 'इंग्रजी शब्दाला मराठी शब्द'], bank: 'LOAN', both: true, fmt: 'मराठी शब्द = इंग्रजी शब्द (देवनागरीत)', ex: ['संगणक = कॉम्प्युटर', 'आकाशवाणी = रेडिओ'], ask: 'इंग्रजी शब्द देवनागरी लिपीत लिही' });
  word({ id: 'mrJod', sub: MR, h: ['जोडशब्द'], bank: 'JOD', fmt: 'जोडशब्द (एका ओळीत एक)', ex: ['भाजीभाकरी', 'दगडधोंडे'], ask: 'दोन शब्द जोडून बनलेले जोडशब्द, जागा न सोडता', maxWords: 1 });
  word({ id: 'mrSpell', sub: MR, h: ['शुद्ध शब्द', 'शुद्धलेखन'], bank: 'SPELL_MR', fmt: 'शुद्ध लिहिलेला शब्द (एका ओळीत एक)', ex: ['परीक्षा', 'आशीर्वाद'], ask: 'मुलांकडून शुद्धलेखनात चूक होणारे (ि/ी, ु/ू, न/ण, श/ष, र्‍) शब्द; फक्त शुद्ध रूप', maxWords: 1,
    valid: w => { if (LG().misspell(w, LG().SWAP_MR, S.tools(1)).length < 3) throw 'या शब्दात चुकीची रूपं बनवता येत नाहीत (ि/ी, ु/ू, न/ण असलेला शब्द द्या)'; } });
  K.push({ id: 'mrOrder', sub: MR, type: 'line', h: ['वर्णानुक्रम'], fmt: 'शब्द1, शब्द2, शब्द3, शब्द4, शब्द5, शब्द6 (एका गटात किमान 6 शब्द)', ex: ['कमळ, काजू, किरण, कीटक, कुलूप, केळ, कैरी', 'पतंग, पाऊस, पिशवी, पीक, पुस्तक, पूल'], ask: 'एका गटातील शब्द एकाच अक्षराने सुरू होणारे पण पुढचे स्वरचिन्ह / अक्षर वेगळे; अनुस्वार किंवा जोडाक्षर जिथे फरक ठरवतो असे शब्द नको',
    parse: line => { const g = list(line); if (g.length < 6) throw 'एका गटात किमान 6 शब्द हवेत'; if (new Set(g.map(nk)).size < g.length) throw 'गटात एकच शब्द दोनदा आला आहे';
      for (const a of g) for (const b of g) if (a !== b) { const x = LG().sortKey(a), y = LG().sortKey(b); let i = 0; while (x[i] === y[i] && i < 99) i++; if (!(x[i] >= 0 && y[i] >= 0)) throw `"${a}" / "${b}": फरक अनुस्वार किंवा जोडाक्षरावर आहे — असे शब्द वगळा`; }
      return g; },
    keys: e => [e.map(nk).sort().join(',')], have: () => new Set(B().ORDER_MR.map(g => g.map(nk).sort().join(','))), show: e => e.join(', '), apply: e => B().ORDER_MR.push(e), count: () => B().ORDER_MR.length, list: () => B().ORDER_MR.map(g => g[0]) });
  word({ id: 'mrJumble', sub: MR, h: ['अक्षरे जुळवा', 'अक्षरे जुळवून शब्द'], bank: 'JUMBLE_MR', fmt: 'शब्द (3 ते 6 अक्षरांचा, एका ओळीत एक)', ex: ['फुलपाखरू', 'वाचनालय'], ask: 'मुलांना ओळखीचे 3 ते 6 अक्षरी शब्द', maxWords: 1,
    valid: w => { const n = LG().aksharas(w).length; if (n < 3 || n > 7) throw '3 ते 6 अक्षरांचा शब्द हवा'; } });
  K.push({ id: 'mrJumble3', sub: MR, type: 'line', h: ['अक्षरे जुळवा अर्थ'], fmt: 'मोठा शब्द | पहिली किती अक्षरे (2 किंवा 3) | त्यातून बनणारा शब्द | त्याचा अर्थ', ex: ['सागरकिनारा | 3 | सागर | समुद्र', 'रविवार | 2 | रवि | सूर्य'], ask: 'मोठ्या शब्दाची पहिली 2 किंवा 3 अक्षरे स्वतंत्र अर्थपूर्ण शब्द बनवतात',
    parse: line => { const [w, n, sub, m] = bar(line, 4), k = +n; if (k !== 2 && k !== 3) throw 'अक्षरांची संख्या 2 किंवा 3'; if (LG().aksharas(w).slice(0, k).join('') !== sub) throw `"${w}" ची पहिली ${k} अक्षरे "${sub}" होत नाहीत`; return [w, k, sub, m]; },
    keys: e => [nk(e[0])], have: () => new Set(B().JUMBLE3.map(x => nk(x[0]))), show: e => `${e[0]} → ${e[2]} = ${e[3]}`, apply: e => B().JUMBLE3.push(e), count: () => B().JUMBLE3.length, list: () => B().JUMBLE3.map(x => x[0]) });
  pair({ id: 'mrGender', sub: MR, h: ['लिंग'], bank: 'GEN', both: true, fmt: 'पुल्लिंगी = स्त्रीलिंगी', ex: ['वाघ = वाघीण', 'लेखक = लेखिका'], ask: 'डावीकडे पुल्लिंगी, उजवीकडे त्याचे स्त्रीलिंगी रूप' });
  word({ id: 'mrNeut', sub: MR, h: ['नपुंसकलिंगी', 'नपुंसकलिंग'], bank: 'NEUT', fmt: 'नपुंसकलिंगी शब्द (एका ओळीत एक)', ex: ['पुस्तक', 'वासरू'], ask: '"ते" लावून वापरले जाणारे नपुंसकलिंगी नाम', maxWords: 1 });
  pair({ id: 'mrNumber', sub: MR, h: ['वचन'], bank: 'NUM', fmt: 'एकवचन = अनेकवचन', ex: ['नदी = नद्या', 'घोडा = घोडे'], ask: 'एकवचन आणि अनेकवचन वेगळे असलेलेच शब्द' });
  const TL = ['भूतकाळ', 'वर्तमानकाळ', 'भविष्यकाळ'];
  K.push({ id: 'mrTense', sub: MR, type: 'line', h: ['काळ'], fmt: 'काळ | वाक्य   (काळ = भूतकाळ / वर्तमानकाळ / भविष्यकाळ)', ex: ['भूतकाळ | आईने गोड खीर केली.', 'भविष्यकाळ | उद्या पाऊस पडेल.'], ask: 'तिन्ही काळांची सारखी वाक्ये; प्रत्येक वाक्याचा काळ एकच व स्पष्ट',
    parse: line => { const [t, s] = bar(line, 2); const k = TL.find(x => nk(x) === nk(t)); if (!k) throw 'काळ: भूतकाळ / वर्तमानकाळ / भविष्यकाळ'; return [k, s]; },
    keys: e => [nk(e[1])], have: () => new Set(Object.values(B().TENSE).flat().map(nk)), show: e => `${e[0]}: ${e[1]}`, apply: e => B().TENSE[e[0]].push(e[1]), count: () => Object.values(B().TENSE).flat().length, list: () => [] });
  K.push({ id: 'mrPron', sub: MR, type: 'line', h: ['सर्वनामे'], fmt: 'वाक्य || त्यातील सर्व सर्वनामे, स्वल्पविरामाने', ex: ['मी आणि तू उद्या बागेत जाऊ. || मी, तू', 'त्याने मला एक पुस्तक दिले. || त्याने, मला'], ask: 'प्रत्येक वाक्यात 1 ते 5 सर्वनामे; "ते/ती/हे" विशेषण म्हणून (ते झाड) वापरू नको; सर्वनामांची यादी अचूक',
    parse: line => { const i = line.indexOf('||'); if (i < 0) throw '"||" नंतर सर्वनामे हवीत'; const s = line.slice(0, i).trim(), p = list(line.slice(i + 2)); if (!s || !p.length) throw 'वाक्य आणि सर्वनामे दोन्ही हवेत';
      const toks = s.replace(/[".,!?“”']/g, ' ').split(/\s+/); p.forEach(x => { if (!toks.includes(x)) throw `"${x}" वाक्यात नाही`; }); return [s, p]; },
    sus: e => { const auto = LG().pronIn(e[0]); return auto.length !== e[1].length ? `वाक्यात आपल्या यादीनुसार ${auto.length} सर्वनामे दिसतात, दिलेली ${e[1].length} — मोजणी तपासा` : ''; },
    keys: e => [nk(e[0])], have: () => new Set(B().PRON_S.map(x => nk(Array.isArray(x) ? x[0] : x))), show: e => `${e[0]} → ${e[1].join(', ')}`, apply: e => B().PRON_S.push(e), count: () => B().PRON_S.length, list: () => [] });
  K.push({ id: 'mrAdj', sub: MR, type: 'line', h: ['विशेषण', 'विशेषण व विशेष्य'], fmt: 'वाक्य | विशेषण | विशेष्य (वाक्यात जसे आहेत तसे)', ex: ['गोड आंबा सर्वांना आवडतो. | गोड | आंबा'], ask: 'साधी 4-5 शब्दांची वाक्ये, एकच विशेषण',
    parse: line => { const [s, a, n] = bar(line, 3), toks = s.replace(/[".,!?“”']/g, ' ').split(/\s+/).filter(Boolean); if (!toks.includes(a) || !toks.includes(n)) throw 'विशेषण / विशेष्य वाक्यात जसेच्या तसे हवे'; const rest = toks.filter(x => x !== a && x !== n); if (rest.length < 2) throw 'वाक्यात किमान 4 शब्द हवेत'; return [s, a, n, rest.slice(0, 3)]; },
    keys: e => [nk(e[0])], have: () => new Set(B().ADJ_S.map(x => nk(x[0]))), show: e => `${e[0]} → ${e[1]} / ${e[2]}`, apply: e => B().ADJ_S.push(e), count: () => B().ADJ_S.length, list: () => [] });
  const PM = { '?': 'प्रश्नचिन्ह (?)', '!': 'उद्गारचिन्ह (!)', '.': 'पूर्णविराम (.)' };
  K.push({ id: 'mrPunct', sub: MR, type: 'line', h: ['विरामचिन्हे', 'विरामचिन्ह'], fmt: 'शेवटचे चिन्ह नसलेले वाक्य | ? किंवा ! किंवा .', ex: ['तुझे नाव काय आहे | ?', 'अबब! केवढा मोठा साप | !'], ask: 'वाक्याच्या शेवटी चिन्ह लावू नको, ते "|" नंतर दे',
    parse: line => { const p = line.split('|').map(x => x.trim()); if (p.length < 2 || !PM[p[1]]) throw 'शेवटी | ? किंवा | ! किंवा | . हवे'; return [p[0].replace(/[.?!।]+$/, ''), PM[p[1]]]; },
    keys: e => [nk(e[0])], have: () => new Set(B().PUNCT_S.map(x => nk(x[0]))), show: e => `${e[0]} ${e[1]}`, apply: e => B().PUNCT_S.push(e), count: () => B().PUNCT_S.length, list: () => [] });
  pair({ id: 'mrIdiom', sub: MR, h: ['वाक्प्रचार'], bank: 'IDIOM', fmt: 'वाक्प्रचार = अर्थ', ex: ['कान टवकारणे = लक्षपूर्वक ऐकणे'], ask: 'वाक्प्रचार "-णे" रूपात, अर्थ थोडक्यात' });
  K.push({ id: 'mrIdiomFill', sub: MR, type: 'line', h: ['वाक्प्रचार वाक्य'], fmt: 'रिकाम्या जागेसह वाक्य .......... | योग्य वाक्प्रचार | (याच वाक्यात बसू शकणारे दुसरे वाक्प्रचार, असल्यास)', ex: ['पोलिसांना पाहताच चोराने .......... | धूम ठोकणे | हातावर तुरी देणे'], ask: 'वाक्प्रचार [वाक्प्रचार] यादीतलाच असावा; रिकामी जागा ".........." ने दाखव',
    parse: line => { const p = line.split('|').map(x => x.trim()); if (p.length < 2 || !p[0] || !p[1]) throw 'वाक्य | वाक्प्रचार हवे'; if (!/\.{4,}|_{3,}/.test(p[0])) throw 'वाक्यात रिकामी जागा (..........) हवी'; return [p[0].replace(/_{3,}/, '..........'), p[1], list(p[2] || '')]; },
    sus: (e, ctx) => B().IDIOM.some(x => nk(x[0]) === nk(e[1])) || ctx.idioms.has(nk(e[1])) ? '' : `"${e[1]}" हा वाक्प्रचार साठ्यात नाही — [वाक्प्रचार] मध्येही द्या`,
    keys: e => [nk(e[0])], have: () => new Set(B().IDIOM_FILL.map(x => nk(x[0]))), show: e => `${e[0]} → ${e[1]}`, apply: e => B().IDIOM_FILL.push(e), count: () => B().IDIOM_FILL.length, list: () => [] });
  K.push({ id: 'mrProverb', sub: MR, type: 'line', h: ['म्हणी', 'म्हण'], fmt: 'म्हणीचा पहिला भाग | दुसरा भाग | अर्थ', ex: ['थेंबे थेंबे | तळे साचे | थोडे थोडे जमवल्याने मोठा साठा होतो'], ask: 'प्रचलित म्हणी, दोन भागांत तोडून, अर्थासह',
    parse: line => { const p = bar(line, 2); return [p[0], p[1], p[2] || '']; },
    keys: e => [nk(e[0] + e[1])], have: () => new Set(B().PROV.map(x => nk(x[0] + x[1]))), show: e => `${e[0]} ${e[1]}${e[2] ? ' — ' + e[2] : ''}`,
    apply: e => { B().PROV.push([e[0], e[1]]); if (e[2]) B().PROV_MEAN.push([`${e[0]} ${e[1]}`, e[2]]); }, count: () => B().PROV.length, list: () => B().PROV.map(x => x[0] + ' ' + x[1]) });
  pair({ id: 'mrAlank', sub: MR, h: ['अलंकारिक', 'अलंकारिक शब्द'], bank: 'ALANK', fmt: 'अलंकारिक शब्द = अर्थ', ex: ['कुंभकर्ण = खूप झोपणारा'], ask: 'प्रचलित अलंकारिक शब्द' });
  pair({ id: 'mrPilu', sub: MR, h: ['पिलू'], bank: 'PILU', fmt: 'प्राणी (मादी) = पिलाचे नाव', ex: ['शेळी = करडू'], ask: 'प्रत्येक प्राण्याच्या पिलाचे वेगळे नाव' });
  pair({ id: 'mrVoice', sub: MR, h: ['आवाज', 'ध्वनिदर्शक'], bank: 'VOICE', fmt: 'प्राणी / पक्षी = आवाज (क्रियापदासह)', ex: ['घोडा = खिंकाळतो'], ask: 'प्राणी-पक्ष्यांचे आवाज' });
  pair({ id: 'mrHome', sub: MR, h: ['निवारा'], bank: 'HOME', fmt: 'प्राणी / पक्षी = राहण्याची जागा', ex: ['मधमाशी = पोळे'], ask: 'प्राणी-पक्ष्यांचे निवारे' });
  pair({ id: 'mrDay', sub: MR, h: ['दिनविशेष'], bank: 'DINA', fmt: 'दिनाचे नाव = तारीख महिना', ex: ['जागतिक पर्यावरण दिन = 5 जून'], ask: 'भारत / महाराष्ट्रात सर्वमान्य तारखेचे दिन; तारीख अंकात व महिना मराठीत',
    valid: (a, b) => { if (!/^\d{1,2} (जानेवारी|फेब्रुवारी|मार्च|एप्रिल|मे|जून|जुलै|ऑगस्ट|सप्टेंबर|ऑक्टोबर|नोव्हेंबर|डिसेंबर)$/.test(b)) throw 'तारीख "5 जून" अशी हवी'; } });
  block({ id: 'mrPassage', sub: MR, h: ['उतारा'], bank: 'MR_PASS', fmt: 'उतारा (6-10 वाक्ये), खाली प्रत्येक प्रश्न "?" ने सुरू', ex: ['सकाळ झाली. कोंबडा आरवला. ……', '? आजी अंगणात काय करत होती? | सडा घालत होती | पाणी घालत होती | दूध तापवत होती | रांगोळी काढत होती | उताऱ्यात: "आजी अंगणात सडा घालत होती."'], ask: 'प्रत्येक उताऱ्यावर 4 प्रश्न; दोन उताऱ्यांच्या मध्ये --- ओळ' });
  block({ id: 'mrPoem', sub: MR, h: ['कविता'], bank: 'MR_POEM', fmt: 'कविता (8 ओळी, यमक असलेली), खाली प्रश्न "?" ने', ex: ['झुळझुळ वाहे झरा गोड,', 'खळखळ हसते पाणी;', '……', '? कवितेत "पाणी" शी यमक जुळणारा शब्द कोणता? | गाणी | सारे | नाचे | गोड'], ask: 'स्वतःची नवीन बालकविता; प्रत्येक कवितेवर 4 प्रश्न; कवितांच्या मध्ये ---' });
  block({ id: 'mrDialog', sub: MR, h: ['संवाद'], bank: 'MR_DIALOG', fmt: 'संवाद (प्रत्येक वाक्य नव्या ओळीवर, अवतरणात), खाली प्रश्न "?" ने', ex: ['"आई, आज शाळेत प्रदर्शन आहे."', '"अरे वा! तू काय नेणार?"', '……', '? संवादात किती व्यक्तींचा उल्लेख आहे? | चार | दोन | तीन | पाच'], ask: '6-8 वाक्यांचा संवाद; 4 प्रश्न; संवादांच्या मध्ये ---' });
  block({ id: 'mrAd', sub: MR, h: ['जाहिरात'], bank: 'MR_AD', fmt: 'जाहिरात (शीर्षक, मुद्दे, तारीख, वेळ, पत्ता), खाली प्रश्न "?" ने', ex: ['★ बाल वाचनालय ★', '• सभासद शुल्क: ₹ 50', '……', '? वाचनालय कोणत्या दिवशी बंद असते? | सोमवारी | रविवारी | शनिवारी | बुधवारी'], ask: 'मुलांसाठीच्या काल्पनिक जाहिराती; 4 प्रश्न; जाहिरातींच्या मध्ये ---' });

  // English
  pair({ id: 'enOpp', sub: EN, h: ['Opposites', 'Opposite words'], bank: 'OPP', fmt: 'word = opposite', ex: ['big = small', 'early = late'], ask: 'simple words a 4th-standard child knows, all in lowercase' });
  K.push({ id: 'enRhyme', sub: EN, type: 'line', h: ['Rhyming', 'Rhyming words'], fmt: 'word, word, word, word (4 or more words that rhyme)', ex: ['cat, hat, bat, mat, rat', 'cake, lake, make, bake'], ask: 'each line one rhyming family, at least 4 simple words',
    parse: line => { const g = list(line).map(x => x.toLowerCase()); if (g.length < 3 || g.some(x => !/^[a-z]+$/.test(x))) throw 'at least 3 single words'; return g; },
    keys: e => [e.slice().sort().join(',')], have: () => new Set(B().RHY.map(g => g.slice().sort().join(','))),
    merge: e => { const old = B().RHY.find(g => g.some(x => e.includes(x))); if (!old) return null; const add = e.filter(x => !old.includes(x)); return add.length ? [old[0], ...add] : 'dup'; },
    show: e => e.join(', '), apply: e => { const old = B().RHY.find(g => g.includes(e[0])); if (old) e.forEach(x => old.includes(x) || old.push(x)); else B().RHY.push(e.slice()); }, count: () => B().RHY.length, list: () => B().RHY.map(g => g[0]) });
  word({ id: 'enSpell', sub: EN, h: ['Spelling'], bank: 'SPELL_EN', fmt: 'correctly spelt word (one per line)', ex: ['February', 'necessary'], ask: 'words children often misspell (double letters, ie/ei, silent letters); only the correct spelling; British spelling', maxWords: 1,
    valid: w => { if (!/^[A-Za-z]+$/.test(w)) throw 'one English word'; if (LG().misEn(w, S.tools(1)).length < 3) throw 'too short for wrong spellings'; } });
  K.push({ id: 'enHidden', sub: EN, type: 'line', h: ['Hidden words', 'Hidden word'], fmt: 'Big word | hidden smaller word | its meaning | wrong1, wrong2, wrong3', ex: ['Kingdom | King | He rules a country | Dog, Kin, Ding'], ask: 'the hidden word must be written inside the big word',
    parse: line => { const [w, h, m, wr] = bar(line, 4); if (!w.toLowerCase().includes(h.toLowerCase())) throw `"${h}" is not inside "${w}"`; const x = list(wr); if (x.length < 3) throw '3 wrong options'; return [w, h, m, x.slice(0, 3)]; },
    keys: e => [nk(e[0] + '|' + e[1])], have: () => new Set(B().HIDDEN.map(x => nk(x[0] + '|' + x[1]))), show: e => `${e[0]} → ${e[1]} (${e[2]})`, apply: e => B().HIDDEN.push(e), count: () => B().HIDDEN.length, list: () => B().HIDDEN.map(x => x[0]) });
  K.push({ id: 'enGroup', sub: EN, type: 'line', h: ['Groups', 'Complete the group'], fmt: 'Category = item, item, item, item, item (5 or more)', ex: ['Flowers = Rose, Lotus, Lily, Jasmine, Marigold'], ask: 'categories a child knows; an item must not fit two categories',
    parse: line => { const [c, r] = eq(line), it = list(r); if (it.length < 5) throw 'at least 5 items'; return [c, it]; },
    keys: e => [nk(e[0])], have: () => new Set(B().CAT_EN.map(x => nk(x[0]))),
    merge: e => { const old = B().CAT_EN.find(x => nk(x[0]) === nk(e[0])); if (!old) return null; const add = e[1].filter(x => !old[1].some(y => nk(y) === nk(x))); return add.length ? [e[0], add] : 'dup'; },
    show: e => `${e[0]} = ${e[1].join(', ')}`, apply: e => { const old = B().CAT_EN.find(x => nk(x[0]) === nk(e[0])); if (old) e[1].forEach(x => old[1].includes(x) || old[1].push(x)); else B().CAT_EN.push([e[0], e[1].slice()]); }, count: () => B().CAT_EN.length, list: () => B().CAT_EN.map(x => x[0]) });
  K.push({ id: 'enAnalogy', sub: EN, type: 'line', h: ['Analogy'], fmt: 'relation = a:b, c:d, e:f, g:h (4 or more pairs)', ex: ['young one = cat:kitten, dog:puppy, cow:calf, hen:chick'], ask: 'one relation per line, all pairs with the same relation, lowercase',
    parse: line => { const [r, x] = eq(line), ps = list(x).map(p => p.split(':').map(y => y.trim().toLowerCase())); if (ps.length < 3 || ps.some(p => p.length !== 2 || !p[0] || !p[1])) throw 'at least 3 pairs like cat:kitten'; return [r.toLowerCase(), ps]; },
    keys: e => [nk(e[0])], have: () => new Set(B().REL_EN.map(x => nk(x[0]))),
    merge: e => { const old = B().REL_EN.find(x => nk(x[0]) === nk(e[0])); if (!old) return null; const add = e[1].filter(p => !old[1].some(q => q[0] === p[0])); return add.length ? [e[0], add] : 'dup'; },
    show: e => `${e[0]} = ${e[1].map(p => p.join(':')).join(', ')}`, apply: e => { const old = B().REL_EN.find(x => nk(x[0]) === nk(e[0])); if (old) old[1].push(...e[1]); else B().REL_EN.push([e[0], e[1].map(p => p.slice())]); }, count: () => B().REL_EN.length, list: () => B().REL_EN.map(x => x[0]) });
  K.push({ id: 'enRiddle', sub: EN, type: 'line', h: ['Riddles', 'Riddle'], fmt: 'riddle | answer (one word)', ex: ['I cut your hair. Who am I? | Barber'], ask: 'easy riddles about workers, objects, animals, fruits',
    parse: line => { const [q, a] = bar(line, 2); return [q, a]; }, keys: e => [nk(e[0])], have: () => new Set(B().RIDDLE.map(x => nk(x[0]))), show: e => `${e[0]} → ${e[1]}`, apply: e => B().RIDDLE.push(e), count: () => B().RIDDLE.length, list: () => B().RIDDLE.map(x => x[1]) });
  word({ id: 'enJumble', sub: EN, h: ['Jumbled words', 'Jumbled letters'], bank: 'JUMBLE_EN', upper: true, fmt: 'WORD (5 to 8 letters, one per line)', ex: ['GARDEN', 'PENCIL'], ask: 'common nouns of 5 to 8 letters, capital letters', maxWords: 1,
    valid: w => { if (!/^[A-Za-z]{4,9}$/.test(w)) throw 'one word of 4 to 9 letters'; } });
  K.push({ id: 'enPrep', sub: EN, type: 'line', h: ['Prepositions', 'Preposition'], fmt: 'sentence with _____ | answer | wrong1, wrong2, wrong3', ex: ['Fish live _____ water. | in | on, at, by'], ask: 'the three wrong prepositions must NOT fit the sentence at all',
    parse: line => { const [s, a, w] = bar(line, 3); if (!/_{3,}/.test(s)) throw 'sentence needs _____'; const x = list(w); if (x.length < 3) throw '3 wrong options'; if (x.some(y => y.toLowerCase() === a.toLowerCase())) throw 'answer is in the wrong options'; return [s.replace(/_{3,}/, '_____'), a, x.slice(0, 3)]; },
    keys: e => [nk(e[0])], have: () => new Set(B().PREP.map(x => nk(x[0]))), show: e => `${e[0]} → ${e[1]}`, apply: e => B().PREP.push(e), count: () => B().PREP.length, list: () => [] });
  K.push({ id: 'enArticle', sub: EN, type: 'line', h: ['a / an', 'Articles'], fmt: 'an | word   or   a | word', ex: ['an | hour', 'a | uniform'], ask: 'include tricky ones (hour, honest, university, uniform, one-rupee coin)',
    parse: line => { const [x, w] = bar(line, 2); const t = x.toLowerCase(); if (t !== 'a' && t !== 'an') throw 'first part: a or an'; return [t, w]; },
    keys: e => [nk(e[1])], have: () => new Set([...B().AN, ...B().A_].map(nk)), show: e => `${e[0]} ${e[1]}`, apply: e => (e[0] === 'an' ? B().AN : B().A_).push(e[1]), count: () => B().AN.length + B().A_.length, list: () => [...B().AN, ...B().A_] });
  pair({ id: 'enVerb', sub: EN, h: ['Verbs', 'Tense'], bank: 'VERBS', fmt: 'present = past', ex: ['write = wrote', 'play = played'], ask: 'common verbs, lowercase, simple past form' });
  pair({ id: 'enPlural', sub: EN, h: ['Plurals', 'Plural'], bank: 'PLU', fmt: 'singular = plural', ex: ['leaf = leaves'], ask: 'include irregular plurals; lowercase' });
  pair({ id: 'enGender', sub: EN, h: ['Gender'], bank: 'GEN_EN', both: true, fmt: 'masculine = feminine', ex: ['prince = princess'], ask: 'lowercase pairs' });
  const EM = { '?': 'Question mark (?)', '!': 'Exclamation mark (!)', '.': 'Full stop (.)' };
  K.push({ id: 'enPunct', sub: EN, type: 'line', h: ['Punctuation'], fmt: 'sentence without the end mark | ? or ! or .', ex: ['Where do you live | ?', 'Hurray! We won the match | !'], ask: 'do not put the end mark in the sentence; give it after "|"',
    parse: line => { const p = line.split('|').map(x => x.trim()); if (p.length < 2 || !EM[p[1]]) throw 'end with | ? or | ! or | .'; return [p[0].replace(/[.?!]+$/, ''), EM[p[1]]]; },
    keys: e => [nk(e[0])], have: () => new Set(B().ENDS.map(x => nk(x[0]))), show: e => `${e[0]} ${e[1]}`, apply: e => B().ENDS.push(e), count: () => B().ENDS.length, list: () => [] });
  K.push({ id: 'enCaps', sub: EN, type: 'line', h: ['Capital letters'], fmt: 'the sentence written correctly with capital letters', ex: ['Ravi and I went to Mumbai on Sunday.'], ask: 'each sentence has names of people, places, days or months; no words fully in capitals',
    parse: line => { const s = line.trim(), n = (s.match(/[A-Z]/g) || []).length; if (n < 2) throw 'need 2 or more capital letters'; if (/[A-Z]{2}/.test(s.replace(/\bI\b/g, ''))) throw 'no words fully in capitals'; return s; },
    keys: e => [nk(e)], have: () => new Set(B().CAPS.map(nk)), show: e => e, apply: e => B().CAPS.push(e), count: () => B().CAPS.length, list: () => [] });
  K.push({ id: 'enExpr', sub: EN, type: 'line', h: ['Requests', 'Request permission order'], fmt: 'request | sentence   (request / permission / order / question / statement)', ex: ['request | Please pass the salt.', 'permission | May I sit here?'], ask: 'each sentence clearly only one of these',
    parse: line => { const [k, s] = bar(line, 2), t = k.toLowerCase(); if (!B().EXPR[t]) throw 'first part: request / permission / order / question / statement'; return [t, s]; },
    keys: e => [nk(e[1])], have: () => new Set(Object.values(B().EXPR).flat().map(nk)), show: e => `${e[0]}: ${e[1]}`, apply: e => B().EXPR[e[0]].push(e[1]), count: () => Object.values(B().EXPR).flat().length, list: () => [] });
  K.push({ id: 'enGreet', sub: EN, type: 'line', h: ['Greetings', 'What will you say'], fmt: 'situation | what you say', ex: ['your friend is ill | Get well soon.'], ask: 'everyday situations of a child',
    parse: line => { const [a, b] = bar(line, 2); return [a, b]; }, keys: e => [nk(e[0])], have: () => new Set(B().GREET.map(x => nk(x[0]))), show: e => `${e[0]} → ${e[1]}`, apply: e => B().GREET.push(e), count: () => B().GREET.length, list: () => B().GREET.map(x => x[0]) });
  block({ id: 'enPassage', sub: EN, h: ['Passage'], bank: 'EN_PASS', fmt: 'passage (6-8 simple sentences), then each question on a line starting with "?"', ex: ['Mani is my cat. ……', '? What does Mani drink? | Milk | Water | Tea | Juice'], ask: '4 questions on each passage; put --- between passages' });
  block({ id: 'enPoem', sub: EN, h: ['Poem'], bank: 'EN_POEM', fmt: 'poem (8 lines with rhymes), then questions starting with "?"', ex: ['Twinkle, little firefly, ……', '? Find the rhyming word for "deep". | sleep | dark | night | tree'], ask: 'your own new poem; 4 questions; --- between poems' });
  block({ id: 'enDialog', sub: EN, h: ['Conversation', 'Dialogue'], bank: 'EN_DIALOG', fmt: 'conversation, each line "Name : words", then questions starting with "?"', ex: ['Ira : Hello, Neha.', 'Neha : Hello!', '……', '? Which game will they play? | Badminton | Cricket | Football | Kabaddi'], ask: '6-8 lines; 4 questions; --- between conversations' });
  block({ id: 'enAd', sub: EN, h: ['Notice', 'Advertisement'], bank: 'EN_AD', fmt: 'notice or advertisement, then questions starting with "?"', ex: ['SUMMER ART CAMP', 'For children aged 6 to 12 years', '……', '? How many seats are there? | 40 | 300 | 15 | 12'], ask: 'made-up notices for children; 4 questions; --- between notices' });

  const byHead = new Map(); K.forEach(k => [k.id, ...k.h].forEach(h => byHead.set(nk(h), k)));
  const kindOf = id => K.find(k => k.id === id);

  /* ───────────── server stock → banks ───────────── */
  const st = { loaded: false, loading: null, batches: [], items: [], pristine: null };
  const live = () => new Set(st.batches.filter(b => b.status === 'live').map(b => b.id));
  function rebuild() {
    const b = B();
    if (!st.pristine) st.pristine = JSON.parse(JSON.stringify(b));
    else for (const k of Object.keys(st.pristine)) { const src = JSON.parse(JSON.stringify(st.pristine[k])); if (Array.isArray(b[k])) b[k].splice(0, b[k].length, ...src); else for (const t of Object.keys(src)) b[k][t].splice(0, b[k][t].length, ...src[t]); }
    const on = live();
    st.items.forEach(it => { const k = kindOf(it.kind); if (k && on.has(it.batch_id)) try { k.apply(it.entry); } catch (e) { console.warn('stock', it.kind, e); } });
  }
  async function load(force) {
    if (st.loaded && !force) return st;
    if (st.loading && !force) return st.loading;
    st.loading = (async () => {
      try { const d = await window.API?.schStockGet?.(EXAM); if (d) { st.batches = d.batches || []; st.items = d.items || []; } st.loaded = true; rebuild(); }
      catch (e) { console.warn('sch-stock load', e); }
      st.loading = null; return st;
    })();
    return st.loading;
  }

  /* ───────────── paste → rows ───────────── */
  function clean(line) { return line.replace(/\*\*/g, '').replace(/^\s*(?:\d{1,3}[.)]\s+|[-*•]\s+)/, '').trim(); }
  function check(text) {
    const rows = [], seen = new Set(), saved = new Set(st.items.map(i => i.kind + '\u0000' + i.norm)), haveCache = new Map();
    const have = k => { if (!haveCache.has(k.id)) haveCache.set(k.id, k.have()); return haveCache.get(k.id); };
    const ctx = { idioms: new Set() };
    let cur = null, chunk = [];
    const push = (k, raw) => {
      const r = { kind: k?.id, title: k ? k.h[0] : '', raw: raw.slice(0, 300), st: 'new', msg: '' };
      try {
        if (!k) throw 'हा मजकूर कोणत्याही [प्रकार] खाली नाही';
        let e = k.parse(raw), norm = k.keys(e)[0];
        if (k.merge) { const m = k.merge(e); if (m === 'dup') r.st = 'dup'; else if (m) { e = m; r.st = 'part'; norm = norm + '+' + (Array.isArray(m[1]) ? m[1].map(x => Array.isArray(x) ? x.join(':') : x) : m.slice(1)).map(nk).sort().join(','); } }
        if (r.st === 'new' && (k.keys(e).some(x => have(k).has(x)) || (k.dupOf && k.dupOf(e)))) r.st = 'dup';
        if (r.st !== 'dup' && (seen.has(k.id + '\u0000' + norm) || saved.has(k.id + '\u0000' + norm))) r.st = 'dup';
        if (r.st !== 'dup') { const s = k.sus?.(e, ctx); if (s) { r.st = 'sus'; r.msg = s; } else if (k.note) r.msg = k.note(e); }
        if (r.st === 'dup') r.msg = 'आधीच आहे — घेतला जाणार नाही';
        if (r.st === 'part') r.msg = 'नवीन भाग: ' + k.show(e).split('=').pop().trim();
        seen.add(k.id + '\u0000' + norm);
        if (k.id === 'mrIdiom') ctx.idioms.add(nk(e[0]));
        r.entry = e; r.norm = norm; r.show = k.show(e); r.on = r.st === 'new' || r.st === 'part';
      } catch (err) { r.st = 'bad'; r.msg = typeof err === 'string' ? err : (err?.message || 'चूक'); r.show = raw.slice(0, 120); r.on = false; }
      rows.push(r);
    };
    const flush = () => { if (cur?.type === 'block') { const parts = chunk.join('\n').split(/\n\s*-{3,}\s*\n/); parts.forEach(p => p.trim() && push(cur, p)); } chunk = []; };
    for (const raw0 of String(text).replace(/\r/g, '').split('\n')) {
      if (/^\s*```/.test(raw0)) continue;
      const h = raw0.replace(/\*\*/g, '').trim().match(/^#*\s*\[(.+?)\]\s*:?\s*$/);
      if (h) { flush(); cur = byHead.get(nk(h[1])) || null; if (!cur) rows.push({ st: 'bad', title: h[1], show: raw0.trim(), msg: 'हा प्रकार ओळखला नाही — prompt मधले शीर्षक वापरा', on: false }); continue; }
      if (cur?.type === 'block') { chunk.push(raw0); continue; }
      const line = clean(raw0); if (!line) continue;
      if (!cur) { rows.push({ st: 'bad', title: '', show: line.slice(0, 120), msg: 'या ओळीच्या वर [प्रकार] शीर्षक नाही', on: false }); continue; }
      push(cur, line);
    }
    flush();
    return rows;
  }

  /* ───────────── AI prompt ───────────── */
  function prompt(sub, ids, n, avoid) {
    const ks = K.filter(k => k.sub === sub && ids.includes(k.id));
    const isMr = sub === MR;
    const head = isMr
      ? `तू महाराष्ट्र राज्य शिष्यवृत्ती परीक्षा (इयत्ता 4थी, पूर्वीची 5वी) च्या मराठी विभागासाठी प्रश्नांचा साठा तयार करणारा अनुभवी मराठी शिक्षक आहेस.\n\nनियम:\n1. शुद्ध, प्रमाण मराठी; इयत्ता 4थीच्या मुलांना समजेल अशी पातळी.\n2. उतारे, कविता, संवाद, जाहिराती स्वतः नव्याने लिही — पाठ्यपुस्तकातून किंवा इतर कुठूनही कॉपी करू नको.\n3. प्रत्येक प्रकाराच्या ${n} नवीन नोंदी दे (उतारा / कविता / संवाद / जाहिरात: प्रत्येकी ${Math.max(2, Math.round(n / 10))}).\n4. ज्याबद्दल पूर्ण खात्री नाही ते देऊ नको. शुद्धलेखन दोनदा तपास.\n5. "आधीच आहेत" यादीतले शब्द / वाक्ये परत देऊ नको.\n6. उत्तर फक्त खालील format मध्ये, संपूर्ण एकाच code block मध्ये. क्रमांक, bullet, bold, स्पष्टीकरण काहीही नको. प्रत्येक प्रकाराचे शीर्षक [चौकोनी कंसात] जसेच्या तसे ठेव.\n`
      : `You are an experienced English teacher preparing question material for the Maharashtra State Scholarship Exam, Std 4 (formerly Std 5), English section. The children study in Marathi-medium schools.\n\nRules:\n1. Simple English for a 9-year-old Marathi-medium child.\n2. Write passages, poems, conversations and notices yourself — never copy from textbooks or anywhere else.\n3. Give ${n} new entries for each section (passage / poem / conversation / notice: ${Math.max(2, Math.round(n / 10))} each).\n4. Give only what you are fully sure is correct. British spelling.\n5. Do not repeat anything from the "already have" lists.\n6. Answer ONLY in the format below, all inside ONE code block. No numbering, bullets, bold or explanations. Keep each section heading in [square brackets] exactly as written.\n`;
    const body = ks.map(k => {
      const have = avoid ? k.list().filter(Boolean) : [];
      const hv = have.length ? `\n${isMr ? 'आधीच आहेत (देऊ नको)' : 'Already have (do not repeat)'}: ${have.slice(0, 250).join(', ')}` : '';
      return `[${k.h[0]}]\n${isMr ? 'Format' : 'Format'}: ${k.fmt}\n${isMr ? 'सूचना' : 'Note'}: ${k.ask}\n${isMr ? 'उदाहरण' : 'Example'}:\n${k.ex.join('\n')}${k.type === 'block' ? '\n---' : ''}${hv}`;
    }).join('\n\n');
    return `${head}\n${body}\n\n${isMr ? 'आता वरील प्रत्येक [प्रकार] साठी नवीन नोंदी दे.' : 'Now give the new entries for every [section] above.'}`;
  }

  /* ───────────── UI ───────────── */
  function _css() {
    if (document.getElementById('schstock-css')) return;
    const s = document.createElement('style'); s.id = 'schstock-css';
    s.textContent = `.ss-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto}
.ss-box{background:var(--bg2,#fff);color:var(--text,#111);border:1px solid var(--border,#ccc);border-radius:14px;width:min(980px,100%);padding:14px;display:flex;flex-direction:column;gap:10px}
.ss-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ss-top h3{margin:0;font-size:1.2rem;font-weight:800;flex:1}
.ss-tabs{display:flex;gap:6px;flex-wrap:wrap}.ss-tab{border:1.5px solid var(--border,#ccc);background:var(--bg3,#f4f4f4);color:inherit;border-radius:18px;padding:7px 15px;font:inherit;font-weight:800;font-size:.95rem;cursor:pointer}
.ss-tab[aria-selected="true"]{background:var(--accent,#6d3cf0);border-color:var(--accent,#6d3cf0);color:#fff}
.ss-ta{width:100%;min-height:260px;font:15px/1.6 Consolas,'Nirmala UI',monospace;border:1px solid var(--border,#ccc);border-radius:10px;padding:8px;background:var(--bg3,#fafafa);color:inherit;box-sizing:border-box}
.ss-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ss-row input[type=text]{flex:1;min-width:180px}
.ss-sum{font-size:1rem;font-weight:800}.ss-list{display:flex;flex-direction:column;gap:4px;max-height:420px;overflow-y:auto}
.ss-r{display:grid;grid-template-columns:22px 26px 170px 1fr;gap:6px;align-items:start;font-size:.95rem;border-bottom:1px solid var(--border,#eee);padding:4px 2px}
.ss-r .k{font-weight:800;color:var(--text2,#555)}.ss-r .m{display:block;color:var(--text2,#666);font-size:.85rem;font-weight:600}.ss-r.bad .m{color:#d14343}.ss-r.sus .m{color:#b7791f}.ss-r.dup{opacity:.6}
.ss-chips{display:flex;flex-wrap:wrap;gap:7px}.ss-chip{border:1.5px solid var(--border,#ccc);background:var(--bg3,#f4f4f4);color:inherit;border-radius:18px;padding:6px 13px;font:inherit;font-size:.95rem;font-weight:700;cursor:pointer;line-height:1.3}.ss-chip small{font-size:.8rem;font-weight:600;opacity:.8}
.ss-chip[aria-pressed="true"]{background:var(--accent,#6d3cf0);border-color:var(--accent,#6d3cf0);color:#fff}
.ss-b{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid var(--border,#ddd);border-radius:10px;padding:10px;font-size:.95rem}.ss-b b{flex:1;min-width:160px}
.ss-pill{font-size:.7rem;font-weight:700;border-radius:10px;padding:1px 8px;background:#e3f5e8;color:#15803d}.ss-pill.rv{background:#fff4d6;color:#a16207}
.ss-cnt{font-size:.9rem;font-weight:600;color:var(--text2,#666)}`;
    document.head.appendChild(s);
  }
  const ICON = { new: '✅', part: '➕', dup: '⏭️', bad: '⚠️', sus: '🔍' };
  let ui = null;
  async function open(opts = {}) {
    _css(); await load();
    ui?.ov.remove();
    const ov = document.createElement('div'); ov.className = 'ss-ov';
    ov.innerHTML = `<div class="ss-box" role="dialog" aria-modal="true" aria-label="साठा वाढवा"><div class="ss-top"><h3>📚 शिष्यवृत्ती साठा वाढवा (4थी मराठी / English)</h3><button type="button" class="admin-btn-secondary" data-ss-close aria-label="बंद करा">✕</button></div>
      <div class="ss-tabs" role="tablist"><button type="button" class="ss-tab" role="tab" data-ss-tab="paste">📥 पेस्ट करा</button><button type="button" class="ss-tab" role="tab" data-ss-tab="prompt">📋 AI साठी prompt</button><button type="button" class="ss-tab" role="tab" data-ss-tab="batches">📦 Batches</button></div>
      <div id="ss-body"></div></div>`;
    document.body.appendChild(ov);
    ui = { ov, tab: 'paste', rows: [], text: '', sub: opts.sub === EN ? EN : MR, pick: null, n: 20, avoid: true };
    ov.addEventListener('click', onClick); ov.addEventListener('change', onChange); ov.addEventListener('input', e => { if (e.target.id === 'ss-text') ui.text = e.target.value; });
    render();
  }
  function counts(sub) { return K.filter(k => k.sub === sub).map(k => `${k.h[0]}: ${k.count()}`).join(' · '); }
  function render() {
    const body = ui.ov.querySelector('#ss-body');
    ui.ov.querySelectorAll('[data-ss-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ssTab === ui.tab)));
    if (ui.tab === 'paste') {
      const r = ui.rows, c = s => r.filter(x => x.st === s).length, on = r.filter(x => x.on).length;
      body.innerHTML = `<p class="ss-cnt" style="margin:0">AI चं संपूर्ण उत्तर इथे एकदम पेस्ट करा. प्रत्येक भाग [प्रकार] शीर्षकाखाली हवा. "तपासा" दाबल्यावर आधीच असलेले शब्द आपोआप वगळले जातील.</p>
        <textarea class="ss-ta" id="ss-text" spellcheck="false" placeholder="[समानार्थी]&#10;पाणी = जल, नीर, उदक&#10;&#10;[Opposites]&#10;big = small">${esc(ui.text)}</textarea>
        <div class="ss-row"><button type="button" class="admin-btn-primary" data-ss-check>🔎 तपासा</button>
          <input type="text" class="admin-input" id="ss-name" placeholder="Batch चे नाव (उदा. ChatGPT – समानार्थी 1)" value="${esc(ui.name || '')}">
          <select class="admin-select" id="ss-src">${['ChatGPT', 'Claude', 'Gemini', 'स्वतः', 'इतर'].map(x => `<option${x === (ui.src || 'ChatGPT') ? ' selected' : ''}>${x}</option>`).join('')}</select>
          <label class="ss-cnt"><input type="checkbox" id="ss-review"${ui.review ? ' checked' : ''}> आधी तपासणी (तपासेपर्यंत प्रश्नांत वापरू नका)</label></div>
        ${r.length ? `<div class="ss-sum">✅ नवीन ${c('new')} · ➕ अर्धे नवीन ${c('part')} · ⏭️ आधीच आहेत ${c('dup')} · 🔍 संशयास्पद ${c('sus')} · ⚠️ चूक ${c('bad')} — निवडलेले ${on}</div>
          <div class="ss-list">${r.map((x, i) => `<div class="ss-r ${x.st}"><input type="checkbox" data-ss-on="${i}"${x.on ? ' checked' : ''}${x.st === 'dup' || x.st === 'bad' ? ' disabled' : ''} aria-label="घ्या"><span>${ICON[x.st]}</span><span class="k">${esc(x.title || '—')}</span><span>${esc(x.show)}${x.msg ? `<span class="m">${esc(x.msg)}</span>` : ''}</span></div>`).join('')}</div>
          <div class="ss-row"><button type="button" class="admin-btn-primary" data-ss-save${on ? '' : ' disabled'}>💾 ${on} नोंदी Save करा</button><span class="ss-cnt" id="ss-msg"></span></div>` : ''}`;
    } else if (ui.tab === 'prompt') {
      const ks = K.filter(k => k.sub === ui.sub);
      if (!ui.pick || !ks.some(k => ui.pick.has(k.id))) ui.pick = new Set(ks.filter(k => k.type === 'line').slice(0, 6).map(k => k.id));
      const p = prompt(ui.sub, [...ui.pick], ui.n, ui.avoid);
      body.innerHTML = `<div class="ss-row"><span class="ss-cnt">विषय</span>${[MR, EN].map(s => `<button type="button" class="ss-chip" aria-pressed="${s === ui.sub}" data-ss-sub="${s}">${s}</button>`).join('')}
          <span class="ss-cnt">प्रत्येकी</span><select class="admin-select" id="ss-n">${[10, 20, 30, 50].map(x => `<option${x === ui.n ? ' selected' : ''}>${x}</option>`).join('')}</select>
          <label class="ss-cnt"><input type="checkbox" id="ss-avoid"${ui.avoid ? ' checked' : ''}> आधीचे शब्द prompt मध्ये देऊन "हे परत नको" सांगा</label></div>
        <div class="ss-chips">${ks.map(k => `<button type="button" class="ss-chip" aria-pressed="${ui.pick.has(k.id)}" data-ss-pick="${k.id}">${esc(k.h[0])} <small>(${k.count()})</small></button>`).join('')}</div>
        <p class="ss-cnt" style="margin:0">${ui.pick.size > 8 ? '⚠️ एका वेळी 6–8 प्रकार निवडा — जास्त निवडले तर AI चं उत्तर अर्धवट येऊ शकतं.' : 'एका वेळी 6–8 प्रकार निवडा. उतारे वेगळ्या prompt मध्ये घ्या.'}</p>
        <div class="ss-row"><button type="button" class="admin-btn-primary" data-ss-copy>📋 Prompt कॉपी करा</button><span class="ss-cnt" id="ss-copied"></span></div>
        <textarea class="ss-ta" id="ss-prompt" readonly style="min-height:220px">${esc(p)}</textarea>`;
    } else {
      const bs = st.batches;
      body.innerHTML = `<p class="ss-cnt" style="margin:0">${esc(counts(MR))}<br>${esc(counts(EN))}</p>
        ${bs.length ? bs.map(b => `<div class="ss-b"><b>${esc(b.name)}</b><span class="ss-cnt">${esc(b.source)} · ${new Date(b.created_at).toLocaleDateString('mr-IN')} · ${b.count} नोंदी</span>
          <span class="ss-pill${b.status === 'live' ? '' : ' rv'}">${b.status === 'live' ? 'प्रश्नांत वापरला जातो' : 'तपासणी बाकी'}</span>
          <button type="button" class="admin-btn-secondary" data-ss-print="${b.id}">🖨️ तपासणी यादी</button>
          <button type="button" class="admin-btn-secondary" data-ss-status="${b.id}">${b.status === 'live' ? '⏸️ थांबवा' : '✅ वापरा'}</button>
          <button type="button" class="admin-btn-secondary" data-ss-del="${b.id}">🗑️ काढा</button></div>`).join('') : '<p class="ss-cnt">अजून एकही batch नाही.</p>'}`;
    }
  }
  const toast = (m, t) => (window.APP?.toast ? APP.toast(m, t) : alert(m));
  async function onClick(e) {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (d.ssClose !== undefined) { ui.ov.remove(); ui = null; return; }
    if (d.ssTab) { ui.tab = d.ssTab; if (ui.tab === 'batches') await load(true); render(); return; }
    if (d.ssCheck !== undefined) { ui.text = ui.ov.querySelector('#ss-text').value; if (!ui.text.trim()) return toast('आधी मजकूर पेस्ट करा', 'error'); await load(true); ui.rows = check(ui.text); render(); return; }
    if (d.ssSave !== undefined) {
      const on = ui.rows.filter(x => x.on && x.entry);
      if (!on.length) return;
      t.disabled = true; const msg = ui.ov.querySelector('#ss-msg'); if (msg) msg.textContent = '⏳ Save होत आहे…';
      ui.name = ui.ov.querySelector('#ss-name').value.trim(); ui.src = ui.ov.querySelector('#ss-src').value; ui.review = ui.ov.querySelector('#ss-review').checked;
      try {
        const r = await API.schStockSave({ exam: EXAM, name: ui.name || `${ui.src} – ${new Date().toLocaleDateString('mr-IN')}`, source: ui.src, status: ui.review ? 'review' : 'live', items: on.map(x => ({ kind: x.kind, entry: x.entry, norm: x.norm })) });
        if (!r?.success) throw new Error(r?.message || 'Save झालं नाही');
        await load(true);
        toast(`✅ ${r.data.saved} नोंदी save झाल्या${r.data.skipped ? `, ${r.data.skipped} आधीच होत्या` : ''}${ui.review ? ' (तपासणी बाकी)' : ''}`, 'success');
        ui.rows = []; ui.text = ''; ui.tab = 'batches'; render();
      } catch (err) { t.disabled = false; if (msg) msg.textContent = '⚠️ ' + (err.message || 'Save झालं नाही'); }
      return;
    }
    if (d.ssSub) { ui.sub = d.ssSub; ui.pick = null; render(); return; }
    if (d.ssPick) { ui.pick.has(d.ssPick) ? ui.pick.delete(d.ssPick) : ui.pick.add(d.ssPick); if (!ui.pick.size) ui.pick.add(d.ssPick); render(); return; }
    if (d.ssCopy !== undefined) { const p = ui.ov.querySelector('#ss-prompt'); try { await navigator.clipboard.writeText(p.value); } catch { p.select(); document.execCommand('copy'); } ui.ov.querySelector('#ss-copied').textContent = '✅ कॉपी झाला — ChatGPT / Claude मध्ये पेस्ट करा'; return; }
    if (d.ssStatus) { const b = st.batches.find(x => x.id === d.ssStatus); try { await API.schStockBatch(b.id, b.status === 'live' ? 'review' : 'live'); } catch (err) { return toast(err.message || 'झालं नाही', 'error'); } await load(true); render(); return; }
    if (d.ssDel) { const b = st.batches.find(x => x.id === d.ssDel); if (!confirm(`"${b.name}" मधल्या ${b.count} नोंदी कायमच्या काढायच्या?`)) return; let r; try { r = await API.schStockDeleteBatch(b.id); } catch (err) { return toast(err.message || 'झालं नाही', 'error'); } await load(true); toast(`🗑️ ${r.data.removed} नोंदी काढल्या`, 'success'); render(); return; }
    if (d.ssPrint) printBatch(d.ssPrint);
  }
  function onChange(e) {
    const t = e.target;
    if (t.dataset.ssOn !== undefined) { ui.rows[+t.dataset.ssOn].on = t.checked; const n = ui.rows.filter(x => x.on).length; const b = ui.ov.querySelector('[data-ss-save]'); if (b) { b.disabled = !n; b.textContent = `💾 ${n} नोंदी Save करा`; } return; }
    if (t.id === 'ss-n') { ui.n = +t.value; render(); } if (t.id === 'ss-avoid') { ui.avoid = t.checked; render(); }
  }
  async function printBatch(id) {
    const b = st.batches.find(x => x.id === id), its = st.items.filter(i => i.batch_id === id);
    const groups = new Map(); its.forEach(i => { const k = kindOf(i.kind); const g = k ? k.h[0] : i.kind; (groups.get(g) || groups.set(g, []).get(g)).push(i); });
    const row = i => { const k = kindOf(i.kind); if (k?.type === 'block') { const [t, qs] = i.entry; return `<div class="p">${esc(t)}</div><ol>${qs.map(([q, a, w]) => `<li>${esc(q)}<br><b>✔ ${esc(a)}</b> · ✘ ${w.map(esc).join(' · ✘ ')}</li>`).join('')}</ol>`; } return `<li>${esc(k ? k.show(i.entry) : JSON.stringify(i.entry))}</li>`; };
    const html = `<!doctype html><html lang="mr"><head><meta charset="utf-8"><title>${esc(b.name)}</title><style>body{font-family:'Nirmala UI','Noto Sans Devanagari',sans-serif;font-size:13px;margin:24px}h1{font-size:18px}h2{font-size:15px;background:#eee;padding:4px 8px}li{margin:3px 0}.p{white-space:pre-line;background:#f6f4ff;padding:6px 9px;border-left:3px solid #6d3cf0;margin-top:10px}</style></head><body>
      <h1>📚 ${esc(b.name)} — तपासणी यादी</h1><p>${esc(b.source)} · ${new Date(b.created_at).toLocaleDateString('mr-IN')} · ${b.count} नोंदी. चुकीच्या नोंदीवर खूण करा.</p>
      ${[...groups].map(([g, list]) => `<h2>${esc(g)} (${list.length})</h2>${kindOf(list[0].kind)?.type === 'block' ? list.map(row).join('') : `<ol>${list.map(row).join('')}</ol>`}`).join('')}</body></html>`;
    if (window.Capacitor?.isNativePlatform?.() && window.FILE_EXPORT) { try { await FILE_EXPORT.saveAndShare(new Blob([html], { type: 'text/html' }), `stock_${Date.now()}.html`); toast('Saved — उघडून Print → Save as PDF', 'success'); } catch (e) { toast(e?.message || 'झालं नाही', 'error'); } return; }
    const w = window.open('', '_blank'); if (!w) return toast('Popup ला परवानगी द्या', 'error');
    w.document.open(); w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 300);
  }

  return { load, open, check, prompt, rebuild, KINDS: K, _st: st, _norm: nk };
})();
window.SCHSTOCK = SCHSTOCK;
