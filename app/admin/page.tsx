import { redirect } from "next/navigation";
import AdminDashboard, { type AdminCandidate, type AdminParty, type AdminStudent } from "./dashboard";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

function AdminNotice({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Electoral board</p>
      <h1 className="display-font mt-3 text-3xl">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[#66736b]">{message}</p>
    </main>
  );
}

export default async function AdminPage() {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    if (access.status === "unauthenticated") redirect("/login?next=/admin");
    if (access.status === "not-configured") {
      return <AdminNotice title="Admin access is not configured" message="Configure Supabase environment variables, then restart the app." />;
    }
    return <AdminNotice title="Access denied" message="This account is not authorized to use the Electoral Board dashboard." />;
  }
  if (!isAdminServiceConfigured()) {
    return <AdminNotice title="Admin service is not configured" message="Add SUPABASE_SERVICE_ROLE_KEY to the server environment. Keep this key private and never expose it as a NEXT_PUBLIC variable." />;
  }

  const admin = createAdminClient();
  const [{ data: students, error }, { data: candidates }, { data: parties }] = await Promise.all([
    admin.from("students").select("id, lrn, role, full_name, email, grade_level, section, otp_code, has_voted").order("grade_level").order("section").order("full_name"),
    admin.from("candidates").select("id, full_name, position, party_id, platform, image_url, allowed_grade_levels").order("position").order("full_name"),
    admin.from("parties").select("id, name, description").order("name"),
  ]);

  if (error) {
    return <AdminNotice title="Student records could not be loaded" message="Check the Supabase service role configuration and students table schema, then reload this page." />;
  }

  return <AdminDashboard initialStudents={(students ?? []) as AdminStudent[]} initialCandidates={(candidates ?? []) as AdminCandidate[]} initialParties={(parties ?? []) as AdminParty[]} currentAdminId={access.userId} />;
}