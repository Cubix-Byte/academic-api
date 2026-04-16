import mongoose, { Document, Schema } from "mongoose";

export interface IAutoIdCounter extends Document {
  _id: string; // prefix e.g. 'STD', 'THR', 'PRT'
  seq: number;
}

const AutoIdCounterSchema = new Schema<IAutoIdCounter>(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    collection: "auto_id_counters",
    versionKey: false,
    timestamps: false,
  }
);

export const AutoIdCounter =
  mongoose.models.AutoIdCounter ||
  mongoose.model<IAutoIdCounter>("AutoIdCounter", AutoIdCounterSchema, "auto_id_counters");

export default AutoIdCounter;


