export type ImportedStudent = { lrn: string; full_name: string; email: string; grade_level: number; section: string };

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function parseStudentCsv(text: string): ImportedStudent[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV must contain a header row and at least one student.");

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const lrnColumn = headers.indexOf("student_id");
  const nameColumn = headers.indexOf("full_name");
  const emailColumn = headers.indexOf("email");
  const gradeColumn = headers.indexOf("grade_level");
  const sectionColumn = headers.indexOf("section");
  if ([lrnColumn, nameColumn, emailColumn, gradeColumn, sectionColumn].some((column) => column === -1)) {
    throw new Error("CSV headers must include student_id, full_name, email, grade_level, and section.");
  }

  return rows.slice(1).map((cells, index) => {
    const lrn = (cells[lrnColumn] ?? "").trim();
    const full_name = (cells[nameColumn] ?? "").trim();
    const email = (cells[emailColumn] ?? "").trim().toLowerCase();
    const grade_level = Number((cells[gradeColumn] ?? "").trim());
    const section = (cells[sectionColumn] ?? "").trim();
    if (!/^\d{8}$/.test(lrn)) throw new Error(`Row ${index + 2}: Student ID must contain exactly 8 digits.`);
    if (!full_name) throw new Error(`Row ${index + 2}: full_name is required.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error(`Row ${index + 2}: a valid email is required.`);
    if (!Number.isInteger(grade_level) || grade_level < 7 || grade_level > 12) {
      throw new Error(`Row ${index + 2}: grade_level must be between 7 and 12.`);
    }
    if (!section || section.length > 80) throw new Error(`Row ${index + 2}: section is required and must be 80 characters or fewer.`);
    return { lrn, full_name, email, grade_level, section };
  });
}