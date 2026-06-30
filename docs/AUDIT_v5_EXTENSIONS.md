# TeachingBoard v5.0.0 — Admin Pricing Tab & Student Self-Registration Deep Audit

**Date:** 2026-06-30  
**Auditor:** Code review (automated + manual)  
**Scope:** Admin Batch Pricing Tab (new feature), Student Self-Registration Process  
**Build:** v5.0.0 / versionCode 50 / SW v41

---

## Summary

| Severity | Area | Count | Fixed | Remaining |
|----------|------|-------|-------|-----------|
| 🔴 CRITICAL | Admin Pricing | 2 | 0 | 2 |
| 🔴 CRITICAL | Self-Registration | 3 | 0 | 3 |
| 🟡 WARNING  | Admin Pricing | 5 | 0 | 5 |
| 🟡 WARNING  | Self-Registration | 4 | 0 | 4 |
| 🔵 MINOR    | Admin Pricing | 3 | 0 | 3 |
| 🔵 MINOR    | Self-Registration | 2 | 0 | 2 |

---

## 🔴 CRITICAL Issues

### Admin Pricing — C1: Native `confirm()` dialog blocks Android delete

**File:** `admin-app/batchPricingManager.js:402`  
**Current Code:**
```javascript
if (!confirm(`Are you sure you want to delete "${batchName}"?...`)) {
  return;
}
```

**Problem:**  
- Native `confirm()` returns `false` on Android WebView (blocked by Capacitor)
- User cannot delete batches from mobile — function silently exits without showing any error
- Unlike the student app's `confirm()` fix (see AUDIT_v5.md C5), this code path was missed

**Impact if unfixed:**  
- Batch deletion is permanently broken on mobile (web and APK)
- Teachers cannot clean up unused batches from their devices
- Data management becomes impossible on mobile

**Recommended Fix:**  
Replace with `APP.confirmAsync()` (already implemented in student-app/ui.js):
```javascript
async function deleteBatch(batchName) {
  const confirmed = await APP.confirmAsync(`Delete "${batchName}" batch? This affects all enrolled students.`);
  if (!confirmed) return;
  try {
    // ... existing delete logic ...
  } catch (err) {
    console.error('❌ Failed to delete batch:', err);
    APP.toast('Failed to delete batch', 'error');
  }
}
```

---

### Admin Pricing — C2: Modal form values not populated on edit

**File:** `admin-app/batchPricingManager.js:254–265`  
**Current Code:**
```javascript
} else {
  batchNameInput.value = batch.name;
  batchNameInput.disabled = true;
  pricingTypeRadios.forEach(r => {
    r.checked = r.value === batch.pricing_type;
  });
  basePriceInput.value = batch.base_price || '';
  discountTypeSelect.value = batch.discount?.type || 'fixed';
  discountValueInput.value = batch.discount?.value || '';
  discountedPriceDisplay.textContent = `₹${batch.discounted_price}`;
  descriptionInput.value = batch.description || '';
}
```

**Problem:**  
- Form fields DO set values, BUT `_updatePricingFieldsVisibility()` is called after form values are set
- If batch is FREE, visibility hides pricing fields (lines 286–292)
- BUT input fields still have their old values from previous free batch edit
- When switching back to PAID, stale values from previous edit are shown

**Scenario:**
1. Create free batch "Batch A" — pricing fields hidden
2. Edit Batch A — looks correct (no pricing shown)
3. Create paid batch "Batch B" with price ₹500, discount ₹50
4. Edit Batch A again → shows FREE radio selected, but pricing fields show ₹500 and ₹50 from step 3
5. Change Batch A to PAID → stale ₹500 is now submitted to server

**Impact if unfixed:**  
- Data corruption: pricing gets mixed across batches
- Admin creates wrong pricing by accident
- No validation catches this since the backend checks per-batch uniqueness

