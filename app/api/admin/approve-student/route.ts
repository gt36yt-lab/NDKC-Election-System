import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as { studentId?: unknown; status?: unknown; approveAll?: unknown } | null;
  const admin = createAdminClient();

  if (body?.approveAll === true) {
    const { data, error } = await admin
      .from("students")
      .update({ status: "approved" })
      .eq("status", "pending")
      .select("id");
    if (error) return NextResponse.json({ error: "Pending registrations could not be approved." }, { status: 500 });
    return NextResponse.json({ studentIds: (data ?? []).map((student) => student.id) });
  }

  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const status = body?.status;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) {
    return NextResponse.json({ error: "A valid student account is required." }, { status: 400 });
  }
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "Status must be approved or rejected." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("students")
    .update({ status })
    .eq("id", studentId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Registration status could not be updated." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "This registration is no longer pending." }, { status: 409 });

  return NextResponse.json({ status });
}