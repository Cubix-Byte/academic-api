import mongoose, { Schema, Document } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../../utils/shared-lib-imports";

export interface IConversation extends IBaseDocument {
    participants: {
        teacherId: mongoose.Types.ObjectId;
        studentId?: mongoose.Types.ObjectId;
        parentId?: mongoose.Types.ObjectId;
    };
    type: "teacher-student" | "teacher-parent";
    lastMessage?: mongoose.Types.ObjectId;
    unreadCount: Map<string, number>;
    tenantId: mongoose.Types.ObjectId;
    isActive: boolean;
}

const ConversationSchema: Schema = new Schema(
    {
        ...BaseDocumentSchema.obj,
        participants: {
            teacherId: {
                type: Schema.Types.ObjectId,
                ref: "Teacher",
                required: true,
            },
            studentId: {
                type: Schema.Types.ObjectId,
                ref: "Student",
            },
            parentId: {
                type: Schema.Types.ObjectId,
                ref: "Parent",
            },
        },
        type: {
            type: String,
            enum: ["teacher-student", "teacher-parent"],
            required: true,
        },
        lastMessage: {
            type: Schema.Types.ObjectId,
            ref: "Message",
        },
        unreadCount: {
            type: Map,
            of: Number,
            default: new Map(),
        },
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: "Tenant",
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

// Index for fast lookup of conversations by user and tenant
ConversationSchema.index({ "participants.teacherId": 1, tenantId: 1 });
ConversationSchema.index({ "participants.studentId": 1, tenantId: 1 });
ConversationSchema.index({ "participants.parentId": 1, tenantId: 1 });

// Ensure only one 1-to-1 conversation exists between same participants
ConversationSchema.index({ "participants.teacherId": 1, "participants.studentId": 1, type: 1, tenantId: 1 }, { unique: true, partialFilterExpression: { "participants.studentId": { $exists: true } } });
ConversationSchema.index({ "participants.teacherId": 1, "participants.parentId": 1, type: 1, tenantId: 1 }, { unique: true, partialFilterExpression: { "participants.parentId": { $exists: true } } });

export default mongoose.model<IConversation>("Conversation", ConversationSchema);
