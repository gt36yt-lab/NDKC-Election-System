"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { comparePositions, POSITION_OPTIONS } from "@/lib/position-order";
import type { AdminCandidate, AdminParty } from "./dashboard";

const GRADES = [7, 8, 9, 10, 11, 12];
const fieldClass = "h-11 w-full border border-[#cfd8d1] bg-white px-3 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15";

export default function CandidateManagement({ initialCandidates, initialParties }: { initialCandidates: AdminCandidate[]; initialParties: AdminParty[] }) {
  const [candidates, setCandidates] = useState(() => [...initialCandidates].sort((left, right) => comparePositions(left.position, right.position) || left.full_name.localeCompare(right.full_name)));
  const [parties, setParties] = useState(initialParties);
  const [selectedGrades, setSelectedGrades] = useState<number[]>(GRADES);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingCandidate, setEditingCandidate] = useState<AdminCandidate | null>(null);
  const [isCandidateEditorOpen, setIsCandidateEditorOpen] = useState(false);

  function openCandidateEditor(candidate: AdminCandidate | null = null) {
    setEditingCandidate(candidate);
    const option = POSITION_OPTIONS.find((item) => item.value === candidate?.position);
    setSelectedGrades(candidate?.allowed_grade_levels ?? option?.grades ?? GRADES);
    setIsCandidateEditorOpen(true);
  }

  async function saveCandidate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const formElement = event.currentTarget;
    setIsSaving(true);
    setNotice("");
    const form = new FormData(formElement);
    try {
      let imageUrl = editingCandidate?.image_url ?? editingCandidate?.photo_url ?? "";
      const photo = form.get("photo");
      if (photo instanceof File && photo.size > 0) {
        const uploadData = new FormData();
        uploadData.set("file", photo);
        const uploadResponse = await fetch("/api/admin/candidate-photo", { method: "POST", body: uploadData });
        const uploadResult = await uploadResponse.json() as { image_url?: string; error?: string };
        if (!uploadResponse.ok || !uploadResult.image_url) throw new Error(uploadResult.error ?? "Candidate photo could not be uploaded.");
        imageUrl = uploadResult.image_url;
      }

      const response = await fetch(editingCandidate ? `/api/admin/candidates/${encodeURIComponent(editingCandidate.id)}` : "/api/admin/candidates", {
        method: editingCandidate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.get("full_name"),
          position: form.get("position"),
          party_id: form.get("party_id"),
          platform: form.get("platform"),
          image_url: imageUrl,
          allowed_grade_levels: selectedGrades,
        }),
      });
      const result = await response.json() as { candidate?: AdminCandidate; error?: string };
      if (!response.ok || !result.candidate) throw new Error(result.error ?? "Candidate could not be saved.");
      setCandidates((current) => (editingCandidate
        ? current.map((candidate) => candidate.id === editingCandidate.id ? result.candidate! : candidate)
        : [...current, result.candidate!]).sort((left, right) => comparePositions(left.position, right.position) || left.full_name.localeCompare(right.full_name)));
      formElement.reset();
      setSelectedGrades(GRADES);
      setIsCandidateEditorOpen(false);
      setEditingCandidate(null);
      setNotice(editingCandidate ? "Candidate updated." : "Candidate added.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Candidate could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addParty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setNotice("");
    try {
      const response = await fetch("/api/admin/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("party_name"), description: form.get("party_description") }),
      });
      const result = await response.json() as { party?: AdminParty; error?: string };
      if (!response.ok || !result.party) throw new Error(result.error ?? "Party could not be created.");
      setParties((current) => [...current, result.party!].sort((left, right) => left.name.localeCompare(right.name)));
      formElement.reset();
      setNotice("Party added.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Party could not be created.");
    }
  }

  async function deleteItem(kind: "candidate" | "party", id: string) {
    const label = kind === "candidate" ? candidates.find((item) => item.id === id)?.full_name : parties.find((item) => item.id === id)?.name;
    if (!window.confirm(`Delete ${kind}${label ? ` "${label}"` : ""}? This cannot be undone.`)) return;
    setNotice("");
    try {
      const response = await fetch(`/api/admin/${kind === "candidate" ? "candidates" : "parties"}/${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Could not delete ${kind}.`);
      if (kind === "candidate") setCandidates((current) => current.filter((item) => item.id !== id));
      else setParties((current) => current.filter((item) => item.id !== id));
      setNotice(`${kind === "candidate" ? "Candidate" : "Party"} deleted.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Could not delete ${kind}.`);
    }
  }

  return (
    <section className="mt-8" aria-labelledby="candidate-management-title">
      <h2 id="candidate-management-title" className="sr-only">Candidate and party management</h2>
      {notice && <p role="status" className="mb-5 border-l-2 border-[#005a36] bg-[#e5f0e9] px-4 py-3 text-sm text-[#174b32]">{notice}</p>}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <div>
          <div className="flex items-center justify-between border-b border-[#cfd8d1] pb-3"><h3 className="display-font text-2xl">Candidates</h3><button type="button" onClick={() => openCandidateEditor()} className="inline-flex h-10 items-center gap-2 bg-[#005a36] px-4 text-xs font-bold text-white hover:bg-[#003d28]"><Plus aria-hidden="true" className="size-4" />Add candidate</button></div>
          <div className="mt-4 divide-y divide-[#d9e0db] border-y border-[#d9e0db] bg-white/70">
            {candidates.map((candidate) => <article key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">{candidate.image_url && <Image src={candidate.image_url} alt="" width={48} height={48} unoptimized className="size-12 shrink-0 object-cover" />}<div className="min-w-0"><p className="font-semibold">{candidate.full_name}</p><p className="mt-1 text-xs text-[#66736b]">{candidate.position} · {parties.find((party) => party.id === candidate.party_id)?.name ?? "Independent"} · Grades {(candidate.allowed_grade_levels ?? []).join(", ")}</p></div></div>
              <div className="flex gap-2"><button type="button" onClick={() => openCandidateEditor(candidate)} aria-label={`Edit candidate ${candidate.full_name}`} title="Edit candidate" className="grid size-9 shrink-0 place-items-center border border-[#d9e0db] hover:border-[#005a36] hover:text-[#005a36]"><Pencil aria-hidden="true" className="size-4" /></button><button type="button" onClick={() => void deleteItem("candidate", candidate.id)} aria-label={`Delete candidate ${candidate.full_name}`} className="grid size-9 shrink-0 place-items-center border border-[#d9e0db] text-[#8c3328] hover:bg-[#fbf0ee]"><Trash2 aria-hidden="true" className="size-4" /></button></div>
            </article>)}
            {candidates.length === 0 && <p className="px-4 py-6 text-sm text-[#66736b]">No candidates have been added.</p>}
          </div>
        </div>

        <div>
          <h3 className="display-font border-b border-[#cfd8d1] pb-3 text-2xl">Parties</h3>
          <form onSubmit={(event) => void addParty(event)} className="mt-4 space-y-4 border-y border-[#d9e0db] bg-white/80 p-5">
            <label className="block text-xs font-semibold">Party name<input name="party_name" required maxLength={100} className={`${fieldClass} mt-2`} /></label>
            <label className="block text-xs font-semibold">Description<textarea name="party_description" rows={3} className="mt-2 w-full border border-[#cfd8d1] bg-white px-3 py-2 text-sm outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" /></label>
            <button type="submit" className="h-11 bg-[#005a36] px-5 text-sm font-bold text-white hover:bg-[#003d28]">Add party</button>
          </form>
          <div className="mt-4 divide-y divide-[#d9e0db] border-y border-[#d9e0db] bg-white/70">
            {parties.map((party) => <article key={party.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0"><p className="font-semibold">{party.name}</p>{party.description && <p className="mt-1 line-clamp-2 text-xs text-[#66736b]">{party.description}</p>}</div>
              <button type="button" onClick={() => void deleteItem("party", party.id)} aria-label={`Delete party ${party.name}`} className="grid size-9 shrink-0 place-items-center border border-[#d9e0db] text-[#8c3328] hover:bg-[#fbf0ee]"><Trash2 aria-hidden="true" className="size-4" /></button>
            </article>)}
            {parties.length === 0 && <p className="px-4 py-6 text-sm text-[#66736b]">No parties have been added.</p>}
          </div>
        </div>
      </div>
      {isCandidateEditorOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10251b]/65 p-4 backdrop-blur-[2px]">
        <section role="dialog" aria-modal="true" aria-labelledby="candidate-editor-title" className="my-auto w-full max-w-2xl border border-[#d9e0db] bg-white p-6 shadow-2xl sm:p-8">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005a36]">Candidate profile</p><h2 id="candidate-editor-title" className="display-font mt-2 text-3xl">{editingCandidate ? "Edit candidate" : "Add candidate"}</h2></div><button type="button" onClick={() => setIsCandidateEditorOpen(false)} aria-label="Close candidate editor" className="grid size-9 place-items-center border border-[#d9e0db] hover:bg-[#f3f5f3]"><X aria-hidden="true" className="size-4" /></button></div>
          <form key={editingCandidate?.id ?? "new-candidate"} onSubmit={(event) => void saveCandidate(event)} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">Full name<input name="full_name" defaultValue={editingCandidate?.full_name ?? ""} required maxLength={120} className={`${fieldClass} mt-2`} /></label>
            <label className="text-xs font-semibold">Position<select name="position" defaultValue={editingCandidate?.position ?? ""} required className={`${fieldClass} mt-2`} onChange={(event) => { const selectedPosition = POSITION_OPTIONS.find((option) => option.value === event.target.value); if (selectedPosition) setSelectedGrades(selectedPosition.grades); }}><option value="" disabled>Select position and division</option>{POSITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}</select></label>
            <label className="text-xs font-semibold">Party<select name="party_id" defaultValue={editingCandidate?.party_id ?? ""} className={`${fieldClass} mt-2`}><option value="">Independent</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
            <label className="text-xs font-semibold">Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block h-11 w-full border border-[#cfd8d1] bg-white px-2 py-2 text-xs file:mr-2 file:border-0 file:bg-[#e5f0e9] file:px-2 file:py-1 file:font-semibold" /><span className="mt-1 block font-normal text-[#66736b]">JPEG, PNG, or WebP; up to 4 MB.</span></label>
            {editingCandidate?.image_url && <div className="flex items-center gap-3 text-xs text-[#66736b]"><Image src={editingCandidate.image_url} alt="Current candidate photo" width={48} height={48} unoptimized className="size-12 object-cover" />Current photo</div>}
            <label className="text-xs font-semibold sm:col-span-2">Manifesto / platform<textarea name="platform" defaultValue={editingCandidate?.platform ?? editingCandidate?.manifesto ?? ""} rows={8} maxLength={5000} placeholder="Describe the candidate's goals and plans." className="mt-2 w-full border border-[#cfd8d1] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#005a36] focus:ring-2 focus:ring-[#005a36]/15" /></label>
            <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold">Eligible grade levels</legend><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{selectedGrades.map((grade) => <label key={grade} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedGrades.includes(grade)} onChange={(event) => setSelectedGrades((current) => event.target.checked ? [...current, grade].sort() : current.filter((item) => item !== grade))} className="size-4 accent-[#005a36]" />Grade {grade}</label>)}</div></fieldset>
            <div className="flex flex-col-reverse gap-3 pt-2 sm:col-span-2 sm:flex-row sm:justify-end"><button type="button" disabled={isSaving} onClick={() => setIsCandidateEditorOpen(false)} className="h-11 border border-[#cfd8d1] px-4 text-sm font-semibold">Cancel</button><button type="submit" disabled={isSaving || selectedGrades.length === 0} className="h-11 bg-[#005a36] px-5 text-sm font-bold text-white hover:bg-[#003d28] disabled:opacity-50">{isSaving ? "Saving…" : editingCandidate ? "Save candidate" : "Add candidate"}</button></div>
          </form>
        </section>
      </div>}
    </section>
  );
}