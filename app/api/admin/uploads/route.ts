import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_BUCKETS = new Set(["candidate-photos", "party-logos"]);
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const bucket = form?.get("bucket");
  const file = form?.get("file");
  if (typeof bucket !== "string" || !ALLOWED_BUCKETS.has(bucket) || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a valid image and upload destination." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image smaller than 5 MB." }, { status: 400 });
  }

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.slice("image/".length);
  const path = `${randomUUID()}.${extension}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: "Image could not be uploaded. Check Supabase Storage bucket setup." }, { status: 500 });
  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ publicUrl: data.publicUrl }, { status: 201 });
}