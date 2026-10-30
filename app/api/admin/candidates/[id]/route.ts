import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { POSITION_OPTIONS } from "@/lib/position-order";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const full_name = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const position = typeof body?.position === "string" ? body.position.trim() : "";
  const positionOption = POSITION_OPTIONS.find((option) => option.value === position);
  const party_id = typeof body?.party_id === "string" && body.party_id ? body.party_id : null;
  const platform = typeof body?.platform === "string" ? body.platform.trim() : "";
  const image_url = typeof body?.image_url === "string" ? body.image_url.trim() : "";
  const allowed_grade_levels = body?.allowed_grade_levels;

  if (!full_name || !positionOption) return NextResponse.json({ error: "Full name and a valid division position are required." }, { status: 400 });
  if (!Array.isArray(allowed_grade_levels) || allowed_grade_levels.length === 0 || !allowed_grade_levels.every((grade) => Number.isInteger(grade) && positionOption.grades.includes(grade))) {
    return NextResponse.json({ error: `Choose eligible grades within ${positionOption.division}.` }, { status: 400 });
  }

  const { id } = await params;
  const { data, error } = await createAdminClient()
    .from("candidates")
    .update({ full_name, position, division: positionOption.division, party_id, manifesto: platform || null, platform: platform || null, image_url: image_url || null, allowed_grade_levels })
    .eq("id", id)
    .select("id, full_name, position, division, party_id, platform, manifesto, image_url, photo_url, allowed_grade_levels")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Candidate could not be updated." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  return NextResponse.json({ candidate: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const { id } = await params;
  const { error } = await createAdminClient().from("candidates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Candidate could not be deleted. Existing votes may reference this candidate." }, { status: 409 });
  return NextResponse.json({ success: true });
}