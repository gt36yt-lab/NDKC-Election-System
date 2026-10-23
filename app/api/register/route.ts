import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const STUDENT_EMAIL_DOMAIN = "students.ndkc.invalid";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RegistrationInput = {
  studentId?: unknown;
  fullName?: unknown;
  email?: unknown;
  password?: unknown;
  gradeLevel?: unknown;
  section?: unknown;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as RegistrationInput | null;
  if (!body) return NextResponse.json({ error: "Registration details are required." }, { status: 400 });

  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const section = typeof body.section === "string" ? body.section.trim() : "";
  const gradeLevel = Number(body.gradeLevel);

  if (!/^\d{8}$/.test(studentId)) {
    return NextResponse.json({ error: "Student ID must be exactly 8 digits." }, { status: 400 });
  }
  if (!/^[^,]+,\s*[^,]+$/.test(fullName) || fullName.length > 120) {
    return NextResponse.json({ error: "Enter your full name as Last Name, First Name." }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Password must be between 8 and 128 characters." }, { status: 400 });
  }
  if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
    return NextResponse.json({ error: "Select a grade level from 7 to 12." }, { status: 400 });
  }
  if (!section || section.length > 80) {
    return NextResponse.json({ error: "Section is required and must be 80 characters or fewer." }, { status: 400 });
  }
  if (!isAdminServiceConfigured() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Registration is not configured. Please contact the election board." }, { status: 503 });
  }

  const admin = createAdminClient();
  const [{ data: existingStudentId, error: studentIdError }, { data: existingEmail, error: emailError }] = await Promise.all([
    admin.from("students").select("id").eq("lrn", studentId).maybeSingle(),
    admin.from("students").select("id").eq("email", email).maybeSingle(),
  ]);
  if (studentIdError || emailError) return NextResponse.json({ error: "Student records could not be checked. Please try again." }, { status: 500 });
  if (existingStudentId || existingEmail) return NextResponse.json({ error: "That Student ID or email address is already registered." }, { status: 409 });

  const otp = String(randomInt(100000, 1000000));
  const authEmail = `${studentId}@${STUDENT_EMAIL_DOMAIN}`;
  const { data: authResult, error: authError } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: { lrn: studentId, full_name: fullName, registered_email: email },
  });
  if (authError || !authResult.user) {
    return NextResponse.json({ error: "An account could not be created for this Student ID. It may already be registered." }, { status: 409 });
  }

  const { error: studentError } = await admin.from("students").insert({
    id: authResult.user.id,
    lrn: studentId,
    full_name: fullName,
    email,
    grade_level: gradeLevel,
    section,
    otp_code: otp,
    has_voted: false,
    has_agreed_terms: false,
  });

  if (studentError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(authResult.user.id);
    if (cleanupError) {
      return NextResponse.json({ error: "Student profile creation failed and account cleanup also failed. Contact the election board before retrying." }, { status: 500 });
    }
    return NextResponse.json({ error: "Student profile could not be created. Check that this Student ID is not already registered." }, { status: 409 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
