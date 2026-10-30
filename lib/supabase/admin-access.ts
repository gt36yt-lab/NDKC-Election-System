import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminAccess =
  | { status: "authorized"; lrn: string; userId: string }
  | { status: "unauthenticated" | "forbidden" | "not-configured" };

export async function getAdminAccess(): Promise<AdminAccess> {
  const allowedLrns = (process.env.ADMIN_LRNS ?? "")
    .split(",")
    .map((lrn) => lrn.trim())
    .filter(Boolean);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { status: "not-configured" };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) console.error("[AdminAccess] Auth user lookup failed:", authError);
  if (!user) return { status: "unauthenticated" };

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("student_id, lrn, role")
    .eq("id", user.id)
    .maybeSingle();

  if (studentError) {
    console.error("[AdminAccess] Student role lookup failed:", studentError);
    return { status: "forbidden" };
  }
  if (!student) return { status: "forbidden" };

  const studentId = typeof student.student_id === "string" ? student.student_id : "";
  const lrn = typeof student.lrn === "string" ? student.lrn : studentId;
  const allowedById = studentId !== "" && allowedLrns.includes(studentId);
  if (student.role !== "admin" && !allowedById) return { status: "forbidden" };

  return { status: "authorized", lrn, userId: user.id };
}

export function isAdminServiceConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}