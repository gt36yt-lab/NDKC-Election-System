import { randomBytes, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { parseStudentCsv } from "@/lib/admin-csv";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_DOMAIN = "students.ndkc.invalid";
const MAX_CSV_BYTES = 1_000_000;
const MAX_STUDENTS = 500;

async function findAuthUserIdByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return { id: null, error };
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return { id: user.id, error: null };
    if (data.users.length < 1000) return { id: null, error: null };
  }
}

function isDuplicateAuthUser(error: { code?: string; message: string }) {
  return error.code === "email_exists" || /already (?:been )?registered|already exists/i.test(error.message);
}

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
  const emailSet = new Set<string>();
  for (const student of students) {
    if (lrnSet.has(student.lrn)) return NextResponse.json({ error: `Student ID ${student.lrn} appears more than once in the CSV.` }, { status: 400 });
    lrnSet.add(student.lrn);
    const normalizedEmail = student.email.toLowerCase();
    if (emailSet.has(normalizedEmail)) return NextResponse.json({ error: `Email ${student.email} appears more than once in the CSV.` }, { status: 400 });
    emailSet.add(normalizedEmail);
  }

  const admin = createAdminClient();
  const { data: existingStudents, error: existingError } = await admin
    .from("students")
    .select("id, lrn, email, has_voted, has_agreed_terms, status")
    .in("lrn", students.map((student) => student.lrn));
  if (existingError) return NextResponse.json({ error: "Existing student records could not be checked." }, { status: 500 });

  const existingByLrn = new Map((existingStudents ?? []).map((student) => [String(student.lrn), student]));
  const { data: emailMatches, error: emailLookupError } = await admin.from("students").select("lrn, email").in("email", students.map((student) => student.email));
  if (emailLookupError) return NextResponse.json({ error: "Existing student email addresses could not be checked." }, { status: 500 });
  const existingEmailToStudentId = new Map((emailMatches ?? []).map((student) => [String(student.email).toLowerCase(), String(student.lrn)]));
  for (const student of students) {
    const existingId = existingEmailToStudentId.get(student.email.toLowerCase());
    if (existingId && existingId !== student.lrn) {
      return NextResponse.json({ error: `Email ${student.email} is already assigned to another student.` }, { status: 409 });
    }
  }

  const credentials: { id: string; lrn: string; full_name: string; email: string; grade_level: number; section: string; assigned_password: string; otp: string }[] = [];
  const errors: { lrn: string; error: string }[] = [];

  for (const student of students) {
    const email = `${student.lrn}@${EMAIL_DOMAIN}`;
    const assignedPassword = `${randomBytes(18).toString("base64url")}aA1!`;
    const otp = String(randomInt(100000, 1000000));
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: assignedPassword,
      email_confirm: true,
      user_metadata: { lrn: student.lrn, full_name: student.full_name, registered_email: student.email },
    });

    let userId = created.user?.id;
    const isNewAuthUser = Boolean(userId);
    if (createError) {
      if (!isDuplicateAuthUser(createError)) {
        errors.push({ lrn: student.lrn, error: createError.message });
        continue;
      }

      const existingStudent = existingByLrn.get(student.lrn);
      let existingUserId = existingStudent?.id ?? null;
      if (!existingUserId) {
        const lookup = await findAuthUserIdByEmail(admin, email);
        if (lookup.error) {
          errors.push({ lrn: student.lrn, error: "Existing Auth account could not be loaded." });
          continue;
        }
        existingUserId = lookup.id;
      }
      if (!existingUserId) {
        errors.push({ lrn: student.lrn, error: "Auth reported a duplicate account, but the existing user could not be found." });
        continue;
      }

      const { error: updateAuthError } = await admin.auth.admin.updateUserById(existingUserId, {
        password: assignedPassword,
        email_confirm: true,
        user_metadata: { lrn: student.lrn, full_name: student.full_name, registered_email: student.email },
      });
      if (updateAuthError) {
        errors.push({ lrn: student.lrn, error: "Existing Auth account could not be updated with the generated password." });
        continue;
      }
      userId = existingUserId;
    }

    if (!userId) {
      errors.push({ lrn: student.lrn, error: "Auth account could not be created." });
      continue;
    }

    const existingStudent = existingByLrn.get(student.lrn);
    const { error: upsertError } = await admin.from("students").upsert({
      id: userId,
      lrn: student.lrn,
      full_name: student.full_name,
      email: student.email,
      grade_level: student.grade_level,
      section: student.section,
      otp_code: otp,
      has_agreed_terms: existingStudent?.has_agreed_terms ?? false,
      has_voted: existingStudent?.has_voted ?? false,
      status: existingStudent?.status ?? "approved",
    }, { onConflict: "lrn" });

    if (upsertError) {
      if (isNewAuthUser) await admin.auth.admin.deleteUser(userId);
      errors.push({ lrn: student.lrn, error: "Student record could not be synchronized." });
      continue;
    }

    credentials.push({ id: userId, lrn: student.lrn, full_name: student.full_name, email: student.email, grade_level: student.grade_level, section: student.section, assigned_password: assignedPassword, otp });
  }

  return NextResponse.json({ imported: credentials.length, credentials, errors });
}