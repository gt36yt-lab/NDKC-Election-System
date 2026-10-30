import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "candidate-photos";
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a candidate photo to upload." }, { status: 400 });
  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Image size must be between 1 byte and 4 MB." }, { status: 413 });

  const admin = createAdminClient();
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error("[CandidatePhoto] Storage upload failed:", error);
    return NextResponse.json({ error: "Photo upload failed. Verify the candidate-photos storage bucket exists." }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ image_url: data.publicUrl });
}