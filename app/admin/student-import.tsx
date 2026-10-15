"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";
import type { AdminStudent } from "./dashboard";

type Credential = { id: string; lrn: string; full_name: string; grade_level: number; section: string; assigned_password: string; otp: string };
type ImportError = { lrn: string; error: string };

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export default function StudentImport({ onImported }: { onImported: (students: AdminStudent[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  async function importStudents(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || isImporting) return;
    setError("");
    setErrors([]);
    setCredentials([]);
    setIsImporting(true);
    try {
      const response = await fetch("/api/admin/import-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: await file.text() }),
      });
      const result = await response.json() as { imported?: number; credentials?: Credential[]; errors?: ImportError[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Student import failed.");
      const importedCredentials = result.credentials ?? [];
      setCredentials(importedCredentials);
      setErrors(result.errors ?? []);
      onImported(importedCredentials.map((item) => ({
        id: item.id,
        lrn: item.lrn,
        full_name: item.full_name,
        grade_level: item.grade_level,
        section: item.section,
        otp_code: item.otp,
        has_voted: false,
      })));
      setFile(null);
      const input = document.getElementById("student-csv") as HTMLInputElement | null;
      if (input) input.value = "";
      if ((result.imported ?? 0) === 0 && (result.errors?.length ?? 0) === 0) setError("No student accounts were imported.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Student import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  function downloadCredentials() {
    if (credentials.length === 0) return;
    const lines = [
      ["lrn", "full_name", "assigned_password", "otp"].join(","),
      ...credentials.map((item) => [item.lrn, item.full_name, item.assigned_password, item.otp].map(csvCell).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-credentials.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="mt-8 border-y border-[#cfd8d1] bg-white/80 px-5 py-5 sm:px-6" aria-labelledby="student-import-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="student-import-title" className="text-sm font-bold">Import students</h2>
          <p className="mt-1 text-xs leading-5 text-[#66736b]">CSV headers: lrn, full_name, grade_level, section. The section column is optional; missing values default to General.</p>
        </div>
        {credentials.length > 0 && <button type="button" onClick={downloadCredentials} className="inline-flex h-10 items-center gap-2 bg-[#005a36] px-4 text-xs font-bold text-white hover:bg-[#003d28]"><Download aria-hidden="true" className="size-4" />Download credentials ({credentials.length})</button>}
      </div>
      <form onSubmit={(event) => void importStudents(event)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="student-csv" className="sr-only">Choose student CSV</label>
        <input id="student-csv" type="file" accept=".csv,text/csv" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="min-w-0 flex-1 text-sm file:mr-3 file:h-10 file:border-0 file:bg-[#e5f0e9] file:px-3 file:text-xs file:font-semibold file:text-[#174b32]" />
        <button type="submit" disabled={!file || isImporting} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 bg-[#005a36] px-4 text-xs font-bold text-white hover:bg-[#003d28] disabled:cursor-wait disabled:opacity-55"><Upload aria-hidden="true" className="size-4" />{isImporting ? "Importing…" : "Import CSV"}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-[#8c3328]">{error}</p>}
      {credentials.length > 0 && <p role="status" className="mt-3 text-sm text-[#174b32]">Created {credentials.length} account{credentials.length === 1 ? "" : "s"}. Download the credentials now; passwords are not stored for later retrieval.</p>}
      {errors.length > 0 && <div className="mt-3 max-h-36 overflow-y-auto border-l-2 border-[#b84a3a] pl-3 text-xs leading-5 text-[#8c3328]" role="alert">{errors.map((item) => <p key={item.lrn}>{item.lrn}: {item.error}</p>)}</div>}
    </section>
  );
}