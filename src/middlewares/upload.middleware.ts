import multer from "multer";
import os from "os";
import { Request } from "express";

/**
 * Multer configuration for CSV file uploads
 * Stores files in OS temp directory for temporary processing
 */
export const csvUpload = multer({
  dest: os.tmpdir(), // OS temp directory
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Only allow CSV files
    const allowedMimeTypes = [
      "text/csv",
      "application/csv",
      "text/plain", // Some systems send CSV as text/plain
    ];

    const isCSV =
      allowedMimeTypes.includes(file.mimetype) ||
      file.originalname.toLowerCase().endsWith(".csv");

    if (isCSV) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

