import { redirect } from "next/navigation";
import { candidateDivision } from "@/lib/position-order";
import { getAdminAccess, isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import LiveResults, { type ResultCandidate, type VoteRow } from "../../(student)/results/live-results";

export default async function AdminResultsPage() {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?next=/admin/results");
  if (access.status !== "authorized") redirect("/admin");
  if (!isAdminServiceConfigured()) return <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8"><h1 className="display-font text-3xl">Admin service is not configured</h1></main>;

  const admin = createAdminClient();
  const [{ data: candidates, error: candidateError }, { data: votes, error: voteError }, { data: parties, error: partyError }] = await Promise.all([
    admin.from("candidates").select("id, full_name, position, division, allowed_grade_levels, party_id, image_url").order("position").order("full_name"),
    admin.from("votes").select("candidate_id, position"),
    admin.from("parties").select("id, name"),
  ]);

  if (candidateError || voteError || partyError) {
    console.error("[AdminResultsPage] Results data could not be loaded:", { candidateError, voteError, partyError });
    return <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8"><h1 className="display-font text-3xl">Results could not be loaded</h1><p className="mt-3 text-sm text-[#66736b]">Check the candidate, party, and vote tables, then reload.</p></main>;
  }

  const partyNames = new Map((parties ?? []).map((party) => [party.id, party.name]));
  const resultCandidates = (candidates ?? []).map((candidate) => ({
    id: candidate.id,
    full_name: candidate.full_name,
    position: candidate.position,
    party_id: candidate.party_id,
    party_name: candidate.party_id ? partyNames.get(candidate.party_id) ?? "Party affiliation unavailable" : "Independent",
    image_url: candidate.image_url,
    division: candidateDivision(candidate),
  })) as ResultCandidate[];

  return (
    <main className="page-enter mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Electoral board</p>
      <h1 className="display-font mt-3 text-4xl">Election results</h1>
      <p className="mt-3 text-sm leading-6 text-[#66736b]">JHS and SHS totals are shown separately.</p>
      <LiveResults candidates={resultCandidates} initialVotes={(votes ?? []) as VoteRow[]} />
    </main>
  );
}
