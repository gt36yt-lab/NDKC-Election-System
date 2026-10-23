"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sortPositions } from "@/lib/position-order";

export type VoteRow = { candidate_id: string; position: string };
export type ResultCandidate = {
  id: string;
  full_name: string;
  position: string;
  party_id: string | null;
  party_name: string;
  image_url: string | null;
};

export default function LiveResults({ candidates, initialVotes }: { candidates: ResultCandidate[]; initialVotes: VoteRow[] }) {
  const [votes, setVotes] = useState(initialVotes);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const refreshVotes = async () => {
      const { data, error } = await supabase.from("votes").select("candidate_id, position");
      if (active && !error) setVotes((data ?? []) as VoteRow[]);
    };
    const channel = supabase
      .channel("public-vote-results")
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, refreshVotes)
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        setIsConnected(connected);
        if (connected) void refreshVotes();
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const positions = new Map<string, ResultCandidate[]>();
  for (const candidate of candidates) {
    const group = positions.get(candidate.position) ?? [];
    group.push(candidate);
    positions.set(candidate.position, group);
  }

  return (
    <div className="mt-8">
      <p className="flex items-center gap-2 text-xs font-semibold text-[#66736b]" aria-live="polite">
        <span aria-hidden="true" className={`size-2 rounded-full ${isConnected ? "bg-[#21824e]" : "bg-[#b99b4a]"}`} />
        {isConnected ? "Live updates connected" : "Connecting to live updates"}
      </p>
      {positions.size === 0 ? (
        <p className="mt-6 border-y border-[#d9e0db] bg-white/80 px-5 py-8 text-sm text-[#66736b]">No candidates have been published yet.</p>
      ) : (
        <div className="mt-6 space-y-10">
          {sortPositions([...positions.entries()]).map(([position, positionCandidates]) => {
            const positionVotes = votes.filter((vote) => vote.position === position);
            const total = positionVotes.length;
            return (
              <section key={position} aria-labelledby={`results-${position}`} className="border-y border-[#d9e0db] bg-white/80 px-5 py-6 sm:px-8">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e5eae6] pb-4">
                  <h2 id={`results-${position}`} className="display-font text-2xl">{position}</h2>
                  <p className="text-sm text-[#66736b]">{total} {total === 1 ? "vote" : "votes"}</p>
                </div>
                <div className="divide-y divide-[#e5eae6]">
                  {positionCandidates.map((candidate) => {
                    const count = positionVotes.filter((vote) => vote.candidate_id === candidate.id).length;
                    const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
                    return (
                      <article key={candidate.id} className="py-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <div>
                            <h3 className="font-semibold">{candidate.full_name}</h3>
                            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#005a36]">{candidate.party_name}</p>
                          </div>
                          <p className="text-sm tabular-nums text-[#4e5b53]">{count} {count === 1 ? "vote" : "votes"} · {percentage}%</p>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden bg-[#e5eae6]" role="progressbar" aria-label={`${candidate.full_name} vote share`} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full bg-[#005a36] transition-[width] duration-500" style={{ width: `${percentage}%` }} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}