// FILE: TeachingBoard-backend/src/models/ParentAccount.js (NEW FILE)

const { mongoose } = require('../config/db');

const parentAccountSchema = new mongoose.Schema(
  {
    // Parent information
    parent_email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    parent_name: String,

    parent_phone: {
      type: String,
      trim: true
    },

    // Parent credentials (for login)
    parent_code: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true
    },

    parent_pin: {
      type: String,
      required: true,
      select: false  // Don't return by default
    },

    // Linked student accounts
    linked_students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
      }
    ],

    // Permissions
    permissions: {
      view_progress: {
        type: Boolean,
        default: true
      },
      view_payments: {
        type: Boolean,
        default: false  // Don't show payment details by default
      },
      send_messages: {
        type: Boolean,
        default: true
      },
      contact_teacher: {
        type: Boolean,
        default: true
      },
      _id: false
    },

    // Session management
    last_login: Date,
    last_ip_address: String,
    failed_login_attempts: {
      type: Number,
      default: 0
    },
    locked_until: Date,

    // Email verification
    email_verified: {
      type: Boolean,
      default: false
    },
    email_verification_token: String,
    email_verification_sent_at: Date,

    // Notifications
    notification_email: {
      type: Boolean,
      default: true
    },
    notification_sms: {
      type: Boolean,
      default: false
    },

    // Timestamps
    created_at: {
      type: Date,
      default: Date.now
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

// Indices for performance
parentAccountSchema.index({ parent_email: 1 });
parentAccountSchema.index({ parent_code: 1 });
parentAccountSchema.index({ linked_students: 1 });

// Static method: Get parent by code
parentAccountSchema.statics.getByParentCode = async function(parentCode) {
  return this.findOne({ parent_code: parentCode })
    .populate('linked_students', 'name email student_code');
};

// Instance method: Is account locked?
parentAccountSchema.methods.isLocked = function() {
  return this.locked_until && this.locked_until > new Date();
};

// Instance method: Increment failed login
parentAccountSchema.methods.incrementFailedLogin = function() {
  this.failed_login_attempts += 1;

  // Lock account after 5 failed attempts
  if (this.failed_login_attempts >= 5) {
    this.locked_until = new Date(Date.now() + 30 * 60 * 1000);  // 30 minutes
  }

  return this.save();
};

// Instance method: Reset failed login
parentAccountSchema.methods.resetFailedLogin = function() {
  this.failed_login_attempts = 0;
  this.locked_until = null;
  this.last_login = new Date();
  return this.save();
};

module.exports = mongoose.models.ParentAccount ||
  mongoose.model('ParentAccount', parentAccountSchema);
