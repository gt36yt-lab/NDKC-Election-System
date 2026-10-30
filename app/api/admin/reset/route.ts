import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type ResetType = "soft" | "hard";

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) {
    return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: currentAdmin, error: adminError } = await admin
    .from("students")
    .select("role, status")
    .eq("id", access.userId)
    .maybeSingle();
  if (adminError) {
    console.error("[AdminReset] Admin profile lookup failed:", adminError);
    return NextResponse.json({ error: "Admin access could not be verified." }, { status: 500 });
  }
  if (!currentAdmin || currentAdmin.role !== "admin" || currentAdmin.status !== "approved") {
    return NextResponse.json({ error: "An active admin account is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { type?: unknown } | null;
  if (!body || (body.type !== "soft" && body.type !== "hard")) {
    return NextResponse.json({ error: "Choose a valid reset type." }, { status: 400 });
  }

  const resetType: ResetType = body.type;
  const procedure = resetType === "soft" ? "reset_votes_and_otps" : "reset_election_system_full";
  const { error } = await admin.rpc(procedure);
  if (error) {
    console.error(`[AdminReset] ${procedure} failed:`, error);
    return NextResponse.json({ error: "The election system could not be reset. Check the reset RPCs in schema.sql." }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/ballot");
  revalidatePath("/results");

  return NextResponse.json({ success: true, type: resetType });
}