**Recommended Fix:**
```javascript
function _showBatchForm(batch) {
  const isNewBatch = !batch;
  
  // Reset form to clean state FIRST
  batchNameInput.value = '';
  basePriceInput.value = '';
  discountTypeSelect.value = 'fixed';
  discountValueInput.value = '';
  discountedPriceDisplay.textContent = '₹0';
  descriptionInput.value = '';
  
  // THEN populate with batch data
  if (!isNewBatch) {
    batchNameInput.value = batch.name;
    batchNameInput.disabled = true;
    // ... rest of population logic ...
  }
  
  // Finally, update visibility based on final radio state
  _updatePricingFieldsVisibility();
  // ... modal display ...
}
```

---

### Self-Registration — C3: No rate limiting / CAPTCHA on registration endpoint

**File:** `core/helpers.js:1201–1206` (frontend) + `TeachingBoard-backend/src/controllers/studentController.js:215–251` (backend)  
**Backend Code:**
```javascript
exports.selfRegister = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  // ... validation ...
  const student = await User.create({ ... });
  res.status(201).json({ success: true, ... });
});
```

**Problem:**  
- Backend endpoint `/students/register` has NO rate limiting
- Frontend sends POST with minimal validation (4-digit PIN, name, school)
- Attacker can spam endpoint with fake registrations:
  ```
  for (let i = 0; i < 10000; i++) {
    API.selfRegister({ name: `Bot${i}`, mobile: '1234567890', school_name: 'Fake', pin: '0000' })
  }
  ```
- No CAPTCHA, no email/SMS verification, no honeypot field
- Database bloat: each spam registration creates a pending student record
- Admin approval queue becomes unusable

**Current Frontend Validation (weak):**
```javascript
if (!name) return _showErr('पूर्ण नाव टाका');
if (!school_name) return _showErr('शाळेचे नाव टाका');
if (mobile && !/^\d{10}$/.test(mobile)) return _showErr('...');
if (!/^\d{4}$/.test(pin)) return _showErr('...');
```

**Impact if unfixed:**  
- Database DoS: registration table filled with spam, degrading admin approval query performance
- Reputation damage: school gets fake student records in their system
- Legal risk if spam registrations are treated as real students

**Recommended Fix:**
1. Add server-side rate limiting on `/students/register` endpoint (5 requests per IP per 10 minutes)
2. Optionally add Google reCAPTCHA v3 to frontend before submission
3. Add email/SMS verification (send PIN via SMS, require confirmation)

Backend rate limiter (example using express-rate-limit):
```javascript
const selfRegisterLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 5,                     // 5 requests per window
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  message: 'Too many registration attempts. Try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/students/register', selfRegisterLimiter, studentController.selfRegister);
```

---

### Self-Registration — C4: No email/SMS verification, immediate activation risk

**File:** `TeachingBoard-backend/src/controllers/studentController.js:215–251`  
**Current Flow:**
1. User submits self-registration
2. Backend creates student with `status: 'pending'`
3. Admin must approve → `status: 'active'`
4. **But** no verification that email/phone is real

**Problem:**  
- Attacker can register with fake email/phone → admin approves → account is now live
- No way to know if the person registering is actually the student or a parent/guardian
- No paper trail linking registration to an email/phone that can be verified
- If parent approves a child, no record of parent consent (GDPR/COPPA concern)

**Impact if unfixed:**  
- Account takeover risk: wrong person creates account, then locks out real student
- Privacy: unverified accounts leak personal data
- Compliance: school cannot prove parental consent was obtained

**Recommended Fix:**
- Send OTP (one-time password) via email or SMS after self-registration
- Require verification before student status changes from 'pending'
- Log verification timestamp and method

Example flow:
```javascript
exports.selfRegister = asyncHandler(async (req, res) => {
  // ... validate input ...
  
  const student = await User.create({
    // ... fields ...
    status: 'pending',
    verification_required: true,
    verification_method: mobile ? 'sms' : 'email', // future: add email field
  });
  
  // Send OTP
  if (mobile) {
    await SMS.sendOtp(mobile, student.user_id);
  }
  
  res.status(201).json({
    success: true,
    message: 'Verification code sent. Check your SMS.',
    student_code: student.student_code,
    requires_verification: true,
  });
});
```

---

## 🟡 WARNING Issues

### Admin Pricing — W1: Discount validation allows negative/oversized values

