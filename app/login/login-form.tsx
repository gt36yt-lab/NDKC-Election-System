"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

const STUDENT_EMAIL_DOMAIN = "students.ndkc.invalid";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lrn, setLrn] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isSupabaseConfigured()) {
      setError("The student portal is not configured yet. Add the Supabase URL and public key to .env.local.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: `${lrn.trim()}@${STUDENT_EMAIL_DOMAIN}`,
      password,
    });

    if (signInError) {
      setError("We couldn't sign you in. Check your LRN and assigned password.");
      setIsLoading(false);
      return;
    }

    const nextPath = searchParams.get("next");
    router.replace(nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/vote");
    router.refresh();
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="lrn" className="mb-2 block text-sm font-semibold">Learner Reference Number</label>
        <input id="lrn" inputMode="numeric" autoComplete="username" required value={lrn} onChange={(event) => setLrn(event.target.value)} className="h-12 w-full rounded-sm border border-[#cfd8d1] bg-white px-3 text-sm outline-none transition focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-semibold">Assigned password</label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-sm border border-[#cfd8d1] bg-white px-3 text-sm outline-none transition focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
      </div>
      {error && <p role="alert" className="border-l-2 border-[#b84a3a] bg-[#fbf0ee] px-3 py-2 text-sm leading-5 text-[#8c3328]">{error}</p>}
      <button type="submit" disabled={isLoading} className="flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-[#005a36] px-4 text-sm font-bold text-white transition hover:bg-[#003d28] disabled:cursor-wait disabled:opacity-60">
        {isLoading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs leading-5 text-[#66736b]">Your account is issued by the school election board.</p>
    </form>
  );
}