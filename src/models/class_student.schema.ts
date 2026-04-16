import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

export interface IClassStudent extends IBaseDocument {
	classId: mongoose.Types.ObjectId;
	studentId: mongoose.Types.ObjectId;
	stdId: string;
	rollNumber: string;
	subjectIds?: mongoose.Types.ObjectId[]; // Subjects assigned to this student in this class
	enrollmentStatus: "active" | "promoted" | "graduated" | "withdrawn";
	academicYear?: string;
}

const ClassStudentSchema = new Schema<IClassStudent>(
	{
		...BaseDocumentSchema.obj,
		classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
		studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
		stdId: { type: String, required: true, trim: true, uppercase: true, maxlength: 50, index: true },
		rollNumber: { type: String, required: true, trim: true, maxlength: 50 },
		subjectIds: [{
			type: Schema.Types.ObjectId,
			ref: "Subject",
		}],
		enrollmentStatus: {
			type: String,
			enum: ["active", "promoted", "graduated", "withdrawn"],
			default: "active",
			index: true
		},
		academicYear: { type: String, trim: true },
	},
	{
		timestamps: true,
		collection: "class_students",
	}
);

// Uniqueness constraints (ignore soft-deleted links)
ClassStudentSchema.index(
	{ tenantId: 1, classId: 1, rollNumber: 1 },
	{ unique: true, partialFilterExpression: { isDeleted: false } }
);
ClassStudentSchema.index(
	{ tenantId: 1, classId: 1, studentId: 1 },
	{ unique: true, partialFilterExpression: { isDeleted: false } }
);

export default mongoose.models.ClassStudent ||
	mongoose.model<IClassStudent>("ClassStudent", ClassStudentSchema);