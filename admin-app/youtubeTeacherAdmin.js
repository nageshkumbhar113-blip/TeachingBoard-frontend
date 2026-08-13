/* ════════════════════════════════════════
   youtubeTeacherAdmin.js — YouTube Teacher Partner Admin
   Approvals / Directory / Video Gaps / Subscriptions
   Global: YOUTUBE_TEACHER_ADMIN
   Same fetch/auth-header pattern as batchPricingManager.js — the closest
   existing analog (batch-level admin config module).
════════════════════════════════════════ */

const YOUTUBE_TEACHER_ADMIN = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let _listenersBound = false;
  let _activeSub = 'approvals';

  function _apiBase() {
    return (window.API?.getApiUrl?.() || window.TEACHINGBOARD_API_URL || '').replace(/\/+$/, '');
  }

  async function _authHeaders(extra = {}) {
    let token = '';
    try { token = await API.ensureAdminSession(); }
    catch { token = API.getAdminToken?.() || ''; }
    return { Authorization: `Bearer ${token}`, ...extra };
  }

  async function _req(path, options = {}) {
    const res = await fetch(`${_apiBase()}${path}`, { ...options, headers: await _authHeaders(options.headers || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }

  // NOTE: APP is a top-level `const` in admin-shell.js, not `window.APP` —
  // a plain <script> top-level const/let never attaches to window. Same
  // convention as the rest of admin.js (bare `APP.toast?.(...)`).
  function _hasApp() { return typeof APP !== 'undefined'; }
  function _toast(msg, type) { _hasApp() && APP.toast ? APP.toast(msg, type) : console.log(msg); }
  async function _confirm(msg) { return _hasApp() && APP.confirmAsync ? APP.confirmAsync(msg) : true; }
  async function _prompt(msg, def) { return _hasApp() && APP.promptAsync ? APP.promptAsync(msg, 'text', def || '') : (def || ''); }

  // ════════════════════════
  // INIT
  // ════════════════════════

  async function init() {
    if (!_listenersBound) {
      document.querySelectorAll('[data-ytt-sub]').forEach(btn => {
        btn.addEventListener('click', () => _switchSub(btn.dataset.yttSub));
      });
      _listenersBound = true;
    }
    _switchSub(_activeSub);
  }

  function _switchSub(name) {
    _activeSub = name;
    document.querySelectorAll('[data-ytt-sub]').forEach(b => b.classList.toggle('active', b.dataset.yttSub === name));
    if (name === 'approvals')     _renderApprovals();
    if (name === 'directory')     _renderDirectory();
    if (name === 'gaps')          _renderGaps();
    if (name === 'subscriptions') _renderSubscriptions();
  }

  // ════════════════════════
  // APPROVALS
  // ════════════════════════

  async function _renderApprovals(status = 'pending') {
    const body = $('ytt-body');
    body.innerHTML = '<div style="text-align:center;padding:2rem;color:#999;">Loading…</div>';
    try {
      const { data: videos } = await _req(`/admin/youtube-teacher-videos?status=${status}`);
      body.innerHTML = `
        <div style="display:flex;gap:6px;margin-bottom:14px;">
          ${['pending', 'approved', 'rejected'].map(s =>
            `<button class="atab-sub ${s === status ? 'active' : ''}" data-ytt-status="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
        </div>
        ${videos.length ? videos.map(v => `
          <div class="ytt-row" data-id="${v.id}">
            <div class="ytt-row-info">
              <strong>${_esc(v.chapter_name)} — ${_esc(v.exercise_no)}${v.part_label ? ' · ' + _esc(v.part_label) : ''}</strong>
              <small>${_esc(v.teacher_name)} · ${_esc(v.batch_name)} · ${_esc(v.subject_name)}</small>
              ${v.pending_video_id ? `<small>▶ youtu.be/${_esc(v.pending_video_id)}</small>` : ''}
              ${v.status === 'rejected' && v.rejection_reason ? `<small style="color:#c82333;">Reason: ${_esc(v.rejection_reason)}</small>` : ''}
            </div>
            ${status === 'pending' ? `
              <div class="ytt-row-actions">
                <button class="btn-tiny btn-approve" data-approve="${v.id}">Approve</button>
                <button class="btn-tiny btn-reject" data-reject="${v.id}">Reject</button>
              </div>` : ''}
          </div>
        `).join('') : '<div style="text-align:center;padding:2rem;color:#999;">No videos here.</div>'}
      `;
      body.querySelectorAll('[data-ytt-status]').forEach(b => b.addEventListener('click', () => _renderApprovals(b.dataset.yttStatus)));
      body.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', async () => {
        try { await _req(`/admin/youtube-teacher-videos/${b.dataset.approve}/approve`, { method: 'POST' }); _toast('Video approved', 'success'); _renderApprovals(status); }
        catch (err) { _toast(err.message, 'error'); }
      }));
      body.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', async () => {
        const reason = await _prompt('Rejection reason (shown to the teacher):', '');
        if (!reason) return;
        try { await _req(`/admin/youtube-teacher-videos/${b.dataset.reject}/reject`, { method: 'POST', body: JSON.stringify({ reason }), headers: { 'Content-Type': 'application/json' } }); _toast('Video rejected', 'info'); _renderApprovals(status); }
        catch (err) { _toast(err.message, 'error'); }
      }));
    } catch (err) {
      body.innerHTML = `<div style="text-align:center;padding:2rem;color:#c82333;">${_esc(err.message)}</div>`;
    }
  }

  // ════════════════════════
  // DIRECTORY
  // ════════════════════════

  async function _renderDirectory() {
    const body = $('ytt-body');
    body.innerHTML = '<div style="text-align:center;padding:2rem;color:#999;">Loading…</div>';
    try {
      const { data: partners } = await _req('/admin/youtube-teacher-partners');
      body.innerHTML = partners.length ? partners.map(p => `
        <div class="ytt-row" data-id="${p.id}">
          <div class="ytt-row-info">
            <strong>${_esc(p.name)} ${p.channel_verified ? '✅' : ''}</strong>
            <small>${_esc(p.email)} · ${_esc(p.mobile)}</small>
            <small>${p.youtube_channel_url ? `<a href="${_esc(p.youtube_channel_url)}" target="_blank" rel="noopener">${_esc(p.youtube_channel_url)}</a>` : 'No channel URL'}</small>
          </div>
          <div class="ytt-row-actions">
            <span class="status-chip ${p.status === 'active' ? 'approved' : 'rejected'}">${_esc(p.status)}</span>
            ${!p.channel_verified ? `<button class="btn-tiny btn-approve" data-verify="${p.id}">Verify Channel</button>` : ''}
            ${p.status === 'active'
              ? `<button class="btn-tiny btn-reject" data-suspend="${p.id}">Suspend</button>`
              : `<button class="btn-tiny btn-approve" data-activate="${p.id}">Activate</button>`}
          </div>
        </div>
      `).join('') : '<div style="text-align:center;padding:2rem;color:#999;">No teacher partners yet.</div>';

      body.querySelectorAll('[data-verify]').forEach(b => b.addEventListener('click', async () => {
        try { await _req(`/admin/youtube-teacher-partners/${b.dataset.verify}/verify-channel`, { method: 'POST' }); _toast('Channel verified', 'success'); _renderDirectory(); }
        catch (err) { _toast(err.message, 'error'); }
      }));
      body.querySelectorAll('[data-suspend]').forEach(b => b.addEventListener('click', async () => {
        if (!await _confirm('Suspend this teacher? All their videos will be hidden from students until reactivated.')) return;
        try { await _req(`/admin/youtube-teacher-partners/${b.dataset.suspend}/suspend`, { method: 'POST' }); _toast('Suspended', 'info'); _renderDirectory(); }
        catch (err) { _toast(err.message, 'error'); }
      }));
      body.querySelectorAll('[data-activate]').forEach(b => b.addEventListener('click', async () => {
        try { await _req(`/admin/youtube-teacher-partners/${b.dataset.activate}/activate`, { method: 'POST' }); _toast('Activated', 'success'); _renderDirectory(); }
        catch (err) { _toast(err.message, 'error'); }
      }));
    } catch (err) {
      body.innerHTML = `<div style="text-align:center;padding:2rem;color:#c82333;">${_esc(err.message)}</div>`;
    }
  }

  // ════════════════════════
  // VIDEO GAPS (platform-wide)
  // ════════════════════════

  async function _renderGaps() {
    const body = $('ytt-body');
    body.innerHTML = '<div style="text-align:center;padding:2rem;color:#999;">Loading batches…</div>';
    try {
      const { data: batches } = await _req('/batches');
      body.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
          <select id="ytt-gap-batch" class="ytt-input"><option value="">Select Batch…</option>
            ${batches.map(b => `<option value="${_esc(b.name)}">${_esc(b.name)}</option>`).join('')}</select>
          <select id="ytt-gap-subject" class="ytt-input" disabled><option>Select Batch first</option></select>
        </div>
        <div id="ytt-gap-results"></div>
      `;
      const batchSel = $('ytt-gap-batch'), subjectSel = $('ytt-gap-subject');
      batchSel.addEventListener('change', () => {
        const b = batches.find(x => x.name === batchSel.value);
        subjectSel.innerHTML = '<option value="">Select…</option>' + (b?.subjects || []).map(s => `<option value="${_esc(s.name)}">${_esc(s.name)}</option>`).join('');
        subjectSel.disabled = !b;
        $('ytt-gap-results').innerHTML = '';
      });
      subjectSel.addEventListener('change', async () => {
        const results = $('ytt-gap-results');
        results.innerHTML = 'Loading…';
        try {
          const { data: gaps } = await _req(`/admin/youtube-teacher-video-gaps?batch=${encodeURIComponent(batchSel.value)}&subject=${encodeURIComponent(subjectSel.value)}`);
          results.innerHTML = gaps.length
            ? gaps.map(g => `<div class="ytt-row"><div class="ytt-row-info"><strong>${_esc(g.chapter_name)} — ${_esc(g.exercise_no)}</strong></div></div>`).join('')
            : '<div style="text-align:center;padding:1.5rem;color:#999;">No gaps — every exercise has at least one approved video 🎉</div>';
        } catch (err) { results.innerHTML = `<div style="color:#c82333;">${_esc(err.message)}</div>`; }
      });
    } catch (err) {
      body.innerHTML = `<div style="text-align:center;padding:2rem;color:#c82333;">${_esc(err.message)}</div>`;
    }
  }

  // ════════════════════════
  // SUBSCRIPTIONS OVERVIEW
  // ════════════════════════

  async function _renderSubscriptions() {
    const body = $('ytt-body');
    body.innerHTML = '<div style="text-align:center;padding:2rem;color:#999;">Loading…</div>';
    try {
      const { data: subs } = await _req('/admin/youtube-teacher-subscriptions');
      body.innerHTML = subs.length ? `
        <div style="overflow-x:auto;">
        <table class="pay-table" style="width:100%;border-collapse:collapse;">
          <tr><th style="text-align:left;padding:8px;">Teacher</th><th style="text-align:left;padding:8px;">Plan</th><th style="text-align:left;padding:8px;">Amount</th><th style="text-align:left;padding:8px;">Status</th><th style="text-align:left;padding:8px;">Expiry</th></tr>
          ${subs.map(s => `<tr>
            <td style="padding:8px;">${_esc(s.teacher_name)}</td>
            <td style="padding:8px;">${_esc(s.plan_type)}${s.is_premium ? ' ⭐' : ''}</td>
            <td style="padding:8px;">₹${s.amount}</td>
            <td style="padding:8px;">${_esc(s.status)}</td>
            <td style="padding:8px;">${s.expiry_date ? new Date(s.expiry_date).toLocaleDateString() : '—'}</td>
          </tr>`).join('')}
        </table>
        </div>
      ` : '<div style="text-align:center;padding:2rem;color:#999;">No subscriptions yet.</div>';
    } catch (err) {
      body.innerHTML = `<div style="text-align:center;padding:2rem;color:#c82333;">${_esc(err.message)}</div>`;
    }
  }

  return { init };
})();

window.YOUTUBE_TEACHER_ADMIN = YOUTUBE_TEACHER_ADMIN;
