import "server-only";

import { createClient } from "@/lib/supabase/server";

const STUDENT_EMAIL_DOMAIN = "@students.ndkc.invalid";

export type AdminAccess =
  | { status: "authorized"; lrn: string }
  | { status: "unauthenticated" | "forbidden" | "not-configured" };

export async function getAdminAccess(): Promise<AdminAccess> {
  const allowedLrns = (process.env.ADMIN_LRNS ?? "")
    .split(",")
    .map((lrn) => lrn.trim())
    .filter(Boolean);

  if (allowedLrns.length === 0 || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { status: "not-configured" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { status: "unauthenticated" };

  const email = user.email.toLowerCase();
  if (!email.endsWith(STUDENT_EMAIL_DOMAIN)) return { status: "forbidden" };
  const lrn = email.slice(0, -STUDENT_EMAIL_DOMAIN.length);
  if (!allowedLrns.includes(lrn)) return { status: "forbidden" };
  return { status: "authorized", lrn };
}

export function isAdminServiceConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}