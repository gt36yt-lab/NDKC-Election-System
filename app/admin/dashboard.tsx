"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StudentImport from "./student-import";
import CandidateManagement from "./candidate-management";

export type AdminStudent = {
  id: string;
  lrn: string;
  role: string;
  full_name: string;
  email: string | null;
  status: string;
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
  image_url: string | null;
  allowed_grade_levels: number[] | null;
  division?: string | null;
  manifesto?: string | null;
  photo_url?: string | null;
};

export type AdminParty = { id: string; name: string; description: string | null };
export type AdminElectionSettings = { status: "scheduled" | "active" | "ended" | "cancelled"; start_time: string | null; end_time: string | null };

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fromDateTimeInput(value: FormDataEntryValue | null) {
  return typeof value === "string" && value ? new Date(value).toISOString() : null;
}

export default function AdminDashboard({ initialStudents, initialCandidates, initialParties, initialElectionSettings, currentAdminId }: { initialStudents: AdminStudent[]; initialCandidates: AdminCandidate[]; initialParties: AdminParty[]; initialElectionSettings: AdminElectionSettings; currentAdminId: string }) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [query, setQuery] = useState("");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<AdminStudent | null>(null);
  const [editError, setEditError] = useState("");
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"students" | "approvals" | "election" | "candidates">("students");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [votingStatusFilter, setVotingStatusFilter] = useState("all");
  const [electionSettings, setElectionSettings] = useState(initialElectionSettings);
  const [isSavingElectionSettings, setIsSavingElectionSettings] = useState(false);
  const [isResettingElection, setIsResettingElection] = useState(false);
  const [resetType, setResetType] = useState<"soft" | "hard" | null>(null);
  const [electionMessage, setElectionMessage] = useState<{ text: string; error: boolean } | null>(null);
  useEffect(() => {
    setStudents(initialStudents);
    setElectionSettings(initialElectionSettings);
  }, [initialElectionSettings, initialStudents]);

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
      const matchesQuery = !normalizedQuery || [student.lrn, student.full_name, student.email ?? "", String(student.grade_level), student.section?.trim() || "General"].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesGrade = gradeFilter === "all" || String(student.grade_level) === gradeFilter;
      const matchesSection = sectionFilter === "all" || (student.section?.trim() || "General") === sectionFilter;
      const matchesVotingStatus = votingStatusFilter === "all" || student.has_voted === (votingStatusFilter === "voted");
      return matchesQuery && matchesGrade && matchesSection && matchesVotingStatus;
    });
  }, [gradeFilter, query, sectionFilter, students, votingStatusFilter]);

  async function resetOtp(student: AdminStudent) {
    if (student.has_voted || resettingId) return;
    setResettingId(student.id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(student.id)}/otp`, { method: "POST" });
      const result = await response.json() as { otp?: string; error?: string };
      if (!response.ok || !result.otp) throw new Error(result.error ?? "OTP could not be changed.");
      setStudents((current) => current.map((item) => item.id === student.id ? { ...item, otp_code: result.otp! } : item));
      setNotice(`A new OTP was generated for ${student.full_name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "OTP could not be changed.");
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

  async function toggleRole(student: AdminStudent) {
    if (resettingId || isSavingStudent || (student.id === currentAdminId && student.role === "admin")) return;
    const role = student.role === "admin" ? "student" : "admin";
    const action = role === "admin" ? "promote" : "demote";
    if (!window.confirm(`Are you sure you want to ${action} ${student.full_name} ${role === "admin" ? "to Admin" : "to Student"}?`)) return;

    setResettingId(student.id);
    setNotice("");
    try {
      const response = await fetch("/api/admin/toggle-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, role }),
      });
      const result = await response.json() as { role?: string; error?: string };
      if (!response.ok || !result.role) throw new Error(result.error ?? "Student role could not be updated.");
      setStudents((current) => current.map((item) => item.id === student.id ? { ...item, role: result.role! } : item));
      setNotice(`${student.full_name} is now ${result.role === "admin" ? "an Admin" : "a Student"}.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Student role could not be updated.");
    } finally {
      setResettingId(null);
    }
  }

  async function updateApproval(student: AdminStudent, status: "approved" | "rejected") {
    if (resettingId || isSavingStudent) return;
    if (status === "rejected" && !window.confirm(`Reject the registration for ${student.full_name}?`)) return;

    setResettingId(student.id);
    setNotice("");
    try {
      const response = await fetch("/api/admin/approve-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, status }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Registration status could not be updated.");
      setStudents((current) => current.map((item) => item.id === student.id ? { ...item, status } : item));
      setNotice(`${student.full_name}'s registration was ${status}.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Registration status could not be updated.");
    } finally {
      setResettingId(null);
    }
  }

  async function approveAllPending() {
    if (resettingId || isSavingStudent) return;
    const pending = students.filter((student) => student.status === "pending");
    if (pending.length === 0 || !window.confirm(`Approve all ${pending.length} pending registrations?`)) return;

    setResettingId("all-pending");
    setNotice("");
    try {
      const response = await fetch("/api/admin/approve-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approveAll: true }),
      });
      const result = await response.json() as { studentIds?: string[]; error?: string };
      if (!response.ok || !result.studentIds) throw new Error(result.error ?? "Pending registrations could not be approved.");
      const approvedIds = new Set(result.studentIds);
      setStudents((current) => current.map((student) => approvedIds.has(student.id) ? { ...student, status: "approved" } : student));
      setNotice(`${result.studentIds.length} registration${result.studentIds.length === 1 ? " was" : "s were"} approved.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Pending registrations could not be approved.");
    } finally {
      setResettingId(null);
    }
  }

  async function saveElectionSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingElectionSettings) return;
    const form = new FormData(event.currentTarget);
    setIsSavingElectionSettings(true);
    setElectionMessage(null);
    try {
      const response = await fetch("/api/admin/election-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: electionSettings.status,
          start_time: fromDateTimeInput(form.get("start_time")),
          end_time: fromDateTimeInput(form.get("end_time")),
        }),
      });
      const result = await response.json() as { settings?: AdminElectionSettings; error?: string };
      if (!response.ok || !result.settings) throw new Error(result.error ?? "Election schedule could not be saved.");
      setElectionSettings(result.settings);
      setElectionMessage({ text: "Election schedule saved.", error: false });
    } catch (cause) {
      setElectionMessage({ text: cause instanceof Error ? cause.message : "Election schedule could not be saved.", error: true });
    } finally {
      setIsSavingElectionSettings(false);
    }
  }

  async function setElectionStatus(status: AdminElectionSettings["status"]) {
    if (isSavingElectionSettings) return;
    if (status === "cancelled" && !window.confirm("Cancel this election immediately? Voting will stop.")) return;
    setIsSavingElectionSettings(true);
    setElectionMessage(null);
    try {
      const response = await fetch("/api/admin/election-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { settings?: AdminElectionSettings; error?: string };
      if (!response.ok || !result.settings) throw new Error(result.error ?? "Election status could not be updated.");
      setElectionSettings(result.settings);
      setElectionMessage({ text: `Election status set to ${status}.`, error: false });
    } catch (cause) {
      setElectionMessage({ text: cause instanceof Error ? cause.message : "Election status could not be updated.", error: true });
    } finally {
      setIsSavingElectionSettings(false);
    }
  }

  async function resetElection() {
    if (!resetType || isResettingElection) return;
    setIsResettingElection(true);
    setElectionMessage(null);
    try {
      const response = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: resetType }),
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error ?? "The election system could not be reset.");

      const resetLabel = resetType === "soft" ? "Votes and OTPs were reset. Candidates and parties were kept." : "The full election system was reset, including candidates and parties.";
      setElectionMessage({ text: resetLabel, error: false });
      setElectionSettings({ status: "scheduled", start_time: null, end_time: null });
      setResetType(null);
      router.refresh();
    } catch (cause) {
      setElectionMessage({ text: cause instanceof Error ? cause.message : "The election system could not be reset.", error: true });
    } finally {
      setIsResettingElection(false);
    }
  }

  async function saveStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStudent || isSavingStudent) return;
    const form = new FormData(event.currentTarget);
    setIsSavingStudent(true);
    setEditError("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(editingStudent.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.get("fullName"),
          studentId: form.get("studentId"),
          gradeLevel: form.get("gradeLevel"),
          section: form.get("section"),
          email: form.get("email"),
        }),
      });
      const result = await response.json() as { student?: AdminStudent; error?: string };
      if (!response.ok || !result.student) throw new Error(result.error ?? "Student details could not be updated.");
      setStudents((current) => current.map((student) => student.id === result.student!.id ? result.student! : student));
      setNotice(`Student details for ${result.student.full_name} were updated.`);
      setEditingStudent(null);
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : "Student details could not be updated.");
    } finally {
      setIsSavingStudent(false);
    }
  }

  async function deleteStudent(student: AdminStudent) {
    if (resettingId || isSavingStudent) return;
    if (!window.confirm("Are you sure you want to permanently delete this student account?")) return;
    setResettingId(student.id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(student.id)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Student account could not be deleted.");
      setStudents((current) => current.filter((item) => item.id !== student.id));
      setNotice(`The account for ${student.full_name} was permanently deleted.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Student account could not be deleted.");
    } finally {
      setResettingId(null);
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
        <button type="button" role="tab" aria-selected={activeTab === "approvals"} onClick={() => setActiveTab("approvals")} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "approvals" ? "border-[#005a36] text-[#005a36]" : "border-transparent text-[#66736b]"}`}>Pending approvals <span className="ml-1 tabular-nums">{students.filter((student) => student.status === "pending").length}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "election"} onClick={() => setActiveTab("election")} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "election" ? "border-[#005a36] text-[#005a36]" : "border-transparent text-[#66736b]"}`}>Election control</button>
        <button type="button" role="tab" aria-selected={activeTab === "candidates"} onClick={() => setActiveTab("candidates")} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "candidates" ? "border-[#005a36] text-[#005a36]" : "border-transparent text-[#66736b]"}`}>Candidates &amp; parties</button>
      </div>

      {activeTab === "students" ? <>
      <StudentImport onImported={(imported) => setStudents((current) => {
        const merged = new Map(current.map((student) => [student.lrn, student]));
        for (const student of imported) merged.set(student.lrn, { ...student, email: student.email ?? merged.get(student.lrn)?.email ?? null });
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Student ID, name, or grade" className="h-11 w-full border border-[#cfd8d1] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
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
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#cfd8d1] text-xs uppercase tracking-wide text-[#66736b]">
                <th scope="col" className="px-3 py-3 font-bold">Student ID</th>
                <th scope="col" className="px-3 py-3 font-bold">Full name</th>
                <th scope="col" className="px-3 py-3 font-bold">Email</th>
                <th scope="col" className="px-3 py-3 font-bold">Role</th>
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
                  <td className="px-3 py-3">{student.email || "—"}</td>
                  <td className="px-3 py-3"><span className={student.role === "admin" ? "inline-flex border border-[#8a5a00]/25 bg-[#fff4cf] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#684400]" : "inline-flex border border-[#cfd8d1] bg-[#f3f6f3] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#56635a]"}>{student.role === "admin" ? "Admin" : "Student"}</span></td>
                  <td className="px-3 py-3 tabular-nums">{student.grade_level}</td>
                  <td className="px-3 py-3">{student.section || "General"}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{student.otp_code ?? "—"}</td>
                  <td className="px-3 py-3"><span className={student.has_voted ? "font-semibold text-[#005a36]" : "text-[#66736b]"}>{student.has_voted ? "Voted" : "Pending"}</span></td>
                  <td className="px-3 py-3 text-right"><div className="flex justify-end gap-2">
                    <button type="button" disabled={resettingId !== null || isSavingStudent || (student.id === currentAdminId && student.role === "admin")} onClick={() => void toggleRole(student)} title={student.id === currentAdminId && student.role === "admin" ? "You cannot demote your own account" : undefined} aria-label={`${student.role === "admin" ? "Demote" : "Promote"} ${student.full_name} ${student.role === "admin" ? "to student" : "to admin"}`} className="inline-flex h-9 items-center justify-center border border-[#8a5a00]/40 px-3 text-xs font-semibold text-[#684400] transition hover:bg-[#fff4cf] disabled:cursor-not-allowed disabled:opacity-50">{resettingId === student.id ? "Updating…" : student.role === "admin" ? "Demote to Student" : "Promote to Admin"}</button>
                    <button type="button" disabled={resettingId !== null || isSavingStudent} onClick={() => { setEditError(""); setEditingStudent(student); }} aria-label={`Edit ${student.full_name}`} className="inline-flex h-9 items-center justify-center border border-[#cfd8d1] px-3 text-xs font-semibold transition hover:border-[#005a36] hover:text-[#005a36] disabled:cursor-not-allowed disabled:opacity-50">Edit</button>
                    <button type="button" disabled={resettingId !== null || isSavingStudent} onClick={() => void deleteStudent(student)} aria-label={`Delete ${student.full_name}`} className="inline-flex h-9 items-center justify-center border border-[#b84a3a] px-3 text-xs font-semibold text-[#8c3328] transition hover:bg-[#fbf0ee] disabled:cursor-wait disabled:opacity-50">{resettingId === student.id ? "Deleting…" : "Delete"}</button>
                    {student.has_voted ? <button type="button" disabled={resettingId !== null || isSavingStudent} onClick={() => void resetVote(student)} aria-label={`Reset vote for ${student.full_name}`} className="inline-flex h-9 items-center justify-center border border-[#b84a3a] px-3 text-xs font-semibold text-[#8c3328] transition hover:bg-[#fbf0ee] disabled:cursor-wait disabled:opacity-50">{resettingId === student.id ? "Resetting…" : "Reset vote"}</button> : <button type="button" disabled={resettingId !== null || isSavingStudent} onClick={() => void resetOtp(student)} title="Generate a new OTP" aria-label={`Generate new OTP for ${student.full_name}`} className="inline-flex h-9 items-center justify-center gap-2 border border-[#cfd8d1] px-3 text-xs font-semibold transition hover:border-[#005a36] hover:text-[#005a36] disabled:cursor-not-allowed disabled:opacity-50">
                      <RefreshCw aria-hidden="true" className={`size-3.5 ${resettingId === student.id ? "animate-spin" : ""}`} />
                      Reset OTP
                    </button>}
                  </div></td>
                </tr>
              ))}
              {filteredStudents.length === 0 && <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-[#66736b]">No matching students.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {editingStudent && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10251b]/65 p-4 backdrop-blur-[2px]">
        <section role="dialog" aria-modal="true" aria-labelledby="edit-student-title" className="my-auto w-full max-w-xl border border-[#d9e0db] bg-white p-6 shadow-2xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Student account</p>
          <h2 id="edit-student-title" className="display-font mt-2 text-3xl">Edit student details</h2>
          <form onSubmit={(event) => void saveStudent(event)} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">Full name
              <input name="fullName" defaultValue={editingStudent.full_name} maxLength={120} required className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
            </label>
            <label className="block text-sm font-semibold">Student ID
              <input name="studentId" defaultValue={editingStudent.lrn} inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
            </label>
            <label className="block text-sm font-semibold">Email address
              <input name="email" type="email" defaultValue={editingStudent.email ?? ""} maxLength={254} required className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Grade level
                <select name="gradeLevel" defaultValue={String(editingStudent.grade_level)} required className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm">
                  {[7, 8, 9, 10, 11, 12].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">Section
                <input name="section" defaultValue={editingStudent.section ?? ""} maxLength={80} required className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" />
              </label>
            </div>
            {editError && <p role="alert" className="text-sm leading-5 text-[#8c3328]">{editError}</p>}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={isSavingStudent} onClick={() => setEditingStudent(null)} className="h-11 border border-[#cfd8d1] px-4 text-sm font-semibold">Cancel</button>
              <button type="submit" disabled={isSavingStudent} className="h-11 bg-[#005a36] px-5 text-sm font-bold text-white hover:bg-[#003d28] disabled:cursor-wait disabled:opacity-60">{isSavingStudent ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </section>
      </div>}
      </> : activeTab === "approvals" ? <section className="mt-8" aria-labelledby="pending-approvals-title">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#cfd8d1] pb-4">
          <div>
            <h2 id="pending-approvals-title" className="display-font text-2xl">Pending registrations</h2>
            <p className="mt-1 text-xs text-[#66736b]">{students.filter((student) => student.status === "pending").length} awaiting review</p>
          </div>
          <button type="button" disabled={resettingId !== null || isSavingStudent || !students.some((student) => student.status === "pending")} onClick={() => void approveAllPending()} className="h-10 border border-[#005a36] bg-[#005a36] px-4 text-xs font-bold text-white transition hover:bg-[#003d28] disabled:cursor-not-allowed disabled:opacity-50">{resettingId === "all-pending" ? "Approving…" : "Batch approve all"}</button>
        </div>
        {notice && <p role="status" className="border-b border-[#d9e0db] bg-[#e5f0e9] px-4 py-3 text-sm text-[#174b32]">{notice}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[#cfd8d1] text-xs uppercase tracking-wide text-[#66736b]"><th scope="col" className="px-3 py-3 font-bold">Student ID</th><th scope="col" className="px-3 py-3 font-bold">Full name</th><th scope="col" className="px-3 py-3 font-bold">Email</th><th scope="col" className="px-3 py-3 font-bold">Grade / Section</th><th scope="col" className="px-3 py-3 text-right font-bold">Review</th></tr></thead>
            <tbody>
              {students.filter((student) => student.status === "pending").map((student) => (
                <tr key={student.id} className="border-b border-[#e5eae6] bg-white/70">
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{student.lrn}</td>
                  <td className="px-3 py-3 font-medium">{student.full_name}</td>
                  <td className="px-3 py-3">{student.email || "—"}</td>
                  <td className="px-3 py-3">{student.grade_level} / {student.section || "General"}</td>
                  <td className="px-3 py-3"><div className="flex justify-end gap-2"><button type="button" disabled={resettingId !== null || isSavingStudent} onClick={() => void updateApproval(student, "approved")} className="h-9 border border-[#005a36] bg-[#005a36] px-3 text-xs font-semibold text-white hover:bg-[#003d28] disabled:cursor-wait disabled:opacity-50">{resettingId === student.id ? "Saving…" : "Approve"}</button><button type="button" disabled={resettingId !== null || isSavingStudent} onClick={() => void updateApproval(student, "rejected")} className="h-9 border border-[#b84a3a] px-3 text-xs font-semibold text-[#8c3328] hover:bg-[#fbf0ee] disabled:cursor-wait disabled:opacity-50">Reject</button></div></td>
                </tr>
              ))}
              {!students.some((student) => student.status === "pending") && <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-[#66736b]">No registrations are waiting for approval.</td></tr>}
            </tbody>
          </table>
        </div>
      </section> : activeTab === "election" ? <section className="mt-8 max-w-3xl" aria-labelledby="election-control-title">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#cfd8d1] pb-4"><div><h2 id="election-control-title" className="display-font text-2xl">Election control panel</h2><p className="mt-1 text-sm text-[#66736b]">Current state: <span className="font-bold uppercase text-[#005a36]">{electionSettings.status}</span></p></div><Link href="/admin/results" className="text-sm font-semibold text-[#005a36] underline">View division results</Link></div>
        {electionMessage && <p role={electionMessage.error ? "alert" : "status"} className={`mt-4 border-l-2 px-4 py-3 text-sm ${electionMessage.error ? "border-[#b84a3a] bg-[#fbf0ee] text-[#8c3328]" : "border-[#005a36] bg-[#e5f0e9] text-[#174b32]"}`}>{electionMessage.text}</p>}
        <form onSubmit={(event) => void saveElectionSettings(event)} className="mt-5 grid gap-4 border-y border-[#d9e0db] bg-white/80 p-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">Voting starts<input name="start_time" type="datetime-local" defaultValue={toDateTimeInput(electionSettings.start_time)} className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm" /></label>
          <label className="text-sm font-semibold">Voting ends<input name="end_time" type="datetime-local" defaultValue={toDateTimeInput(electionSettings.end_time)} className="mt-2 h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm" /></label>
          <button type="submit" disabled={isSavingElectionSettings} className="h-11 justify-self-start bg-[#005a36] px-5 text-sm font-bold text-white hover:bg-[#003d28] disabled:opacity-50 sm:col-span-2">{isSavingElectionSettings ? "Saving…" : "Save schedule"}</button>
        </form>
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={isSavingElectionSettings || isResettingElection || electionSettings.status === "scheduled"} onClick={() => void setElectionStatus("scheduled")} className="h-11 border border-[#cfd8d1] px-4 text-sm font-semibold hover:border-[#005a36] disabled:opacity-50">Schedule election</button><button type="button" disabled={isSavingElectionSettings || isResettingElection || electionSettings.status === "active"} onClick={() => void setElectionStatus("active")} className="h-11 bg-[#005a36] px-4 text-sm font-bold text-white hover:bg-[#003d28] disabled:opacity-50">Start voting</button><button type="button" disabled={isSavingElectionSettings || isResettingElection || electionSettings.status !== "active"} onClick={() => void setElectionStatus("ended")} className="h-11 border border-[#cfd8d1] px-4 text-sm font-semibold hover:border-[#005a36] disabled:opacity-50">End voting</button><button type="button" disabled={isSavingElectionSettings || isResettingElection || electionSettings.status === "cancelled"} onClick={() => void setElectionStatus("cancelled")} className="h-11 border border-[#b84a3a] px-4 text-sm font-semibold text-[#8c3328] hover:bg-[#fbf0ee] disabled:opacity-50">Emergency cancel</button></div>
        <div className="mt-8 border-t border-[#cfd8d1] pt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#4e5b53]">Reset election data</h3>
          <p className="mt-1 text-sm leading-6 text-[#66736b]">Both reset options clear ballots, reset voter status, generate new OTPs, and return the election to scheduled.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={isSavingElectionSettings || isResettingElection} onClick={() => { setElectionMessage(null); setResetType("soft"); }} className="h-11 border border-[#b88a16] bg-[#fff4cf] px-4 text-sm font-bold text-[#684400] transition hover:bg-[#fce8a6] disabled:cursor-not-allowed disabled:opacity-50">Reset Votes &amp; OTPs Only</button>
            <button type="button" disabled={isSavingElectionSettings || isResettingElection} onClick={() => { setElectionMessage(null); setResetType("hard"); }} className="h-11 border border-[#b84a3a] bg-[#b84a3a] px-4 text-sm font-bold text-white transition hover:bg-[#8c3328] disabled:cursor-not-allowed disabled:opacity-50">Full System Reboot</button>
          </div>
        </div>
      </section> : <CandidateManagement initialCandidates={initialCandidates} initialParties={initialParties} />}
      {resetType && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!isResettingElection) setResetType(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="system-reset-title" className="w-full max-w-lg border border-[#d9e0db] bg-white p-6 shadow-2xl sm:p-8" onClick={(event) => event.stopPropagation()}>
          <p className={`text-xs font-bold uppercase tracking-[0.18em] ${resetType === "soft" ? "text-[#8a5a00]" : "text-[#8c3328]"}`}>Confirm election reset</p>
          <h2 id="system-reset-title" className="display-font mt-3 text-2xl">{resetType === "soft" ? "Reset votes and OTPs?" : "Reboot the full election system?"}</h2>
          <p className="mt-4 text-sm leading-6 text-[#4e5b53]">{resetType === "soft"
            ? "This permanently deletes every recorded vote, resets all students to not voted, generates new OTPs, and clears the election schedule. Candidates, parties, and manifestos will be kept."
            : "This permanently deletes every recorded vote, all candidates, all parties, and their manifestos. Student accounts remain; their voting status is reset, new OTPs are generated, and the election schedule is cleared."}</p>
          {electionMessage?.error && <p role="alert" className="mt-4 border-l-2 border-[#b84a3a] bg-[#fbf0ee] px-4 py-3 text-sm text-[#8c3328]">{electionMessage.text}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" disabled={isResettingElection} onClick={() => setResetType(null)} className="h-10 border border-[#cfd8d1] px-4 text-sm font-semibold hover:border-[#005a36] disabled:opacity-50">Cancel</button>
            <button type="button" disabled={isResettingElection} onClick={() => void resetElection()} className={`h-10 px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-50 ${resetType === "soft" ? "bg-[#a97700] hover:bg-[#805900]" : "bg-[#b84a3a] hover:bg-[#8c3328]"}`}>{isResettingElection ? "Resetting…" : resetType === "soft" ? "Reset votes & OTPs" : "Reboot system"}</button>
          </div>
        </section>
      </div>}
    </main>
  );
}