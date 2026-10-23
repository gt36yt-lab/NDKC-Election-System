"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isMultipleSelectionPosition, sortPositions } from "@/lib/position-order";
import { submitBallot } from "./actions";

type Candidate = {
  id: string;
  full_name: string;
  position: string;
  party_id: string | null;
  platform: string | null;
  allowed_grade_levels: number[] | null;
};

type SavedVote = { candidate_id: string; position: string };

export default function Ballot({
  candidates,
  partyNames,
  hasVoted,
  savedVotes,
}: {
  candidates: Candidate[];
  partyNames: Record<string, string>;
  hasVoted: boolean;
  savedVotes: SavedVote[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [lrn, setLrn] = useState("");
  const [otp, setOtp] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.position) ?? [];
    group.push(candidate);
    groups.set(candidate.position, group);
  }
  const hasCompleteSelection = [...groups.keys()].every((position) =>
    isMultipleSelectionPosition(position) || Boolean(selected[position]?.length),
  );

  if (hasVoted) {
    return (
      <section className="mt-10 border-y border-[#d9e0db] bg-white/80 px-5 py-8 sm:px-8">
        <h2 className="display-font text-2xl">Your ballot has been submitted</h2>
        <p className="mt-2 text-sm leading-6 text-[#66736b]">This is a view-only ballot. Your selections cannot be changed.</p>
        {savedVotes.length > 0 && (
          <ul className="mt-6 divide-y divide-[#d9e0db]">
            {savedVotes.map((vote) => {
              const candidate = candidates.find((item) => item.id === vote.candidate_id);
              return <li key={`${vote.position}-${vote.candidate_id}`} className="py-3 text-sm"><span className="font-semibold">{vote.position}:</span> {candidate?.full_name ?? "Recorded selection"}</li>;
            })}
          </ul>
        )}
      </section>
    );
  }

  return (
    <>
      {groups.size === 0 ? (
        <p className="mt-8 border-y border-[#d9e0db] bg-white/80 px-5 py-8 text-sm text-[#66736b]">No eligible candidates are available for your grade.</p>
      ) : (
        <div className="mt-10 space-y-10">
          {sortPositions([...groups.entries()]).map(([position, positionCandidates]) => (
            <fieldset key={position} className="border-y border-[#d9e0db] bg-white/80 px-5 py-6 sm:px-8">
              <legend className="display-font px-2 text-2xl">{position}</legend>
              {isMultipleSelectionPosition(position) && <p className="mt-2 text-xs text-[#66736b]">Choose up to two candidates.</p>}
              <div className="divide-y divide-[#e5eae6]">
                {positionCandidates.map((candidate) => (
                  <label key={candidate.id} className="flex cursor-pointer items-start gap-4 py-5">
                    <input
                      type={isMultipleSelectionPosition(position) ? "checkbox" : "radio"}
                      name={`position-${position}`}
                      value={candidate.id}
                      checked={selected[position]?.includes(candidate.id) ?? false}
                      disabled={isMultipleSelectionPosition(position) && (selected[position]?.length ?? 0) >= 2 && !selected[position]?.includes(candidate.id)}
                      onChange={() => setSelected((current) => {
                        const currentSelection = current[position] ?? [];
                        const nextSelection = isMultipleSelectionPosition(position)
                          ? currentSelection.includes(candidate.id)
                            ? currentSelection.filter((id) => id !== candidate.id)
                            : currentSelection.length < 2 ? [...currentSelection, candidate.id] : currentSelection
                          : [candidate.id];
                        return { ...current, [position]: nextSelection };
                      })}
                      className="mt-1 size-4 shrink-0 accent-[#005a36]"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">{candidate.full_name}</span>
                      <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-[#005a36]">{candidate.party_id ? partyNames[candidate.party_id] ?? "Party affiliation unavailable" : "Independent"}</span>
                      {candidate.platform && <span className="mt-2 block whitespace-pre-line text-sm leading-6 text-[#66736b]">{candidate.platform}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button type="button" disabled={!hasCompleteSelection} onClick={() => { setError(""); setIsReviewOpen(true); }} className="h-12 rounded-sm bg-[#005a36] px-6 text-sm font-bold text-white transition hover:bg-[#003d28] disabled:cursor-not-allowed disabled:bg-[#aab8af]">Review and submit ballot</button>
        </div>
      )}
      {isReviewOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10251b]/65 p-4 backdrop-blur-[2px]">
        <section role="dialog" aria-modal="true" aria-labelledby="review-ballot-title" className="my-auto w-full max-w-lg border border-[#d9e0db] bg-white p-6 shadow-2xl sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Final ballot review</p>
          <h2 id="review-ballot-title" className="display-font mt-3 text-3xl">Check your choices</h2>
          <p className="mt-3 text-sm leading-6 text-[#66736b]">Review your selection for each position. Your choices cannot be changed after submission.</p>
          <ul className="mt-5 divide-y divide-[#e5eae6] border-y border-[#d9e0db]">
            {sortPositions([...groups.entries()]).map(([position, positionCandidates]) => {
              const positionSelection = positionCandidates.filter((item) => selected[position]?.includes(item.id));
              return (
                <li key={position} className="py-3 text-sm">
                  <span className="font-semibold">{position}:</span>{" "}
                  {positionSelection.length > 0
                    ? positionSelection.map((candidate) => candidate.full_name).join(", ")
                    : <span className="italic text-[#66736b]">No selection</span>}
                </li>
              );
            })}
          </ul>
          {error && <p role="alert" className="mt-4 text-sm leading-5 text-[#8c3328]">{error}</p>}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsReviewOpen(false)} className="h-11 border border-[#cfd8d1] px-4 text-sm font-semibold">Back to ballot</button>
            <button type="button" onClick={() => { setError(""); setIsReviewOpen(false); setIsOtpOpen(true); }} className="h-11 bg-[#005a36] px-5 text-sm font-bold text-white hover:bg-[#003d28]">Continue to OTP verification</button>
          </div>
        </section>
      </div>}
      {isOtpOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10251b]/65 p-4 backdrop-blur-[2px]">
        <section role="dialog" aria-modal="true" aria-labelledby="confirm-ballot-title" className="my-auto w-full max-w-lg border border-[#d9e0db] bg-white p-6 shadow-2xl sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Ballot verification</p>
          <h2 id="confirm-ballot-title" className="display-font mt-3 text-3xl">Confirm your vote</h2>
          <p className="mt-3 text-sm leading-6 text-[#66736b]">Enter your Student ID and the 6-digit OTP provided by the election board. Your choices cannot be changed after submission.</p>
          <form className="mt-6 space-y-4" onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = await submitBallot({ lrn, otp, votes: Object.entries(selected).flatMap(([position, candidateIds]) => candidateIds.map((candidate_id) => ({ candidate_id, position }))) });
              if (result.error) { setError(result.error); return; }
              setIsOtpOpen(false);
              router.refresh();
            });
          }}>
            <div>
              <label htmlFor="confirm-lrn" className="mb-2 block text-sm font-semibold">Student ID</label>
              <input id="confirm-lrn" inputMode="numeric" autoComplete="off" placeholder="8-digit Student ID" pattern="[0-9]{8}" maxLength={8} required value={lrn} onChange={(event) => setLrn(event.target.value.replace(/\D/g, "").slice(0, 8))} className="h-12 w-full border border-[#cfd8d1] bg-white px-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
            </div>
            <div>
              <label htmlFor="confirm-otp" className="mb-2 block text-sm font-semibold">6-digit one-time password</label>
              <input id="confirm-otp" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} pattern="[0-9]{6}" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="h-12 w-full border border-[#cfd8d1] bg-white px-3 text-sm tabular-nums tracking-[0.3em] outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
            </div>
            {error && <p role="alert" className="text-sm leading-5 text-[#8c3328]">{error}</p>}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setIsOtpOpen(false); setIsReviewOpen(true); }} className="h-11 border border-[#cfd8d1] px-4 text-sm font-semibold">Back to ballot review</button>
              <button type="submit" disabled={isPending} className="h-11 bg-[#005a36] px-5 text-sm font-bold text-white hover:bg-[#003d28] disabled:cursor-wait disabled:opacity-60">{isPending ? "Submitting…" : "Confirm vote"}</button>
            </div>
          </form>
        </section>
      </div>}
    </>
  );
}