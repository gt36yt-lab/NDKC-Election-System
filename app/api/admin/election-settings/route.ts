import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STATUSES = ["scheduled", "active", "ended", "cancelled"] as const;
type ElectionStatus = typeof VALID_STATUSES[number];

export async function PATCH(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as {
    status?: unknown;
    start_time?: unknown;
    end_time?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Election settings are required." }, { status: 400 });

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as ElectionStatus)) {
    return NextResponse.json({ error: "Choose a valid election status." }, { status: 400 });
  }
  const parseTime = (value: unknown) => {
    if (value === null || value === "") return null;
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return undefined;
    return new Date(value).toISOString();
  };
  const startWasProvided = body.start_time !== undefined;
  const endWasProvided = body.end_time !== undefined;
  const startTime = startWasProvided ? parseTime(body.start_time) : undefined;
  const endTime = endWasProvided ? parseTime(body.end_time) : undefined;
  const manualStart = body.status === "active" && (!startWasProvided || startTime === null || startTime === undefined);
  if ((!manualStart && startWasProvided && startTime === undefined)
    || (body.status !== "active" && endWasProvided && endTime === undefined)) {
    return NextResponse.json({ error: "Enter valid start and end dates." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("election_settings")
    .select("status, start_time, end_time")
    .eq("id", 1)
    .maybeSingle();
  if (currentError) {
    console.error("[ElectionSettings] Current settings lookup failed:", currentError);
    return NextResponse.json({ error: "Election settings could not be loaded. Run the current schema.sql in Supabase." }, { status: 500 });
  }

  const nextStart = manualStart
    ? new Date().toISOString()
    : startWasProvided ? startTime ?? null : current?.start_time ?? null;
  let nextEnd = endWasProvided && endTime !== undefined ? endTime : current?.end_time ?? null;
  if (body.status === "active" && nextEnd && Date.parse(nextEnd) <= Date.parse(nextStart ?? "")) nextEnd = null;
  if (nextStart && nextEnd && Date.parse(nextEnd) <= Date.parse(nextStart)) {
    return NextResponse.json({ error: "Voting end time must be after the start time." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("election_settings")
    .upsert({
      id: 1,
      status: (body.status as ElectionStatus | undefined) ?? current?.status ?? "scheduled",
      start_time: nextStart,
      end_time: nextEnd,
      updated_by: access.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select("id, status, start_time, end_time, updated_at")
    .single();
  if (error) {
    console.error("[ElectionSettings] Settings upsert failed:", error);
    return NextResponse.json({ error: "Election settings could not be saved. Check the election_settings table and service-role permissions." }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/candidates");
  revalidatePath("/vote");
  revalidatePath("/ballot");

  return NextResponse.json({ settings: data });
}

export const POST = PATCH;
export const PUT = PATCH;
