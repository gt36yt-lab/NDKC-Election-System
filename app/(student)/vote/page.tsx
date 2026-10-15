import { createClient } from "@/lib/supabase/server";
import Ballot from "./ballot";

type Candidate = {
  id: string;
  full_name: string;
  position: string;
  party_id: string | null;
  platform: string | null;
  allowed_grade_levels: number[] | null;
};

type Party = { id: string; name: string };
type SavedVote = { candidate_id: string; position: string };

export default async function VotePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: student }, { data: candidates, error: candidateError }, { data: parties }] = await Promise.all([
    supabase.from("students").select("lrn, grade_level, section, has_voted").eq("id", user.id).maybeSingle(),
    supabase.from("candidates").select("id, full_name, position, party_id, platform, allowed_grade_levels").order("full_name"),
    supabase.from("parties").select("id, name"),
  ]);

  if (!student) {
    return <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8"><h1 className="display-font text-3xl">Student profile not found</h1><p className="mt-3 text-sm leading-6 text-[#66736b]">Ask the election board to verify your student profile.</p></main>;
  }

  const gradeLevel = Number(student.grade_level);
  const partyNames = new Map((parties ?? []).map((party: Party) => [party.id, party.name]));
  const eligibleCandidates = ((candidates ?? []) as Candidate[]).filter((candidate) =>
    candidate.allowed_grade_levels?.includes(gradeLevel) ?? true,
  );
  let savedVotes: SavedVote[] = [];

  if (student.has_voted && student.lrn) {
    const { data: votes } = await supabase.from("votes").select("candidate_id, position").eq("student_lrn", student.lrn);
    savedVotes = (votes ?? []) as SavedVote[];
  }

  return (
    <main className="page-enter mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Student ballot</p>
      <h1 className="display-font mt-3 text-4xl">Your vote matters.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66736b]">Review the candidates and their platforms before you make your choice. Your ballot is tailored to grade {student.grade_level}{student.section ? ` - ${student.section}` : ""}.</p>
      {candidateError ? (
        <p role="alert" className="mt-8 border-l-2 border-[#b84a3a] bg-white px-4 py-3 text-sm text-[#8c3328]">The ballot could not be loaded. Please try again later.</p>
      ) : (
        <Ballot candidates={eligibleCandidates} partyNames={Object.fromEntries(partyNames)} hasVoted={student.has_voted} savedVotes={savedVotes} />
      )}
    </main>
  );
}