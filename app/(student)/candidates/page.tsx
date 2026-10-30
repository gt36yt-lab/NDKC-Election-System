import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { candidateMatchesGrade, schoolDivision, sortPositions } from "@/lib/position-order";
import OtpStatus from "../otp-status";

type Candidate = {
  id: string;
  full_name: string;
  position: string;
  party_id: string | null;
  platform: string | null;
  image_url: string | null;
  allowed_grade_levels: number[] | null;
};

type Party = { id: string; name: string };

export default async function CandidatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: student, error: studentError }, { data: candidates, error: candidateError }, { data: parties, error: partyError }, { data: otpRows, error: otpError }] = await Promise.all([
    supabase.from("students").select("id, student_id, role, grade_level, has_voted").eq("id", user.id).maybeSingle(),
    supabase.from("candidates").select("id, full_name, position, party_id, platform, image_url, allowed_grade_levels").order("full_name"),
    supabase.from("parties").select("id, name").order("name"),
    supabase.rpc("get_my_election_otp"),
  ]);

  if (studentError) {
    console.error("[CandidatesPage] Student profile lookup failed:", studentError);
    return <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8"><p role="alert" className="text-sm text-[#8c3328]">Your student profile could not be loaded. Please try again later.</p></main>;
  }
  if (!student) {
    return <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8"><p role="alert" className="text-sm text-[#8c3328]">Your student profile could not be found. Please contact the election board.</p></main>;
  }

  if (candidateError) console.error("[CandidatesPage] Candidate lookup failed:", candidateError);
  if (partyError) console.error("[CandidatesPage] Party lookup failed:", partyError);
  if (otpError) console.error("[CandidatesPage] Election OTP lookup failed:", otpError);
  const electionOtp = (otpRows ?? [])[0] as { status: "scheduled" | "active" | "ended" | "cancelled"; otp_code: string | null } | undefined;
  const error = candidateError ?? partyError;
  const gradeLevel = Number(student?.grade_level);
  if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
    return <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8"><p role="alert" className="text-sm text-[#8c3328]">Your grade level could not be verified. Please contact the election board.</p></main>;
  }
  const partyNames = new Map((parties ?? []).map((party: Party) => [party.id, party.name]));
  const eligibleCandidates = ((candidates ?? []) as Candidate[]).filter((candidate) => candidateMatchesGrade(candidate, gradeLevel));
  const groupedCandidates = eligibleCandidates.reduce((groups: Map<string, Candidate[]>, candidate: Candidate) => {
    const group = groups.get(candidate.position) ?? [];
    group.push(candidate);
    groups.set(candidate.position, group);
    return groups;
  }, new Map<string, Candidate[]>());

  return (
    <main className="page-enter mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Meet the candidates</p>
      <h1 className="display-font mt-3 text-4xl">Candidate profiles</h1>
      <OtpStatus status={electionOtp?.status} otpCode={electionOtp?.otp_code ?? null} hasVoted={student.has_voted} error={Boolean(otpError)} />
      {error ? (
        <p role="alert" className="mt-8 border-l-2 border-[#b84a3a] bg-white px-4 py-3 text-sm text-[#8c3328]">Candidate information could not be loaded. Please try again later.</p>
      ) : groupedCandidates.size === 0 ? (
        <p className="mt-8 border-y border-[#d9e0db] bg-white/80 px-5 py-8 text-sm text-[#66736b]">No candidates have been published yet.</p>
      ) : (
        <section className="mt-6 space-y-12" aria-labelledby="division-title">
          <h2 id="division-title" className="display-font text-2xl">{schoolDivision(gradeLevel)}</h2>
          {sortPositions([...groupedCandidates.entries()]).map(([position, positionCandidates]) => (
            <section key={position} aria-labelledby={`position-${position}`}>
              <h3 id={`position-${position}`} className="display-font border-b border-[#d9e0db] pb-3 text-2xl">{position}</h3>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {positionCandidates.map((candidate) => (
                  <article key={candidate.id} className="overflow-hidden border border-[#d9e0db] bg-white">
                    {candidate.image_url ? (
                      <Image src={candidate.image_url} alt={candidate.full_name} width={640} height={420} unoptimized className="h-56 w-full object-cover" />
                    ) : (
                      <div aria-hidden="true" className="grid h-56 place-items-center bg-[#e5f0e9] text-5xl font-semibold text-[#005a36]">
                        {candidate.full_name.trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#005a36]">
                        {candidate.party_id ? partyNames.get(candidate.party_id) ?? "Party affiliation unavailable" : "Independent"}
                      </p>
                      <h4 className="display-font mt-2 text-2xl">{candidate.full_name}</h4>
                      {candidate.platform && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#66736b]">{candidate.platform}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      )}
    </main>
  );
}