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

type Party = { id: string; name: string };

export default async function CandidatesPage() {
  const supabase = await createClient();
  const [{ data: candidates, error: candidateError }, { data: parties, error: partyError }] = await Promise.all([
    supabase.from("candidates").select("id, full_name, position, party_id, platform, image_url").order("full_name"),
    supabase.from("parties").select("id, name").order("name"),
  ]);

  const error = candidateError ?? partyError;
  const partyNames = new Map((parties ?? []).map((party: Party) => [party.id, party.name]));
  const groupedCandidates = (candidates ?? []).reduce((groups: Map<string, Candidate[]>, candidate: Candidate) => {
    const group = groups.get(candidate.position) ?? [];
    group.push(candidate);
    groups.set(candidate.position, group);
    return groups;
  }, new Map<string, Candidate[]>());

  return (
    <main className="page-enter mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Meet the candidates</p>
      <h1 className="display-font mt-3 text-4xl">Candidate profiles</h1>
      {error ? (
        <p role="alert" className="mt-8 border-l-2 border-[#b84a3a] bg-white px-4 py-3 text-sm text-[#8c3328]">Candidate information could not be loaded. Please try again later.</p>
      ) : groupedCandidates.size === 0 ? (
        <p className="mt-8 border-y border-[#d9e0db] bg-white/80 px-5 py-8 text-sm text-[#66736b]">No candidates have been published yet.</p>
      ) : (
        <div className="mt-10 space-y-12">
          {[...groupedCandidates.entries()].map(([position, positionCandidates]) => (
            <section key={position} aria-labelledby={`position-${position}`}>
              <h2 id={`position-${position}`} className="display-font border-b border-[#d9e0db] pb-3 text-2xl">{position}</h2>
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
                      <h3 className="display-font mt-2 text-2xl">{candidate.full_name}</h3>
                      {candidate.platform && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#66736b]">{candidate.platform}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}