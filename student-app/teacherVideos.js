/* ════════════════════════════════════════
   teacherVideos.js — 🎬 a school teacher's own YouTube videos, only for that teacher's students
   (owner 2026-11-19: the YouTube-partner programme is closed; teachers get this instead).
   Teacher: Teacher Dashboard › "🎬 Videos" — paste a YouTube link, name it, choose who sees it (all my
   students / one batch) and, if wanted, the Exercise / Notes / Test it belongs to; edit, hide, delete, and
   see how many students opened it. A new video → a push to those students and their parents.
   Student: Home › "🎬 माझ्या सरांचे Videos" (the latest, and the full list); a video on an Exercise /
   Notes / Test also shows on that screen's "🎬 Videos" button (videoTeacherSelect.js). Played in the app.
   Another teacher's videos are never shown (the server only returns the student's own teachers').
   Global: TEACHER_VIDEOS
════════════════════════════════════════ */

const TEACHER_VIDEOS = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => (window.APP?.toast || window.toast || (() => {}))(m, t);
  const thumb = id => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;

  // the same links the server accepts (youtu.be, watch?v=, shorts, live, m.youtube.com, embed)
  function videoIdOf(url) {
    const s = String(url || '').trim();
    const m = s.match(/^https?:\/\/(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/)
      || s.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube|youtube-nocookie)\.com\/watch\?[^#]*\bv=([A-Za-z0-9_-]{11})/)
      || s.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube|youtube-nocookie)\.com\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(s) ? s : '';
  }
  const whereText = v => [v.batch || 'सगळे माझे students', v.chapter, v.exercise_no ? `Exercise ${v.exercise_no}` : v.concept_title ? `📓 ${v.concept_title}` : v.quiz_title ? `📝 ${v.quiz_title}` : ''].filter(Boolean).join(' · ');
  const play = (v, record) => window.VIDEO_TEACHER_SELECT?.play?.(record ? v.id : null, v.video_id, v.title);

  // ══ Teacher: the "🎬 Videos" tab ══════════════════════════════════════════
  let _data = { videos: [], batches: [], students: 0 };
  let _tree = null, _editing = null;

  async function initTeacher() {
    const host = $('td-tab-videos');
    if (!host) return;
    host.innerHTML = `
      <div class="tv-box">
        <h4 class="tv-h">🎬 माझे Videos</h4>
        <p class="td-hint td-hint-sm">YouTube वर टाकलेल्या video ची link इथे जोडा. तो <b>फक्त तुमच्या students ना</b> app मध्ये दिसेल (YouTube वर "Unlisted" ठेवला तरी चालतो).</p>
        <p class="td-hint td-hint-sm">💡 Video कसा बनवायचा: app मध्ये Test उघडा → ✏️ Board mode → पेनने प्रश्न सोडवा → phone च्या screen recorder ने record करा → YouTube वर टाका.</p>
      </div>
      <div class="tv-box" id="tv-form">
        <h4 class="tv-h" id="tv-form-title">➕ Video जोडा</h4>
        <label class="tv-l">YouTube link<input id="tv-url" class="td-modal-select" type="url" inputmode="url" autocapitalize="off" placeholder="https://youtu.be/…" /></label>
        <div id="tv-prev" class="tv-prev hidden"></div>
        <label class="tv-l">Video चं नाव<input id="tv-title" class="td-modal-select" maxlength="120" placeholder="उदा. परिमेय संख्या — सोपी पद्धत" /></label>
        <label class="tv-l">कोणासाठी<select id="tv-batch" class="td-modal-select"></select></label>
        <div id="tv-where" class="hidden">
          <label class="tv-l">विषय<select id="tv-subject" class="td-modal-select"><option value="">— विषय (हवं असेल तर) —</option></select></label>
          <label class="tv-l">धडा<select id="tv-chapter" class="td-modal-select"><option value="">— धडा —</option></select></label>
          <label class="tv-l">कुठे दाखवायचा<select id="tv-kind" class="td-modal-select">
            <option value="">फक्त "माझ्या सरांचे Videos" यादीत</option><option value="exercise">📝 एका Exercise जवळ</option><option value="concept">📓 एका Notes जवळ</option><option value="quiz">🧪 एका Test जवळ</option></select></label>
          <label class="tv-l hidden" id="tv-item-l"><span id="tv-item-name">निवडा</span><select id="tv-item" class="td-modal-select"></select></label>
        </div>
        <label class="tv-chk"><input type="checkbox" id="tv-notify" checked /> 🔔 students आणि पालकांना notification पाठवा</label>
        <div class="tv-actions">
          <button type="button" class="td-send-notif-btn" id="tv-save">💾 Video जोडा</button>
          <button type="button" class="admin-btn-secondary hidden" id="tv-cancel">रद्द करा</button>
        </div>
        <p class="td-hint td-hint-sm" id="tv-msg" role="status"></p>
      </div>
      <div class="tv-box"><h4 class="tv-h">📋 जोडलेले videos <small id="tv-count"></small></h4><div id="tv-list"><p class="td-hint">लोड होत आहे…</p></div></div>`;
    $('tv-url').addEventListener('input', _preview);
    $('tv-batch').addEventListener('change', _onBatch);
    $('tv-subject').addEventListener('change', _onSubject);
    $('tv-chapter').addEventListener('change', _onKind);
    $('tv-kind').addEventListener('change', _onKind);
    $('tv-save').addEventListener('click', _save);
    $('tv-cancel').addEventListener('click', () => _resetForm());
    await _load();
  }

  async function _load() {
    try {
      _data = (await API.teacherVideos('GET', '/mine'))?.data || _data;
    } catch (err) { $('tv-list').innerHTML = `<p class="td-hint">${esc(err.message || 'Videos उघडता आले नाहीत')}</p>`; return; }
    const sel = $('tv-batch');
    sel.innerHTML = `<option value="">👩‍🎓 माझे सगळे students (${_data.students})</option>` + _data.batches.map(b => `<option value="${esc(b)}">📚 फक्त ${esc(b)}</option>`).join('');
    _paintList();
  }

  function _preview() {
    const id = videoIdOf($('tv-url').value), box = $('tv-prev');
    box.classList.toggle('hidden', !id);
    box.innerHTML = id ? `<img src="${thumb(id)}" alt="" loading="lazy" /><span>✅ Video सापडला</span>` : '';
    if (!id && $('tv-url').value.trim().length > 8) { box.classList.remove('hidden'); box.innerHTML = '<span class="tv-bad">⚠️ ही YouTube video ची link वाटत नाही</span>'; }
  }

  async function _treeFor(batch) {
    // the same catalog the Paper tab uses (chapters from the batch and from its questions)
    // ({ name, subjects: ['Maths', …], chapters: [{ subject, name }] }), else the batch tree
    // ({ name, subjects: [{ name, chapters: ['…'] }] }) — both made into the second shape
    if (!_tree) {
      const raw = await API.syncServerBatches().catch(() => null) || (await API.teacherVideos('GET', '/pick/tree').catch(() => null))?.data || [];
      _tree = raw.map(b => ({
        name: b.name,
        subjects: (b.subjects || []).map(s => {
          const name = typeof s === 'string' ? s : s.name;
          const own = typeof s === 'string' ? [] : (s.chapters || []).map(c => c.name || c);
          const flat = (b.chapters || []).filter(c => c.subject === name).map(c => c.name);
          return { name, chapters: [...new Set([...own, ...flat])] };
        }),
      }));
    }
    return _tree.find(b => b.name === batch) || null;
  }
  async function _onBatch() {
    const batch = $('tv-batch').value;
    $('tv-where').classList.toggle('hidden', !batch);
    const b = batch ? await _treeFor(batch) : null;
    $('tv-subject').innerHTML = '<option value="">— विषय (हवं असेल तर) —</option>' + (b?.subjects || []).map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
    _onSubject();
  }
  async function _onSubject() {
    const b = await _treeFor($('tv-batch').value), s = b?.subjects.find(x => x.name === $('tv-subject').value);
    $('tv-chapter').innerHTML = '<option value="">— धडा —</option>' + (s?.chapters || []).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    _onKind();
  }
  async function _onKind() {
    const kind = $('tv-kind').value, batch = $('tv-batch').value, subject = $('tv-subject').value, chapter = $('tv-chapter').value;
    const l = $('tv-item-l'), sel = $('tv-item');
    if (!kind || !chapter) { l.classList.add('hidden'); sel.innerHTML = ''; return; }
    l.classList.remove('hidden');
    sel.innerHTML = '<option value="">लोड होत आहे…</option>';
    const qs = `?batch=${encodeURIComponent(batch)}&subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`;
    try {
      if (kind === 'exercise') {
        $('tv-item-name').textContent = 'Exercise';
        const list = (await API.teacherVideos('GET', '/pick/exercises' + qs))?.data || [];
        sel.innerHTML = list.length ? list.map(n => `<option value="${esc(n)}">Exercise ${esc(n)}</option>`).join('') : '<option value="">या धड्यात Exercise नाही</option>';
      } else if (kind === 'concept') {
        $('tv-item-name').textContent = 'Notes';
        const list = (await API.teacherVideos('GET', '/pick/concepts' + qs))?.data || [];
        sel.innerHTML = list.length ? list.map(c => `<option value="${esc(c.id)}" data-title="${esc(c.title)}">${esc(c.title)}</option>`).join('') : '<option value="">या धड्यात Notes नाहीत</option>';
      } else {
        $('tv-item-name').textContent = 'Test';
        const list = (await API.teacherVideos('GET', '/pick/quiz-tests' + qs))?.data || [];
        sel.innerHTML = list.length ? list.map(q => `<option value="${esc(q.quiz_id)}" data-title="${esc(q.title)}">${esc(q.title)}</option>`).join('') : '<option value="">या धड्यात Test नाही</option>';
      }
    } catch { sel.innerHTML = '<option value="">उघडता आलं नाही</option>'; }
  }

  function _body() {
    const kind = $('tv-kind').value, item = $('tv-item'), opt = item.selectedOptions?.[0];
    const batch = $('tv-batch').value, subject = batch ? $('tv-subject').value : '', chapter = batch ? $('tv-chapter').value : '';
    const b = { url: $('tv-url').value.trim(), title: $('tv-title').value.trim(), batch, subject, chapter, exercise_no: '', concept_id: '', concept_title: '', quiz_id: '', quiz_title: '' };
    if (batch && chapter && kind && item.value) {
      if (kind === 'exercise') b.exercise_no = item.value;
      if (kind === 'concept') { b.concept_id = item.value; b.concept_title = opt?.dataset.title || ''; }
      if (kind === 'quiz') { b.quiz_id = item.value; b.quiz_title = opt?.dataset.title || ''; }
    }
    return b;
  }

  async function _save() {
    const b = _body(), msg = $('tv-msg'), btn = $('tv-save');
    if (!videoIdOf(b.url)) { msg.textContent = '⚠️ YouTube video ची link paste करा'; return; }
    if (!b.title) { msg.textContent = '⚠️ Video चं नाव लिहा'; return; }
    if ($('tv-kind').value && !$('tv-item').value) { msg.textContent = '⚠️ धडा आणि Exercise / Notes / Test निवडा, किंवा "फक्त यादीत" ठेवा'; return; }
    btn.disabled = true; msg.textContent = '⏳ जतन करत आहे…';
    try {
      if (_editing) {
        await API.teacherVideos('PUT', `/mine/${encodeURIComponent(_editing)}`, b);
        toast('✅ Video बदलला', 'success');
      } else {
        const r = await API.teacherVideos('POST', '/mine', { ...b, notify: $('tv-notify').checked });
        toast(r?.notified ? `✅ Video जोडला — ${r.notified} students ना कळवलं` : '✅ Video जोडला', 'success');
      }
      _resetForm();
      await _load();
    } catch (err) { msg.textContent = '⚠️ ' + (err.message || 'जतन झालं नाही'); }
    finally { btn.disabled = false; }
  }

  function _resetForm() {
    _editing = null;
    ['tv-url', 'tv-title'].forEach(id => { $(id).value = ''; });
    $('tv-batch').value = ''; $('tv-kind').value = '';
    $('tv-where').classList.add('hidden'); $('tv-item-l').classList.add('hidden');
    $('tv-prev').classList.add('hidden');
    $('tv-form-title').textContent = '➕ Video जोडा';
    $('tv-save').textContent = '💾 Video जोडा';
    $('tv-cancel').classList.add('hidden');
    $('tv-notify').closest('label').classList.remove('hidden');
    $('tv-msg').textContent = '';
  }

  async function _edit(v) {
    _editing = v.id;
    $('tv-url').value = `https://youtu.be/${v.video_id}`; _preview();
    $('tv-title').value = v.title;
    $('tv-batch').value = v.batch || '';
    await _onBatch();
    if (v.batch) {
      $('tv-subject').value = v.subject || ''; await _onSubject();
      $('tv-chapter').value = v.chapter || '';
      $('tv-kind').value = v.exercise_no ? 'exercise' : v.concept_id ? 'concept' : v.quiz_id ? 'quiz' : '';
      await _onKind();
      $('tv-item').value = v.exercise_no || v.concept_id || v.quiz_id || '';
    }
    $('tv-form-title').textContent = '✏️ Video बदला';
    $('tv-save').textContent = '💾 बदल जतन करा';
    $('tv-cancel').classList.remove('hidden');
    $('tv-notify').closest('label').classList.add('hidden');
    $('tv-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function _paintList() {
    const list = $('tv-list'), vs = _data.videos;
    $('tv-count').textContent = vs.length ? `(${vs.length})` : '';
    if (!vs.length) { list.innerHTML = '<p class="td-hint">अजून video नाही. वर link paste करून पहिला video जोडा.</p>'; return; }
    list.innerHTML = vs.map(v => `
      <div class="tv-item${v.hidden || v.removed_by_admin ? ' tv-off' : ''}" data-id="${esc(v.id)}">
        <button type="button" class="tv-thumb" data-act="play" aria-label="पाहा"><img src="${thumb(v.video_id)}" alt="" loading="lazy" /><span>▶</span></button>
        <div class="tv-info">
          <b>${esc(v.title)}</b>
          <small>${esc(whereText(v))}</small>
          <small>👀 ${v.viewers} students नी पाहिला · ▶ ${v.open_count} वेळा${v.hidden ? ' · 🙈 लपवलेला' : ''}${v.removed_by_admin ? ' · ⛔ Admin ने काढला' : ''}</small>
          <div class="tv-btns">
            <button type="button" class="admin-btn-secondary" data-act="edit">✏️ बदला</button>
            <button type="button" class="admin-btn-secondary" data-act="hide">${v.hidden ? '👁 दाखवा' : '🙈 लपवा'}</button>
            <button type="button" class="admin-btn-secondary" data-act="del">🗑️</button>
          </div>
        </div>
      </div>`).join('');
    list.querySelectorAll('.tv-item').forEach(row => {
      const v = vs.find(x => x.id === row.dataset.id);
      row.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
        const act = btn.dataset.act;
        if (act === 'play') return play(v, false);
        if (act === 'edit') return _edit(v);
        try {
          if (act === 'hide') { await API.teacherVideos('PUT', `/mine/${encodeURIComponent(v.id)}`, { hidden: !v.hidden }); toast(v.hidden ? '👁 Video पुन्हा दिसेल' : '🙈 Video लपवला', 'success'); }
          if (act === 'del') {
            const ok = typeof UI !== 'undefined' && UI.confirmAsync ? await UI.confirmAsync(`"${v.title}" काढून टाकायचा?`) : confirm(`"${v.title}" काढून टाकायचा?`);
            if (!ok) return;
            await API.teacherVideos('DELETE', `/mine/${encodeURIComponent(v.id)}`); toast('🗑️ Video काढला', 'success');
          }
          await _load();
        } catch (err) { toast(err.message || 'झालं नाही', 'error'); }
      }));
    });
  }

  // ══ Student: Home › "🎬 माझ्या सरांचे Videos" ═════════════════════════════
  let _mine = [];
  async function renderHomeCard() {
    const home = $('screen-home');
    if (!home || window.GUEST?.isActive?.() || !navigator.onLine) return;
    try { _mine = await API.fetchMyTeacherVideos(); } catch { return; }
    home.querySelector('.tv-home')?.remove();
    if (!_mine.length) return;
    const card = document.createElement('div');
    card.className = 're-card tv-home';
    card.innerHTML = `<div class="re-card-head"><b>🎬 माझ्या सरांचे Videos</b>${_mine.length > 3 ? `<button type="button" class="re-open-btn" data-all>सगळे (${_mine.length})</button>` : ''}</div>
      <div class="tv-home-row">${_mine.slice(0, 3).map(v => `<button type="button" class="tv-home-v" data-id="${esc(v.id)}"><img src="${thumb(v.video_id)}" alt="" loading="lazy" /><span>${esc(v.title)}</span><small>${esc(v.teacher_name || '')}</small></button>`).join('')}</div>`;
    card.querySelectorAll('.tv-home-v').forEach(b => b.addEventListener('click', () => play(_mine.find(v => v.id === b.dataset.id), true)));
    card.querySelector('[data-all]')?.addEventListener('click', openList);
    const wk = home.querySelector('.wk-strip-wrap, .wk-card, .wk-lock');   // after the महा-Test / practice row
    if (wk) wk.after(card); else home.insertBefore(card, home.firstElementChild);
  }

  // the full list, in the same screen the "🎬 Videos" buttons use
  async function openList() {
    if (!_mine.length) { try { _mine = await API.fetchMyTeacherVideos(); } catch { /* offline */ } }
    window.APP?.navigate?.('video-teachers');
    $('vts-title').textContent = '🎬 माझ्या सरांचे Videos';
    const list = $('vts-list');
    list.innerHTML = _mine.length ? _mine.map(v => `
      <button type="button" class="vts-card" data-id="${esc(v.id)}">
        <span class="vts-thumb tv-wide"><img src="${thumb(v.video_id)}" alt="" loading="lazy" /></span>
        <span class="vts-info"><strong>${esc(v.title)}</strong><small>${esc([v.teacher_name, v.chapter, v.exercise_no ? `Exercise ${v.exercise_no}` : v.concept_title || v.quiz_title].filter(Boolean).join(' · '))}</small></span>
      </button>`).join('') : '<p class="vts-empty">अजून तुमच्या सरांनी video टाकलेला नाही.</p>';
    list.querySelectorAll('.vts-card').forEach(b => b.addEventListener('click', () => play(_mine.find(v => v.id === b.dataset.id), true)));
  }

  return { initTeacher, renderHomeCard, openList, videoIdOf };
})();

window.TEACHER_VIDEOS = TEACHER_VIDEOS;
