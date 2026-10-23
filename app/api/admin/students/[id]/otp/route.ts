import { randomInt } from "node:crypto";
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
  const otp = String(randomInt(100000, 1000000));
  const { data, error } = await createAdminClient()
    .from("students")
    .update({ otp_code: otp })
    .eq("id", id)
    .eq("has_voted", false)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "OTP could not be updated." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Student was not found or has already voted." }, { status: 404 });
  return NextResponse.json({ otp });
}