import mongoose, { Document, Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

export interface IAdmin extends IBaseDocument {
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    password?: string; // Optional because it's mainly stored in user-api
    phoneNumber?: string; // Optional phone number
    address?: string; // Optional address
    tenantId: string | mongoose.Types.ObjectId;
}

const AdminSchema: Schema = new Schema(
    {
        ...BaseDocumentSchema.obj,
        username: {
            type: String,
            required: [true, "Username is required"],
            trim: true,
            unique: true,
        },
        firstName: {
            type: String,
            required: [true, "First name is required"],
            trim: true,
        },
        lastName: {
            type: String,
            required: [true, "Last name is required"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            select: false, // For internal reference if needed
        },
        phoneNumber: {
            type: String,
            trim: true,
        },
        address: {
            type: String,
            trim: true,
        },
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: "Tenant",
            required: [true, "Tenant ID is required"],
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret) {
                const { _id, __v, password, ...rest } = ret;
                return {
                    id: _id.toString(),
                    ...rest,
                };
            },
        },
        toObject: {
            transform: function (doc, ret) {
                const { _id, __v, password, ...rest } = ret;
                return {
                    id: _id.toString(),
                    ...rest,
                };
            },
        },
    }
);

// Indexes
AdminSchema.index({ username: 1 });
AdminSchema.index({ email: 1 });
AdminSchema.index({ tenantId: 1 });

export default mongoose.model<IAdmin>("Admin", AdminSchema);
