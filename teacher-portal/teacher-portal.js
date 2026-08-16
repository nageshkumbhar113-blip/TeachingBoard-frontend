/* NKS EduOrbit — YouTube Teacher Partner Portal
   Vanilla JS, same showScreen()/no-build convention as student-app/app.js.
   Talks to the backend added in TeachingBoard-backend/src/routes/youtubeTeacherRoutes.js. */

const API_BASE = 'https://teachingboard-backend.onrender.com/api/youtube-teacher';
const TOKEN_KEY = 'ytt_token';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

let _selectedPlan = 'yearly';
let _selectedPremium = false;
let _cache = { profile: null, teachingAreas: null, videos: null, batchTree: null };

// ── Token / API ──────────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

async function api(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

function toast(msg, isError) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  $('toast-root').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Screen switching (same convention as student-app/app.js showScreen) ─────

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $('screen-' + name);
  if (el) el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'dashboard') renderDashboardTab('home');
}

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  e.preventDefault();
  const target = nav.dataset.nav;
  if (target === 'register' && nav.dataset.plan) _selectedPlan = nav.dataset.plan;
  showScreen(target);
});

// ── Register / Login ──────────────────────────────────────────────────────────

$('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = $('register-error');
  errEl.classList.remove('show');
  const btn = $('register-submit');
  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    const data = await api('POST', '/register', {
      name: $('reg-name').value.trim(),
      mobile: $('reg-mobile').value.trim(),
      email: $('reg-email').value.trim(),
      password: $('reg-password').value,
      teaching_subject: $('reg-subject').value.trim(),
      youtube_channel_url: $('reg-channel').value.trim(),
      terms_accepted: $('reg-terms').checked,
    });
    setToken(data.token);
    toast('Account created!');
    showScreen('plan');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account →';
  }
});

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = $('login-error');
  errEl.classList.remove('show');
  const btn = $('login-submit');
  btn.disabled = true; btn.textContent = 'Logging in…';
  try {
    const data = await api('POST', '/login', {
      email: $('login-email').value.trim(),
      password: $('login-password').value,
    });
    setToken(data.token);
    showScreen('dashboard');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'Login →';
  }
});

// ── Plan selection + Razorpay checkout ───────────────────────────────────────

document.querySelectorAll('#plan-choice .plan-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('#plan-choice .plan-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    _selectedPlan = opt.dataset.plan;
    $('premium-field').style.display = _selectedPlan === 'trial' ? 'none' : '';
  });
});
document.querySelector(`#plan-choice .plan-opt[data-plan="${_selectedPlan}"]`)?.classList.add('selected');

$('plan-submit').addEventListener('click', async () => {
  const errEl = $('plan-error');
  errEl.classList.remove('show');
  const btn = $('plan-submit');
  btn.disabled = true;

  try {
    if (_selectedPlan === 'trial') {
      await api('POST', '/subscription/start-trial');
      toast('3-day trial started!');
      showScreen('dashboard');
      return;
    }

    _selectedPremium = $('plan-premium').checked;
    btn.textContent = 'Preparing payment…';
    const order = await api('POST', '/subscription/create', { plan_type: _selectedPlan, is_premium: _selectedPremium });

    if (!window.Razorpay) {
      await loadRazorpayScript();
    }
    const rzp = new Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'NKS EduOrbit — Teacher Partner',
      description: `${_selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'} plan${_selectedPremium ? ' + Premium' : ''}`,
      order_id: order.order_id,
      prefill: order.prefill,
      theme: { color: '#d97e1a' },
      handler: async response => {
        try {
          await api('POST', '/subscription/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          toast('Payment successful!');
          showScreen('dashboard');
        } catch (err) {
          toast('Payment done, but confirming failed — it will activate shortly. Contact support if not.', true);
        }
      },
      modal: { ondismiss: () => { btn.disabled = false; btn.textContent = 'Continue →'; } },
    });
    rzp.on('payment.failed', () => toast('Payment failed. No amount was deducted.', true));
    rzp.open();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'Continue →';
  }
});

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load payment gateway'));
    document.head.appendChild(s);
  });
}

// ── Dashboard ────────────────────────────────────────────────────────────────

document.querySelectorAll('#dash-sidebar .dash-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'logout') {
      setToken(null);
      showScreen('landing');
      return;
    }
    renderDashboardTab(btn.dataset.tab);
  });
});

