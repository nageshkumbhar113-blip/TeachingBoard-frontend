/* ════════════════════════════════════════
   partnerEarnings.js - Teacher Dashboard > Earnings
   Shown only to teachers the admin turned commission on for (YouTube partners / school teachers).
   Running month, monthly statements, and the UPI / PAN form. Server: /api/partners/me/*
════════════════════════════════════════ */

const PARTNER_EARNINGS = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof APP !== 'undefined' && APP?.toast) ? APP.toast(m, t) : console.log(m);
  const rs = n => `₹${(Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-IN')}`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = m => { const [y, mo] = String(m).split('-'); return `${MONTHS[Number(mo) - 1] || mo} ${y}`; };

  let _bound = false;
  let _enabled = null;

  // Called whenever the dashboard opens: reveals the Earnings tab only for partners.
  async function checkTab() {
    const btn = document.querySelector('[data-tdtab="earnings"]');
    if (!btn) return;
    try {
      const data = await API.fetchMyEarnings();
      _enabled = !!data?.enabled;
    } catch {
      _enabled = false;
    }
    btn.classList.toggle('hidden', !_enabled);
  }

  async function open() {
    if (!_bound) {
      $('pe-save')?.addEventListener('click', _saveProfile);
      _bound = true;
    }
    const box = $('pe-body');
    if (box) box.innerHTML = '<p class="td-hint">Loading...</p>';
    try {
      _render(await API.fetchMyEarnings());
    } catch (err) {
      if (box) box.innerHTML = '<p class="td-hint">Could not load your earnings. Check your internet and try again.</p>';
    }
  }

  function _render(d) {
    const rule = d.mode === 'percent' ? `${d.value}% of a student's payment` : `${rs(d.value)} for each student who pays`;
    const body = $('pe-body');
    if (!body) return;
    body.innerHTML = `
      <div class="pe-cards">
        <div class="pe-card"><small>Paid students</small><b>${d.paid_students}</b><small>of ${d.linked_students} linked</small></div>
        <div class="pe-card"><small>On hold (${d.hold_days} days)</small><b>${rs(d.pending.amount)}</b><small>${d.pending.count} payment${d.pending.count === 1 ? '' : 's'}</small></div>
        <div class="pe-card"><small>Ready, this month</small><b>${rs(d.ready.amount)}</b><small>goes into the ${monthLabel(d.current_month)} statement</small></div>
      </div>
      <p class="td-share-hint">You earn ${esc(rule)}${d.first_payment_only ? ' (first payment only)' : ''}. A commission is held for ${d.hold_days} days after the payment. Each month is closed on the 1st and paid between the 2nd and the 5th, once it reaches ${rs(d.min_payout)}; a smaller amount moves to the next month.</p>
      ${d.payout.upi_id ? '' : '<p class="pe-warn">Add your UPI ID below, otherwise we cannot pay you.</p>'}
      <h4 class="pe-h">Monthly statements</h4>
      ${d.statements.length ? d.statements.map(s => `
        <div class="pe-stmt">
          <div class="pe-stmt-top"><b>${monthLabel(s.month)}</b><span class="pe-badge ${s.status}">${s.status === 'paid' ? 'Paid' : s.status === 'closed' ? 'To be paid' : 'Carried forward'}</span></div>
          <div class="pe-lines"><span>${s.new_count} student${s.new_count === 1 ? '' : 's'}: ${rs(s.new_amount)}</span>
            ${s.adjust_count ? `<span>Adjustments: ${rs(s.adjust_amount)}</span>` : ''}${s.carried_in ? `<span>Carried in: ${rs(s.carried_in)}</span>` : ''}
            <b>Total ${rs(s.net)}</b></div>
          ${s.status === 'paid' ? `<small>Paid ${s.paid_at ? new Date(s.paid_at).toLocaleDateString('en-IN') : ''} - reference ${esc(s.utr)}</small>` : ''}
          ${s.status === 'carried' ? `<small>Below ${rs(s.min_payout)}, so it is added to the next month.</small>` : ''}
        </div>`).join('') : '<p class="td-hint">No statement yet. The first one is made on the 1st of the month after your first commission becomes payable.</p>'}
      <h4 class="pe-h">Payout details</h4>
      <p class="td-share-hint">Saved: ${d.payout.upi_id ? `${esc(d.payout.upi_name)} - ${esc(d.payout.upi_id)}${d.payout.pan ? ` - PAN ${esc(d.payout.pan)}` : ''}` : 'nothing yet'}</p>`;
    if (d.payout.upi_id) { $('pe-upi').value = d.payout.upi_id; $('pe-upi2').value = ''; $('pe-name').value = d.payout.upi_name; }
  }

  async function _saveProfile() {
    const btn = $('pe-save');
    const payload = {
      upi_id: $('pe-upi').value.trim(),
      upi_id_confirm: $('pe-upi2').value.trim(),
      upi_name: $('pe-name').value.trim(),
      pan: $('pe-pan').value.trim(),
    };
    btn.disabled = true;
    try {
      await API.saveMyPayoutProfile(payload);
      $('pe-pan').value = '';
      toast('Payout details saved', 'success');
      await open();
    } catch (err) {
      toast(err?.message || 'Could not save', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  return { checkTab, open };
})();

window.PARTNER_EARNINGS = PARTNER_EARNINGS;
