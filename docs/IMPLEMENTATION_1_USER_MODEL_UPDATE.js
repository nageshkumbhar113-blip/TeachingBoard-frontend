// FILE: TeachingBoard-backend/src/models/User.js
// UPDATE: Add payment + parent fields

const { mongoose } = require('../config/db');

const userSchema = new mongoose.Schema(
  {
    // Existing fields
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, select: false },  // select: false = not returned by default
    role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
    assigned_batches: [
      {
        batch_id: mongoose.Schema.Types.ObjectId,
        assigned_date: { type: Date, default: Date.now },
        expiry_date: Date
      }
    ],

    // NEW: Student Payment & Subscription Fields
    student_code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    student_pin: {
      type: String,
      select: false  // Don't return by default
    },

    payment_status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },

    subscription_status: {
      type: String,
      enum: ['inactive', 'active', 'expired', 'paused', 'cancelled'],
      default: 'inactive'
    },

    // NEW: Parent Fields
    parent_code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },

    // NEW: Welcome Window
    welcome_seen: { type: Boolean, default: false },
    welcome_shown_date: Date,
    first_login_date: Date,

    // NEW: Payment History
    last_payment_date: Date,
    last_payment_amount: Number,
    next_renewal_date: Date,

    // Timestamps
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

// Indices for performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ student_code: 1 });
userSchema.index({ parent_code: 1 });
userSchema.index({ subscription_status: 1 });
userSchema.index({ payment_status: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