async function renderDashboardTab(tab) {
  document.querySelectorAll('#dash-sidebar .dash-nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const main = $('dash-main');
  main.innerHTML = '<div class="empty-hint">Loading…</div>';
  try {
    if (tab === 'home')          return renderHome(main);
    if (tab === 'profile')       return renderProfile(main);
    if (tab === 'areas')         return renderAreas(main);
    if (tab === 'add-video')     return renderAddVideo(main);
    if (tab === 'videos')        return renderVideos(main);
    if (tab === 'missing')       return renderMissing(main);
    if (tab === 'subscription')  return renderSubscription(main);
    if (tab === 'payments')      return renderPayments(main);
  } catch (err) {
    if (/unauthorized|login required/i.test(err.message)) {
      setToken(null);
      toast('Session expired — please login again', true);
      showScreen('login');
      return;
    }
    main.innerHTML = `<div class="empty-hint">${esc(err.message)}</div>`;
  }
}

async function renderHome(main) {
  const [profileRes, videosRes, missingRes, subRes] = await Promise.all([
    api('GET', '/profile'), api('GET', '/videos'), api('GET', '/missing-videos'), api('GET', '/subscription'),
  ]);
  const profile = profileRes.data, videos = videosRes.data, missing = missingRes.data, sub = subRes.data;
  const counts = { pending: 0, approved: 0, rejected: 0 };
  videos.forEach(v => { counts[v.status] = (counts[v.status] || 0) + 1; });

  const daysLeft = sub?.expiry_date ? Math.max(0, Math.ceil((new Date(sub.expiry_date) - Date.now()) / 86400000)) : null;

  main.innerHTML = `
    <div class="dash-head">
      <div><h2>Welcome back, ${esc(profile.name)} 👋</h2>
        <div class="sub">${sub ? `${sub.is_premium ? '⭐ Premium · ' : ''}${sub.plan_type[0].toUpperCase()+sub.plan_type.slice(1)} · Active` : 'No active plan'}</div></div>
      <button class="btn btn-primary" data-tab="add-video">+ Add New Video</button>
    </div>
    <div class="stat-row">
      <div class="stat-tile"><b>${videos.length}</b><span>Total Videos</span></div>
      <div class="stat-tile"><b>${counts.pending || 0}</b><span>Pending Review</span></div>
      <div class="stat-tile"><b>${counts.approved || 0}</b><span>Approved</span></div>
      <div class="stat-tile"><b>${counts.rejected || 0}</b><span>Rejected</span></div>
    </div>
    <div class="banner-row">
      <div class="banner warn"><span>⏳</span><div><strong>${missing.length} exercises still need videos</strong><span>in your Teaching Areas</span></div></div>
      <div class="banner ${sub ? 'ok' : 'warn'}"><span>${sub ? '✓' : '⚠️'}</span><div><strong>${sub ? `Renews in ${daysLeft} days` : 'No active subscription'}</strong><span>${sub ? `${sub.plan_type} plan` : 'Choose a plan to start adding videos'}</span></div></div>
    </div>
    <p class="section-label">Recent Videos</p>
    ${videos.slice(0, 5).map(videoRow).join('') || '<div class="empty-hint">No videos yet.</div>'}
  `;
  main.querySelector('[data-tab="add-video"]').addEventListener('click', () => renderDashboardTab('add-video'));
}

function videoRow(v) {
  return `<div class="list-card"><div class="thumb">▶</div><div class="info">
    <strong>${esc(v.chapter_name)} — ${esc(v.exercise_no)}${v.part_label ? ' · ' + esc(v.part_label) : ''}</strong>
    <small>${esc(v.batch_name)} · ${esc(v.subject_name)}</small></div>
    <span class="status-chip ${v.status}">${v.status[0].toUpperCase()+v.status.slice(1)}</span></div>`;
}

async function renderProfile(main) {
  const { data: p } = await api('GET', '/profile');
  main.innerHTML = `
    <div class="dash-head"><div><h2>My Profile</h2><div class="sub">${p.channel_verified ? '✅ Channel Verified' : '⏳ Channel not yet verified'}</div></div></div>
    <div class="field"><label>Name</label><input id="pf-name" value="${esc(p.name)}"></div>
    <div class="field"><label>Bio</label><textarea id="pf-bio" rows="3">${esc(p.bio)}</textarea></div>
    <div class="field"><label>Teaching Subject</label><input id="pf-subject" value="${esc(p.teaching_subject)}"></div>
    <div class="field"><label>YouTube Channel URL</label><input id="pf-channel" value="${esc(p.youtube_channel_url)}">
      <p class="field-note">Changing this resets verification — admin will re-check.</p></div>
    <div class="field"><label>Intro/Demo Video URL (optional)</label><input id="pf-intro" placeholder="Shown on your card to students choosing between teachers"></div>
    <div class="field"><label>New Password (leave blank to keep current)</label><input id="pf-password" type="password" minlength="6"></div>
    <p class="field-error" id="pf-error"></p>
    <button class="btn btn-primary" id="pf-save">Save Changes</button>
  `;
  main.querySelector('#pf-save').addEventListener('click', async () => {
    const errEl = main.querySelector('#pf-error');
    errEl.classList.remove('show');
    try {
      const introUrl = main.querySelector('#pf-intro').value.trim();
      await api('PUT', '/profile', {
        name: main.querySelector('#pf-name').value.trim(),
        bio: main.querySelector('#pf-bio').value.trim(),
        teaching_subject: main.querySelector('#pf-subject').value.trim(),
        youtube_channel_url: main.querySelector('#pf-channel').value.trim(),
        ...(introUrl ? { intro_video_id: extractVideoIdClient(introUrl) } : {}),
        ...(main.querySelector('#pf-password').value ? { new_password: main.querySelector('#pf-password').value } : {}),
      });
      toast('Profile updated');
    } catch (err) {
      errEl.textContent = err.message; errEl.classList.add('show');
    }
  });
}

async function renderAreas(main) {
  const [treeRes, areasRes] = await Promise.all([api('GET', '/batch-tree'), api('GET', '/teaching-areas')]);
  const tree = treeRes.data, areas = areasRes.data;
  const activeSet = new Set(areas.map(a => `${a.batch_name}::${a.subject_name}`));
  const idFor = (b, s) => areas.find(a => a.batch_name === b && a.subject_name === s)?.id;

  main.innerHTML = `
    <div class="dash-head"><div><h2>My Teaching Areas</h2><div class="sub">Pick the Batches &amp; Subjects you teach — same names students already see.</div></div></div>
    <div class="batch-check-grid">
      ${tree.map(b => `<div class="batch-check"><div class="bname">${esc(b.name)}</div>
        ${b.subjects.map(s => {
          const on = activeSet.has(`${b.name}::${s.name}`);
          return `<span class="subj-tag ${on ? 'on' : ''}" data-batch="${esc(b.name)}" data-subject="${esc(s.name)}">${on ? '✓ ' : ''}${esc(s.name)}</span>`;
        }).join('')}
      </div>`).join('')}
    </div>
    <div class="card" style="margin-top:20px;padding:16px 18px;border-left:3px solid var(--red);">
      <strong style="font-size:.86rem;color:var(--red);">⚠️ Removing a Subject deletes its videos</strong>
      <p style="font-size:.82rem;color:var(--ink2);margin:6px 0 0;">Removing a Teaching Area permanently deletes every video (any status) you've added for that Batch + Subject. This can't be undone.</p>
    </div>
  `;
  main.querySelectorAll('.subj-tag').forEach(tag => {
    tag.addEventListener('click', async () => {
      const batch = tag.dataset.batch, subject = tag.dataset.subject;
      const isOn = tag.classList.contains('on');
      try {
        if (isOn) {
          const id = idFor(batch, subject);
          if (!confirm(`Remove "${subject}" from "${batch}"?\n\nThis permanently deletes every video you've added for it.`)) return;
          const res = await api('DELETE', `/teaching-areas/${id}`);
          toast(`Removed — ${res.videos_deleted} video(s) deleted`);
        } else {
          await api('POST', '/teaching-areas', { batch_name: batch, subject_name: subject });
          toast('Teaching area added');
        }
        renderDashboardTab('areas');
      } catch (err) { toast(err.message, true); }
    });
  });
}

async function renderAddVideo(main) {
  const [treeRes, areasRes] = await Promise.all([api('GET', '/batch-tree'), api('GET', '/teaching-areas')]);
  const tree = treeRes.data;
  const myAreaBatches = [...new Set(areasRes.data.map(a => a.batch_name))];
  const batchesForPicker = tree.filter(b => myAreaBatches.includes(b.name));

  main.innerHTML = `
    <div class="dash-head"><div><h2>Add Exercise Video</h2><div class="sub">Add a Teaching Area first if the batch you need isn't listed.</div></div></div>
    ${batchesForPicker.length === 0 ? '<div class="empty-hint">Add a Teaching Area first (My Teaching Areas tab).</div>' : `
    <div class="field"><label>Batch</label><select class="field-select" id="av-batch"><option value="">Select…</option>
      ${batchesForPicker.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Subject</label><select class="field-select" id="av-subject" disabled><option>Select Batch first</option></select></div>
    <div class="field"><label>Chapter</label><select class="field-select" id="av-chapter" disabled><option>Select Subject first</option></select></div>
    <div class="field"><label>Exercise</label><select class="field-select" id="av-exercise" disabled><option>Select Chapter first</option></select></div>
    <div id="av-callout"></div>
    <div class="field"><label>YouTube URL</label><input id="av-url" placeholder="https://youtu.be/..."></div>
    <div id="av-preview"></div>
    <div class="field"><label>Part Label (optional — for a long exercise split into parts)</label><input id="av-part" placeholder="e.g. Part 1 — Concepts"></div>
    <p class="field-error" id="av-error"></p>
    <button class="btn btn-primary btn-block" id="av-submit">Submit for Approval</button>
    `}
  `;
  if (!batchesForPicker.length) return;

  const batchSel = main.querySelector('#av-batch'), subjectSel = main.querySelector('#av-subject'),
        chapterSel = main.querySelector('#av-chapter'), exerciseSel = main.querySelector('#av-exercise');

  batchSel.addEventListener('change', () => {
    const b = tree.find(x => x.name === batchSel.value);
    subjectSel.innerHTML = '<option value="">Select…</option>' + (b?.subjects || []).map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
    subjectSel.disabled = !b;
    chapterSel.innerHTML = '<option>Select Subject first</option>'; chapterSel.disabled = true;
    exerciseSel.innerHTML = '<option>Select Chapter first</option>'; exerciseSel.disabled = true;
  });
  subjectSel.addEventListener('change', () => {
    const b = tree.find(x => x.name === batchSel.value);
    const s = b?.subjects.find(x => x.name === subjectSel.value);
    chapterSel.innerHTML = '<option value="">Select…</option>' + (s?.chapters || []).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    chapterSel.disabled = !s;
    exerciseSel.innerHTML = '<option>Select Chapter first</option>'; exerciseSel.disabled = true;
  });
  chapterSel.addEventListener('change', async () => {
    exerciseSel.innerHTML = '<option>Loading…</option>'; exerciseSel.disabled = true;
    try {
      const res = await api('GET', `/exercises?batch=${encodeURIComponent(batchSel.value)}&subject=${encodeURIComponent(subjectSel.value)}&chapter=${encodeURIComponent(chapterSel.value)}`);
      exerciseSel.innerHTML = res.data.length
        ? '<option value="">Select…</option>' + res.data.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')
        : '<option value="">No exercises found for this chapter yet</option>';
      exerciseSel.disabled = false;
    } catch { exerciseSel.innerHTML = '<option>Failed to load</option>'; }
  });

  // Live preview — the teacher (and, on the admin side, whoever approves
  // it) both need to actually SEE the video before submitting/approving,
  // not just paste/read a URL. Debounced-by-nature since it only re-renders
  // when the extracted 11-char id actually changes, so retyping mid-URL
  // doesn't reload the iframe on every keystroke.
  const urlInput = main.querySelector('#av-url');
  const previewEl = main.querySelector('#av-preview');
  let lastPreviewedId = '';
  urlInput.addEventListener('input', () => {
    const id = extractVideoIdClient(urlInput.value);
    if (id === lastPreviewedId) return;
    lastPreviewedId = id;
    previewEl.innerHTML = id
      ? `<iframe width="100%" height="220" style="border-radius:8px;border:1px solid var(--border,#ddd);margin-top:8px" src="https://www.youtube-nocookie.com/embed/${id}" title="Preview" frameborder="0" allowfullscreen></iframe>`
      : '';
  });

  main.querySelector('#av-submit').addEventListener('click', async () => {
    const errEl = main.querySelector('#av-error');
    errEl.classList.remove('show');
    const url = main.querySelector('#av-url').value.trim();
    if (!batchSel.value || !subjectSel.value || !chapterSel.value || !exerciseSel.value || !url) {
      errEl.textContent = 'Please fill Batch, Subject, Chapter, Exercise and YouTube URL.'; errEl.classList.add('show'); return;
    }
    try {
      await api('POST', '/videos', {
        batch_name: batchSel.value, subject_name: subjectSel.value, chapter_name: chapterSel.value, exercise_no: exerciseSel.value,
        youtube_url: url, part_label: main.querySelector('#av-part').value.trim(),
      });
      toast('Submitted for approval!');
      renderDashboardTab('videos');
    } catch (err) { errEl.textContent = err.message; errEl.classList.add('show'); }
  });
}

async function renderVideos(main) {
  const { data: videos } = await api('GET', '/videos');
  main.innerHTML = `
    <div class="dash-head"><div><h2>My Videos</h2><div class="sub">All ${videos.length} · Pending ${videos.filter(v=>v.status==='pending').length} · Approved ${videos.filter(v=>v.status==='approved').length} · Rejected ${videos.filter(v=>v.status==='rejected').length}</div></div></div>
    ${videos.length ? videos.map(v => `
      <div class="list-card"><div class="thumb">▶</div><div class="info">
        <strong>${esc(v.chapter_name)} — ${esc(v.exercise_no)}${v.part_label ? ' · ' + esc(v.part_label) : ''}</strong>
        <small>${esc(v.batch_name)} · ${esc(v.subject_name)}${v.status === 'rejected' && v.rejection_reason ? ' — ' + esc(v.rejection_reason) : ''}</small></div>
        <span class="status-chip ${v.status}">${v.status[0].toUpperCase()+v.status.slice(1)}</span>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:.76rem;" data-delete="${v.id}">Delete</button>
      </div>`).join('') : '<div class="empty-hint">No videos yet — add one from "Add Exercise Video".</div>'}
  `;
  main.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this video permanently?')) return;
      try { await api('DELETE', `/videos/${btn.dataset.delete}`); toast('Deleted'); renderDashboardTab('videos'); }
      catch (err) { toast(err.message, true); }
    });
  });
}

