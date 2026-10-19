import { NextResponse } from "next/server";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status === "unauthenticated" ? 401 : 403 });
  }
  if (!isAdminServiceConfigured()) return NextResponse.json({ error: "Admin service is not configured." }, { status: 503 });
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json({ error: "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { student_id?: unknown; recipient_email?: unknown; subject?: unknown; text?: unknown } | null;
  const studentId = typeof body?.student_id === "string" ? body.student_id : "";
  const recipientEmail = typeof body?.recipient_email === "string" ? body.recipient_email.trim() : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!studentId) return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return NextResponse.json({ error: "Enter a valid recipient email address." }, { status: 400 });
  if (!subject || subject.length > 200 || !text || text.length > 10000) return NextResponse.json({ error: "Enter a subject and an email body under 10,000 characters." }, { status: 400 });

  const { data: student, error } = await createAdminClient().from("students")
    .select("lrn, raw_password, otp_code")
    .eq("id", studentId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Student credentials could not be loaded." }, { status: 500 });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  if (!student.raw_password || !student.otp_code) return NextResponse.json({ error: "Student credentials are incomplete; re-import or reset the credentials first." }, { status: 409 });

  const delivery = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [recipientEmail],
      subject,
      text,
    }),
  });
  if (!delivery.ok) return NextResponse.json({ error: "Email delivery failed. Check the email provider configuration and try again." }, { status: 502 });
  return NextResponse.json({ success: true });
}