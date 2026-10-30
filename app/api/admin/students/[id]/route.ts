import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

const STUDENT_EMAIL_DOMAIN = "students.ndkc.invalid";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StudentInput = {
  fullName?: unknown;
  studentId?: unknown;
  gradeLevel?: unknown;
  section?: unknown;
  email?: unknown;
};

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured() || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as StudentInput | null;
  if (!body) return NextResponse.json({ error: "Student details are required." }, { status: 400 });
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const gradeLevel = Number(body.gradeLevel);
  const section = typeof body.section === "string" ? body.section.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!fullName || fullName.length > 120) return NextResponse.json({ error: "Full name is required and must be 120 characters or fewer." }, { status: 400 });
  if (!/^\d{8}$/.test(studentId)) return NextResponse.json({ error: "Student ID must be exactly 8 digits." }, { status: 400 });
  if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) return NextResponse.json({ error: "Grade level must be from 7 to 12." }, { status: 400 });
  if (!section || section.length > 80) return NextResponse.json({ error: "Section is required and must be 80 characters or fewer." }, { status: 400 });
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin.from("students").select("id, lrn, full_name, email, grade_level, section, otp_code, has_voted").eq("id", id).maybeSingle();
  if (currentError) return NextResponse.json({ error: "Student record could not be loaded." }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const [{ data: duplicateStudentId, error: studentIdError }, { data: duplicateEmail, error: emailError }] = await Promise.all([
    admin.from("students").select("id").eq("lrn", studentId).neq("id", id).maybeSingle(),
    admin.from("students").select("id").ilike("email", email).neq("id", id).maybeSingle(),
  ]);
  if (studentIdError || emailError) return NextResponse.json({ error: "Student ID and email availability could not be checked." }, { status: 500 });
  if (duplicateStudentId || duplicateEmail) return NextResponse.json({ error: "That Student ID or email address is already in use." }, { status: 409 });
  const adminStudentIds = (process.env.ADMIN_LRNS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (studentId !== current.lrn && adminStudentIds.includes(current.lrn)) {
    return NextResponse.json({ error: "An Electoral Board Student ID cannot be changed from this screen." }, { status: 409 });
  }

  const { data: authResult, error: authLookupError } = await admin.auth.admin.getUserById(id);
  if (authLookupError || !authResult.user) return NextResponse.json({ error: "The student's authentication account could not be loaded." }, { status: 404 });

  const oldAuthEmail = authResult.user.email;
  const oldMetadata = authResult.user.user_metadata ?? {};
  const newAuthEmail = `${studentId}@${STUDENT_EMAIL_DOMAIN}`;
  const newMetadata = { ...oldMetadata, lrn: studentId, full_name: fullName, registered_email: email };
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, {
    email: newAuthEmail,
    email_confirm: true,
    user_metadata: newMetadata,
  });
  if (authUpdateError) return NextResponse.json({ error: "Authentication details could not be updated. The student profile was not changed." }, { status: 409 });

  if (studentId !== current.lrn) {
    const { error: voteUpdateError } = await admin.from("votes").update({ student_lrn: studentId }).eq("student_lrn", current.lrn);
    if (voteUpdateError) {
      const { error: authRollbackError } = oldAuthEmail
        ? await admin.auth.admin.updateUserById(id, { email: oldAuthEmail, email_confirm: true, user_metadata: oldMetadata })
        : { error: new Error("Previous auth email was unavailable.") };
      if (authRollbackError) {
        return NextResponse.json({ error: "Vote records could not be updated, and authentication rollback also failed. Contact the system administrator." }, { status: 500 });
      }
      return NextResponse.json({ error: "Vote records could not be updated. Authentication changes were rolled back." }, { status: 500 });
    }
  }

  const { data: updated, error: updateError } = await admin.from("students").update({
    lrn: studentId,
    full_name: fullName,
    email,
    grade_level: gradeLevel,
    section,
  }).eq("id", id).select("id, lrn, role, full_name, email, grade_level, section, otp_code, has_voted").maybeSingle();

  if (updateError || !updated) {
    const { error: voteRollbackError } = studentId !== current.lrn
      ? await admin.from("votes").update({ student_lrn: current.lrn }).eq("student_lrn", studentId)
      : { error: null };
    const { error: rollbackError } = oldAuthEmail
      ? await admin.auth.admin.updateUserById(id, { email: oldAuthEmail, email_confirm: true, user_metadata: oldMetadata })
      : { error: new Error("Previous auth email was unavailable.") };
    if (rollbackError || voteRollbackError) {
      return NextResponse.json({ error: "Student profile update failed, and one or more rollback steps also failed. Contact the system administrator." }, { status: 500 });
    }
    const status = updateError?.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: "Student profile could not be updated. Changes were rolled back." }, { status });
  }

  return NextResponse.json({ student: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured() || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: student, error: studentError } = await admin.from("students").select("id, lrn").eq("id", id).maybeSingle();
  if (studentError) return NextResponse.json({ error: "Student record could not be loaded." }, { status: 500 });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  if (id === access.userId || student.lrn === access.lrn) return NextResponse.json({ error: "You cannot delete your own Electoral Board account." }, { status: 409 });

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(id);
  if (authDeleteError) return NextResponse.json({ error: "The student's authentication account could not be deleted. No profile deletion was attempted." }, { status: 500 });

  const { error: profileDeleteError } = await admin.from("students").delete().eq("id", id);
  if (profileDeleteError) {
    return NextResponse.json({ error: "The authentication account was deleted, but the student profile could not be removed. Contact the system administrator." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
