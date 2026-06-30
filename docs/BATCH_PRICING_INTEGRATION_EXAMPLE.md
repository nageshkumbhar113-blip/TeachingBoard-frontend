# 🎓 Batch Pricing Integration Example

## Quick Start: Add Pricing Tab to Admin Panel

### 1. Add to Admin HTML (admin-app/index.html)

```html
<!-- Add this in your admin tabs section -->
<div class="admin-tabs">
  <!-- Existing tabs... -->
  
  <!-- NEW: Batch Pricing Tab -->
  <button class="admin-tab-button" data-tab="batch-pricing">
    🎓 Batch Pricing
  </button>
</div>

<!-- Tab Content -->
<div id="batch-pricing" class="admin-tab-content" style="display: none;">
  <!-- Batch Pricing UI will load here -->
  <div id="bp-container"></div>
</div>

<!-- Add this script at the end of HTML, after other admin scripts -->
<script src="./batchPricingManager.js"></script>

<script>
  // Initialize batch pricing when admin loads
  document.addEventListener('DOMContentLoaded', async () => {
    // Load batch pricing UI
    const response = await fetch('./batch-pricing-ui.html');
    const html = await response.text();
    const container = document.getElementById('bp-container');
    if (container) {
      container.innerHTML = html;
    }

    // Tab switching
    document.querySelectorAll('.admin-tab-button').forEach(btn => {
      btn.addEventListener('click', function() {
        const tabName = this.dataset.tab;
        
        // Hide all tabs
        document.querySelectorAll('.admin-tab-content').forEach(content => {
          content.style.display = 'none';
        });
        
        // Show selected tab
        const tabContent = document.getElementById(tabName);
        if (tabContent) {
          tabContent.style.display = 'block';
        }
        
        // Highlight active button
        document.querySelectorAll('.admin-tab-button').forEach(b => {
          b.classList.remove('active');
        });
        this.classList.add('active');
      });
    });
  });
</script>
```

### 2. Add CSS (admin-app/admin.css)

```css
/* Tab buttons */
.admin-tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #eee;
  flex-wrap: wrap;
}

.admin-tab-button {
  padding: 1rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 1rem;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.3s ease;
}

.admin-tab-button:hover {
  color: #001f5c;
}

.admin-tab-button.active {
  color: #001f5c;
  border-bottom-color: #001f5c;
}

/* Tab content */
.admin-tab-content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 2. Backend API Setup (Already Complete!)

The following endpoints are now available:

```bash
# Admin endpoints
GET    /api/batches                     # Get all batches with structure
POST   /api/batches                     # Create new batch
PUT    /api/batches/:name               # Rename batch
DELETE /api/batches/:name               # Delete batch

# Pricing endpoints (NEW)
PUT    /api/batches/:name/pricing       # Update batch pricing
GET    /api/batches/:name/pricing       # Get batch pricing

# Student endpoints
GET    /api/batches/pricing/all         # Get all pricing for checkout
```

---

## 3. Example Admin Panel Layout

```
┌─────────────────────────────────────────────────────────┐
│ Admin Panel                                          [⊗] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [❓ PIN Gate] [📚 Questions] [📄 Lessons]             │
│  [🎓 Batch Pricing]  [⚙️ Settings]                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🎓 Batch Pricing Management                           │
│  [➕ Create New Batch]                                 │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │ 📚 Physics Class 12              Active       │    │
│  │ Type: 💰 Paid                                 │    │
│  │ Price: ₹999 → 10% off → ₹899                 │    │
│  │ [✏️ Edit] [🗑️ Delete]                        │    │
│  └───────────────────────────────────────────────┘    │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │ ⚗️ Chemistry Class 12            Active       │    │
│  │ Type: 🆓 Free                                 │    │
│  │ [✏️ Edit] [🗑️ Delete]                        │    │
│  └───────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Student Registration Flow Integration

### In student-app/app.js

