import { ObjectId } from "mongodb";
import { StudentContentRead, IStudentContentRead } from "../models";

/**
 * Student Content Read Repository
 * Tracks when a student has opened assigned content (for unread counts).
 */
export class StudentContentReadRepository {
  /**
   * Upsert a read record for student + content. Idempotent; updates readAt if already exists.
   */
  async upsertRead(
    studentId: string,
    contentId: string,
    tenantId: string
  ): Promise<IStudentContentRead> {
    const now = new Date();
    const doc = await StudentContentRead.findOneAndUpdate(
      {
        studentId: new ObjectId(studentId),
        contentId: new ObjectId(contentId),
        tenantId: new ObjectId(tenantId),
      },
      { $set: { readAt: now, updatedAt: now } },
      { new: true, upsert: true }
    );
    return doc;
  }

  /**
   * Check if a read record exists for student + content (optional helper).
   */
  async hasRead(studentId: string, contentId: string): Promise<boolean> {
    const doc = await StudentContentRead.findOne(
      {
        studentId: new ObjectId(studentId),
        contentId: new ObjectId(contentId),
      },
      { _id: 1 }
    ).lean();
    return !!doc;
  }

  /**
   * Return the set of content IDs that the student has read (have a record in student_content_reads).
   * Used to enrich assigned-content list with isRead per item.
   */
  async getReadContentIds(studentId: string, contentIds: string[]): Promise<Set<string>> {
    if (!contentIds.length) return new Set();
    const validIds = contentIds.filter((id) => id && ObjectId.isValid(id));
    if (!validIds.length) return new Set();
    const docs = await StudentContentRead.find(
      {
        studentId: new ObjectId(studentId),
        contentId: { $in: validIds.map((id) => new ObjectId(id)) },
      },
      { contentId: 1 }
    )
      .lean();
    const readIds = new Set<string>();
    for (const d of docs) {
      const cid = (d as any).contentId;
      if (cid) readIds.add(cid.toString());
    }
    return readIds;
  }
}
