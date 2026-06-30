// FILE: TeachingBoard-backend/src/models/StudentProgress.js (NEW FILE)

const { mongoose } = require('../config/db');

const studentProgressSchema = new mongoose.Schema(
  {
    // References
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    batch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true
    },

    course_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },

    // Progress tracking
    progress_percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    topics_completed: {
      type: Number,
      default: 0
    },

    total_topics: {
      type: Number,
      required: true
    },

    // Activity tracking
    time_spent_minutes: {
      type: Number,
      default: 0,
      min: 0
    },

    last_accessed: Date,

    completed_topics: [
      {
        topic_id: mongoose.Schema.Types.ObjectId,
        completed_date: Date,
        time_spent: Number  // in minutes
      }
    ],

    // Weak areas (for parent view)
    weak_topics: [
      {
        topic_id: mongoose.Schema.Types.ObjectId,
        topic_name: String,
        accuracy_percentage: Number,
        attempts: Number,
        correct_answers: Number
      }
    ],

    // Strong areas
    strong_topics: [
      {
        topic_id: mongoose.Schema.Types.ObjectId,
        topic_name: String,
        accuracy_percentage: Number,
        attempts: Number
      }
    ],

    // Quiz/Test performance
    quiz_attempts: {
      type: Number,
      default: 0
    },

    quiz_passed: {
      type: Number,
      default: 0
    },

    average_quiz_score: Number,

    // Practice paper performance
    practice_papers_taken: {
      type: Number,
      default: 0
    },

    practice_papers_average_score: Number,

    // Assignments
    assignments_submitted: {
      type: Number,
      default: 0
    },

    assignments_score: Number,

    // Status
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'failed'],
      default: 'not_started'
    },

    // Timestamps
    started_date: Date,
    completed_date: Date,
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

// Indices for queries
studentProgressSchema.index({ student_id: 1, batch_id: 1 });
studentProgressSchema.index({ student_id: 1, course_id: 1 });
studentProgressSchema.index({ last_accessed: 1 });

// Static method: Get all progress for student
studentProgressSchema.statics.getStudentProgress = async function(studentId) {
  return this.find({ student_id: studentId })
    .populate('batch_id', 'name icon')
    .populate('course_id', 'name');
};

// Static method: Get batch progress for student
studentProgressSchema.statics.getBatchProgress = async function(studentId, batchId) {
  return this.find({
    student_id: studentId,
    batch_id: batchId
  });
};

// Instance method: Calculate overall progress
studentProgressSchema.methods.calculateProgress = function() {
  if (this.total_topics === 0) return 0;
  this.progress_percentage = Math.round((this.topics_completed / this.total_topics) * 100);
  return this.progress_percentage;
};

// Instance method: Update weak areas
studentProgressSchema.methods.updateWeakAreas = async function(topicId, accuracy, attempts) {
  const topic = this.weak_topics.find(t => t.topic_id.equals(topicId));

  if (topic) {
    topic.accuracy_percentage = accuracy;
    topic.attempts = attempts;
    topic.correct_answers = Math.round((accuracy / 100) * attempts);
  } else if (accuracy < 70) {  // Add to weak areas if < 70% accuracy
    this.weak_topics.push({
      topic_id: topicId,
      accuracy_percentage: accuracy,
      attempts: attempts,
      correct_answers: Math.round((accuracy / 100) * attempts)
    });
  }

  return this.save();
};

module.exports = mongoose.models.StudentProgress ||
  mongoose.model('StudentProgress', studentProgressSchema);
