// FILE: TeachingBoard-backend/src/models/StudentSubscription.js (NEW FILE)

const { mongoose } = require('../config/db');

const studentSubscriptionSchema = new mongoose.Schema(
  {
    // Student reference
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Batches purchased
    batches: [
      {
        batch_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Batch',
          required: true
        },
        batch_name: String,
        price: Number,
        period: {
          type: String,
          enum: ['monthly', 'yearly'],
          required: true
        },
        _id: false
      }
    ],

    // Payment amount
    total_amount: {
      type: Number,
      required: true,
      min: 0
    },

    subscription_period: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true
    },

    // Razorpay payment information
    razorpay_order_id: {
      type: String,
      index: true
    },

    razorpay_payment_id: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },

    razorpay_signature: String,

    payment_verified: {
      type: Boolean,
      default: false,
      index: true
    },

    // Subscription dates
    start_date: {
      type: Date,
      default: Date.now,
      index: true
    },

    expiry_date: {
      type: Date,
      required: true,
      index: true
    },

    // Auto-renewal
    auto_renewal: {
      type: Boolean,
      default: true
    },

    next_renewal_date: Date,

    // Subscription status
    status: {
      type: String,
      enum: ['active', 'expired', 'paused', 'cancelled'],
      default: 'active',
      index: true
    },

    // Cancellation info (if applicable)
    cancelled_date: Date,
    cancellation_reason: String,

    // Refund info (if applicable)
    refund_id: String,
    refund_amount: Number,
    refund_date: Date,

    // Timestamps
    created_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    updated_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

// Indices for queries
studentSubscriptionSchema.index({ student_id: 1, status: 1 });
studentSubscriptionSchema.index({ expiry_date: 1 });
studentSubscriptionSchema.index({ payment_verified: 1 });

// Static method: Get active subscription for student
studentSubscriptionSchema.statics.getActiveSubscription = async function(studentId) {
  return this.findOne({
    student_id: studentId,
    status: 'active',
    expiry_date: { $gt: new Date() }
  });
};

// Instance method: Check if subscription is expired
studentSubscriptionSchema.methods.isExpired = function() {
  return this.expiry_date < new Date();
};

module.exports = mongoose.models.StudentSubscription ||
  mongoose.model('StudentSubscription', studentSubscriptionSchema);
