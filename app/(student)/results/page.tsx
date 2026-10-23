import { createClient } from "@/lib/supabase/server";
import LiveResults, { type ResultCandidate, type VoteRow } from "./live-results";

type Party = { id: string; name: string };

export default async function ResultsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("has_voted")
    .eq("id", user.id)
    .maybeSingle();

  if (studentError || !student) {
    return (
      <main className="page-enter mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p role="alert" className="border-l-2 border-[#b84a3a] bg-white px-4 py-3 text-sm text-[#8c3328]">
          Your voting status could not be verified, so results are unavailable. Please try again later.
        </p>
      </main>
    );
  }

  if (!student.has_voted) {
    return (
      <main className="page-enter mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Election count</p>
        <h1 className="display-font mt-3 text-4xl">Live results</h1>
        <p role="status" className="mt-8 border-l-4 border-[#d5a92e] bg-[#fff8e4] px-5 py-4 text-sm leading-6 text-[#5c4a18]">
          Election results are locked until you have cast your ballot. Please submit your vote to view live election results.
        </p>
      </main>
    );
  }

  const [{ data: candidates, error: candidateError }, { data: votes, error: voteError }, { data: parties, error: partyError }] = await Promise.all([
    supabase.from("candidates").select("id, full_name, position, party_id, image_url").order("position").order("full_name"),
    supabase.from("votes").select("candidate_id, position"),
    supabase.from("parties").select("id, name"),
  ]);

  const error = candidateError ?? voteError ?? partyError;
  const partyNames = new Map((parties ?? []).map((party: Party) => [party.id, party.name]));
  const resultCandidates = ((candidates ?? []) as Omit<ResultCandidate, "party_name">[]).map((candidate) => ({
    ...candidate,
    party_name: candidate.party_id ? partyNames.get(candidate.party_id) ?? "Party affiliation unavailable" : "Independent",
  }));

  return (
    <main className="page-enter mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Election count</p>
      <h1 className="display-font mt-3 text-4xl">Live results</h1>
      <p className="mt-3 text-sm leading-6 text-[#66736b]">Vote totals update as ballots are recorded.</p>
      {error ? (
        <p role="alert" className="mt-8 border-l-2 border-[#b84a3a] bg-white px-4 py-3 text-sm text-[#8c3328]">Results could not be loaded. Check the votes table access policy and try again.</p>
      ) : (
        <LiveResults candidates={resultCandidates} initialVotes={(votes ?? []) as VoteRow[]} />
      )}
    </main>
  );
}