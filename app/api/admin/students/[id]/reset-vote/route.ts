import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: student, error: studentError } = await admin.from("students").select("lrn, has_voted").eq("id", id).maybeSingle();
  if (studentError) return NextResponse.json({ error: "Student could not be loaded." }, { status: 500 });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  if (!student.has_voted) return NextResponse.json({ error: "This student has not voted." }, { status: 409 });

  const { error } = await admin.rpc("reset_student_vote", { p_student_lrn: student.lrn });
  if (error) return NextResponse.json({ error: "Vote could not be reset. Check the RPC permissions and try again." }, { status: 500 });
  return NextResponse.json({ success: true });
}