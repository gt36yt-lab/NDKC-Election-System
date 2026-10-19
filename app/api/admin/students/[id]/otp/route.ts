import { randomBytes, randomInt } from "node:crypto";
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
  const { data: student, error: lookupError } = await admin.from("students").select("lrn, has_voted, raw_password, otp_code").eq("id", id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Student credentials could not be loaded." }, { status: 500 });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  const password = `${randomBytes(18).toString("base64url")}aA1!`;
  const otp = String(randomInt(100000, 1000000));
  const { data, error } = await admin.from("students")
    .update({ otp_code: otp, raw_password: password })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Student credentials could not be updated." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const { error: authError } = await admin.auth.admin.updateUserById(id, { password });
  if (authError) {
    await admin.from("students").update({ otp_code: student.otp_code, raw_password: student.raw_password }).eq("id", id).eq("has_voted", false);
    return NextResponse.json({ error: "The password could not be changed in Supabase Auth." }, { status: 500 });
  }

  return NextResponse.json({ otp, password });
}