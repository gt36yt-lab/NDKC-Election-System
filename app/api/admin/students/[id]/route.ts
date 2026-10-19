import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as { full_name?: unknown; grade_level?: unknown; section?: unknown; email?: unknown } | null;
  const full_name = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const grade_level = Number(body?.grade_level);
  const section = typeof body?.section === "string" ? body.section.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!full_name || full_name.length > 120) return NextResponse.json({ error: "Enter a valid full name." }, { status: 400 });
  if (!Number.isInteger(grade_level) || grade_level < 7 || grade_level > 12) return NextResponse.json({ error: "Choose a grade level from 7 to 12." }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const { id } = await params;
  const { data, error } = await createAdminClient().from("students")
    .update({ full_name, grade_level, section: section || "General", email })
    .eq("id", id)
    .select("id, lrn, email, raw_password, full_name, grade_level, section, otp_code, has_voted")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Student record could not be updated." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  return NextResponse.json({ student: data });
}