/* ════════════════════════════════════════
   payment.js — Student subscription checkout
   Plan select (Monthly / Yearly) + Razorpay
   Global: PAYMENT
════════════════════════════════════════ */

const PAYMENT = (() => {
  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function _toast(msg, type = 'info') {
    // APP/UI are top-level `const` in app.js/ui.js — never attach to `window`,
    // but ARE visible as bare identifiers to other classic scripts on this page.
    if (typeof APP !== 'undefined' && APP?.toast) APP.toast(msg, type);
    else if (typeof UI !== 'undefined' && UI?.toast) UI.toast(msg, type);
  }

  let _overlay = null;
  function _close() { _overlay?.remove(); _overlay = null; }

  /**
   * Open the plan-selection sheet after registration.
   * @param {{student_code, pin, name, contact}} student
   * @param {Function} onActivated  called when account becomes active
   */
  async function openPlanSelect(student, onActivated) {
    _close();

    let batches = [];
    try { batches = await API.getBatchPlans(); } catch (e) { console.warn('plans load failed', e); }
    const paid = (batches || []).filter(b => (b.monthly_price > 0 || b.yearly_price > 0));

    // Board/Medium search filter — only shown when there's actually more
    // than one distinct value to filter by (batches missing this metadata,
    // pre-dating it, just report '' and fall out of these lists — the
    // carousel still shows everything, unfiltered, same as before this
    // feature existed). A batch with no board/medium set is never hidden
    // by a filter — only excluded when the filter is a specific value that
    // doesn't match.
    const boards  = [...new Set(paid.map(b => b.board).filter(Boolean))].sort();
    const mediums = [...new Set(paid.map(b => b.medium).filter(Boolean))].sort();

    _overlay = document.createElement('div');
    _overlay.className = 'admit-theme';
    _overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto';

    const filterHtml = (boards.length > 1 || mediums.length > 1)
      ? `<div class="admit-filter-row">
           ${boards.length > 1 ? `<select id="pay-filter-board" class="admit-filter-select" aria-label="Board">
             <option value="">सर्व Boards</option>
             ${boards.map(v => `<option value="${_esc(v)}">${_esc(v)}</option>`).join('')}
           </select>` : ''}
           ${mediums.length > 1 ? `<select id="pay-filter-medium" class="admit-filter-select" aria-label="Medium">
             <option value="">सर्व Mediums</option>
             ${mediums.map(v => `<option value="${_esc(v)}">${_esc(v)}</option>`).join('')}
           </select>` : ''}
         </div>`
      : '';

    const bodyHtml = paid.length
      ? `${filterHtml}
         <p class="admit-slides-hint">← स्वाइप करा →</p>
         <div id="pay-batch-slides" class="admit-batch-slides"></div>
         <div class="admit-ledger-row"><span class="l">Batch</span><span class="v" id="pay-batch-label"></span></div>
         <div class="admit-ledger-row"><span class="l">Student</span><span class="v">${_esc(student.name || '')} · ${_esc(student.student_code || '')}</span></div>
         <div class="admit-gold-rule"></div>
         <div id="pay-plans"></div>
         <div id="pay-yt-discount"></div>`
      : `<p style="color:var(--text2,#8b949e);text-align:center">अजून कोणतीही paid batch उपलब्ध नाही. Admin शी संपर्क करा.</p>`;

    _overlay.innerHTML = `
      <div class="onboarding-card admit-card" style="max-width:380px;margin:0">
        <div class="admit-head">
          <div class="admit-seal" aria-hidden="true"><div class="admit-seal-inner">VERIFIED<br>STUDENT</div></div>
          <div>
            <div class="admit-eyebrow">CHOOSE ACCESS</div>
            <h2 class="onboarding-title" style="font-size:1.15rem">Plan निवडा</h2>
            <p class="onboarding-sub">${_esc(student.name || '')} — ${_esc(student.student_code || '')}</p>
          </div>
        </div>
        <div class="admit-perforation" aria-hidden="true"></div>
        <div class="admit-body">
          ${bodyHtml}
          <button id="pay-close" class="onboarding-skip" style="margin-top:2px">नंतर करेन (बंद करा)</button>
          <p style="text-align:center;margin-top:12px;font-size:0.72rem;color:var(--text2,#8b949e)">
            <a href="https://teachingboard-frontend.vercel.app/terms-and-conditions.html" target="_blank" rel="noopener noreferrer" style="color:inherit">Terms</a> ·
            <a href="https://teachingboard-frontend.vercel.app/privacy-policy.html" target="_blank" rel="noopener noreferrer" style="color:inherit">Privacy</a> ·
            <a href="https://teachingboard-frontend.vercel.app/refund-policy.html" target="_blank" rel="noopener noreferrer" style="color:inherit">Refund Policy</a>
          </p>
        </div>
      </div>`;
    document.body.appendChild(_overlay);

    _overlay.querySelector('#pay-close')?.addEventListener('click', _close);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) _close(); });

    let currentBatch = null;
    const renderPlans = () => _renderPlans(currentBatch, student, onActivated);

    // Renders the swipeable carousel for a given (possibly filtered) batch
    // list, re-binding slide clicks each time — called once at open with
    // the full `paid` list, and again whenever a Board/Medium filter changes.
    function _renderCarousel(list) {
      const slidesHost = _overlay.querySelector('#pay-batch-slides');
      const label = _overlay.querySelector('#pay-batch-label');
      const plansHost = _overlay.querySelector('#pay-plans');
      if (!slidesHost) return;

      if (!list.length) {
        slidesHost.innerHTML = `<p style="color:var(--text2,#8b949e);text-align:center;padding:12px 0">या Board/Medium साठी कोणतीही batch नाही.</p>`;
        if (label) label.textContent = '';
        if (plansHost) plansHost.innerHTML = '';
        currentBatch = null;
        return;
      }

      slidesHost.innerHTML = list.map((b, i) => `
        <div class="admit-batch-slide${i === 0 ? ' active' : ''}" data-name="${_esc(b.name)}">
          <div class="admit-slide-dot"></div>
          <div class="admit-slide-cover">${b.cover_image ? `<img src="${_esc(b.cover_image)}" alt="">` : _esc(b.icon || '📚')}</div>
          <div class="admit-slide-name">${_esc(b.name)}</div>
        </div>`).join('');

      currentBatch = list[0];
      if (label) label.textContent = currentBatch.name;

      slidesHost.querySelectorAll('.admit-batch-slide').forEach(slide => {
        slide.addEventListener('click', () => {
          slidesHost.querySelectorAll('.admit-batch-slide').forEach(s => s.classList.remove('active'));
          slide.classList.add('active');
          currentBatch = list.find(b => b.name === slide.dataset.name);
          if (label) label.textContent = currentBatch.name;
          renderPlans();
        });
      });

      renderPlans();
    }

    function _applyFilters() {
      const boardVal  = _overlay.querySelector('#pay-filter-board')?.value  || '';
      const mediumVal = _overlay.querySelector('#pay-filter-medium')?.value || '';
      const filtered = paid.filter(b =>
        (!boardVal  || b.board  === boardVal) &&
        (!mediumVal || b.medium === mediumVal)
      );
      _renderCarousel(filtered);
    }

    _overlay.querySelector('#pay-filter-board')?.addEventListener('change', _applyFilters);
    _overlay.querySelector('#pay-filter-medium')?.addEventListener('change', _applyFilters);

    _renderCarousel(paid);
    _renderYtDiscountBlock(student);
  }

  // ── YouTube-subscriber discount: self-claim + teacher approval ──────────────

  async function _renderYtDiscountBlock(student) {
    const host = _overlay?.querySelector('#pay-yt-discount');
    if (!host) return;
    try {
      const status = await API.getMySubscriberClaimStatus({ student_code: student.student_code, pin: student.pin });
      if (!host.isConnected) return;
      if (status.state === 'verified') {
        host.innerHTML = `<div class="admit-yt-verified">✅ YouTube Subscriber Discount Active${status.partner_name ? ` — ${_esc(status.partner_name)}` : ''}</div>`;
        return;
      }
      if (status.state === 'pending') {
        host.innerHTML = `<div class="admit-yt-pending">⏳ तुमची subscriber request pending आहे${status.partner_name ? ` (${_esc(status.partner_name)})` : ''} — approve झाल्यावर notification येईल.</div>`;
        return;
      }
      host.innerHTML = `<button type="button" class="admit-yt-claim-btn" id="pay-yt-claim-open">📺 मी YouTube Subscriber आहे — 50% सूट मिळवा</button>`;
      host.querySelector('#pay-yt-claim-open')?.addEventListener('click', () => _openYtClaimPanel(host, student));
    } catch { host.innerHTML = ''; }
  }

  function _openYtClaimPanel(host, student) {
    host.innerHTML = `
      <div class="admit-yt-panel">
        <p class="admit-yt-panel-title">📺 तुमचा YouTube Teacher शोधा</p>
        <input type="text" id="pay-yt-search" class="admit-input admit-yt-search" placeholder="नाव टाईपा (किमान 1 अक्षर)…" autocomplete="off" />
        <div id="pay-yt-results" class="admit-yt-results"></div>
        <div id="pay-yt-selected" class="admit-yt-selected hidden">
          <p id="pay-yt-selected-name"></p>
          <input type="text" id="pay-yt-handle" class="admit-input" placeholder="तुमचं YouTube नाव काय आहे?" />
          <button type="button" id="pay-yt-submit" class="admit-yt-claim-btn">Request पाठवा</button>
          <p id="pay-yt-claim-err" class="pin-error hidden"></p>
        </div>
        <button type="button" id="pay-yt-cancel" class="admit-yt-cancel">रद्द करा</button>
      </div>`;

    let selectedPartner = null;
    let searchTimer = null;
    const searchInput = host.querySelector('#pay-yt-search');
    const resultsEl = host.querySelector('#pay-yt-results');

    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      if (!q) { resultsEl.innerHTML = ''; return; }
      searchTimer = setTimeout(async () => {
        let results = [];
        try { results = await API.searchYoutubeSubscriberPartners(q, { student_code: student.student_code, pin: student.pin }); } catch { /* ignore */ }
        if (!host.isConnected) return;
        resultsEl.innerHTML = results.length
          ? results.map(p => `<div class="admit-yt-result" data-id="${_esc(p.id)}">${_esc(p.name)}${p.youtube_channel_name ? ` — ${_esc(p.youtube_channel_name)}` : ''}</div>`).join('')
          : '<div class="admit-yt-result-empty">काही सापडलं नाही</div>';
        resultsEl.querySelectorAll('[data-id]').forEach(el => {
          el.addEventListener('click', () => {
            selectedPartner = results.find(r => r.id === el.dataset.id);
            if (!selectedPartner) return;
            host.querySelector('#pay-yt-selected')?.classList.remove('hidden');
            const nameEl = host.querySelector('#pay-yt-selected-name');
            if (nameEl) nameEl.textContent = `निवडलं: ${selectedPartner.name}`;
            resultsEl.innerHTML = '';
            searchInput.value = selectedPartner.name;
          });
        });
      }, 250);
    });

    host.querySelector('#pay-yt-submit')?.addEventListener('click', async () => {
      const errEl = host.querySelector('#pay-yt-claim-err');
      errEl?.classList.add('hidden');
      if (!selectedPartner) { if (errEl) { errEl.textContent = 'आधी teacher निवडा'; errEl.classList.remove('hidden'); } return; }
      const displayName = host.querySelector('#pay-yt-handle')?.value.trim() || '';
      if (!displayName) { if (errEl) { errEl.textContent = 'तुमचं YouTube नाव टाका'; errEl.classList.remove('hidden'); } return; }

      const btn = host.querySelector('#pay-yt-submit');
      btn.disabled = true;
      try {
        await API.claimYoutubeSubscriber(selectedPartner.id, displayName, { student_code: student.student_code, pin: student.pin });
        _toast('Request पाठवली — Teacher approve केल्यावर कळेल', 'success');
        _renderYtDiscountBlock(student);
      } catch (err) {
        if (errEl) { errEl.textContent = err?.message || 'काहीतरी चूक झाली'; errEl.classList.remove('hidden'); }
        btn.disabled = false;
      }
    });

    host.querySelector('#pay-yt-cancel')?.addEventListener('click', () => _renderYtDiscountBlock(student));
  }

  function _renderPlans(batch, student, onActivated) {
    const host = _overlay?.querySelector('#pay-plans');
    if (!host || !batch) return;

    const btns = [];
    if (batch.monthly_price > 0) {
      btns.push(`<button class="admit-plan-btn featured" data-plan="monthly" data-price="${batch.monthly_price}">
        <span class="admit-plan-name">📅 Monthly <span class="admit-plan-badge">Popular</span></span>
        <span class="admit-plan-price" data-price-el>₹${_esc(batch.monthly_price)}</span>
      </button>`);
    }
    if (batch.yearly_price > 0) {
      btns.push(`<button class="admit-plan-btn" data-plan="yearly" data-price="${batch.yearly_price}">
        <span class="admit-plan-name">🗓️ Yearly</span>
        <span class="admit-plan-price" data-price-el>₹${_esc(batch.yearly_price)}</span>
      </button>`);
    }
    host.innerHTML = `${btns.join('')}<p id="pay-msg" class="pin-error hidden" role="alert" style="margin-top:6px"></p>`;

    host.querySelectorAll('button[data-plan]').forEach(btn => {
      btn.addEventListener('click', () => _choosePlan(btn.dataset.plan, batch, student, onActivated, host));
    });

    _applyDiscountToPlans(host, batch, student);
  }

  // Best-effort: if this student has an approved YouTube-subscriber claim,
  // fetch the real discounted price (server-computed, same resolveStudentDiscount
  // logic createOrder will use) and show it struck-through + a badge. Silently
  // no-ops on any failure — the plan buttons already show the full price.
  async function _applyDiscountToPlans(host, batch, student) {
    const buttons = [...host.querySelectorAll('button[data-plan]')];
    await Promise.all(buttons.map(async btn => {
      try {
        const period = btn.dataset.plan;
        const preview = await API.previewPaymentPrice({
          student_code: student.student_code, pin: student.pin, batch: batch.name, period,
        });
        if (!preview?.discount_percent) return;
        const priceEl = btn.querySelector('[data-price-el]');
        if (!priceEl || !host.isConnected) return;
        priceEl.innerHTML = `<s class="admit-plan-price-orig">₹${_esc(preview.original_price)}</s> ₹${_esc(preview.discounted_price)}
          <span class="admit-plan-discount-badge">🎓 ${preview.discount_percent}% OFF</span>`;
      } catch { /* keep full price shown */ }
    }));
  }

  function _msg(host, text, isErr = true) {
    const el = host?.querySelector('#pay-msg');
    if (el) { el.textContent = text; el.classList.toggle('hidden', !text); el.style.color = isErr ? '' : '#16a34a'; }
  }

  async function _choosePlan(plan, batch, student, onActivated, host) {
    _msg(host, '');
    const buttons = host.querySelectorAll('button[data-plan]');
    buttons.forEach(b => b.disabled = true);

    try {
      // monthly / yearly → Razorpay
      if (typeof window.Razorpay !== 'function') {
        _msg(host, 'Payment system load झाले नाही. Internet तपासा.');
        return;
      }
      const order = await API.createPaymentOrder({
        student_code: student.student_code, pin: student.pin, batch: batch.name, period: plan,
      });
      _openCheckout(order, plan, batch, student, onActivated, host);
    } catch (err) {
      _msg(host, err?.message || 'काहीतरी चूक झाली, पुन्हा प्रयत्न करा');
    } finally {
      buttons.forEach(b => b.disabled = false);
    }
  }

  // Checkout runs in the device's external browser (not the app's own
  // WebView) via pay.html — a Play Store policy requirement: an app that
  // itself initiates/completes an in-app digital-content purchase must use
  // Google Play Billing, but a purchase that happens on a website the app
  // merely links out to is exempt. Order creation + verification are
  // unchanged; only where the Razorpay checkout UI is displayed moves.
  function _openCheckout(order, plan, batch, student, onActivated, host) {
    const params = new URLSearchParams({
      order_id: order.order_id,
      amount:   String(order.amount),
      currency: order.currency || 'INR',
      key_id:   order.key_id,
      batch:    batch.name,
      period:   plan,
      name:     student.name || '',
      contact:  student.contact || '',
    });
    const payUrl = `https://teachingboard-frontend.vercel.app/pay.html?${params.toString()}`;

    const BrowserPlugin = window.Capacitor?.Plugins?.Browser;
    if (BrowserPlugin) {
      BrowserPlugin.open({ url: payUrl });
    } else {
      window.open(payUrl, '_blank', 'noopener,noreferrer');
    }

    _showWaitingForPayment(student, onActivated, host);
  }

  function _showWaitingForPayment(student, onActivated, host) {
    if (!host) return;
    host.innerHTML = `
      <div style="text-align:center;padding:8px 0">
        <p style="font-size:0.85rem;color:var(--text2,#8b949e);line-height:1.6;margin-bottom:14px">
          Payment साठी browser उघडला आहे. पूर्ण झाल्यावर इथे परत या आणि खालील बटण दाबा.
        </p>
        <button id="pay-check-status" class="admit-plan-btn featured" style="width:100%">✅ मी Payment केलं — Check करा</button>
        <p id="pay-msg" class="pin-error hidden" role="alert" style="margin-top:10px"></p>
      </div>
    `;
    host.querySelector('#pay-check-status')?.addEventListener('click', () => {
      _pollActivation(student, onActivated, host, 0, /* singleShot */ true);
    });
  }

  // Webhook activation is async — poll status until active (≈20s max).
  // singleShot=true is used by the "Check करा" button (external-browser
  // checkout flow) — gives immediate "checking…" feedback instead of
  // silently retrying in the background with no visible state change.
  async function _pollActivation(student, onActivated, host, tries = 0, singleShot = false) {
    const btn = host?.querySelector('#pay-check-status');
    if (singleShot && tries === 0) {
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Checking…'; }
      _msg(host, '', false);
    }
    try {
      const res = await API.getSubscriptionStatus({ student_code: student.student_code, pin: student.pin });
      if (res?.student?.status === 'active') {
        _toast('✅ Account active! आता login करा.', 'success');
        _close();
        onActivated?.();
        return;
      }
    } catch {}
    if (tries >= 10) {
      _msg(host, 'अजून payment दिसत नाही. Payment पूर्ण केलं असेल तर १ मिनिटाने परत Check करा.', true);
      if (btn) { btn.disabled = false; btn.textContent = '✅ मी Payment केलं — Check करा'; }
      return;
    }
    setTimeout(() => _pollActivation(student, onActivated, host, tries + 1, singleShot), 2000);
  }

  return { openPlanSelect };
})();

window.PAYMENT = PAYMENT;
