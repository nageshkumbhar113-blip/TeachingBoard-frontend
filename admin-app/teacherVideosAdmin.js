/* ════════════════════════════════════════
   teacherVideosAdmin.js — Admin › 🎬 Teacher Videos (owner 2026-11-19)
   Every school teacher's own YouTube videos (they go only to that teacher's students; no approval step).
   The admin can search and take a video off the students' side ("⛔ काढा") or put it back.
   Global: TEACHER_VIDEOS_ADMIN
════════════════════════════════════════ */
const TEACHER_VIDEOS_ADMIN = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let _timer = null;

  function init() {
    const box = $('tva-container');
    if (!box) return;
    if (!box.dataset.ready) {
      box.dataset.ready = '1';
      box.innerHTML = `
        <div class="bp-header"><h2>🎬 Teacher Videos</h2>
          <p class="import-hint">शिक्षकांनी त्यांच्या स्वतःच्या students साठी जोडलेले YouTube videos. Video फक्त त्या शिक्षकाच्या students ना दिसतो, म्हणून मंजुरी लागत नाही. चुकीचा video दिसला तर "⛔ काढा" दाबा: तो students ना दिसणं बंद होईल.</p></div>
        <input id="tva-q" class="admin-input" type="search" placeholder="Video चं नाव, शिक्षकाचं नाव किंवा code" style="max-width:340px" />
        <div id="tva-list" style="margin-top:10px"></div>`;
      $('tva-q').addEventListener('input', () => { clearTimeout(_timer); _timer = setTimeout(load, 300); });
    }
    load();
  }

  async function load() {
    const list = $('tva-list');
    list.innerHTML = '<p class="import-hint">Loading…</p>';
    let rows = [];
    try { rows = await API.adminTeacherVideos($('tva-q')?.value.trim() || ''); }
    catch (err) { list.innerHTML = `<p class="import-hint">${esc(err.message || 'Load failed')}</p>`; return; }
    if (!rows.length) { list.innerHTML = '<p class="import-hint">अजून कोणत्याही शिक्षकाने video जोडलेला नाही.</p>'; return; }
    list.innerHTML = `<div class="import-hint">${rows.length} videos</div>` + rows.map(v => `
      <div class="admin-card" style="display:flex;gap:12px;align-items:center;padding:10px;margin:6px 0;${v.removed_by_admin ? 'opacity:.55' : ''}">
        <a href="https://youtu.be/${esc(v.video_id)}" target="_blank" rel="noopener" style="flex:0 0 120px"><img src="https://i.ytimg.com/vi/${esc(v.video_id)}/mqdefault.jpg" alt="" loading="lazy" style="width:120px;border-radius:8px;display:block" /></a>
        <div style="flex:1;min-width:0">
          <b>${esc(v.title)}</b><br>
          <small>👩‍🏫 ${esc(v.teacher_name)} (${esc(v.teacher_code)}) · ${esc(v.batch || 'सगळे students')}${v.chapter ? ' · ' + esc(v.chapter) : ''}${v.exercise_no ? ' · Ex ' + esc(v.exercise_no) : v.concept_title ? ' · 📓 ' + esc(v.concept_title) : v.quiz_title ? ' · 📝 ' + esc(v.quiz_title) : ''}</small><br>
          <small>👀 ${v.viewers} students · ▶ ${v.open_count} · ${new Date(v.created_at).toLocaleDateString('en-IN')}${v.hidden ? ' · 🙈 शिक्षकाने लपवला' : ''}${v.removed_by_admin ? ' · ⛔ काढलेला' : ''}</small>
        </div>
        <button type="button" class="admin-btn-secondary" data-id="${esc(v.id)}" data-removed="${v.removed_by_admin ? '1' : ''}">${v.removed_by_admin ? '↩️ परत दाखवा' : '⛔ काढा'}</button>
      </div>`).join('');
    list.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await API.adminRemoveTeacherVideo(b.dataset.id, !b.dataset.removed); await load(); }
      catch (err) { alert(err.message || 'झालं नाही'); b.disabled = false; }
    }));
  }

  return { init, load };
})();
window.TEACHER_VIDEOS_ADMIN = TEACHER_VIDEOS_ADMIN;
