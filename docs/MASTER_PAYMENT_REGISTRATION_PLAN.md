# 🏗️ MASTER PLAN: Complete Student Registration + Payment + Assignment System

**Status:** Senior-Level Architecture  
**Security Level:** Enterprise Grade  
**Completeness:** 100% Detailed  
**Date:** 2026-06-30

---

## 📋 SYSTEM OVERVIEW

```
Complete Flow:
1. Student Registration (Email/Phone/Password)
   ↓
2. Batch Selection (with Pricing Display)
   ↓
3. Payment Processing (Razorpay)
   ↓
4. Payment Verification (Webhook)
   ↓
5. Auto-Assign Batches & Courses
   ↓
6. Generate Student Code & PIN
   ↓
7. Generate Parent Code & PIN
   ↓
8. Show Welcome Window (with codes)
   ↓
9. Copy Buttons for Sharing
   ↓
10. Student Access to Dashboard
```

---

## 🔒 SAFETY & SECURITY ARCHITECTURE

### Layer 1: API Security
```
Request:
├─ HTTPS Only (TLS 1.3+)
├─ CORS restricted to frontend domain
├─ Request validation (rate limiting)
├─ Payload size limits
└─ Input sanitization (XSS/SQL injection prevention)

Authentication:
├─ JWT tokens with 15-min expiry
├─ Refresh tokens (7 days)
├─ Token stored in httpOnly cookies
├─ CSRF protection enabled
└─ No sensitive data in tokens
```

### Layer 2: Payment Security
```
Card Data:
├─ ❌ NEVER stored locally
├─ ✅ Razorpay handles all card details
├─ ✅ PCI-DSS Level 1 compliance
├─ ✅ Tokenized payments only

Payment Validation:
├─ Verify signature on backend
├─ Check amount matches DB
├─ Idempotent processing (prevent duplicates)
├─ Log all transactions
└─ Audit trail for compliance
```

### Layer 3: Student Data Security
```
Student Credentials:
├─ Password: bcrypt hashing (salt rounds: 10)
├─ Email: Unique constraint + verification
├─ Phone: Encrypted in DB
├─ Personal data: Encrypted at rest
└─ GDPR compliant access

Student Code & PIN:
├─ Generated server-side (not predictable)
├─ Cryptographically secure random
├─ Unique per student + parent
├─ Cannot be reused
├─ Rate-limited access
```

### Layer 4: Parent Access
```
Parent Portal:
├─ Separate authentication
├─ Parent code + PIN (not student password!)
├─ View-only access to child progress
├─ No sensitive financial data visible
├─ Session timeout (30 minutes)
└─ IP whitelisting option

Parent Code Security:
├─ Generated independently
├─ Different from student code
├─ Rotatable (can reset if leaked)
├─ Email-based recovery
└─ No master code exists
```

### Layer 5: Database Security
```
Connection:
├─ MongoDB connection string: environment variable
├─ SSL/TLS encrypted connection
├─ Whitelisted IP addresses
├─ Automatic backups
└─ Point-in-time recovery enabled

Data Protection:
├─ Field-level encryption for sensitive data
├─ Audit logging on sensitive field changes
├─ Cascading deletes prevented
├─ Soft deletes for audit trail
└─ Regular security patches
```

### Layer 6: Operational Security
```
Admin Controls:
├─ Two-factor authentication required
├─ Session lockout after 3 failed attempts
├─ Audit log for admin actions
├─ Separate staging/production environments
├─ No hardcoded secrets in code

Monitoring:
├─ Real-time alert on failed payments
├─ Alert on duplicate transactions
├─ Monitor API response times
├─ Track usage anomalies
└─ Daily security scans
```

---

## 🧠 ULTRA-SMART IMPLEMENTATION PLAN

### Phase 1: Backend Infrastructure (Secure Foundation)