**File:** `admin-app/batchPricingManager.js:296–317`  
**Current Discount Calculation:**
```javascript
function _calculateDiscountedPrice() {
  const basePrice = parseFloat(basePriceInput.value) || 0;
  const discountType = discountTypeSelect.value;
  const discountValue = parseFloat(discountValueInput.value) || 0;

  let discountedPrice = basePrice;

  if (discountType === 'fixed') {
    discountedPrice = Math.max(0, basePrice - discountValue);  // Clamps to 0, good
  } else if (discountType === 'percentage') {
    const percentage = Math.min(100, Math.max(0, discountValue));  // Clamps to 0-100, good
    discountedPrice = basePrice * (1 - percentage / 100);
  }
  discountedPrice = Math.round(discountedPrice * 100) / 100;
  discountedPriceDisplay.textContent = `₹${discountedPrice}`;
}
```

**Problem:**
- **Frontend clamping is only visual** — does NOT prevent invalid submission
- If user enters `-100` for fixed discount:
  - Display shows: `Math.max(0, 1000 - (-100))` = `1100` (increased price!)
  - Stored value sent to server: `{ type: 'fixed', value: -100 }`
- Backend DOES validate (lines 319–330 in batchController.js) but:
  - Frontend shows wrong visual feedback (price jumped up)
  - Backend rejects → user sees error only after submission

**Scenario:**
1. Admin enters base price ₹1000, discount type "fixed", discount value "-100"
2. Display shows final price as ₹1100 (visually wrong)
3. Admin clicks save
4. Backend rejects: "discount value must be >= 0"
5. Admin is confused — why did the UI show ₹1100?

**Impact if unfixed:**  
- User confusion and poor UX
- Admin may not understand why the discount was rejected
- No form-level validation before submission

**Recommended Fix:**
- Add `min="0"` HTML5 attribute to discount value input
- Add client-side validation in `_submitBatchForm()` before sending
- Show inline error message if user enters invalid discount:

```javascript
async function _submitBatchForm() {
  // ... existing validation ...
  
  if (pricingType === 'paid' && payload.discount) {
    const discValue = parseFloat(discountValueInput.value);
    if (discValue < 0) {
      APP.toast('Discount value must be 0 or greater', 'error');
      return;
    }
    if (discountTypeSelect.value === 'percentage' && discValue > 100) {
      APP.toast('Discount percentage must be 0-100', 'error');
      return;
    }
  }
  
  // ... continue with submission ...
}
```

---

### Admin Pricing — W2: No loading state / double-submit prevention

**File:** `admin-app/batchPricingManager.js:319–395`  
**Current Submit Handler:**
```javascript
async function _submitBatchForm() {
  // ... validation ...
  try {
    // Fetch request
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
      },
      body: JSON.stringify(payload),
    });
    // ... handle response ...
  } catch (err) {
    // ... error handling ...
  }
}
```

**Problem:**
- Submit button is never disabled during fetch
- User can click "Save" multiple times while request is in-flight
- Server receives duplicate POST requests creating duplicate batch records
- No loading spinner to indicate submission progress
- No visual feedback that request is processing

**Scenario:**
1. Admin fills form, clicks "Save Batch"
2. Network is slow (3G, 2 second latency)
3. Admin clicks "Save" again (button still enabled)
4. Server receives 2 POST requests simultaneously
5. First request: creates batch "Physics" successfully
6. Second request: unique constraint violation or creates a second duplicate
7. Admin sees 2 batches now

**Impact if unfixed:**  
- Duplicate batch records in database
- Confusion about which batch to use
- Manual cleanup required by database admin

**Recommended Fix:**
```javascript
async function _submitBatchForm() {
  const submitBtn = document.getElementById('bp-submit-btn');
  
  // ... validation ...
  
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '⏳ Saving...';
  
  try {
    // ... existing fetch logic ...
    APP.toast(isNew ? 'Batch created! 🎉' : 'Updated! ✅', 'success');
    _hideBatchForm();
    await loadBatches();
  } catch (err) {
    console.error('Failed to save:', err);
    APP.toast(err.message || 'Failed to save batch', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}
```

---

### Admin Pricing — W3: Modal doesn't handle concurrent edits

