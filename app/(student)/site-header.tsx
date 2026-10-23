"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/candidates", label: "CANDIDATES" },
  { href: "/teams", label: "TEAMS" },
  { href: "/results", label: "RESULTS" },
];

export default function SiteHeader({ studentId, studentName, hasVoted = false }: { studentId?: string; studentName?: string | null; hasVoted?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [voted, setVoted] = useState(hasVoted);

  useEffect(() => {
    setVoted(hasVoted);
  }, [hasVoted]);

  useEffect(() => {
    if (!studentId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`student-vote-status-${studentId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "students", filter: `id=eq.${studentId}` }, (payload) => {
        if (typeof payload.new.has_voted === "boolean") setVoted(payload.new.has_voted);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [studentId]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="bg-[#005a36] text-white shadow-[0_2px_12px_rgba(0,61,40,0.14)]">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/candidates" className="flex shrink-0 items-center gap-2.5" aria-label="NDKC SSLG home">
          <span role="img" aria-label="Notre Dame of Kidapawan College logo" className="school-logo-placeholder grid size-9 place-items-center border border-white/60" />
          <span className="hidden text-xs font-bold uppercase tracking-[0.13em] sm:block">SSLG E-Voting</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-3">
          {links.map((link) => {
            const active = pathname === link.href;
            return <Link key={link.href} href={link.href} prefetch aria-current={active ? "page" : undefined} className={`rounded-sm px-2 py-2 text-[10px] font-bold tracking-[0.08em] transition sm:px-3 sm:text-xs ${active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{link.label}</Link>;
          })}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {studentName && <span className="max-w-36 truncate text-xs text-white/75">{studentName}</span>}
          {studentName && (voted ? <span role="status" aria-live="polite" className="whitespace-nowrap border border-[#b7dfc3] bg-[#dff1e4] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#174b32]">Voted</span> : <Link href="/vote" className="inline-flex h-9 items-center gap-2 whitespace-nowrap bg-[#f1d989] px-3 text-xs font-bold text-[#193d2b] transition hover:bg-white">Vote Now<ArrowRight aria-hidden="true" className="size-4" /></Link>)}
          <button type="button" onClick={signOut} title="Sign out" aria-label="Sign out" className="grid size-9 place-items-center rounded-sm text-white/80 transition hover:bg-white/10 hover:text-white"><LogOut size={16} /></button>
        </div>
      </div>
      {studentName && <div className="flex items-center justify-end gap-2 px-4 pb-3 md:hidden">
        <span className="max-w-40 truncate text-xs text-white/75">{studentName}</span>
        {voted ? <span role="status" aria-live="polite" className="whitespace-nowrap border border-[#b7dfc3] bg-[#dff1e4] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#174b32]">Voted</span> : <Link href="/vote" className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap bg-[#f1d989] px-2.5 text-[10px] font-bold text-[#193d2b]">Vote Now<ArrowRight aria-hidden="true" className="size-3.5" /></Link>}
        <button type="button" onClick={signOut} title="Sign out" aria-label="Sign out" className="grid size-8 place-items-center text-white/80 transition hover:bg-white/10 hover:text-white"><LogOut size={15} /></button>
      </div>}
    </header>
  );
}