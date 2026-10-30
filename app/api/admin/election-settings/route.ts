import { NextResponse } from "next/server";
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
  const startTime = body.start_time === undefined ? undefined : parseTime(body.start_time);
  const endTime = body.end_time === undefined ? undefined : parseTime(body.end_time);
  if (startTime === undefined || endTime === undefined) {
    return NextResponse.json({ error: "Enter valid start and end dates." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("election_settings")
    .select("status, start_time, end_time")
    .eq("id", 1)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: "Election settings could not be loaded." }, { status: 500 });

  const nextStart = startTime === undefined ? current?.start_time ?? null : startTime;
  const nextEnd = endTime === undefined ? current?.end_time ?? null : endTime;
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
  if (error) return NextResponse.json({ error: "Election settings could not be saved." }, { status: 500 });

  return NextResponse.json({ settings: data });
}
