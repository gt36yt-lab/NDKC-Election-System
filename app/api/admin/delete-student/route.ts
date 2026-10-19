import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as { student_id?: unknown } | null;
  const studentId = typeof body?.student_id === "string" ? body.student_id : "";
  if (!studentId) return NextResponse.json({ error: "Student ID is required." }, { status: 400 });

  const admin = createAdminClient();
  const { data: student, error: lookupError } = await admin.from("students").select("id").eq("id", studentId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Student record could not be loaded." }, { status: 500 });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const { error: authError } = await admin.auth.admin.deleteUser(studentId);
  if (authError) return NextResponse.json({ error: "Student Auth account could not be deleted; the student record was left unchanged." }, { status: 409 });
  const { error: studentError } = await admin.from("students").delete().eq("id", studentId);
  if (studentError) return NextResponse.json({ error: "The Auth account was deleted, but the student record could not be removed. Contact the administrator." }, { status: 500 });
  return NextResponse.json({ success: true });
}