/* ════════════════════════════════════════
   payment.js — Student subscription checkout
   Plan select (Trial / Monthly / Yearly) + Razorpay
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

    _overlay = document.createElement('div');
    _overlay.className = 'admit-theme';
    _overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto';

    const bodyHtml = paid.length
      ? `<p class="admit-slides-hint">← स्वाइप करा →</p>
         <div id="pay-batch-slides" class="admit-batch-slides">
           ${paid.map((b, i) => `
             <div class="admit-batch-slide${i === 0 ? ' active' : ''}" data-name="${_esc(b.name)}">
               <div class="admit-slide-dot"></div>
               <div class="admit-slide-cover">${b.cover_image ? `<img src="${_esc(b.cover_image)}" alt="">` : _esc(b.icon || '📚')}</div>
               <div class="admit-slide-name">${_esc(b.name)}</div>
             </div>`).join('')}
         </div>
         <div class="admit-ledger-row"><span class="l">Batch</span><span class="v" id="pay-batch-label">${_esc(paid[0].name)}</span></div>
         <div class="admit-ledger-row"><span class="l">Student</span><span class="v">${_esc(student.name || '')} · ${_esc(student.student_code || '')}</span></div>
         <div class="admit-gold-rule"></div>
         <div id="pay-plans"></div>`
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
        </div>
      </div>`;
    document.body.appendChild(_overlay);

    _overlay.querySelector('#pay-close')?.addEventListener('click', _close);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) _close(); });

    let currentBatch = paid[0];
    const renderPlans = () => _renderPlans(currentBatch, student, onActivated);

    _overlay.querySelectorAll('.admit-batch-slide').forEach(slide => {
      slide.addEventListener('click', () => {
        _overlay.querySelectorAll('.admit-batch-slide').forEach(s => s.classList.remove('active'));
        slide.classList.add('active');
        currentBatch = paid.find(b => b.name === slide.dataset.name);
        const label = _overlay.querySelector('#pay-batch-label');
        if (label) label.textContent = currentBatch.name;
        renderPlans();
      });
    });

    if (currentBatch) renderPlans();
  }

  function _renderPlans(batch, student, onActivated) {
    const host = _overlay?.querySelector('#pay-plans');
    if (!host || !batch) return;

    const trialDays = batch.trial_days != null ? batch.trial_days : 1;
    const btns = [];
    if (trialDays > 0) {
      btns.push(`<button class="admit-plan-btn trial" data-plan="trial">
        <span class="admit-plan-name">🎁 ${trialDays}-दिवस Free Trial</span>
        <span class="admit-plan-price">मोफत</span>
      </button>`);
    }
    if (batch.monthly_price > 0) {
      btns.push(`<button class="admit-plan-btn featured" data-plan="monthly">
        <span class="admit-plan-name">📅 Monthly <span class="admit-plan-badge">Popular</span></span>
        <span class="admit-plan-price">₹${_esc(batch.monthly_price)}</span>
      </button>`);
    }
    if (batch.yearly_price > 0) {
      btns.push(`<button class="admit-plan-btn" data-plan="yearly">
        <span class="admit-plan-name">🗓️ Yearly</span>
        <span class="admit-plan-price">₹${_esc(batch.yearly_price)}</span>
      </button>`);
    }
    host.innerHTML = `${btns.join('')}<p id="pay-msg" class="pin-error hidden" role="alert" style="margin-top:6px"></p>`;

    host.querySelectorAll('button[data-plan]').forEach(btn => {
      btn.addEventListener('click', () => _choosePlan(btn.dataset.plan, batch, student, onActivated, host));
    });
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
      if (plan === 'trial') {
        await API.startTrial({ student_code: student.student_code, pin: student.pin, batch: batch.name });
        _toast('🎁 Free trial सुरू झाला!', 'success');
        _close();
        onActivated?.();
        return;
      }

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

  function _openCheckout(order, plan, batch, student, onActivated, host) {
    const rzp = new Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'Nks EduOrbit',
      description: `${batch.name} — ${plan === 'yearly' ? 'Yearly' : 'Monthly'}`,
      order_id: order.order_id,
      prefill: { name: student.name || '', contact: student.contact || '' },
      theme: { color: '#001f5c' },
      handler: async (response) => {
        // Verify + activate synchronously — don't depend solely on the
        // webhook (which can be delayed, misconfigured, or never delivered).
        _msg(host, 'Payment मिळाले! Account active होत आहे…', false);
        try {
          await API.verifyPayment({
            student_code: student.student_code,
            pin: student.pin,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          _toast('✅ Account active! आता login करा.', 'success');
          _close();
          onActivated?.();
          return;
        } catch (err) {
          console.warn('verifyPayment failed, falling back to polling', err);
        }
        _pollActivation(student, onActivated, host);
      },
      modal: { ondismiss: () => _msg(host, 'Payment रद्द झाले.') },
    });
    rzp.on('payment.failed', resp => _msg(host, resp?.error?.description || 'Payment अयशस्वी'));
    rzp.open();
  }

  // Webhook activation is async — poll status until active (≈20s max).
  async function _pollActivation(student, onActivated, host, tries = 0) {
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
      _msg(host, 'Payment झाले. Activation मध्ये थोडा वेळ — १ मिनिटाने login करा.', false);
      return;
    }
    setTimeout(() => _pollActivation(student, onActivated, host, tries + 1), 2000);
  }

  return { openPlanSelect };
})();

window.PAYMENT = PAYMENT;
