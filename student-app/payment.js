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
    _overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto';

    const optionsHtml = paid.length
      ? `<label class="onboarding-label" for="pay-batch">Class / Batch निवडा</label>
         <select id="pay-batch" class="onboarding-input">
           ${paid.map(b => `<option value="${_esc(b.name)}">${_esc(b.icon || '📚')} ${_esc(b.name)}</option>`).join('')}
         </select>
         <div id="pay-plans" style="margin-top:14px"></div>`
      : `<p style="color:var(--text2,#8b949e);text-align:center">अजून कोणतीही paid batch उपलब्ध नाही. Admin शी संपर्क करा.</p>`;

    _overlay.innerHTML = `
      <div style="background:var(--surface,#fff);border-radius:18px;padding:22px 20px;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.25)">
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:1.8rem">🎟️</div>
          <h2 style="margin:6px 0 2px;font-size:1.15rem;color:var(--text1,#111)">Plan निवडा</h2>
          <p style="margin:0;font-size:0.82rem;color:var(--text2,#8b949e)">${_esc(student.name || '')} — ${_esc(student.student_code || '')}</p>
        </div>
        ${optionsHtml}
        <button id="pay-close" class="onboarding-skip" style="margin-top:14px;width:100%">नंतर करेन (बंद करा)</button>
      </div>`;
    document.body.appendChild(_overlay);

    _overlay.querySelector('#pay-close')?.addEventListener('click', _close);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) _close(); });

    const batchSel = _overlay.querySelector('#pay-batch');
    const renderPlans = () => _renderPlans(paid.find(b => b.name === batchSel.value), student, onActivated);
    if (batchSel) {
      batchSel.addEventListener('change', renderPlans);
      renderPlans();
    }
  }

  function _renderPlans(batch, student, onActivated) {
    const host = _overlay?.querySelector('#pay-plans');
    if (!host || !batch) return;

    const trialDays = batch.trial_days != null ? batch.trial_days : 1;
    const btns = [];
    if (trialDays > 0) {
      btns.push(`<button class="onboarding-btn" data-plan="trial" style="background:#16a34a">🎁 ${trialDays}-दिवस Free Trial</button>`);
    }
    if (batch.monthly_price > 0) {
      btns.push(`<button class="onboarding-btn" data-plan="monthly">📅 Monthly — ₹${_esc(batch.monthly_price)}</button>`);
    }
    if (batch.yearly_price > 0) {
      btns.push(`<button class="onboarding-btn" data-plan="yearly">🗓️ Yearly — ₹${_esc(batch.yearly_price)}</button>`);
    }
    host.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">${btns.join('')}</div>
      <p id="pay-msg" class="pin-error hidden" role="alert" style="margin-top:10px"></p>`;

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
      handler: () => {
        // Payment captured on client; the webhook activates the account.
        _msg(host, 'Payment मिळाले! Account active होत आहे…', false);
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