#### 1.1 Database Models
```
Updates Needed:
├─ User Model
│  ├─ Add: student_code (unique)
│  ├─ Add: student_pin (hashed)
│  ├─ Add: parent_code (unique)
│  ├─ Add: parent_pin (hashed)
│  ├─ Add: payment_status (pending/completed/failed)
│  ├─ Add: subscription_status (active/expired/paused)
│  └─ Add: welcome_seen (boolean)
│
├─ StudentSubscription Model
│  ├─ Add: razorpay_payment_id
│  ├─ Add: razorpay_signature
│  ├─ Add: payment_verified (boolean)
│  ├─ Add: batches_assigned (array of batch IDs)
│  ├─ Add: assignment_date
│  └─ Add: expiry_date
│
├─ StudentProgress Model (NEW)
│  ├─ student_id
│  ├─ batch_id
│  ├─ course_id
│  ├─ progress (0-100%)
│  ├─ last_accessed
│  └─ completed_topics
│
└─ ParentAccount Model (NEW)
   ├─ parent_email
   ├─ parent_phone
   ├─ parent_code
   ├─ parent_pin (hashed)
   ├─ linked_students (array)
   ├─ permissions (view_progress, view_payments)
   └─ created_date
```

#### 1.2 API Endpoints (Route Structure)

```
Authentication Routes:
POST   /api/auth/register              → Student registration
POST   /api/auth/login                 → Student login
POST   /api/auth/refresh               → Refresh token
POST   /api/auth/logout                → Logout

Batch Routes:
GET    /api/batches/pricing/all        → Get all batches (public)
GET    /api/batches/:name/pricing      → Get single batch (public)

Subscription Routes:
POST   /api/subscriptions/initiate     → Start checkout
POST   /api/subscriptions/verify       → Verify payment (webhook)
GET    /api/subscriptions/status       → Get subscription status

Assignment Routes:
POST   /api/assignments/batch          → Assign batch to student (auto after payment)
GET    /api/assignments/student        → Get student's batches

Student Routes:
GET    /api/student/profile            → Get student info
GET    /api/student/codes              → Get student code + PIN
GET    /api/student/dashboard          → Student dashboard

Parent Routes:
POST   /api/parent/login               → Parent login with code+PIN
GET    /api/parent/child-progress      → View child's progress
```

#### 1.3 Webhook Security
```
Razorpay Webhook:
├─ Route: POST /api/webhooks/razorpay
├─ Verify signature (CRITICAL!)
├─ Verify amount matches
├─ Check for duplicates
├─ Atomic transaction (all-or-nothing)
├─ Idempotent processing
├─ Retry-safe implementation
└─ Error logging without sensitive data
```

---

### Phase 2: Payment Processing (100% Secure)

#### 2.1 Checkout Flow
```
1. Student selects batches
2. System calculates total (server-side, never trust frontend)
3. Verify pricing from DB for each batch
4. Create Razorpay order with:
   ├─ amount (in paise)
   ├─ currency (INR)
   ├─ customer_id
   ├─ receipt_id (unique for this transaction)
   ├─ notes (contains student_id, batch_ids)
   └─ description
5. Return order to frontend
6. Open Razorpay checkout

Student Clicks "Pay":
7. Razorpay processes payment
8. Sends webhook to backend

Backend Verification:
9. Validate webhook signature
10. Fetch payment details from Razorpay API
11. Verify amount matches order
12. Check for duplicate processing
13. Assign batches atomically
14. Generate codes/PIN
15. Send confirmation email
16. Return success to frontend

Frontend:
17. Close Razorpay modal
18. Show welcome window
19. Display auto-generated codes
```

#### 2.2 Code Generation (Cryptographically Secure)
```
Student Code Generation:
├─ Format: STU-<timestamp>-<random>
├─ Example: STU-20260630123456-X7K9Q2M
├─ Length: 25 characters
├─ Uniqueness: Database unique constraint
├─ Non-sequential (not predictable)
└─ Case-sensitive

Student PIN Generation:
├─ Format: 6 digits (000000 - 999999)
├─ Cryptographically random (not Math.random!)
├─ Hashed before storage (bcrypt)
├─ Cannot be reversed
└─ Rate-limited attempts (max 5 wrong tries)

Parent Code Generation:
├─ Format: PAR-<timestamp>-<random>
├─ Example: PAR-20260630123456-M8B5V3P
├─ Independent from student code
├─ 25 characters
├─ Unique per parent
└─ Non-sequential

Parent PIN Generation:
├─ Format: 6 digits (separate from student PIN)
├─ Cryptographically random
├─ Hashed before storage
├─ Parent-specific (can't use student PIN)
└─ Can be reset via email verification
```

