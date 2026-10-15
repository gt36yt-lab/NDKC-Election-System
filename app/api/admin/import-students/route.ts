import { randomBytes, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { parseStudentCsv } from "@/lib/admin-csv";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_DOMAIN = "students.ndkc.invalid";
const MAX_CSV_BYTES = 1_000_000;
const MAX_STUDENTS = 500;

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { csv?: unknown } | null;
  if (typeof body?.csv !== "string") return NextResponse.json({ error: "Provide CSV text in the csv field." }, { status: 400 });
  if (Buffer.byteLength(body.csv, "utf8") > MAX_CSV_BYTES) return NextResponse.json({ error: "CSV must be smaller than 1 MB." }, { status: 413 });

  let students;
  try {
    students = parseStudentCsv(body.csv);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "CSV could not be parsed." }, { status: 400 });
  }
  if (students.length > MAX_STUDENTS) return NextResponse.json({ error: `Import is limited to ${MAX_STUDENTS} students per file.` }, { status: 400 });

  const lrnSet = new Set<string>();
  for (const student of students) {
    if (lrnSet.has(student.lrn)) return NextResponse.json({ error: `LRN ${student.lrn} appears more than once in the CSV.` }, { status: 400 });
    lrnSet.add(student.lrn);
  }

  const admin = createAdminClient();
  const { data: existingStudents, error: existingError } = await admin
    .from("students")
    .select("lrn")
    .in("lrn", students.map((student) => student.lrn));
  if (existingError) return NextResponse.json({ error: "Existing student records could not be checked." }, { status: 500 });

  const existingLrns = new Set((existingStudents ?? []).map((student) => String(student.lrn)));
  const credentials: { id: string; lrn: string; full_name: string; grade_level: number; section: string; assigned_password: string; otp: string }[] = [];
  const errors: { lrn: string; error: string }[] = [];

  for (const student of students) {
    if (existingLrns.has(student.lrn)) {
      errors.push({ lrn: student.lrn, error: "A student record with this LRN already exists." });
      continue;
    }

    const assignedPassword = `${randomBytes(18).toString("base64url")}aA1!`;
    const otp = String(randomInt(100000, 1000000));
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `${student.lrn}@${EMAIL_DOMAIN}`,
      password: assignedPassword,
      email_confirm: true,
      user_metadata: { lrn: student.lrn, full_name: student.full_name },
    });

    if (createError || !created.user) {
      errors.push({ lrn: student.lrn, error: createError?.message ?? "Auth account could not be created." });
      continue;
    }

    const { error: insertError } = await admin.from("students").insert({
      id: created.user.id,
      lrn: student.lrn,
      full_name: student.full_name,
      grade_level: student.grade_level,
      section: student.section,
      otp_code: otp,
      has_agreed_terms: false,
      has_voted: false,
    });

    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      errors.push({ lrn: student.lrn, error: "Student record could not be created; the Auth account was rolled back." });
      continue;
    }

    credentials.push({ id: created.user.id, lrn: student.lrn, full_name: student.full_name, grade_level: student.grade_level, section: student.section, assigned_password: assignedPassword, otp });
    existingLrns.add(student.lrn);
  }

  return NextResponse.json({ imported: credentials.length, credentials, errors });
}