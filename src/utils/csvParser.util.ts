import fs from "fs/promises";

/**
 * CSV Parser Utility
 * Parses CSV files as plain text (simple format only)
 * 
 * Limitations:
 * - Does not handle quoted fields with commas
 * - Does not handle multiline fields
 * - Does not handle escaped quotes
 * 
 * For complex CSV files, consider using csv-parser package
 */

export interface ParsedCSVRow {
  [key: string]: string;
}

export interface ParseCSVResult {
  headers: string[];
  rows: ParsedCSVRow[];
  totalRows: number;
}

/**
 * Parse CSV file from file path
 * @param filePath - Path to CSV file
 * @returns Parsed CSV data with headers and rows
 */
export async function parseCSV(filePath: string): Promise<ParseCSVResult> {
  try {
    const fileContent = await fs.readFile(filePath, "utf-8");

    if (!fileContent || fileContent.trim().length === 0) {
      throw new Error("CSV file is empty");
    }

    // Split by newlines and filter out empty lines
    const lines = fileContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      throw new Error("CSV file contains no data");
    }

    // Parse headers (first line)
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().toLowerCase().replace(/\s+/g, ""))
      .filter((h) => h.length > 0);

    if (headers.length === 0) {
      throw new Error("CSV file has no valid headers");
    }

    // Parse rows
    const rows: ParsedCSVRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        // Basic CSV parsing - handle quoted fields and extra columns
        const line = lines[i];
        const values: string[] = [];
        let currentValue = "";
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          const nextChar = line[j + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              // Escaped quote inside quoted field
              currentValue += '"';
              j++; // Skip next quote
            } else {
              // Toggle quote state
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            // End of field
            values.push(currentValue.trim());
            currentValue = "";
          } else {
            currentValue += char;
          }
        }
        // Add the last field
        values.push(currentValue.trim());

        // Handle case where we have more values than headers (e.g., children column with comma-separated IDs)
        // If the last header is "children" or "studentids", combine extra values into that field
        const lastHeader = headers[headers.length - 1];
        const isChildrenColumn =
          lastHeader === "children" ||
          lastHeader === "studentids" ||
          lastHeader === "childrenids";

        if (values.length > headers.length && isChildrenColumn) {
          // Combine extra values into the children field
          const childrenValues = values.slice(headers.length - 1);
          values[headers.length - 1] = childrenValues.join(",");
          // Truncate to match header count
          values.splice(headers.length);
        } else if (values.length > headers.length) {
          // For other cases, truncate to header count
          values.splice(headers.length);
        } else if (values.length < headers.length) {
          // Pad with empty strings if we have fewer values
          while (values.length < headers.length) {
            values.push("");
          }
        }

        const row: ParsedCSVRow = {};
        headers.forEach((header, index) => {
          // Remove surrounding quotes if present
          let value = values[index] || "";
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          row[header] = value;
        });

        rows.push(row);
      } catch (error: any) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    if (rows.length === 0 && errors.length > 0) {
      throw new Error(
        `No valid rows found. Errors: ${errors.slice(0, 5).join("; ")}`
      );
    }

    return {
      headers,
      rows,
      totalRows: rows.length,
    };
  } catch (error: any) {
    throw new Error(`Failed to parse CSV file: ${error.message}`);
  }
}

