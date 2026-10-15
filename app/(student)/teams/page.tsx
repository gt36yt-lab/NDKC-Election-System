import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

type Candidate = {
  id: string;
  full_name: string;
  position: string;
  party_id: string | null;
  platform: string | null;
  image_url: string | null;
};

type Party = { id: string; name: string; description: string | null };

function CandidateList({ candidates }: { candidates: Candidate[] }) {
  if (candidates.length === 0) return <p className="mt-4 text-sm text-[#66736b]">No candidates listed.</p>;

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {candidates.map((candidate) => (
        <article key={candidate.id} className="flex gap-4 border-y border-[#d9e0db] bg-white px-4 py-4">
          {candidate.image_url ? (
            <Image src={candidate.image_url} alt="" width={160} height={160} unoptimized className="size-20 shrink-0 object-cover" />
          ) : (
            <div aria-hidden="true" className="grid size-20 shrink-0 place-items-center bg-[#e5f0e9] text-2xl font-semibold text-[#005a36]">
              {candidate.full_name.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 py-1">
            <p className="text-xs font-bold uppercase tracking-wide text-[#005a36]">{candidate.position}</p>
            <h3 className="display-font mt-1 text-xl">{candidate.full_name}</h3>
            {candidate.platform && <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-5 text-[#66736b]">{candidate.platform}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

export default async function TeamsPage() {
  const supabase = await createClient();
  const [{ data: parties, error: partyError }, { data: candidates, error: candidateError }] = await Promise.all([
    supabase.from("parties").select("id, name, description").order("name"),
    supabase.from("candidates").select("id, full_name, position, party_id, platform, image_url").order("full_name"),
  ]);
  const error = partyError ?? candidateError;
  const allCandidates = (candidates ?? []) as Candidate[];

  return (
    <main className="page-enter mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Party affiliations</p>
      <h1 className="display-font mt-3 text-4xl">Meet the teams</h1>
      {error ? (
        <p role="alert" className="mt-8 border-l-2 border-[#b84a3a] bg-white px-4 py-3 text-sm text-[#8c3328]">Party information could not be loaded. Please try again later.</p>
      ) : allCandidates.length === 0 ? (
        <p className="mt-8 border-y border-[#d9e0db] bg-white/80 px-5 py-8 text-sm text-[#66736b]">No candidates have been published yet.</p>
      ) : (
        <div className="mt-10 space-y-12">
          {(parties ?? []).map((party: Party) => (
            <section key={party.id} aria-labelledby={`party-${party.id}`}>
              <h2 id={`party-${party.id}`} className="display-font border-b border-[#d9e0db] pb-3 text-2xl">{party.name}</h2>
              {party.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736b]">{party.description}</p>}
              <CandidateList candidates={allCandidates.filter((candidate) => candidate.party_id === party.id)} />
            </section>
          ))}
          {allCandidates.some((candidate) => candidate.party_id === null) && (
            <section aria-labelledby="independent-candidates">
              <h2 id="independent-candidates" className="display-font border-b border-[#d9e0db] pb-3 text-2xl">Independent</h2>
              <CandidateList candidates={allCandidates.filter((candidate) => candidate.party_id === null)} />
            </section>
          )}
        </div>
      )}
    </main>
  );
}