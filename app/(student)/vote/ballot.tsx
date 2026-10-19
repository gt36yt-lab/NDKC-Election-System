"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [lrn, setLrn] = useState("");
  const [otp, setOtp] = useState("");
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.position) ?? [];
    group.push(candidate);
    groups.set(candidate.position, group);
  }

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
      ) : !termsAccepted ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10251b]/65 p-4 backdrop-blur-[2px]">
          <section role="dialog" aria-modal="true" aria-labelledby="voting-terms-title" className="my-auto w-full max-w-lg border border-[#d9e0db] bg-white p-6 shadow-2xl sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Before you vote</p>
            <h2 id="voting-terms-title" className="display-font mt-2 text-2xl">Terms &amp; Conditions</h2>
            <p className="mt-4 text-sm leading-6 text-[#4e5b53]">By using the SSLG E-Voting System, you agree to participate honestly and responsibly. Your account is for your personal use; do not share your login credentials or submit more than one ballot. Your vote is confidential and will be used only for this election.</p>
            <label className="mt-5 flex cursor-pointer items-start gap-3 border-y border-[#e4e9e5] py-4 text-sm leading-5">
              <input type="checkbox" checked={termsChecked} onChange={(event) => setTermsChecked(event.target.checked)} className="mt-0.5 size-4 accent-[#005a36]" />
              <span>I agree with the terms and conditions</span>
            </label>
            <button type="button" disabled={!termsChecked} onClick={() => setTermsAccepted(true)} className="mt-5 h-11 bg-[#005a36] px-5 text-sm font-bold text-white hover:bg-[#003d28] disabled:cursor-not-allowed disabled:bg-[#aab8af]">Continue to ballot</button>
          </section>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {[...groups.entries()].map(([position, positionCandidates]) => (
            <fieldset key={position} className="border-y border-[#d9e0db] bg-white/80 px-5 py-6 sm:px-8">
              <legend className="display-font px-2 text-2xl">{position}</legend>
              <div className="divide-y divide-[#e5eae6]">
                {positionCandidates.map((candidate) => (
                  <label key={candidate.id} className="flex cursor-pointer items-start gap-4 py-5">
                    <input type="radio" name={`position-${position}`} value={candidate.id} checked={selected[position] === candidate.id} onChange={() => setSelected((current) => ({ ...current, [position]: candidate.id }))} className="mt-1 size-4 shrink-0 accent-[#005a36]" />
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
          <button type="button" disabled={Object.keys(selected).length === 0} onClick={() => { setError(""); setIsModalOpen(true); }} className="h-12 rounded-sm bg-[#005a36] px-6 text-sm font-bold text-white transition hover:bg-[#003d28] disabled:cursor-not-allowed disabled:bg-[#aab8af]">Review and submit ballot</button>
        </div>
      )}
      {isModalOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10251b]/65 p-4 backdrop-blur-[2px]">
        <section role="dialog" aria-modal="true" aria-labelledby="confirm-ballot-title" className="my-auto w-full max-w-lg border border-[#d9e0db] bg-white p-6 shadow-2xl sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Final confirmation</p>
          <h2 id="confirm-ballot-title" className="display-font mt-3 text-3xl">Verify your ballot</h2>
          <p className="mt-3 text-sm leading-6 text-[#66736b]">Enter your LRN and the OTP provided by the election board. Your choices cannot be changed after submission.</p>
          <form className="mt-6 space-y-4" onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = await submitBallot({ lrn, otp, votes: Object.entries(selected).map(([position, candidate_id]) => ({ candidate_id, position })) });
              if (result.error) { setError(result.error); return; }
              setIsModalOpen(false);
              router.refresh();
            });
          }}>
            <div>
              <label htmlFor="confirm-lrn" className="mb-2 block text-sm font-semibold">Learner Reference Number</label>
              <input id="confirm-lrn" inputMode="numeric" autoComplete="off" required value={lrn} onChange={(event) => setLrn(event.target.value)} className="h-12 w-full border border-[#cfd8d1] bg-white px-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
            </div>
            <div>
              <label htmlFor="confirm-otp" className="mb-2 block text-sm font-semibold">One-time password</label>
              <input id="confirm-otp" autoComplete="one-time-code" required value={otp} onChange={(event) => setOtp(event.target.value)} className="h-12 w-full border border-[#cfd8d1] bg-white px-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
            </div>
            {error && <p role="alert" className="text-sm leading-5 text-[#8c3328]">{error}</p>}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setIsModalOpen(false)} className="h-11 border border-[#cfd8d1] px-4 text-sm font-semibold">Back to ballot</button>
              <button type="submit" disabled={isPending} className="h-11 bg-[#005a36] px-5 text-sm font-bold text-white hover:bg-[#003d28] disabled:cursor-wait disabled:opacity-60">{isPending ? "Submitting…" : "Confirm vote"}</button>
            </div>
          </form>
        </section>
      </div>}
    </>
  );
}