```javascript
// Step 1: Load batch pricing during registration
async function loadBatchPricingForRegistration() {
  try {
    const response = await fetch(
      `${window.TEACHINGBOARD_API_URL}/batches/pricing/all`
    );
    const result = await response.json();
    const batches = result.data;

    // Render batch selection UI
    const batchContainer = document.getElementById('batch-selection');
    batchContainer.innerHTML = batches.map(batch => {
      const isFree = batch.pricing_type === 'free';
      const priceDisplay = isFree 
        ? '<span style="color: green; font-weight: bold;">🆓 Free</span>'
        : `<span style="color: #001f5c;">₹${batch.discounted_price}</span>
           ${batch.discount ? `<small>(${batch.discount.type === 'percentage' ? batch.discount.value + '%' : '₹' + batch.discount.value} off)</small>` : ''}`;

      return `
        <div class="batch-option">
          <label>
            <input type="checkbox" class="batch-checkbox" data-batch="${batch.name}" data-price="${batch.discounted_price}">
            <span class="batch-icon">${batch.icon}</span>
            <span class="batch-name">${batch.name}</span>
            <span class="batch-price">${priceDisplay}</span>
          </label>
          ${batch.description ? `<small>${batch.description}</small>` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load batches:', err);
  }
}

// Step 2: Calculate total and prepare for Razorpay
function calculateTotalAmount() {
  const checkboxes = document.querySelectorAll('.batch-checkbox:checked');
  let total = 0;

  checkboxes.forEach(checkbox => {
    const price = parseFloat(checkbox.dataset.price) || 0;
    total += price;
  });

  return total;
}

// Step 3: Student proceeds to payment
async function proceedToPayment() {
  const selectedBatches = Array.from(
    document.querySelectorAll('.batch-checkbox:checked')
  ).map(cb => cb.dataset.batch);

  const totalAmount = calculateTotalAmount();

  if (selectedBatches.length === 0) {
    alert('Please select at least one batch');
    return;
  }

  if (totalAmount === 0) {
    // All selected batches are free
    console.log('All free batches selected, no payment needed');
    await enrollStudentInBatches(selectedBatches);
    return;
  }

  // Show Razorpay checkout
  const student = {
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    name: document.getElementById('name').value
  };

  initializeRazorpayPayment(totalAmount, selectedBatches, student);
}

