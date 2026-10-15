"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TermsGate({ hasAgreed, studentId, children }: { hasAgreed: boolean; studentId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function acceptTerms() {
    if (!checked) return;
    setIsSaving(true);
    setError("");
    const { error: updateError } = await createClient()
      .from("students")
      .update({ has_agreed_terms: true })
      .eq("id", studentId);

    if (updateError) {
      setError("We couldn't save your agreement. Please try again or contact the election board.");
      setIsSaving(false);
      return;
    }

    router.refresh();
  }

  return (
    <>
      {children}
      {!hasAgreed && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10251b]/65 p-4 backdrop-blur-[2px]" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="terms-title" className="my-auto w-full max-w-lg rounded-md border border-[#d9e0db] bg-white p-6 shadow-2xl sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Before you continue</p>
          <h1 id="terms-title" className="display-font mt-3 text-3xl">Terms &amp; Conditions</h1>
          <p className="mt-5 text-sm leading-6 text-[#4e5b53]">By using the SSLG E-Voting System, you agree to participate in the school election honestly and responsibly. Your account is for your personal use; do not share your login credentials or attempt to submit more than one ballot. Your vote is confidential and will be used only for this election.</p>
          <label className="mt-6 flex cursor-pointer items-start gap-3 border-y border-[#e4e9e5] py-4 text-sm leading-5">
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="mt-0.5 size-4 accent-[#005a36]" />
            <span>I agree with the terms and conditions</span>
          </label>
          {error && <p role="alert" className="mt-4 text-sm text-[#9a382c]">{error}</p>}
          <button type="button" disabled={!checked || isSaving} onClick={acceptTerms} className="mt-5 h-12 w-full rounded-sm bg-[#005a36] px-4 text-sm font-bold text-white transition hover:bg-[#003d28] disabled:cursor-not-allowed disabled:bg-[#aab8af]">{isSaving ? "Saving agreement…" : "Agree and continue"}</button>
        </section>
      </div>}
    </>
  );
}