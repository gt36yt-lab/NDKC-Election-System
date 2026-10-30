import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type Role = "admin" | "student";

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as { studentId?: unknown; role?: unknown } | null;
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const role = body?.role;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) {
    return NextResponse.json({ error: "A valid student account is required." }, { status: 400 });
  }
  if (role !== "admin" && role !== "student") {
    return NextResponse.json({ error: "Role must be admin or student." }, { status: 400 });
  }
  if (studentId === access.userId && role === "student") {
    return NextResponse.json({ error: "You cannot demote your own admin account." }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("students")
    .select("id, role")
    .eq("id", studentId)
    .maybeSingle();
  if (targetError) return NextResponse.json({ error: "Student role could not be loaded." }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const { data: authResult, error: authLookupError } = await admin.auth.admin.getUserById(studentId);
  if (authLookupError || !authResult.user) return NextResponse.json({ error: "Student authentication account could not be loaded." }, { status: 404 });

  const { error: roleUpdateError } = await admin
    .from("students")
    .update({ role })
    .eq("id", studentId);
  if (roleUpdateError) return NextResponse.json({ error: "Student role could not be updated." }, { status: 500 });

  const oldMetadata = authResult.user.user_metadata ?? {};
  const { error: metadataUpdateError } = await admin.auth.admin.updateUserById(studentId, {
    user_metadata: { ...oldMetadata, role },
  });

  if (metadataUpdateError) {
    const { error: rollbackError } = await admin
      .from("students")
      .update({ role: target.role })
      .eq("id", studentId);
    if (rollbackError) {
      console.error("[ToggleAdminRole] Role metadata update and database rollback failed:", { metadataUpdateError, rollbackError });
      return NextResponse.json({ error: "Role synchronization failed. Contact the system administrator." }, { status: 500 });
    }
    return NextResponse.json({ error: "Auth metadata could not be updated. The database role change was rolled back." }, { status: 500 });
  }

  return NextResponse.json({ role });
}