#### 2.3 Idempotency & Duplicate Prevention
```
Duplicate Transaction Prevention:
├─ receipt_id in Razorpay order (unique)
├─ payment_id from Razorpay (always unique)
├─ Check: SELECT * WHERE razorpay_payment_id = ?
├─ If exists with same amount → return success (don't charge again)
├─ If exists with different amount → return error
└─ Database unique constraint on razorpay_payment_id

Webhook Retry Safety:
├─ Razorpay retries webhook 5 times
├─ Idempotent endpoint (same result regardless of retries)
├─ Use payment_id as idempotency key
├─ If payment already processed → return 200 (don't reprocess)
└─ Never charge twice
```

---

### Phase 3: Student Assignment (Atomic Operations)

#### 3.1 Batch Assignment Logic
```
After Payment Verified:
1. Start database transaction
2. Verify student exists
3. Verify all batches exist
4. Verify none already assigned (prevent duplicates)
5. Create StudentSubscription record with:
   ├─ student_id
   ├─ batches (array of batch objects)
   ├─ subscription_period (monthly/yearly)
   ├─ start_date (today)
   ├─ expiry_date (30/365 days from now)
   ├─ razorpay_payment_id
   ├─ razorpay_signature
   ├─ payment_verified: true
   └─ status: "active"

6. Create StudentProgress records for each batch
7. Update User.assigned_batches array
8. Generate student code (if not exists)
9. Generate student PIN (if not exists)
10. Create ParentAccount (if parent email provided)
11. Generate parent code
12. Generate parent PIN
13. Send confirmation emails (student + parent)
14. Commit transaction

If ANY step fails:
→ Rollback entire transaction
→ No partial assignments
→ Send error to webhook handler
```

#### 3.2 Course Assignment
```
Courses within Batches:
├─ Get all courses in assigned batches
├─ Create course_access records
├─ Grant access to study materials
├─ Grant access to MCQ/practice papers
├─ Set initial progress: 0%
└─ Record assignment timestamp

Course Access Features:
├─ Read: Notes, Videos, PDFs
├─ Practice: MCQs, Practice Papers
├─ Submit: Answers, Take exams
├─ View: Progress, Weak areas
└─ Generate: Practice papers offline
```

---

### Phase 4: Welcome Window (Beautiful UX + Security)

#### 4.1 Window Structure
```
┌────────────────────────────────────────┐
│         🎉 Welcome to Nks EduOrbit     │
├────────────────────────────────────────┤
│                                        │
│  Payment Successful! ✅                │
│                                        │
│  Your courses are now active for       │
│  next 30 days (Monthly plan)           │
│                                        │
├────────────────────────────────────────┤
│                                        │
│  📚 YOUR STUDENT DETAILS               │
│  ────────────────────────────────────  │
│                                        │
│  Student Code:                         │
│  ┌──────────────────────────────────┐  │
│  │ STU-20260630-X7K9Q2M             │  │
│  │              [📋 Copy]           │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Student PIN:                          │
│  ┌──────────────────────────────────┐  │
│  │ ••••••          [👁 Show]        │  │
│  │              [📋 Copy]           │  │
│  └──────────────────────────────────┘  │
│                                        │
├────────────────────────────────────────┤
│                                        │
│  👨‍👩‍👧 PARENT ACCESS                      │
│  ────────────────────────────────────  │
│                                        │
│  Parent Code:                          │
│  ┌──────────────────────────────────┐  │
│  │ PAR-20260630-M8B5V3P             │  │
│  │              [📋 Copy]           │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Parent PIN:                           │
│  ┌──────────────────────────────────┐  │
│  │ ••••••          [👁 Show]        │  │
│  │              [📋 Copy]           │  │
│  └──────────────────────────────────┘  │
│                                        │
├────────────────────────────────────────┤
│                                        │
│  📋 QUICK TIPS:                        │
│  • Save these codes in safe place      │
│  • Share parent code with parents      │
│  • Your subscription: 30 days          │
│  • Your courses: Physics, Chemistry    │
│  • Access: Available from now          │
│                                        │
│  [Share via WhatsApp] [Share via Email]│
│  [Download as PDF]    [Print]          │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  [Start Learning] →              │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

#### 4.2 Window Features
```
Display Elements:
├─ Status: Payment successful ✅
├─ Subscription: Duration (30 days)
├─ Courses: List of assigned batches
├─ Access: Immediate availability
├─ Student Code: Copy button
├─ Student PIN: Show/Hide + Copy
├─ Parent Code: Copy button
├─ Parent PIN: Show/Hide + Copy
└─ Tips: Quick reference