// Step 4: Save enrollment after payment
async function enrollStudentInBatches(batchNames) {
  try {
    const response = await fetch(
      `${window.TEACHINGBOARD_API_URL}/students/enroll`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('student_token')}`
        },
        body: JSON.stringify({ batches: batchNames })
      }
    );

    if (!response.ok) throw new Error('Enrollment failed');

    alert('✅ Enrollment successful! You can now access the courses.');
    // Redirect to dashboard
    window.location.href = './student-app/index.html';
  } catch (err) {
    console.error('Enrollment failed:', err);
    alert('Failed to complete enrollment');
  }
}
```

---

## 5. Complete Checkout Flow Example

### HTML UI

```html
<!-- Registration Form with Batch Selection -->
<div id="student-registration-form">
  <h2>Register with Nks EduOrbit</h2>

  <!-- Personal Info -->
  <form>
    <input type="text" id="name" placeholder="Full Name" required>
    <input type="email" id="email" placeholder="Email" required>
    <input type="tel" id="phone" placeholder="Phone" required>
    <input type="password" id="password" placeholder="Password" required>

    <!-- Batch Selection -->
    <h3>📚 Select Courses</h3>
    <div id="batch-selection" style="margin: 1rem 0;">
      <!-- Batches will load here -->
    </div>

    <!-- Price Summary -->
    <div id="price-summary" style="background: #f9f9f9; padding: 1rem; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between;">
        <span>Selected Batches:</span>
        <span id="selected-count">0</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 0.5rem;">
        <span>Total Amount:</span>
        <span id="total-amount">₹0</span>
      </div>
    </div>

    <!-- Register Button -->
    <button type="button" onclick="registerStudent()" class="btn-primary">
      Register & Proceed to Payment →
    </button>
  </form>

  <!-- Add event listeners for batch selection -->
  <script>
    document.addEventListener('change', function(e) {
      if (e.target.classList.contains('batch-checkbox')) {
        const checkboxes = document.querySelectorAll('.batch-checkbox:checked');
        document.getElementById('selected-count').textContent = checkboxes.length;
        
        let total = 0;
        checkboxes.forEach(cb => {
          total += parseFloat(cb.dataset.price) || 0;
        });
        
        document.getElementById('total-amount').textContent = total === 0 ? 'Free' : '₹' + total;
      }
    });
  </script>
</div>
```

---

## 6. Admin Test Scenario

### Create Test Batches

1. **Physics Class 12** (Paid)
   - Base Price: ₹999
   - Discount: 10% off
   - Final Price: ₹899

2. **Chemistry Class 12** (Paid)
   - Base Price: ₹1299
   - Discount: ₹100 off
   - Final Price: ₹1199

3. **Biology Class 12** (Free)
   - Pricing: Free
   - Final Price: ₹0

### Test Student Registration

1. Student selects: Physics + Chemistry
2. Total: ₹899 + ₹1199 = ₹2098
3. Proceed to Razorpay
4. After payment: Access to both paid courses
5. Biology is free: Immediate access

---

## 7. Database Verification

After setting up, verify batches are created:

```javascript
// Open browser console and run:
fetch('https://teachingboard-backend.onrender.com/api/batches/pricing/all')
  .then(r => r.json())
  .then(data => console.table(data.data));

// Output:
// ┌────┬──────────────────────┬──────────┬───────────┬─────────┬──────────┐
// │ name                │ pricing_type │ base_price │ discount │ final   │
// ├────┬──────────────────────┼──────────┼───────────┼─────────┼──────────┤
// │ Physics Class 12   │ paid         │ 999        │ 10% off  │ 899.1   │
// │ Chemistry Class 12 │ paid         │ 1299       │ ₹100 off │ 1199    │
// │ Biology Class 12   │ free         │ 0          │ none     │ 0       │
// └────┴──────────────────────┴──────────┴───────────┴─────────┴──────────┘
```

---

## 8. File Structure After Integration

```
Teaching Board/
├── admin-app/
│   ├── index.html
│   ├── admin.js
│   ├── batchPricingManager.js          (NEW)
│   ├── batch-pricing-ui.html           (NEW)
│   └── admin.css
├── student-app/
│   ├── app.js
│   ├── index.html
│   └── student-ui.css
├── docs/
│   ├── BATCH_PRICING_ADMIN_GUIDE.md    (NEW)
│   ├── BATCH_PRICING_INTEGRATION_EXAMPLE.md (NEW)
│   └── ...
└── TeachingBoard-backend/
    ├── src/
    │   ├── models/
    │   │   └── Batch.js                (UPDATED - added pricing fields)
    │   ├── controllers/
    │   │   └── batchController.js      (UPDATED - added pricing functions)
    │   └── routes/
    │       └── batchRoutes.js          (UPDATED - added pricing endpoints)
    └── ...
```

---

## 9. Testing Checklist

- [ ] Admin can create new batch with pricing
- [ ] Admin can edit batch pricing
- [ ] Discount calculation works correctly
- [ ] Free batches don't show pricing fields
- [ ] Batch deletion works with confirmation
- [ ] Student sees pricing during registration
- [ ] Student can select multiple batches
- [ ] Total amount calculates correctly
- [ ] Free batches don't charge payment
- [ ] Razorpay integration works
- [ ] Batch data persists in database

---

## 10. Troubleshooting

**Batches not showing in admin:**
```javascript
// Check API
fetch('API_URL/batches', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
}).then(r => r.json()).then(console.log);
```

**Discount not calculating:**
- Ensure base_price > 0
- Ensure discount type is "fixed" or "percentage"
- Ensure percentage is 0-100

**Modal not opening:**
- Check browser console for JavaScript errors
- Verify HTML IDs match JavaScript selectors

---

**Status:** ✅ Ready to Integrate  
**Next Step:** Add to admin panel and test with sample batches
