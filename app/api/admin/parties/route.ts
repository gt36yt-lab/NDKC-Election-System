import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as { name?: unknown; description?: unknown; logo_url?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const logo_url = typeof body?.logo_url === "string" ? body.logo_url.trim() : "";
  if (!name) return NextResponse.json({ error: "Party name is required." }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("parties")
    .insert({ name, description: description || null, logo_url: logo_url || null })
    .select("id, name, description, logo_url")
    .single();
  if (error) return NextResponse.json({ error: "Party could not be created." }, { status: 500 });
  return NextResponse.json({ party: data }, { status: 201 });
}