**File:** `admin-app/batchPricingManager.js:207–227`  
**Current Edit Handler:**
```javascript
async function editBatch(batchName) {
  try {
    const response = await fetch(
      `${window.TEACHINGBOARD_API_URL}/batches/${encodeURIComponent(batchName)}/pricing`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
    );
    const result = await response.json();
    _editingBatch = result.data;
    _showBatchForm(result.data);
  } catch (err) {
    console.error('Failed to load batch:', err);
    APP.toast('Failed to load batch details', 'error');
  }
}
```

**Problem:**
- If backend pricing changed (another admin updated it concurrently):
  - User A opens Edit for batch "Physics", pricing: ₹500, discount: ₹50
  - User B changes same batch to ₹800, discount: ₹100
  - User A still sees ₹500, ₹50 in form (stale data)
  - User A submits → overwrites User B's changes with stale ₹500, ₹50
- **Lost update problem:** Last write wins, silently dropping concurrent changes
- No version/timestamp to detect conflicts
- No warning to user that data changed

**Impact if unfixed:**  
- Data loss due to concurrent edits
- Admin changes pricing, then another admin's older edit overwrites it
- Pricing audit trail is unreliable

**Recommended Fix:**
- Add `updated_at` timestamp to batch response
- Compare timestamps before allowing save:
  ```javascript
  if (_editingBatch.updated_at !== refreshedBatch.updated_at) {
    APP.toast('Batch was updated by another user. Reloading...', 'warning');
    _editingBatch = refreshedBatch;
    _showBatchForm(refreshedBatch);
    return;
  }
  ```

---

### Admin Pricing — W4: No accessibility (ARIA labels, keyboard nav)

**File:** `admin-app/batch-pricing-ui.html` + `admin-app/batchPricingManager.js`  
**Current Modal HTML:**
```html
<div id="bp-batch-modal" class="bp-modal hidden">
  <div class="bp-modal-content">
    <div class="bp-modal-header">
      <h3 id="bp-modal-title">Create New Batch</h3>
      <button id="bp-close-btn" class="bp-modal-close" onclick="...">✕</button>
    </div>
    <form id="bp-batch-form" class="bp-form">
      <!-- No aria-labels on form inputs -->
      <input id="bp-batch-name" type="text" placeholder="e.g., Physics Class 12" required />
      <!-- No role="group" on pricing type radio group -->
      <div class="bp-radio-group">
        <label class="bp-radio-label">
          <input type="radio" name="bp-pricing-type" value="free" />
          <span>🆓 Free Course</span>
        </label>
      </div>
    </form>
  </div>
</div>
```

**Problems:**
1. **No `aria-label` on modal** — screen readers can't announce modal purpose
2. **No `role="dialog"` on modal container**
3. **Radio group has no `role="group"` and no `aria-labelledby`**
4. **Close button has no `aria-label`** — screen reader says "button ✕"
5. **Form inputs missing `aria-label`** (only placeholders)
6. **No focus trap** — Tabbing past submit button exits modal (accessibility failure)
7. **No Escape key handler** to close modal
8. **No `aria-describedby`** for inline validation errors

**Impact:**
- Screen reader users cannot navigate the form effectively
- Keyboard-only users cannot close the modal (no Escape key)
- WCAG 2.1 Level AA violations

**Recommended Fix:**
```html
<div id="bp-batch-modal" class="bp-modal hidden" role="dialog" aria-labelledby="bp-modal-title" aria-modal="true">
  <div class="bp-modal-content">
    <div class="bp-modal-header">
      <h3 id="bp-modal-title">Create New Batch</h3>
      <button id="bp-close-btn" class="bp-modal-close" aria-label="Close batch form">✕</button>
    </div>
    <form id="bp-batch-form" class="bp-form">
      <div class="bp-form-group">
        <label for="bp-batch-name">📚 Batch Name</label>
        <input id="bp-batch-name" type="text" aria-label="Batch name" required />
      </div>

      <fieldset class="bp-form-group">
        <legend>💰 Pricing Type</legend>
        <div class="bp-radio-group" role="group" aria-labelledby="pricing-legend">
          <label class="bp-radio-label">
            <input type="radio" name="bp-pricing-type" value="free" />
            <span>🆓 Free Course</span>
          </label>
          <label class="bp-radio-label">
            <input type="radio" name="bp-pricing-type" value="paid" checked />
            <span>💳 Paid Course</span>
          </label>
        </div>
      </fieldset>
    </form>
  </div>
</div>
```

