import { redirect } from "next/navigation";
import SiteHeader from "./site-header";
import TermsGate from "./terms-gate";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Student = {
  full_name: string | null;
  grade_level: string | number | null;
  section: string | null;
  has_agreed_terms: boolean;
  has_voted: boolean;
};

function SetupNotice() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Setup required</p>
      <h1 className="display-font mt-3 text-3xl">Connect the student portal</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#66736b]">Add your Supabase project URL and public key to <code className="rounded bg-white px-1.5 py-0.5">.env.local</code>, then restart the development server. No database changes have been made by this scaffold.</p>
    </main>
  );
}

export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isSupabaseConfigured()) return <><SiteHeader /><SetupNotice /></>;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/candidates");

  const { data: student } = await supabase
    .from("students")
    .select("full_name, grade_level, section, has_agreed_terms, has_voted")
    .eq("id", user.id)
    .maybeSingle();

  if (!student) {
    return <><SiteHeader /><main className="mx-auto max-w-3xl px-5 py-16 sm:px-8"><h1 className="display-font text-3xl">Student profile not found</h1><p className="mt-3 text-sm leading-6 text-[#66736b]">Ask the election board to verify that your student profile is linked to this sign-in account.</p></main></>;
  }

  const profile = student as Student;
  return <><SiteHeader studentId={user.id} studentName={profile.full_name} hasVoted={profile.has_voted} /><TermsGate hasAgreed={profile.has_agreed_terms} studentId={user.id}>{children}</TermsGate></>;
}