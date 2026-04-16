import mongoose, { Schema, Document } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../../utils/shared-lib-imports";

export interface IMessage extends IBaseDocument {
    conversationId: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId;
    content: string;
    type: "text" | "image" | "file";
    seenBy: mongoose.Types.ObjectId[];
    tenantId: mongoose.Types.ObjectId;
}

const MessageSchema: Schema = new Schema(
    {
        ...BaseDocumentSchema.obj,
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
        },
        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["text", "image", "file"],
            default: "text",
        },
        seenBy: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: "Tenant",
            required: true,
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

// Index for fast retrieval of message history in a conversation
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ tenantId: 1 });

export default mongoose.model<IMessage>("Message", MessageSchema);