---

### Admin Pricing — W5: Form state not cleared on cancel

**File:** `admin-app/batchPricingManager.js:272–279`  
**Current Close Handler:**
```javascript
function _hideBatchForm() {
  const modal = $('bp-batch-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('visible');
  }
  _editingBatch = null;
}
```

**Problem:**
- Form fields retain previous values when modal is closed
- User fills "Create New Batch" form, clicks Cancel
- User clicks "Create New Batch" again
- Form still shows previous values (name, pricing, discount) — confusing
- No visual indication that form is "reset"

**Scenario:**
1. Create batch "Physics" with ₹500 price
2. After success, modal closes
3. User clicks "Create New Batch" again
4. Form shows "Physics" in the name field (should be empty)
5. User forgets to clear it → overwrites Physics or creates a second one

**Impact:**
- Poor UX, user confusion
- Duplicate batches created by accident

**Recommended Fix:**
```javascript
function _hideBatchForm() {
  const modal = $('bp-batch-modal');
  if (!modal) return;
  
  // Reset form fields
  $('bp-batch-name').value = '';
  $('bp-batch-name').disabled = false;
  $('bp-base-price').value = '';
  $('bp-discount-value').value = '';
  $('bp-discount-type').value = 'fixed';
  $('bp-description').value = '';
  document.querySelector('input[name="bp-pricing-type"][value="paid"]').checked = true;
  $('bp-discounted-price').textContent = '₹0';
  
  // Clear error messages
  const errorEl = document.getElementById('bp-error-msg');
  if (errorEl) errorEl.classList.add('hidden');
  
  // Hide modal
  modal.classList.add('hidden');
  modal.classList.remove('visible');
  _editingBatch = null;
}
```

---

### Self-Registration — W1: PIN allows trivial patterns (0000, 1111, 1234)

**File:** `TeachingBoard-backend/src/controllers/studentController.js:223`  
**Validation:**
```javascript
if (!/^\d{4}$/.test(pin)) throw new AppError('PIN must be 4 digits', 400);
```

**Problem:**
- Validation only checks format (4 digits), NOT entropy
- Allows trivial/guessable PINs:
  - `0000`, `1111`, `2222`, ..., `9999` (10 options)
  - `1234`, `4567`, `9876` (sequential)
  - `1212`, `1313` (repeating pattern)
- Student account security depends on a 4-digit PIN
- An attacker needs to guess only 10,000 combinations (trivial brute-force)

**Current PIN Comparison (Good):**
```javascript
// In authController: uses timing-safe comparison
crypto.timingSafeEqual(Buffer.from(providedPin), Buffer.from(storedPin))
```

**But:** Timing-safe comparison is only useful if the PIN itself is strong. Weak PINs defeat the purpose.

**Impact:**
- Account takeover: guess PIN, login as student
- If mobile device is shared, anyone can guess PIN (0000, 1111)
- Low password entropy violates industry best practices

**Recommended Fix (Policy-level):**
- Reject PINs with all identical digits: `0000`, `1111`, etc.
- Reject sequential PINs: `1234`, `4567`, `6789`, `9876`, `3210`, etc.
- Reject repeating pairs: `1212`, `2323`, `5656`, etc.

```javascript
function isWeakPin(pin) {
  if (!/^\d{4}$/.test(pin)) return true;  // not 4 digits
  if (/^(\d)\1{3}$/.test(pin)) return true;  // all same: 0000, 1111, etc
  if (/^(\d)(\d)(\d)(\d)$/.test(pin)) {
    const [a, b, c, d] = pin.split('').map(Number);
    // Sequential ascending: 0123, 1234, 5678, etc
    if (b === a + 1 && c === b + 1 && d === c + 1) return true;
    // Sequential descending: 9876, 5432, 3210, etc
    if (b === a - 1 && c === b - 1 && d === c - 1) return true;
    // Repeating pairs: 1212, 5656, etc
    if (a === c && b === d) return true;
  }
  return false;
}
```

