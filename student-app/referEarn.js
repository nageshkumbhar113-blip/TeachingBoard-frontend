/* ════════════════════════════════════════
   referEarn.js - Student Home > Refer & Earn
   Friend count, prize steps (5 / 8 / 15 by default, edited by the admin), share link and prize claim.
   Server: /api/referrals/me and /api/referrals/me/claim
════════════════════════════════════════ */

const REFER_EARN = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof APP !== 'undefined' && APP?.toast) ? APP.toast(m, t) : console.log(m);
  const SHARE_BASE = 'https://teachingboard-frontend.vercel.app/get-app.html';

  let _data = null;

  const _link = () => `${SHARE_BASE}?ref=${encodeURIComponent(_data?.code || '')}`;
  const _message = () => [
    '📚 *Nks EduOrbit*: notes, exercises and MCQ tests for Maharashtra Board students.',
    '🎁 The first chapter of every subject is free.',
    '',
    'Open the app and register here:',
    _link(),
  ].join('\n');

  async function refresh() {
    const card = $('home-refer-card');
    if (!card) return;
    try {
      _data = await API.fetchMyReferrals();
    } catch {
      card.classList.add('hidden');
      return;
    }
    if (!_data) { card.classList.add('hidden'); return; }
    const top = (_data.milestones || []).slice(-1)[0];
    const target = _data.next ? _data.next.count : (top ? top.count : 1);
    const pct = Math.min(100, Math.round((_data.friends_paid / target) * 100));
    const claimable = (_data.milestones || []).filter(m => m.state === 'claimable').length;
    card.innerHTML = `
      <div class="re-card-head"><b>🎁 Refer &amp; Earn</b>${claimable ? `<span class="re-badge">${claimable} prize${claimable === 1 ? '' : 's'} ready</span>` : ''}</div>
      <div class="re-card-line">${_data.friends_paid} friend${_data.friends_paid === 1 ? '' : 's'} paid${_data.next ? ` &middot; next prize: <b>${esc(_data.next.title)}</b> at ${_data.next.count}` : ' &middot; all prizes reached'}</div>
      <div class="re-bar"><span style="width:${pct}%"></span></div>
      <button type="button" class="re-open-btn" id="re-open">See prizes &amp; share</button>`;
    card.classList.remove('hidden');
    $('re-open')?.addEventListener('click', openModal);
  }

  function _closeModal() { $('re-modal')?.remove(); }

  function _stateLabel(m) {
    return { locked: `${m.count} friends`, claimable: 'Ready to claim', requested: 'Requested', shipped: 'Sent', rejected: 'Not approved' }[m.state] || '';
  }

  function _renderModal() {
    let modal = $('re-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 're-modal';
      modal.className = 're-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) _closeModal(); });
    }
    const d = _data;
    modal.innerHTML = `
      <div class="re-sheet">
        <div class="re-sheet-head"><h3>🎁 Refer &amp; Earn</h3><button type="button" class="re-x" id="re-close" aria-label="Close">✕</button></div>
        <p class="re-hint">Share your link with friends. A friend counts when they register with it and take a paid plan, and ${d.hold_days} days have passed.</p>
        <div class="re-counts">
          <div><b>${d.friends_paid}</b><small>paid</small></div>
          <div><b>${d.friends_pending}</b><small>in ${d.hold_days}-day wait</small></div>
          <div><b>${d.friends_joined}</b><small>joined</small></div>
        </div>
        <h4>Prizes</h4>
        ${(d.milestones || []).map(m => `
          <div class="re-prize ${m.state}">
            <div><b>${esc(m.title)}</b><br><small>${m.count} friends have paid</small></div>
            ${m.state === 'claimable' ? `<button type="button" class="re-claim-btn" data-claim="${m.count}">Claim</button>` : `<span class="re-state">${_stateLabel(m)}</span>`}
          </div>
          ${m.state === 'shipped' && m.claim?.tracking ? `<small class="re-hint">Tracking: ${esc(m.claim.tracking)}</small>` : ''}`).join('')}
        <div id="re-claim-form" class="re-form hidden"></div>
        <h4>Your link</h4>
        <textarea id="re-msg" class="re-msg" rows="6" readonly>${esc(_message())}</textarea>
        <div class="re-row">
          <button type="button" id="re-copy" class="re-open-btn">📋 Copy</button>
          <button type="button" id="re-wa" class="re-open-btn">💬 WhatsApp</button>
        </div>
      </div>`;
    $('re-close')?.addEventListener('click', _closeModal);
    $('re-copy')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('re-msg').value); toast('Copied', 'success'); } catch { $('re-msg')?.select(); }
    });
    $('re-wa')?.addEventListener('click', () => window.open(`https://wa.me/?text=${encodeURIComponent($('re-msg').value)}`, '_blank', 'noopener'));
    modal.querySelectorAll('[data-claim]').forEach(b => b.addEventListener('click', () => _openClaimForm(Number(b.dataset.claim))));
  }

  function _openClaimForm(milestone) {
    const m = (_data.milestones || []).find(x => x.count === milestone);
    const box = $('re-claim-form');
    if (!m || !box) return;
    box.classList.remove('hidden');
    box.innerHTML = `
      <h4>Claim: ${esc(m.title)}</h4>
      <p class="re-hint">Ask a parent or guardian to fill in the delivery details.</p>
      <input id="re-name" type="text" placeholder="Name of the person who will receive it" autocomplete="name" />
      <input id="re-phone" type="tel" inputmode="numeric" maxlength="10" placeholder="Phone number" autocomplete="tel" />
      <textarea id="re-addr" rows="3" placeholder="Full address" autocomplete="street-address"></textarea>
      <input id="re-pin" type="text" inputmode="numeric" maxlength="6" placeholder="Pincode" autocomplete="postal-code" />
      <label class="re-consent"><input id="re-consent" type="checkbox" /> I am a parent / guardian and I agree to share this address so the prize can be sent.</label>
      <p id="re-err" class="re-err hidden" role="alert"></p>
      <button type="button" id="re-submit" class="re-open-btn">Send claim</button>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('re-submit')?.addEventListener('click', async () => {
      const err = $('re-err');
      const show = t => { err.textContent = t; err.classList.remove('hidden'); };
      err.classList.add('hidden');
      const body = {
        milestone,
        recipient_name: $('re-name').value.trim(),
        phone: $('re-phone').value.trim(),
        address: $('re-addr').value.trim(),
        pincode: $('re-pin').value.trim(),
        parent_consent: $('re-consent').checked,
      };
      if (!body.recipient_name) return show('Enter the name of the person who will receive it');
      if (!/^[6-9]\d{9}$/.test(body.phone)) return show('Enter a valid 10-digit phone number');
      if (body.address.length < 10) return show('Enter the full address');
      if (!/^\d{6}$/.test(body.pincode)) return show('Enter a 6-digit pincode');
      if (!body.parent_consent) return show('A parent or guardian must agree');
      $('re-submit').disabled = true;
      try {
        await API.claimReferralPrize(body);
        toast('Claim sent. We will contact you about delivery.', 'success');
        await refresh();
        _renderModal();
      } catch (e) {
        $('re-submit').disabled = false;
        show(e?.message || 'Could not send the claim');
      }
    });
  }

  async function openModal() {
    try { _data = await API.fetchMyReferrals(); } catch { /* keep the last data */ }
    if (!_data) { toast('Could not load Refer & Earn. Check your internet.', 'error'); return; }
    _renderModal();
  }

  return { refresh, openModal };
})();

window.REFER_EARN = REFER_EARN;