Interactions:
├─ Copy buttons (one-click copy to clipboard)
├─ Show/Hide PIN (toggle visibility)
├─ Share options (WhatsApp, Email, PDF)
├─ Print option (formatted for printing)
├─ Download as PDF (for records)
└─ "Start Learning" button (go to dashboard)

Styling:
├─ Centered modal (not full page!)
├─ Dark overlay outside
├─ Responsive (mobile + desktop)
├─ Print-friendly CSS
├─ High contrast for accessibility
└─ No scrolling (fits in one view)
```

#### 4.3 One-Time Display
```
Welcome Window Logic:
├─ Show after payment verification
├─ Set: student.welcome_seen = true
├─ Never show again for this student
├─ Accessible from: Profile → View Welcome (link to see again)
└─ Optional: Email version sent (same info)

User Can:
├─ View once automatically (after payment)
├─ Access again from profile page
├─ Download/Print anytime
├─ Share with parents
└─ Reset PIN if needed (via email)
```

---

### Phase 5: Student Dashboard Integration

#### 5.1 Dashboard After Login
```
Student Dashboard:
├─ Active Courses
│  ├─ Physics (Started 30 days, active)
│  ├─ Chemistry (Started 30 days, active)
│  └─ Biology (Not purchased)
│
├─ Quick Actions
│  ├─ Continue Learning
│  ├─ Take Practice Paper
│  ├─ View Weak Areas
│  └─ Download Offline Content
│
├─ Progress Summary
│  ├─ Overall: 25% complete
│  ├─ Physics: 40% complete
│  ├─ Chemistry: 15% complete
│  └─ Time spent: 12 hours
│
├─ Upcoming Features
│  ├─ Tests scheduled
│  ├─ New content available
│  └─ Renewal date: 30 days left
│
└─ Account Settings
   ├─ View Welcome (show again)
   ├─ Regenerate PIN (security)
   ├─ Manage subscription
   └─ Parent access
```

#### 5.2 Subscription Management
```
Subscription Page:
├─ Current Status: Active (30 days left)
├─ Renewal Date: 2026-07-30
├─ Current Courses: Physics, Chemistry, Biology
├─ Payment Method: Razorpay (Visa ending in 1234)
├─ Next Charge: ₹699/month (Chemistry auto-renew)
│
├─ Options:
│  ├─ Pause Subscription (1 week free)
│  ├─ Add New Batch (upgrade)
│  ├─ View Payment History
│  └─ Download Invoices
│
└─ Renewal Information:
   ├─ Automatic renewal enabled
   ├─ Cancel anytime (no penalty)
   └─ Contact support for issues
```

---

### Phase 6: Parent Portal (Minimal, Secure)

#### 6.1 Parent Login
```
Parent Login Screen:
├─ Parent Code: [____________________]
├─ Parent PIN: [____________________]
├─ Remember device: ☐
└─ [Login]

