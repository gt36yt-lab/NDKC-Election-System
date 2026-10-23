import Link from "next/link";
import RegistrationForm from "./registration-form";

export default function RegisterPage() {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-md border border-[#d9e0db] bg-white shadow-[0_18px_60px_rgba(0,61,40,0.09)]">
        <header className="school-background-panel px-6 py-8 text-white sm:px-10">
          <Link href="/login" className="school-logo-placeholder grid size-12 place-items-center border border-white/60" role="img" aria-label="Notre Dame of Kidapawan College logo" />
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#f1d989]">Student portal</p>
          <h1 className="display-font mt-2 text-3xl sm:text-4xl">Create your account</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">Register to access the NDKC SSLG E-Voting System.</p>
        </header>
        <section className="px-6 py-8 sm:px-10">
          <RegistrationForm />
        </section>
      </div>
    </main>
  );
}
