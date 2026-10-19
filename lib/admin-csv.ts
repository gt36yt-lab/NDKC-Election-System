export type ImportedStudent = { lrn: string; full_name: string; grade_level: number; section: string; email: string | null };

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
  const lrnColumn = headers.indexOf("lrn");
  const nameColumn = headers.indexOf("full_name");
  const gradeColumn = headers.indexOf("grade_level");
  const sectionColumn = headers.indexOf("section");
  const emailColumn = headers.indexOf("email");
  if ([lrnColumn, nameColumn, gradeColumn].some((column) => column === -1)) {
    throw new Error("CSV headers must include lrn, full_name, and grade_level.");
  }

  return rows.slice(1).map((cells, index) => {
    const lrn = (cells[lrnColumn] ?? "").trim();
    const full_name = (cells[nameColumn] ?? "").trim();
    const grade_level = Number((cells[gradeColumn] ?? "").trim());
    const section = sectionColumn < 0 ? "General" : (cells[sectionColumn] ?? "").trim() || "General";
    const email = emailColumn < 0 ? "" : (cells[emailColumn] ?? "").trim();
    if (!/^\d+$/.test(lrn)) throw new Error(`Row ${index + 2}: LRN must contain digits only.`);
    if (!full_name) throw new Error(`Row ${index + 2}: full_name is required.`);
    if (!Number.isInteger(grade_level) || grade_level < 7 || grade_level > 12) {
      throw new Error(`Row ${index + 2}: grade_level must be between 7 and 12.`);
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Row ${index + 2}: email address is invalid.`);
    return { lrn, full_name, grade_level, section, email: email || null };
  });
}