---

### Self-Registration — W2: No terms & conditions, no parent consent

**File:** `student-app/app.js:606–642` (registration form)  
**Current Form:**
```html
<!-- No T&C checkbox -->
<!-- No parent consent -->
<form id="reg-form">
  <input id="reg-name" type="text" placeholder="पूर्ण नाव" />
  <input id="reg-mobile" type="text" placeholder="Mobile number" />
  <input id="reg-school" type="text" placeholder="School name" />
  <input id="reg-pin" type="text" placeholder="PIN" />
  <button id="reg-submit">Register</button>
</form>
```

**Problems:**
1. **No terms & conditions checkbox** — user has not explicitly agreed to use
2. **No privacy policy link** — school cannot prove GDPR/COPPA compliance
3. **No parental consent** — for minors (< 18), no guardian approval recorded
4. **No age acknowledgment** — form does not ask "Are you 18+ or have parental consent?"
5. **No audit trail** — if a child self-registers without permission, school has no record of warning

**Legal/Compliance Risk:**
- GDPR (EU): minors need parental consent to process personal data
- COPPA (US): children under 13 need parental consent
- Schools liable if they process data without proper consent

**Impact:**
- Regulatory fines for data protection violations
- Liability if a minor's data is misused and school cannot prove consent was sought

**Recommended Fix:**
```html
<div class="bp-form-group">
  <label class="bp-checkbox">
    <input type="checkbox" id="reg-terms" required />
    <span>
      I agree to the 
      <a href="/terms" target="_blank">Terms of Use</a> and 
      <a href="/privacy" target="_blank">Privacy Policy</a>
    </span>
  </label>
</div>

<div class="bp-form-group">
  <label class="bp-checkbox">
    <input type="checkbox" id="reg-consent" required />
    <span>
      I confirm that I am 18+ years old OR have parental/guardian consent
    </span>
  </label>
</div>
```

Then in submission:
```javascript
if (!document.getElementById('reg-terms').checked) {
  return _showErr('Must agree to Terms of Use');
}
if (!document.getElementById('reg-consent').checked) {
  return _showErr('Must confirm age or parental consent');
}
```

---

### Self-Registration — W3: Success screen doesn't guide next steps

**File:** `student-app/app.js:630–636`  
**Current Success:**
```javascript
const codeEl = document.getElementById('reg-success-code');
if (codeEl) codeEl.textContent = `तुमचा Student Code: ${code}`;
if (successEl) successEl.classList.remove('hidden');
submitBtn.style.display = 'none';
document.getElementById('reg-back').textContent = '← Login कडे जा';
```

**Problem:**
- Screen shows code but doesn't explain:
  - "Your registration is pending admin approval"
  - "Save your code somewhere safe"
  - "You'll receive an email when approved" (not true, no email sent)
  - "Contact your school if not approved within X days"
- No copy-to-clipboard button — user has to manually type code
- No indication of how long approval takes

**Impact:**
- User doesn't know they need admin approval
- User tries to login immediately, fails, gives up
- Support tickets from confused students

**Recommended Fix:**
```javascript
if (codeEl) {
  codeEl.innerHTML = `
    <div style="margin-bottom: 16px;">
      <strong>तुमचा Student Code:</strong>
      <code style="background:#eee;padding:8px;border-radius:4px;font-size:1.2em">${code}</code>
      <button style="margin-left:8px;padding:8px 12px" onclick="navigator.clipboard.writeText('${code}').then(()=>APP.toast('Copied!','success'))">
        📋 Copy
      </button>
    </div>
    <div style="font-size:0.9em;color:#666;">
      <p>✅ <strong>Registration submitted!</strong></p>
      <p>📧 Admin approval is required. Check back in 24-48 hours.</p>
      <p>💾 <strong>Save your code!</strong> You'll need it to login.</p>
      <p>❓ Questions? Contact your school's admin.</p>
    </div>
  `;
}
```

---

### Self-Registration — W4: Mobile field accepts non-Indian formats

**File:** `student-app/app.js:622`  
**Validation:**
```javascript
if (mobile && !/^\d{10}$/.test(mobile)) return _showErr('Mobile number 10 अंकी असणे आवश्यक आहे');
```

