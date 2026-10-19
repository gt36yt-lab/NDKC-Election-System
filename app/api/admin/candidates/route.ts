import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const full_name = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const position = typeof body?.position === "string" ? body.position.trim() : "";
  const party_id = typeof body?.party_id === "string" && body.party_id ? body.party_id : null;
  const platform = typeof body?.platform === "string" ? body.platform.trim() : "";
  const image_url = typeof body?.image_url === "string" ? body.image_url.trim() : "";
  const allowed_grade_levels = body?.allowed_grade_levels;

  if (!full_name || !position) return NextResponse.json({ error: "Full name and position are required." }, { status: 400 });
  if (!Array.isArray(allowed_grade_levels) || allowed_grade_levels.length === 0 || !allowed_grade_levels.every((grade) => Number.isInteger(grade) && grade >= 7 && grade <= 12)) {
    return NextResponse.json({ error: "Choose one or more valid grade levels from 7 to 12." }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("candidates")
    .insert({ full_name, position, party_id, platform: platform || null, image_url: image_url || null, allowed_grade_levels })
    .select("id, full_name, position, party_id, platform, image_url, allowed_grade_levels")
    .single();
  if (error) return NextResponse.json({ error: "Candidate could not be created. Verify the party and candidate table policies." }, { status: 500 });
  return NextResponse.json({ candidate: data }, { status: 201 });
}