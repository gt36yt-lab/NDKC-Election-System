"use client";

import { useMemo, useState } from "react";
import { Mail, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import StudentImport from "./student-import";
import CandidateManagement from "./candidate-management";

export type AdminStudent = {
  id: string;
  lrn: string;
  email: string | null;
  raw_password: string | null;
  full_name: string;
  grade_level: string | number;
  section: string | null;
  otp_code: string | null;
  has_voted: boolean;
};

export type AdminCandidate = {
  id: string;
  full_name: string;
  position: string;
  party_id: string | null;
  platform: string | null;
  photo_url: string | null;
  allowed_grade_levels: number[] | null;
};

export type AdminParty = { id: string; name: string; description: string | null; logo_url: string | null };

export default function AdminDashboard({ initialStudents, initialCandidates, initialParties }: { initialStudents: AdminStudent[]; initialCandidates: AdminCandidate[]; initialParties: AdminParty[] }) {
  const [students, setStudents] = useState(initialStudents);
  const [query, setQuery] = useState("");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<AdminStudent | null>(null);
  const [editDraft, setEditDraft] = useState({ full_name: "", grade_level: "7", section: "", email: "" });
  const [emailingStudent, setEmailingStudent] = useState<AdminStudent | null>(null);
  const [emailDraft, setEmailDraft] = useState({ recipient: "", subject: "", body: "" });
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"students" | "candidates">("students");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [votingStatusFilter, setVotingStatusFilter] = useState("all");
  const totalVoters = students.length;
  const votedCount = students.filter((student) => student.has_voted).length;
  const turnout = totalVoters === 0 ? 0 : Math.round((votedCount / totalVoters) * 100);
  const sections = useMemo(
    () => [...new Set(students.map((student) => student.section?.trim() || "General"))].sort((left, right) => left.localeCompare(right)),
    [students],
  );
  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesQuery = !normalizedQuery || [student.lrn, student.full_name, String(student.grade_level), student.section?.trim() || "General"].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesGrade = gradeFilter === "all" || String(student.grade_level) === gradeFilter;
      const matchesSection = sectionFilter === "all" || (student.section?.trim() || "General") === sectionFilter;
      const matchesVotingStatus = votingStatusFilter === "all" || student.has_voted === (votingStatusFilter === "voted");
      return matchesQuery && matchesGrade && matchesSection && matchesVotingStatus;
    });
  }, [gradeFilter, query, sectionFilter, students, votingStatusFilter]);

  async function resetOtp(student: AdminStudent) {
    if (resettingId) return;
    setResettingId(student.id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(student.id)}/otp`, { method: "POST" });
      const result = await response.json() as { otp?: string; password?: string; error?: string };
      if (!response.ok || !result.otp || !result.password) throw new Error(result.error ?? "Credentials could not be changed.");
      setStudents((current) => current.map((item) => item.id === student.id ? { ...item, otp_code: result.otp!, raw_password: result.password! } : item));
      setNotice(`A new password and OTP were generated for ${student.full_name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Credentials could not be changed.");
    } finally {
      setResettingId(null);
    }
  }

  async function resetVote(student: AdminStudent) {
    if (!student.has_voted || resettingId) return;
    if (!window.confirm(`Reset ${student.full_name}'s ballot? Their recorded votes will be deleted and they can vote again.`)) return;
    setResettingId(student.id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(student.id)}/reset-vote`, { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Vote could not be reset.");
      setStudents((current) => current.map((item) => item.id === student.id ? { ...item, has_voted: false } : item));
      setNotice(`The ballot for ${student.full_name} was reset.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Vote could not be reset.");
    } finally {
      setResettingId(null);
    }
  }

  function openEmailDraft(student: AdminStudent) {
    setEmailingStudent(student);
    setEmailDraft({
      recipient: student.email ?? "",
      subject: "Your SSLG E-Voting credentials",
      body: `Hello ${student.full_name},\n\nYour SSLG E-Voting sign-in details are below.\n\nLRN: ${student.lrn}\nPassword: ${student.raw_password ?? "Not assigned. Ask the administrator to reset OTP / Password."}\nOTP: ${student.otp_code ?? "Not assigned. Ask the administrator to reset OTP / Password."}\n\nKeep these credentials private.`,
    });
  }

  async function sendCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailingStudent || rowActionId) return;
    const student = emailingStudent;
    setRowActionId(student.id);
    setNotice("");
    try {
      const response = await fetch("/api/admin/send-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, recipient_email: emailDraft.recipient, subject: emailDraft.subject, text: emailDraft.body }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Email could not be sent.");
      setEmailingStudent(null);
      setNotice(`Credentials sent to ${emailDraft.recipient}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Email could not be sent.");
    } finally {
      setRowActionId(null);
    }
  }

  async function saveStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStudent || rowActionId) return;
    const student = editingStudent;
    setRowActionId(student.id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(student.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editDraft, grade_level: Number(editDraft.grade_level) }),
      });
      const result = await response.json() as { student?: AdminStudent; error?: string };
      if (!response.ok || !result.student) throw new Error(result.error ?? "Student could not be updated.");
      setStudents((current) => current.map((item) => item.id === student.id ? result.student! : item));
      setEditingStudent(null);
      setNotice(`${student.full_name}'s record was updated.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Student could not be updated.");
    } finally {
      setRowActionId(null);
    }
  }

  async function deleteStudent(student: AdminStudent) {
    if (!window.confirm(`Delete ${student.full_name}'s student and sign-in accounts? This cannot be undone.`)) return;
    setRowActionId(student.id);
    setNotice("");
    try {
      const response = await fetch("/api/admin/delete-student", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: student.id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Student could not be deleted.");
      setStudents((current) => current.filter((item) => item.id !== student.id));
      setNotice(`${student.full_name} was deleted.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Student could not be deleted.");
    } finally {
      setRowActionId(null);
    }
  }

  return (
    <main className="page-enter mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#cfd8d1] pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Electoral board</p>
          <h1 className="display-font mt-2 text-4xl">Voter administration</h1>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#66736b]">Restricted access</p>
      </header>

      <section aria-label="Voter turnout" className="mt-7 grid gap-0 border-y border-[#cfd8d1] bg-white/80 sm:grid-cols-3">
        <div className="border-b border-[#d9e0db] px-5 py-5 sm:border-b-0 sm:border-r"><p className="text-xs font-bold uppercase tracking-wide text-[#66736b]">Registered students</p><p className="mt-2 text-3xl font-semibold tabular-nums">{totalVoters}</p></div>
        <div className="border-b border-[#d9e0db] px-5 py-5 sm:border-b-0 sm:border-r"><p className="text-xs font-bold uppercase tracking-wide text-[#66736b]">Ballots recorded</p><p className="mt-2 text-3xl font-semibold tabular-nums">{votedCount}</p></div>
        <div className="px-5 py-5"><p className="text-xs font-bold uppercase tracking-wide text-[#66736b]">Voter turnout</p><p className="mt-2 text-3xl font-semibold tabular-nums">{turnout}%</p></div>
      </section>

      <div role="tablist" aria-label="Admin sections" className="mt-8 flex border-b border-[#cfd8d1]">
        <button type="button" role="tab" aria-selected={activeTab === "students"} onClick={() => setActiveTab("students")} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "students" ? "border-[#005a36] text-[#005a36]" : "border-transparent text-[#66736b]"}`}>Students</button>
        <button type="button" role="tab" aria-selected={activeTab === "candidates"} onClick={() => setActiveTab("candidates")} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "candidates" ? "border-[#005a36] text-[#005a36]" : "border-transparent text-[#66736b]"}`}>Candidates &amp; parties</button>
      </div>

      {activeTab === "students" ? <>
      <StudentImport onImported={(imported) => setStudents((current) => {
        const merged = new Map(current.map((student) => [student.lrn, student]));
        for (const student of imported) merged.set(student.lrn, student);
        return [...merged.values()];
      })} />
      <section className="mt-10" aria-labelledby="student-records-title">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#cfd8d1] pb-4">
          <div>
            <h2 id="student-records-title" className="display-font text-2xl">Registered students</h2>
            <p className="mt-1 text-xs text-[#66736b]">{filteredStudents.length} of {students.length} records</p>
          </div>
          <label className="relative block w-full sm:w-80">
            <span className="sr-only">Search students</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#66736b]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search LRN, name, or grade" className="h-11 w-full border border-[#cfd8d1] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-[#d9e0db] py-3">
          <label htmlFor="student-grade-filter" className="text-xs font-semibold text-[#4e5b53]">Grade level</label>
          <select id="student-grade-filter" value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="h-10 border border-[#cfd8d1] bg-white px-3 text-sm">
            <option value="all">All Grades</option>
            {[7, 8, 9, 10, 11, 12].map((grade) => <option key={grade} value={String(grade)}>Grade {grade}</option>)}
          </select>
          <label htmlFor="student-section-filter" className="text-xs font-semibold text-[#4e5b53]">Section</label>
          <select id="student-section-filter" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className="h-10 min-w-40 border border-[#cfd8d1] bg-white px-3 text-sm">
            <option value="all">All Sections</option>
            {sections.map((section) => <option key={section} value={section}>{section}</option>)}
          </select>
          <label htmlFor="student-voting-status-filter" className="text-xs font-semibold text-[#4e5b53]">Voting status</label>
          <select id="student-voting-status-filter" value={votingStatusFilter} onChange={(event) => setVotingStatusFilter(event.target.value)} className="h-10 border border-[#cfd8d1] bg-white px-3 text-sm">
            <option value="all">All Statuses</option>
            <option value="voted">Voted</option>
            <option value="not-voted">Not Voted</option>
          </select>
        </div>
        {notice && <p role="status" className="border-b border-[#d9e0db] bg-[#e5f0e9] px-4 py-3 text-sm text-[#174b32]">{notice}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#cfd8d1] text-xs uppercase tracking-wide text-[#66736b]">
                <th scope="col" className="px-3 py-3 font-bold">LRN</th>
                <th scope="col" className="px-3 py-3 font-bold">Full name</th>
                <th scope="col" className="px-3 py-3 font-bold">Email</th>
                <th scope="col" className="px-3 py-3 font-bold">Password</th>
                <th scope="col" className="px-3 py-3 font-bold">Grade</th>
                <th scope="col" className="px-3 py-3 font-bold">Section</th>
                <th scope="col" className="px-3 py-3 font-bold">OTP code</th>
                <th scope="col" className="px-3 py-3 font-bold">Voting status</th>
                <th scope="col" className="px-3 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} className="border-b border-[#e5eae6] bg-white/70">
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{student.lrn}</td>
                  <td className="px-3 py-3 font-medium">{student.full_name}</td>
                  <td className="px-3 py-3">{student.email ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{student.raw_password ?? "—"}</td>
                  <td className="px-3 py-3 tabular-nums">{student.grade_level}</td>
                  <td className="px-3 py-3">{student.section || "General"}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{student.otp_code ?? "—"}</td>
                  <td className="px-3 py-3"><span className={student.has_voted ? "font-semibold text-[#005a36]" : "text-[#66736b]"}>{student.has_voted ? "Voted" : "Pending"}</span></td>
                  <td className="px-3 py-3 text-right"><div className="flex justify-end gap-2">
                    <button type="button" disabled={rowActionId !== null} onClick={() => openEmailDraft(student)} className="inline-flex h-9 items-center gap-1.5 border border-[#cfd8d1] px-2.5 text-xs font-semibold hover:border-[#005a36] hover:text-[#005a36] disabled:opacity-50"><Mail aria-hidden="true" className="size-3.5" />Send Email</button>
                    <button type="button" disabled={rowActionId !== null} onClick={() => { setEditingStudent(student); setEditDraft({ full_name: student.full_name, grade_level: String(student.grade_level), section: student.section ?? "", email: student.email ?? "" }); }} aria-label={`Edit ${student.full_name}`} className="grid size-9 place-items-center border border-[#cfd8d1] hover:border-[#005a36] hover:text-[#005a36] disabled:opacity-50"><Pencil aria-hidden="true" className="size-4" /></button>
                    <button type="button" disabled={rowActionId !== null} onClick={() => void deleteStudent(student)} aria-label={`Delete ${student.full_name}`} className="grid size-9 place-items-center border border-[#d9e0db] text-[#8c3328] hover:bg-[#fbf0ee] disabled:opacity-50"><Trash2 aria-hidden="true" className="size-4" /></button>
                    {student.has_voted && <button type="button" disabled={resettingId !== null} onClick={() => void resetVote(student)} aria-label={`Reset vote for ${student.full_name}`} className="inline-flex h-9 items-center justify-center border border-[#b84a3a] px-3 text-xs font-semibold text-[#8c3328] transition hover:bg-[#fbf0ee] disabled:cursor-wait disabled:opacity-50">Reset vote</button>}
                    <button type="button" disabled={resettingId !== null} onClick={() => void resetOtp(student)} title="Generate a new OTP and password" aria-label={`Reset OTP and password for ${student.full_name}`} className="inline-flex h-9 items-center justify-center gap-2 border border-[#cfd8d1] px-3 text-xs font-semibold transition hover:border-[#005a36] hover:text-[#005a36] disabled:cursor-not-allowed disabled:opacity-50">
                      <RefreshCw aria-hidden="true" className={`size-3.5 ${resettingId === student.id ? "animate-spin" : ""}`} />
                      Reset OTP / Password
                    </button>
                  </div></td>
                </tr>
              ))}
              {filteredStudents.length === 0 && <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-[#66736b]">No matching students.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {editingStudent && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10251b]/65 p-4">
        <form onSubmit={(event) => void saveStudent(event)} className="my-auto w-full max-w-lg border border-[#d9e0db] bg-white p-6 shadow-2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="edit-student-title">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Student record</p>
          <h2 id="edit-student-title" className="display-font mt-2 text-2xl">Edit student</h2>
          <div className="mt-5 space-y-4">
            <label className="block text-xs font-semibold">Full name<input required maxLength={120} value={editDraft.full_name} onChange={(event) => setEditDraft((current) => ({ ...current, full_name: event.target.value }))} className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm" /></label>
            <label className="block text-xs font-semibold">Grade level<select value={editDraft.grade_level} onChange={(event) => setEditDraft((current) => ({ ...current, grade_level: event.target.value }))} className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm">{[7, 8, 9, 10, 11, 12].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label>
            <label className="block text-xs font-semibold">Section<input maxLength={80} value={editDraft.section} onChange={(event) => setEditDraft((current) => ({ ...current, section: event.target.value }))} className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm" /></label>
            <label className="block text-xs font-semibold">Email<input required type="email" value={editDraft.email} onChange={(event) => setEditDraft((current) => ({ ...current, email: event.target.value }))} className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm" /></label>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" disabled={rowActionId !== null} onClick={() => setEditingStudent(null)} className="h-10 border border-[#cfd8d1] px-4 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={rowActionId !== null} className="h-10 bg-[#005a36] px-5 text-sm font-bold text-white disabled:opacity-50">{rowActionId === editingStudent.id ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      </div>}
      {emailingStudent && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10251b]/65 p-4">
        <form onSubmit={(event) => void sendCredentials(event)} className="my-auto w-full max-w-2xl border border-[#d9e0db] bg-white p-6 shadow-2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="credential-email-title">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Credential delivery</p>
          <h2 id="credential-email-title" className="display-font mt-2 text-2xl">Review email to {emailingStudent.full_name}</h2>
          <div className="mt-5 space-y-4">
            <label className="block text-xs font-semibold">Recipient email<input required type="email" value={emailDraft.recipient} onChange={(event) => setEmailDraft((current) => ({ ...current, recipient: event.target.value }))} className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm" /></label>
            <label className="block text-xs font-semibold">Subject line<input required maxLength={200} value={emailDraft.subject} onChange={(event) => setEmailDraft((current) => ({ ...current, subject: event.target.value }))} className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm" /></label>
            <label className="block text-xs font-semibold">Email body<textarea required maxLength={10000} rows={10} value={emailDraft.body} onChange={(event) => setEmailDraft((current) => ({ ...current, body: event.target.value }))} className="mt-2 w-full border border-[#cfd8d1] bg-white px-3 py-2 text-sm leading-5" /></label>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" disabled={rowActionId !== null} onClick={() => setEmailingStudent(null)} className="h-10 border border-[#cfd8d1] px-4 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={rowActionId !== null} className="h-10 bg-[#005a36] px-5 text-sm font-bold text-white disabled:opacity-50">{rowActionId === emailingStudent.id ? "Sending…" : "Confirm & Send"}</button>
          </div>
        </form>
      </div>}
      </> : <CandidateManagement initialCandidates={initialCandidates} initialParties={initialParties} />}
    </main>
  );
}