**Problem:**
- Validation assumes Indian phone numbers (10 digits)
- But does not:
  - Validate country code (+91, etc.)
  - Check if number is valid India format
  - Reject reserved/test numbers (like 1234567890)
  - Reject obviously invalid sequences

**Scenarios:**
- User enters: `1234567890` (all sequential) — passes validation ✓ (but invalid)
- User enters: `0000000000` (all zeros) — passes validation ✓ (but invalid)
- User enters: `1111111111` (all ones) — passes validation ✓ (but invalid)

**Impact:**
- Invalid phone numbers in database
- SMS OTP cannot be sent (when/if implemented)
- Database cleanup needed later

**Recommended Fix:**
```javascript
function isValidIndianPhone(mobile) {
  // Must be 10 digits
  if (!/^\d{10}$/.test(mobile)) return false;
  
  // Reject invalid patterns
  if (/^0{10}$/.test(mobile)) return false;  // all zeros
  if (/^(\d)\1{9}$/.test(mobile)) return false;  // all same digit
  
  // Reject sequential
  const digits = mobile.split('').map(Number);
  const isSequential = digits.every((d, i) => {
    if (i === 0) return true;
    return d === digits[i-1] + 1 || d === digits[i-1] - 1;
  });
  if (isSequential) return false;
  
  // Indian mobile numbers typically start with 6-9
  const firstDigit = parseInt(mobile[0]);
  if (firstDigit < 6 || firstDigit > 9) return false;
  
  return true;
}

if (mobile && !isValidIndianPhone(mobile)) {
  return _showErr('Invalid mobile number');
}
```

---

## 🔵 MINOR Issues

### Admin Pricing — M1: Discount display doesn't show "No discount"

**File:** `admin-app/batchPricingManager.js:160–166`  
**Current Display:**
```javascript
const discountText = batch.discount
  ? `${batch.discount.type === 'percentage' ? batch.discount.value + '%' : '₹' + batch.discount.value} off`
  : 'No discount';
priceDisplay = `₹${batch.base_price} → ${discountText} → ₹${batch.discounted_price}`;
```

**Problem:**
- If discount is 0, still shows "No discount" correctly
- But if discount.value is null or undefined, behavior is undefined
- Small edge case, but inconsistent

**Impact:** Minor — cosmetic only

---

### Admin Pricing — M2: No batch deactivation (soft delete)

**File:** `admin-app/batchPricingManager.js` (batch card actions)  
**Current Actions:**
```javascript
<button class="bp-btn bp-btn-edit">✏️ Edit</button>
<button class="bp-btn bp-btn-delete">🗑️ Delete</button>
```

**Problem:**
- Only Edit and Delete (hard delete)
- No "Deactivate" option (soft delete)
- If admin deletes batch, all cascade deletes happen (see batchController.js:142–169):
  - Fee configs removed
  - Notes/lessons removed
  - Questions unlinked
- Some schools want to hide old batches without destroying data

**Recommended Enhancement:**
- Add `is_active` field toggle
- Keep data but hide from student UI

---

### Admin Pricing — M3: Batch list doesn't show pricing status

**File:** `admin-app/batchPricingManager.js:138–200`  
**Current Card Display:**
```javascript
<div class="bp-detail-row">
  <span class="bp-label">Status:</span>
  <span class="bp-value">${priceDisplay}</span>
</div>
```

**Problem:**
- List shows pricing, but doesn't sort by status
- "Unpriced" batches not highlighted
- Admin can't quickly find batches that need pricing set up

**Recommended Enhancement:**
- Add filter/sort by pricing status
- Highlight "⚠️ Unpriced" batches in orange
- Show count: "3 paid, 1 free, 2 unpriced"

---

### Self-Registration — M1: No mobile/email in DB schema for self-registered students

**File:** `TeachingBoard-backend/src/controllers/studentController.js:233–243`  
**Current Create:**
```javascript
const student = await User.create({
  user_id: `student-${randomUUID()}`,
  name,
  role: 'student',
  student_code,
  mobile,                    // Stored, good
  school_name,               // Stored
  status: 'pending',
  request_source: 'self',
  pin_hash: User.hashPin(pin),
});
```

