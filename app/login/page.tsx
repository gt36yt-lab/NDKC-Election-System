import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f3f5f3] px-5 py-10 sm:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-md border border-[#d9e0db] bg-white shadow-[0_18px_60px_rgba(0,61,40,0.09)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="school-background-panel relative flex min-h-64 flex-col justify-between overflow-hidden p-8 text-white sm:p-12 lg:min-h-[640px]">
          <div className="absolute inset-0 opacity-20" aria-hidden="true">
            <div className="absolute -right-20 top-20 h-72 w-72 rounded-full border border-white/60" />
            <div className="absolute -right-8 top-32 h-72 w-72 rounded-full border border-white/40" />
            <div className="absolute -bottom-24 -left-12 h-80 w-80 rounded-full border border-white/30" />
          </div>
          <div className="relative flex items-center gap-3">
            <div aria-hidden="true" className="school-logo-placeholder grid size-12 place-items-center border border-white/60 text-sm font-bold tracking-wide">NDKC</div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">Student elections</div>
          </div>
          <div className="relative max-w-lg py-10">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#f1d989]">Your voice. Your school.</p>
            <h1 className="display-font text-4xl leading-[1.08] sm:text-5xl">Choose the leaders who move us forward.</h1>
            <p className="mt-6 max-w-md text-sm leading-6 text-white/75">A secure space for NDKC students to learn about candidates and take part in the SSLG election.</p>
          </div>
          <p className="relative text-xs text-white/65">NDKC · SSLG E-Voting System</p>
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Student portal</p>
            <h2 className="display-font mt-3 text-3xl">Sign in to continue</h2>
            <p className="mt-2 text-sm leading-6 text-[#66736b]">Use the Student ID and assigned password provided by your school.</p>
            <Suspense fallback={<div className="mt-8 h-56 animate-pulse rounded bg-[#f3f5f3]" />}>
              <LoginForm />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}