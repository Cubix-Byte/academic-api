import mongoose, { Schema, Document } from 'mongoose';

/**
 * TeacherInbox Interface - Teacher messages and notifications
 */
export interface ITeacherInbox extends Document {
  teacherId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderType: 'Admin' | 'Parent' | 'Student' | 'System';
  subject: string;
  message: string;
  isRead: boolean;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TeacherInbox Schema - Manages teacher communications
 */
const TeacherInboxSchema = new Schema({
  teacherId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  senderType: {
    type: String,
    enum: ['Admin', 'Parent', 'Student', 'System'],
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium',
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'teacher_inbox'
});

// Indexes for high performance
TeacherInboxSchema.index({ teacherId: 1, isRead: 1, createdAt: -1 });
TeacherInboxSchema.index({ tenantId: 1, teacherId: 1, priority: 1 });
TeacherInboxSchema.index({ senderType: 1, senderId: 1 });

// Ensure virtual fields are serialized
TeacherInboxSchema.set('toJSON', { virtuals: true });
TeacherInboxSchema.set('toObject', { virtuals: true });

export const TeacherInbox = mongoose.model<ITeacherInbox>('TeacherInbox', TeacherInboxSchema);
export default TeacherInbox;