**Problem:**
- Mobile is stored but never validated by backend
- No email field (only mobile)
- When admin approves, no way to contact student back (only mobile on file)

**Recommendation:**
- Add email field to User model
- Add email validation on self-register endpoint

---

### Self-Registration — M2: No handling of duplicate registration attempts

**File:** `TeachingBoard-backend/src/controllers/studentController.js:215–251`  
**Current Flow:**
```javascript
// If code already exists, admin.createStudent rejects
const existing = await User.findOne({ student_code: studentCode, role: 'student' });
if (existing) throw new AppError('Student code already exists', 409);
```

**Problem:**
- `selfRegister` generates random code, very unlikely to collide
- But if same person tries registering twice:
  - First attempt: name "Raj", code "RAJ123" → pending
  - Second attempt: same name "Raj" → generates new code "RAJ456" → another pending record
  - Admin sees 2 pending records for same person, doesn't know they're duplicates

**Recommendation:**
- Check for duplicate registrations by name + school_name
- If found, reject: "You already have a pending registration"

---

## Verified Clean ✅

| Check | Status |
|-------|--------|
| Batch pricing calculation logic (fixed + percentage) | ✅ |
| Self-register backend route protection (no auth required — intentional) | ✅ |
| Discount values clamped to valid range on backend | ✅ |
| Student PIN hashing uses PBKDF2 (strong) | ✅ |
| Batch deletion cascades correctly (no orphaned records) | ✅ |
| Registration input sanitization (no HTML injection) | ✅ |

---

## Recommendations: Priority Order

### Immediate (Before Production)
1. ✅ **C1 — Admin Pricing Delete:** Replace `confirm()` with `APP.confirmAsync()`
2. ✅ **C3 — Self-Register Rate Limit:** Add rate limiting to `/students/register` endpoint
3. ✅ **C4 — Email/SMS Verification:** Require verification before account activation
4. ✅ **W1 — Discount Validation:** Add input min/max attributes and form validation
5. ✅ **W3 — Concurrent Edit Conflict:** Add `updated_at` timestamp detection

### High Priority (Next Release)
6. ✅ **C2 — Form State Clear:** Reset modal form on open/close
7. ✅ **W2 — Trivial PIN Check:** Reject weak PIN patterns
8. ✅ **W4 — T&C & Parental Consent:** Add checkboxes, audit trail
9. ✅ **W5 — Mobile Validation:** Add Indian phone number format check

### Medium Priority (Polish)
10. ✅ **W4 — Accessibility:** Add ARIA labels, keyboard navigation, focus trap
11. ✅ **W3 — Success Guidance:** Improve registration success screen messaging
12. ✅ **M1–M3 — UX Enhancements:** Soft delete, batch status sort, copy-to-clipboard

---

## Files to Update

| File | Issues | Priority |
|------|--------|----------|
| `admin-app/batchPricingManager.js` | C1, C2, W1, W2, W3, W4, W5, M1, M2, M3 | CRITICAL |
| `admin-app/batch-pricing-ui.html` | W4 (accessibility) | HIGH |
| `student-app/app.js` | C1 (re-check), W2, W4, W5, M1, M2 | HIGH |
| `core/helpers.js` | W2, W4 (mobile validation) | HIGH |
| `TeachingBoard-backend/src/controllers/studentController.js` | C3, C4, W2, M1, M2 | CRITICAL |
| `TeachingBoard-backend/src/routes/studentRoutes.js` | Add rate limiting middleware | CRITICAL |
| `TeachingBoard-backend/src/middleware/rateLimiter.js` | Create if doesn't exist | CRITICAL |

---

## Next Steps

1. **Address CRITICAL issues (C1–C4)** immediately before next deployment
2. **Schedule WARNING fixes (W1–W5)** for current sprint
3. **Plan MINOR enhancements (M1–M3)** for backlog
4. **Add automated tests** for discount calculation, PIN validation, form submission
5. **Security audit** of registration rate limiting after implementation

---

**Date Completed:** 2026-06-30  
**Audit Level:** DEEP (all UI flows, routing, API calls, backend validation)  
**Next Audit:** After implementing recommendations, estimate 1 week