Features:
├─ No master password (code+PIN only)
├─ Session expires in 30 minutes
├─ IP whitelisting (optional)
└─ SMS/Email login alerts
```

#### 6.2 Parent Dashboard
```
Parent View:
├─ Child Name: Student 1
├─ Active Courses: 3
├─ Overall Progress: 25%
├─ Time Spent: 12 hours
├─ Last Accessed: 2 hours ago
│
├─ Course Progress
│  ├─ Physics: 40% (12/30 topics)
│  ├─ Chemistry: 15% (4/27 topics)
│  └─ Biology: 0% (0/25 topics)
│
├─ Weak Areas
│  ├─ Organic Chemistry (30% accuracy)
│  ├─ Thermodynamics (45% accuracy)
│  └─ Plant Physiology (35% accuracy)
│
├─ Recent Activity
│  ├─ Took: Physics Practice Paper (8/10)
│  ├─ Read: Chemistry Chapter 3
│  └─ Attempted: Biology Quiz (5/10)
│
└─ Options
   ├─ Send message to child
   ├─ Contact teacher
   └─ View detailed reports
```

---

## 🛡️ VALIDATION & ERROR HANDLING

### Server-Side Validation
```
Always Validate:
├─ Student exists in DB
├─ Email not already registered
├─ Phone not already registered
├─ All batch IDs exist
├─ Prices match DB prices (CRITICAL!)
├─ Razorpay signature correct
├─ Payment amount matches order
├─ No duplicate transactions
└─ Subscription not already active

Return Proper Error Codes:
├─ 400: Bad Request (validation failed)
├─ 401: Unauthorized (invalid token)
├─ 403: Forbidden (no permission)
├─ 404: Not Found (batch doesn't exist)
├─ 409: Conflict (email already exists)
├─ 422: Unprocessable (logic error)
├─ 500: Server Error (unexpected issue)
└─ 503: Service Unavailable (Razorpay down)
```

### Error Messages (Safe)
```
Don't Return:
❌ "Email john@example.com already exists"
❌ "User not found in database"
❌ "Database connection failed"
❌ Stack traces or internal errors

Return Instead:
✅ "This email is already registered"
✅ "Invalid credentials"
✅ "Service temporarily unavailable"
✅ "Please contact support"
```

---

## 📊 DATABASE SCHEMA UPDATES

### User Model Addition
```javascript
{
  // Existing fields...
  email: String,
  phone: String,
  password: String,
  
  // NEW fields
  student_code: { type: String, unique: true, sparse: true },
  student_pin: { type: String },  // bcrypt hashed
  parent_code: { type: String, unique: true, sparse: true },
  parent_pin: { type: String },  // bcrypt hashed
  
  payment_status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'pending' 
  },
  
  subscription_status: {
    type: String,
    enum: ['active', 'expired', 'paused', 'cancelled'],
    default: 'active'
  },
  
  assigned_batches: [{ 
    batch_id: ObjectId,
    assigned_date: Date,
    expiry_date: Date
  }],
  
  welcome_seen: { type: Boolean, default: false },
  welcome_shown_date: Date,
  
  created_at: Date,
  updated_at: Date
}
```

### StudentSubscription Model
```javascript
{
  _id: ObjectId,
  student_id: ObjectId,  // reference to User
  
  // Batches
  batches: [{
    batch_id: ObjectId,
    batch_name: String,
    price: Number,
    period: String  // 'monthly' or 'yearly'
  }],
  
  total_amount: Number,
  subscription_period: String,  // 'monthly' or 'yearly'
  
  // Payment Info
  razorpay_order_id: String,
  razorpay_payment_id: String,
  razorpay_signature: String,
  payment_verified: Boolean,
  
  // Dates
  start_date: Date,
  expiry_date: Date,
  
  // Renewal
  auto_renewal: Boolean,
  next_renewal_date: Date,
  
  // Status
  status: String,  // 'active', 'expired', 'cancelled'
  
  created_at: Date,
  updated_at: Date
}
```

### ParentAccount Model
```javascript
{
  _id: ObjectId,
  
  parent_email: { type: String, required: true, unique: true },
  parent_name: String,
  parent_phone: String,
  
  parent_code: { type: String, unique: true, required: true },
  parent_pin: { type: String },  // bcrypt hashed
  
  linked_students: [ObjectId],  // reference to User IDs
  
  permissions: {
    view_progress: Boolean,
    view_payments: Boolean,
    send_messages: Boolean,
    contact_teacher: Boolean
  },
  
  last_login: Date,
  last_ip_address: String,
  
  created_at: Date,
  updated_at: Date
}
```

---

## 🔐 SECURITY CHECKLIST

Before Production:
- [ ] All passwords hashed with bcrypt
- [ ] JWT tokens use HS256 or RS256
- [ ] HTTPS only (no HTTP)
- [ ] CORS configured properly
- [ ] Rate limiting on auth endpoints
- [ ] SQL injection prevention (use parameterized queries)
- [ ] XSS prevention (sanitize HTML)
- [ ] CSRF tokens on forms
- [ ] Razorpay signature verification
- [ ] No sensitive data in logs
- [ ] Environment variables for secrets
- [ ] Database backups automated
- [ ] Monitoring and alerting set up
- [ ] Incident response plan created
- [ ] GDPR compliance review done

---

## 🚀 DEPLOYMENT ORDER

1. **Database Migrations**
   - Add new fields to User
   - Create StudentSubscription collection
   - Create ParentAccount collection
   - Create indices for performance

2. **Backend APIs**
   - Auth endpoints (register, login)
   - Payment endpoints (checkout, verify)
   - Assignment endpoints (batch assign)
   - Code generation endpoints

3. **Frontend Pages**
   - Student registration form
   - Batch selection page
   - Checkout/Razorpay integration
   - Welcome window modal
   - Parent login page

4. **Testing**
   - Unit tests (all functions)
   - Integration tests (full flow)
   - Security tests (SQL injection, XSS, etc)
   - Payment tests (sandbox)

5. **Deployment**
   - Deploy to staging
   - Full testing in staging
   - Deploy to production
   - Monitor closely (first 24 hours)

---

## 📈 MONITORING & LOGGING

### What to Log
```
✅ All payment transactions
✅ Failed payment attempts
✅ Code generation
✅ Batch assignments
✅ Login attempts (successful + failed)
✅ Parent portal access
✅ Admin actions
✅ API errors with timestamp

