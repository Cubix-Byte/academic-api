import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

/**
 * Minimal User Interface for population purposes
 */
export interface IUser extends IBaseDocument {
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
    userType: string;
    tenantId?: mongoose.Types.ObjectId;
}

const UserSchema: Schema = new Schema(
    {
        ...BaseDocumentSchema.obj,
        username: {
            type: String,
            required: true,
            trim: true,
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        profilePicture: {
            type: String,
            trim: true,
        },
        userType: {
            type: String,
            required: true,
        },
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: "Tenant",
        },
    },
    {
        timestamps: true,
        collection: "users", // Explicitly map to the users collection in user-api database (shared cluster/DB)
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

export default mongoose.model<IUser>("User", UserSchema);