async function renderMissing(main) {
  const { data: gaps } = await api('GET', '/missing-videos');
  main.innerHTML = `
    <div class="dash-head"><div><h2>Missing Videos</h2><div class="sub">Exercises in your Teaching Areas where you don't have a video yet.</div></div></div>
    ${gaps.length ? gaps.map(g => `<div class="list-card"><div class="thumb">📄</div><div class="info">
        <strong>${esc(g.chapter_name)} — ${esc(g.exercise_no)}</strong><small>${esc(g.batch_name)} · ${esc(g.subject_name)}</small></div></div>`).join('')
      : '<div class="empty-hint">No gaps — you\'ve covered every exercise in your Teaching Areas 🎉</div>'}
  `;
}

async function renderSubscription(main) {
  const { data: sub } = await api('GET', '/subscription');
  main.innerHTML = `
    <div class="dash-head"><div><h2>My Subscription</h2></div></div>
    ${sub ? `
      <div class="stat-row" style="grid-template-columns:repeat(3,1fr);">
        <div class="stat-tile"><b>${sub.plan_type[0].toUpperCase()+sub.plan_type.slice(1)}</b><span>Plan</span></div>
        <div class="stat-tile"><b>${sub.is_premium ? '⭐ Yes' : 'No'}</b><span>Premium add-on</span></div>
        <div class="stat-tile"><b>${new Date(sub.expiry_date).toLocaleDateString()}</b><span>Expires</span></div>
      </div>
    ` : '<div class="empty-hint">No active subscription.</div>'}
    <button class="btn btn-primary" id="sub-change" style="margin-top:16px;">${sub ? 'Renew / Change Plan' : 'Choose a Plan'}</button>
  `;
  main.querySelector('#sub-change').addEventListener('click', () => showScreen('plan'));
}