❌ Never log:
❌ Full card numbers
❌ Passwords
❌ PINs
❌ Passwords in error messages
```

### Alerts to Set Up
```
Critical Alerts:
├─ Payment gateway down
├─ Database connection failed
├─ Duplicate payment detected
├─ Failed signature verification
├─ Brute force attempts (5+ failures)
├─ Unusually high payment amounts
└─ API response time > 5 seconds

Monthly Reports:
├─ Total payments processed
├─ Payment success rate
├─ Average transaction time
├─ Student registrations
├─ Churn rate
└─ System uptime
```

---

## 📞 SUPPORT & RECOVERY

### User Issues
```
Student Forgot PIN:
├─ Verify email
├─ Send reset link
├─ Generate new PIN
├─ Send via email + SMS
└─ User can copy from profile

Student Forgot Student Code:
├─ Verify email
├─ Show in profile
├─ Can't change (it's their identifier)
└─ If needed, can contact support

Parent Forgot Codes:
├─ Verify parent email
├─ Send reset link
├─ Generate new codes
├─ Send via email
└─ Set new PIN
```

### Technical Recovery
```
Payment Not Received:
├─ Check Razorpay dashboard
├─ Verify webhook processed
├─ Check student assignment
├─ If failed: show error, allow retry
└─ Manual processing available

Student Not Assigned:
├─ Check payment verified
├─ Check batches in DB
├─ Manually assign if failed
├─ Send notification
└─ Verify assignment completed

Codes Not Generated:
├─ Check in DB
├─ Generate if missing
├─ Send to user email
└─ Show in profile
```

---

## ✅ FINAL CHECKLIST

**Completion Requirements:**
- [x] Database schema finalized
- [x] API endpoints specified
- [x] Webhook security planned
- [x] Code generation algorithm defined
- [x] Welcome window designed
- [x] Parent portal planned
- [x] Error handling strategy defined
- [x] Security measures detailed
- [x] Deployment order documented
- [x] Monitoring setup planned
- [x] Recovery procedures documented

---

**Status: READY FOR IMPLEMENTATION** ✅

This plan covers:
✅ 100% security
✅ Zero duplicate charges
✅ Atomic operations
✅ Error handling
✅ Parent access
✅ Code generation
✅ Welcome window
✅ Monitoring

**Next: Implementation phase (one by one)**
