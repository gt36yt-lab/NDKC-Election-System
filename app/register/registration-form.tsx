"use client";

import Link from "next/link";
import { useState } from "react";

const fieldClass = "h-12 w-full rounded-sm border border-[#cfd8d1] bg-white px-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15";

export default function RegistrationForm() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.get("studentId"),
          fullName: form.get("fullName"),
          email: form.get("email"),
          password,
          gradeLevel: form.get("gradeLevel"),
          section: form.get("section"),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Registration could not be completed.");
      window.location.assign("/login?registered=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration could not be completed.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void register(event)} className="mt-8 space-y-5">
      <label className="block text-sm font-semibold">Student ID
        <input name="studentId" inputMode="numeric" autoComplete="off" pattern="[0-9]{8}" maxLength={8} placeholder="8-digit Student ID" required className={`${fieldClass} mt-2`} />
      </label>
      <label className="block text-sm font-semibold">Full name
        <input name="fullName" autoComplete="name" placeholder="Last Name, First Name" maxLength={120} required className={`${fieldClass} mt-2`} />
      </label>
      <label className="block text-sm font-semibold">Email address
        <input name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required className={`${fieldClass} mt-2`} />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Password
          <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className={`${fieldClass} mt-2`} />
        </label>
        <label className="block text-sm font-semibold">Confirm password
          <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className={`${fieldClass} mt-2`} />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Grade level
          <select name="gradeLevel" defaultValue="" required className={`${fieldClass} mt-2`}>
            <option value="" disabled>Select grade</option>
            {[7, 8, 9, 10, 11, 12].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Section
          <input name="section" autoComplete="off" maxLength={80} required className={`${fieldClass} mt-2`} />
        </label>
      </div>
      {error && <p role="alert" className="border-l-2 border-[#b84a3a] bg-[#fbf0ee] px-3 py-2 text-sm leading-5 text-[#8c3328]">{error}</p>}
      <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-sm bg-[#005a36] px-4 text-sm font-bold text-white transition hover:bg-[#003d28] disabled:cursor-wait disabled:opacity-60">
        {isSubmitting ? "Creating account…" : "Create student account"}
      </button>
      <p className="text-center text-sm text-[#66736b]">Already registered? <Link href="/login" className="font-semibold text-[#005a36] underline">Sign in</Link></p>
    </form>
  );
}