async function renderPayments(main) {
  const { data: rows } = await api('GET', '/payment-history');
  main.innerHTML = `
    <div class="dash-head"><div><h2>Payment History</h2></div></div>
    <div class="card" style="padding:6px 18px;overflow-x:auto;">
      <table class="pay-table"><tr><th>Date</th><th>Amount</th><th>Plan</th><th>Status</th></tr>
        ${rows.length ? rows.map(r => `<tr><td>${new Date(r.date).toLocaleDateString()}</td><td>₹${r.amount}</td>
          <td>${r.plan_type[0].toUpperCase()+r.plan_type.slice(1)}${r.is_premium ? ' + Premium' : ''}</td>
          <td style="color:var(--teal);font-weight:700;">${r.status === 'active' ? 'Paid' : r.status}</td></tr>`).join('')
          : '<tr><td colspan="4" style="text-align:center;color:var(--ink3);">No payments yet</td></tr>'}
      </table>
    </div>
  `;
}

function extractVideoIdClient(url) {
  const s = String(url || '').trim();
  let m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || s.match(/[?&]v=([A-Za-z0-9_-]{11})/) || s.match(/embed\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return '';
}

// ── Boot ──────────────────────────────────────────────────────────────────────

(function boot() {
  if (getToken()) {
    showScreen('dashboard');
  }
})();
