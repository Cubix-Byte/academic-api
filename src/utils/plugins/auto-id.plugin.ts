import { Schema } from "mongoose";
import { AutoIdCounter, IAutoIdCounter } from "../../models/auto_id_counter.schema";

type AutoIdPluginOptions = {
  fieldName: string; // e.g., 'stdId', 'thrId', 'prtId'
  prefix: string;    // e.g., 'STD', 'THR', 'PRT'
  pad?: number;      // e.g., 3 -> 001
};

/**
 * Mongoose plugin to auto-generate incrementing IDs with a prefix.
 * Uses an atomic counter collection to avoid race conditions.
 */
export default function autoIdPlugin(schema: Schema, options: AutoIdPluginOptions): void {
  const { fieldName, prefix, pad = 3 } = options;

  if (!fieldName || !prefix) {
    throw new Error("autoIdPlugin requires 'fieldName' and 'prefix' options.");
  }

  // Ensure the field is included in JSON outputs by default (no special transform needed)

  schema.pre("save", async function (next) {
    try {
      // Only generate on new documents and when field is not already set
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc: any = this;
      if (!doc.isNew) return next();
      if (doc.get(fieldName)) return next();

      // Use the same MongoDB session as the document (if any), so the counter
      // increment is part of the same transaction and rolls back on failure.
      const session = typeof doc.$session === "function" ? doc.$session() : undefined;

      const query = AutoIdCounter.findOneAndUpdate(
        { _id: prefix },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (session) {
        query.session(session);
      }

      const counter = await query.lean<IAutoIdCounter>();

      const seq = counter?.seq ?? 1;
      const generated = `${prefix}-${String(seq).padStart(pad, "0")}`;
      doc.set(fieldName, generated);

      return next();
    } catch (err) {
      return next(err as Error);
    }
  });
}


