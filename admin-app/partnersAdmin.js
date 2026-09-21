/* ════════════════════════════════════════
   partnersAdmin.js - Admin > Partners
   Commission programme for YouTube teachers and school teachers:
   settings, monthly payout statements (closed on the 1st, paid 2nd-5th), partner balances, ledger.
   Server: TeachingBoard-backend /api/partners
════════════════════════════════════════ */

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof APP !== 'undefined' && APP?.toast) ? APP.toast(m, t) : console.log(m);
  const rs = n => `₹${(Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-IN')}`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = m => { const [y, mo] = String(m).split('-'); return `${MONTHS[Number(mo) - 1] || mo} ${y}`; };

  let _loaded = false;
  let _statements = [];
  let _partners = [];
  let _prizes = [];
  let _claims = [];
  let _payingId = '';
  let _month = '';

  const STATUS = { closed: ['Ready to pay', 'ok'], paid: ['Paid', 'done'], carried: ['Carried forward', 'muted'] };

  async function init() {
    if (!_loaded) { _bind(); _loaded = true; }
    await refresh();
  }

  function _bind() {
    $('pa-save-config')?.addEventListener('click', _saveConfig);
    $('pa-close-month')?.addEventListener('click', _closeMonth);
    $('pa-month')?.addEventListener('change', e => { _month = e.target.value; _loadStatements(); });
    $('pa-ledger-partner')?.addEventListener('change', _loadLedger);
    $('pa-prize-add')?.addEventListener('click', () => { _prizes.push({ count: '', title: '' }); _renderPrizes(); });
    $('pa-prizes')?.addEventListener('click', e => {
      const rm = e.target.closest('[data-prize-rm]');
      if (rm) { _readPrizes(); _prizes.splice(Number(rm.dataset.prizeRm), 1); _renderPrizes(); }
    });
    $('pa-claim-status')?.addEventListener('change', _loadClaims);
    $('pa-claims')?.addEventListener('click', _onClaimClick);
    $('pa-statements')?.addEventListener('click', _onStatementClick);
    $('pa-ledger')?.addEventListener('click', _onLedgerClick);
  }

  async function refresh() {
    try {
      await Promise.all([_loadConfig(), _loadPartners()]);
      await _loadStatements();
      await _loadLedger();
      await _loadClaims();
    } catch (err) {
      console.error('partners load failed', err);
      toast('Could not load partners', 'error');
    }
  }

  // ── settings ──────────────────────────────────────────────────────────────
  async function _loadConfig() {
    const c = await API.fetchPartnerConfig();
    $('pa-hold').value = c.hold_days;
    $('pa-min').value = c.min_payout;
    $('pa-yt').value = c.youtube_flat;
    $('pa-school').value = c.school_percent;
    _prizes = (c.prizes || []).map(p => ({ count: p.count, title: p.title }));
    _renderPrizes();
  }

  function _renderPrizes() {
    const box = $('pa-prizes');
    if (!box) return;
    box.innerHTML = _prizes.length ? _prizes.map((p, i) => `
      <div class="pa-prize-row">
        <input class="admin-input pa-prize-count" type="number" min="1" placeholder="Friends" value="${esc(p.count)}" aria-label="Friends who paid" />
        <input class="admin-input pa-prize-title" type="text" maxlength="60" placeholder="Prize name" value="${esc(p.title)}" aria-label="Prize name" />
        <button type="button" class="admin-btn-danger" data-prize-rm="${i}">Remove</button>
      </div>`).join('') : '<p class="import-hint">No prizes. Students will see no prize steps.</p>';
  }

  function _readPrizes() {
    const rows = [...document.querySelectorAll('#pa-prizes .pa-prize-row')];
    _prizes = rows.map(r => ({ count: r.querySelector('.pa-prize-count').value, title: r.querySelector('.pa-prize-title').value.trim() }));
  }

  // ── prize requests ────────────────────────────────────────────────────────
  async function _loadClaims() {
    const box = $('pa-claims');
    if (!box) return;
    _claims = await API.fetchReferralClaims($('pa-claim-status')?.value || '');
    if (!_claims.length) { box.innerHTML = '<p class="import-hint">No requests here.</p>'; return; }
    box.innerHTML = _claims.map(c => `
      <div class="pa-stmt" data-id="${esc(c.id)}">
        <div class="pa-stmt-head">
          <div><b>${esc(c.title)}</b> <small>(${c.milestone} friends)</small><br><small>${esc(c.student_name)} - ${esc(c.student_code)} - ${new Date(c.requested_at).toLocaleDateString('en-IN')}</small></div>
          <span class="pa-badge ${c.status === 'shipped' ? 'done' : c.status === 'requested' ? 'ok' : 'muted'}">${c.status === 'shipped' ? 'Sent' : c.status === 'requested' ? 'To send' : 'Not approved'}</span>
        </div>
        <div class="pa-stmt-lines"><span>${esc(c.recipient_name)}, ${esc(c.phone)}</span><span>${esc(c.address)} - ${esc(c.pincode)}</span></div>
        ${c.tracking ? `<small class="import-hint">Tracking: ${esc(c.tracking)}</small>` : ''}
        ${c.status === 'requested' ? `<div class="pa-stmt-actions">
          <input class="admin-input pa-utr" data-tracking placeholder="Tracking / courier note (optional)" />
          <button type="button" class="admin-btn-primary" data-claim-act="shipped">Mark as sent</button>
          <button type="button" class="admin-btn-danger" data-claim-act="rejected">Not approved</button></div>` : ''}
      </div>`).join('');
  }

  async function _onClaimClick(e) {
    const btn = e.target.closest('[data-claim-act]');
    if (!btn) return;
    const card = btn.closest('.pa-stmt');
    btn.disabled = true;
    try {
      await API.updateReferralClaim(card.dataset.id, { status: btn.dataset.claimAct, tracking: card.querySelector('[data-tracking]')?.value.trim() || '' });
      toast(btn.dataset.claimAct === 'shipped' ? 'Marked as sent' : 'Marked as not approved', 'success');
      await _loadClaims();
    } catch (err) {
      btn.disabled = false;
      toast(err?.message || 'Could not update', 'error');
    }
  }

  async function _saveConfig() {
    try {
      _readPrizes();
      await API.setPartnerConfig({
        prizes: _prizes.map(p => ({ count: Number(p.count), title: p.title })),
        hold_days: Number($('pa-hold').value),
        min_payout: Number($('pa-min').value),
        youtube_flat: Number($('pa-yt').value),
        school_percent: Number($('pa-school').value),
      });
      toast('Settings saved', 'success');
    } catch (err) {
      toast(err?.message || 'Could not save settings', 'error');
    }
  }

  // ── partners ──────────────────────────────────────────────────────────────
  async function _loadPartners() {
    _partners = await API.fetchPartners();
    const sel = $('pa-ledger-partner');
    if (sel) {
      const prev = sel.value;
      sel.innerHTML = '<option value="">All partners</option>' + _partners.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.teacher_code)})</option>`).join('');
      sel.value = prev;
    }
    const box = $('pa-partners');
    if (!box) return;
    if (!_partners.length) {
      box.innerHTML = '<p class="import-hint">No partners yet. Open Teachers, edit a teacher, set the partner type and turn commission on.</p>';
    } else {
      box.innerHTML = `<div class="pa-table-wrap"><table class="pa-table"><thead><tr>
        <th>Partner</th><th>Type</th><th>Commission</th><th>UPI</th><th>Pending</th><th>Ready</th><th>Paid so far</th></tr></thead><tbody>` +
        _partners.map(p => `<tr>
          <td><b>${esc(p.name)}</b><br><small>${esc(p.teacher_code)}</small></td>
          <td>${p.partner_type === 'youtube' ? 'YouTube' : p.partner_type === 'school' ? 'School' : '-'}${p.commission_enabled ? '' : ' <small>(off)</small>'}</td>
          <td>${p.commission_mode === 'percent' ? `${p.commission_value}%` : rs(p.commission_value)}</td>
          <td>${p.upi_id ? esc(p.upi_id) : '<span class="pa-warn">missing</span>'}${p.pan ? '' : '<br><small class="pa-warn">no PAN</small>'}</td>
          <td>${rs(p.pending_amount)}<br><small>${p.pending_count} in hold</small></td>
          <td>${rs(p.payable_amount)}<br><small>${p.payable_count} not yet closed</small></td>
          <td>${rs(p.paid_total)}</td></tr>`).join('') + '</tbody></table></div>';
    }
  }

  // ── statements ────────────────────────────────────────────────────────────
  async function _loadStatements() {
    const res = await API.fetchPartnerStatements(_month || '');
    _statements = res.data;
    const monthSel = $('pa-month');
    if (monthSel && !monthSel.dataset.filled) {
      // last 12 months + "all"
      const [cy, cm] = res.current_month.split('-').map(Number);
      const opts = ['<option value="">All months</option>'];
      for (let i = 0; i < 12; i++) {
        const d = new Date(Date.UTC(cy, cm - 1 - i, 1));
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        opts.push(`<option value="${key}">${monthLabel(key)}${key === res.previous_month ? ' (last month)' : key === res.current_month ? ' (running)' : ''}</option>`);
      }
      monthSel.innerHTML = opts.join('');
      monthSel.dataset.filled = '1';
      _month = res.previous_month;
      monthSel.value = _month;
      return _loadStatements();
    }
    _renderStatements();
  }

  function _upiLink(s) {
    const q = new URLSearchParams({ pa: s.upi_id, pn: s.upi_name || s.partner_name, am: String(s.net), cu: 'INR', tn: `NksEduOrbit commission ${s.month}` });
    return `upi://pay?${q.toString()}`;
  }

  function _renderStatements() {
    const box = $('pa-statements');
    if (!box) return;
    const due = _statements.filter(s => s.status === 'closed');
    $('pa-due-total').textContent = rs(due.reduce((t, s) => t + s.net, 0));
    $('pa-due-count').textContent = `${due.length} statement${due.length === 1 ? '' : 's'} to pay`;
    if (!_statements.length) {
      box.innerHTML = '<p class="import-hint">No statements for this selection. A month is closed automatically on the 1st of the next month.</p>';
      return;
    }
    box.innerHTML = _statements.map(s => {
      const [label, cls] = STATUS[s.status] || [s.status, ''];
      const canPay = s.status === 'closed';
      const missingUpi = canPay && !s.upi_id;
      return `<div class="pa-stmt" data-id="${esc(s.id)}">
        <div class="pa-stmt-head">
          <div><b>${esc(s.partner_name || s.partner_code)}</b> <small>${esc(s.partner_code)}</small><br><small>${monthLabel(s.month)}</small></div>
          <span class="pa-badge ${cls}">${label}</span>
        </div>
        <div class="pa-stmt-lines">
          <span>${s.new_count} paid student${s.new_count === 1 ? "" : "s"} = ${rs(s.new_amount)}</span>
          ${s.adjust_count ? `<span>Adjustments ${rs(s.adjust_amount)}</span>` : ''}
          ${s.carried_in ? `<span>Carried in ${rs(s.carried_in)}</span>` : ''}
          <b class="pa-net">Net ${rs(s.net)}</b>
        </div>
        ${s.status === 'carried' ? `<small class="import-hint">Below the minimum (${rs(s.min_payout)}) or negative, so it moves to the next month${s.carried_to ? ` (added to ${monthLabel(s.carried_to)})` : ''}.</small>` : ''}
        ${s.status === 'paid' ? `<small class="import-hint">Paid ${s.paid_at ? new Date(s.paid_at).toLocaleDateString('en-IN') : ''} - UTR ${esc(s.utr)}</small>` : ''}
        ${canPay ? `<div class="pa-stmt-actions">
          ${missingUpi ? '<span class="pa-warn">UPI ID missing - ask the partner to add it</span>' : `
          <a class="admin-btn-secondary" href="${esc(_upiLink(s))}">Pay via UPI app</a>
          <button type="button" class="admin-btn-secondary" data-act="copy-upi" data-v="${esc(s.upi_id)}">Copy UPI ID</button>
          <button type="button" class="admin-btn-secondary" data-act="copy-amt" data-v="${s.net}">Copy amount</button>`}
          ${_payingId === s.id
            ? `<input class="admin-input pa-utr" placeholder="UPI reference / UTR" /><button type="button" class="admin-btn-primary" data-act="paid-confirm">Confirm paid</button><button type="button" class="admin-btn-secondary" data-act="paid-cancel">Cancel</button>`
            : '<button type="button" class="admin-btn-primary" data-act="paid">Mark as paid</button>'}
        </div>
        ${s.upi_id ? `<small class="import-hint">${esc(s.upi_name)} - ${esc(s.upi_id)}. Check the name your UPI app shows before paying.</small>` : ''}` : ''}
      </div>`;
    }).join('');
  }

  async function _onStatementClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.pa-stmt');
    const id = card?.dataset.id;
    const act = btn.dataset.act;
    if (act === 'copy-upi' || act === 'copy-amt') {
      try { await navigator.clipboard.writeText(btn.dataset.v); toast('Copied', 'success'); } catch { toast('Could not copy', 'error'); }
    } else if (act === 'paid') {
      _payingId = id; _renderStatements();
    } else if (act === 'paid-cancel') {
      _payingId = ''; _renderStatements();
    } else if (act === 'paid-confirm') {
      const utr = card.querySelector('.pa-utr')?.value.trim() || '';
      if (utr.length < 6) { toast('Enter the UPI reference / UTR number', 'error'); return; }
      btn.disabled = true;
      try {
        await API.markPartnerStatementPaid(id, utr);
        _payingId = '';
        toast('Marked as paid', 'success');
        await _loadStatements();
        await _loadPartners();
      } catch (err) {
        btn.disabled = false;
        toast(err?.message || 'Could not save', 'error');
      }
    }
  }

  async function _closeMonth() {
    const btn = $('pa-close-month');
    btn.disabled = true;
    try {
      const res = await API.closePartnerMonth('');
      toast(res.created ? `Closed ${monthLabel(res.month)}: ${res.created} statement(s) created` : `${monthLabel(res.month)} is already closed`, 'info');
      await _loadStatements();
      await _loadPartners();
    } catch (err) {
      toast(err?.message || 'Could not close the month', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  // ── ledger ────────────────────────────────────────────────────────────────
  let _reversing = '';
  async function _loadLedger() {
    const box = $('pa-ledger');
    if (!box) return;
    const rows = await API.fetchPartnerCommissions($('pa-ledger-partner')?.value || '');
    if (!rows.length) { box.innerHTML = '<p class="import-hint">No commission lines yet.</p>'; return; }
    box.innerHTML = `<div class="pa-table-wrap"><table class="pa-table"><thead><tr>
      <th>Date</th><th>Partner</th><th>Student</th><th>Paid</th><th>Commission</th><th>Payable</th><th>Status</th><th></th></tr></thead><tbody>` +
      rows.map(r => {
        const state = r.status === 'reversed' ? 'Cancelled' : r.type === 'adjustment' ? 'Adjustment' : r.in_statement ? 'In statement' : new Date(r.payable_at) > new Date() ? 'On hold' : 'Ready';
        const canReverse = r.type === 'commission' && r.status === 'active';
        return `<tr data-id="${esc(r.id)}"><td>${new Date(r.paid_at).toLocaleDateString('en-IN')}</td>
          <td>${esc(r.partner_code)}</td><td>${esc(r.student_code)}</td><td>${r.type === 'adjustment' ? '-' : rs(r.amount_paid)}</td>
          <td>${rs(r.amount)}</td><td>${monthLabel(r.payable_month)}</td><td>${state}${r.note ? `<br><small>${esc(r.note)}</small>` : ''}</td>
          <td>${canReverse ? (_reversing === r.id
            ? '<button type="button" class="admin-btn-danger" data-act="rev-yes">Sure?</button>'
            : '<button type="button" class="admin-btn-secondary" data-act="rev">Reverse</button>') : ''}</td></tr>`;
      }).join('') + '</tbody></table></div>';
  }

  async function _onLedgerClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('tr')?.dataset.id;
    if (btn.dataset.act === 'rev') { _reversing = id; _loadLedger(); return; }
    if (btn.dataset.act === 'rev-yes') {
      btn.disabled = true;
      try {
        const res = await API.reversePartnerCommission(id, 'Refund / reversal');
        toast(res.mode === 'adjustment' ? 'Reversed - deducted in the next statement' : 'Commission cancelled', 'success');
        _reversing = '';
        await _loadLedger();
        await _loadPartners();
      } catch (err) {
        toast(err?.message || 'Could not reverse', 'error');
        btn.disabled = false;
      }
    }
  }

  window.PARTNERS_ADMIN = { init, refresh };
})();
