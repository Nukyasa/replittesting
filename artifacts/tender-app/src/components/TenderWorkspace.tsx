import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ClipboardCheck, ArrowRight, Plus, FileCheck2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SubmissionReadiness } from "./SubmissionReadiness";

type Person = { id: string; name: string };
type Decision = { version: number; tender_id: string; decision: string; reason: string; owner_id: string | null; internal_deadline: string | null; updated_at?: string };
type Task = { id: string; tender_id: string; title: string; document_id: string | null; source_quote: string; source_page?: number | null; owner_id: string | null; due_at: string | null; status: string; proof: string; proof_document_id?: string | null; proof_valid_until?: string | null; version: number; document_name?: string; source_changed?: boolean };
type WorkspaceData = { workspace: Decision; tasks: Task[]; users: Person[]; documents: Person[]; events: { id: string; message: string; actor_name: string; created_at: string; details: { reason?: string; decision?: string; title?: string; status?: string } }[] };
const labels: Record<string, string> = { pending: "Čeka odluku", go: "Idemo", no_go: "Ne idemo", todo: "Za pripremu", in_progress: "U radu", review: "Za provjeru", done: "Provjereno" };
const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const displayDate = (value?: string | null) => value ? new Date(value).toLocaleString("bs-BA", { dateStyle: "medium", timeStyle: "short" }) : "Rok nije postavljen";
const localDate = (value?: string | null) => { if (!value) return ""; const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); };
const isoDate = (value: FormDataEntryValue | null) => value ? new Date(String(value)).toISOString() : null;
const emptyTask: Task = { id: "", tender_id: "", title: "", document_id: null, source_quote: "", owner_id: null, due_at: null, status: "todo", proof: "", version: 0 };
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>; }
function People({ users, value }: { users: Person[]; value: string | null }) { return <select name="owner_id" defaultValue={value || ""} className={inputClass}><option value="">Nije dodijeljeno</option>{users.map(u => <option value={u.id} key={u.id}>{u.name}</option>)}</select>; }
function ErrorBox({ error }: { error: unknown }) { return error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error instanceof Error ? error.message : "Podaci nisu dostupni."}</p> : null; }

export function TenderWorkspace({ tenderId }: { tenderId: string }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState("all");
  const query = useQuery({ queryKey: ["workspace", tenderId], queryFn: () => customFetch<WorkspaceData>(`/api/workspace/${tenderId}`), refetchOnWindowFocus: false });
  const mutation = useMutation({
    mutationFn: ({ path, body, method = "PUT" }: { path: string; body?: unknown; method?: string }) => customFetch<{ added?: number; found?: number }>(`/api/workspace/${tenderId}/${path}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }),
    onSuccess: async result => {
      setEditing(null);
      await Promise.all([client.invalidateQueries({ queryKey: ["workspace", tenderId] }), client.invalidateQueries({ queryKey: ["workday"] }), client.invalidateQueries({ queryKey: ["readiness", tenderId] })]);
      toast.success(result.added !== undefined ? result.added ? `Dodano ${result.added} stavki za provjeru.` : result.found ? "Izdvojene stavke su već na listi." : "Nema izdvojenih zahtjeva. Dodajte dokumentaciju ili ručnu stavku." : "Izmjene su sačuvane.");
    },
  });
  if (query.isPending) return <p className="p-6 text-sm">Učitavanje dosjea ponude…</p>;
  if (!query.data) return <div className="space-y-3"><ErrorBox error={query.error} /><Button onClick={() => query.refetch()}>Pokušaj ponovo</Button></div>;
  const { workspace: w, tasks, users, documents, events } = query.data;
  const done = tasks.filter(t => t.status === "done" && !t.source_changed).length;
  const visible = tasks.filter(t => filter === "all" || (filter === "open" ? t.status !== "done" || t.source_changed : t.status === filter));
  function saveDecision(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    mutation.mutate({ path: "decision", body: { version: w.version, decision: f.get("decision"), reason: f.get("reason"), owner_id: f.get("owner_id") || null, internal_deadline: isoDate(f.get("internal_deadline")) } });
  }
  function saveTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); if (!editing) return;
    mutation.mutate({ path: editing.id ? `requirements/${editing.id}` : "requirements", method: editing.id ? "PUT" : "POST", body: { version: editing.version, title: f.get("title"), document_id: f.get("document_id") || null, source_quote: f.get("source_quote"), owner_id: f.get("owner_id") || null, due_at: isoDate(f.get("due_at")), status: f.get("status"), proof: f.get("proof"), proof_document_id: f.get("proof_document_id") || null, proof_valid_until: f.get("proof_valid_until") || null } });
  }
  return <div className="space-y-6">
    <section className="rounded-xl border bg-white overflow-hidden">
      <div className="bg-slate-900 p-5 text-white flex flex-wrap justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-slate-300">Dosje ponude</p><h2 className="font-semibold text-xl mt-1">Odluka i plan tima</h2></div><span className="rounded-full border border-white/30 px-3 py-1 text-sm self-start">{labels[w.decision]}</span></div>
      <form key={w.version} onSubmit={saveDecision} className="p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-4"><Field label="Odluka"><select name="decision" defaultValue={w.decision} className={inputClass}>{["pending", "go", "no_go"].map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></Field><Field label="Odgovorna osoba"><People users={users} value={w.owner_id} /></Field><Field label="Interni rok"><Input type="datetime-local" name="internal_deadline" defaultValue={localDate(w.internal_deadline)} /></Field></div>
        <Field label="Razlog odluke / napomena tima"><Textarea name="reason" maxLength={4000} defaultValue={w.reason} placeholder="Zašto učestvujemo ili odustajemo? Šta još treba provjeriti?" /></Field>
        <div className="flex flex-wrap justify-between gap-3 items-center"><span className="text-xs text-muted-foreground">{w.updated_at ? `Posljednja izmjena: ${displayDate(w.updated_at)}` : "Odluka još nije zabilježena."}</span><Button disabled={mutation.isPending}>Sačuvaj odluku i plan</Button></div>
      </form>
    </section>
    <ErrorBox error={mutation.error || query.error} />
    {mutation.isError && <Button variant="outline" onClick={async () => { setEditing(null); mutation.reset(); await query.refetch(); }}>Učitaj posljednje podatke (odbaci nespremljeni unos)</Button>}
    <section className="rounded-xl border bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold flex gap-2 items-center"><ClipboardCheck className="w-5 h-5 text-primary" />Kontrolna lista zahtjeva</h2><p className="text-sm text-muted-foreground mt-1">{done} / {tasks.length} stavki provjereno · potvrđuje član tima</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={mutation.isPending || !!editing} onClick={() => mutation.mutate({ path: "requirements/import", method: "POST" })}><FileCheck2 />Izdvoji iz dokumenata</Button><Button variant="outline" disabled={mutation.isPending || !!editing} onClick={() => { mutation.reset(); setEditing(emptyTask); }}><Plus />Dodaj stavku</Button></div></div>
      <div role="progressbar" aria-label="Provjerene stavke" aria-valuemin={0} aria-valuemax={tasks.length || 1} aria-valuenow={done} className="h-2 rounded-full bg-slate-100"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${tasks.length ? done / tasks.length * 100 : 0}%` }} /></div>
      <p className="text-xs text-muted-foreground">Izdvajanje dodaje navode za ručnu provjeru; ne potvrđuje potpunost dokumentacije. Ponovni unos istog izvornog navoda ne stvara duplikat.</p>
      {editing && <form key={`${editing.id}-${editing.version}`} onSubmit={saveTask} className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-4">
        <h3 className="font-semibold">{editing.id ? "Uredi zahtjev" : "Nova stavka"}</h3>
        <Field label="Zahtjev / zadatak"><Input name="title" required maxLength={1000} defaultValue={editing.title} placeholder="Npr. Provjeriti i pripremiti traženu referencu" /></Field>
        <div className="grid sm:grid-cols-2 gap-4"><Field label="Izvorni dokument"><select name="document_id" defaultValue={editing.document_id || ""} className={inputClass}><option value="">Interni zadatak — bez izvornog dokumenta</option>{documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="Odgovorna osoba"><People users={users} value={editing.owner_id} /></Field></div>
        <Field label="Tačan citat zahtjeva iz dokumenta"><Textarea name="source_quote" maxLength={8000} defaultValue={editing.source_quote} placeholder="Za interni zadatak ostavite prazno. Citat se provjerava u tekstu dokumenta." /></Field>
        <div className="grid sm:grid-cols-2 gap-4"><Field label="Interni rok stavke"><Input name="due_at" type="datetime-local" defaultValue={localDate(editing.due_at)} /></Field><Field label="Status"><select name="status" defaultValue={editing.status} className={inputClass}>{["todo", "in_progress", "review", "done"].map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></Field></div>
        <div className="grid sm:grid-cols-2 gap-4"><Field label="Dokazni prilog"><select name="proof_document_id" defaultValue={editing.proof_document_id || ""} className={inputClass}><option value="">Nije povezan dokaz</option>{documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="Dokaz važi do (ako ima rok)"><Input type="date" name="proof_valid_until" defaultValue={editing.proof_valid_until?.slice(0,10) || ""} /></Field></div><p className="text-xs text-muted-foreground">Dokaz prvo učitajte u kartici Dokumenti, pa ga povežite ovdje. Izvor zahtjeva i dokaz ispunjavanja su odvojene stavke.</p>
        <Field label="Dokaz i bilješka provjere"><Textarea name="proof" maxLength={8000} defaultValue={editing.proof} placeholder="Navedite naziv pripremljenog priloga i šta ste provjerili. Obavezno za status Provjereno." /></Field>
        <div className="flex gap-2"><Button disabled={mutation.isPending}>Sačuvaj stavku</Button><Button type="button" variant="ghost" disabled={mutation.isPending} onClick={() => setEditing(null)}>Odustani</Button></div>
      </form>}
      <div className="flex flex-wrap gap-2">{[["all", "Sve"], ["open", "Otvorene"], ["review", "Za provjeru"], ["done", "Provjerene"]].map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? "secondary" : "ghost"} onClick={() => setFilter(value)}>{label}</Button>)}</div>
      {!visible.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{tasks.length ? "Nema stavki u ovom prikazu." : "Lista je prazna. Izdvojite zahtjeve iz dokumenata ili dodajte prvi zadatak."}</div>}
      {visible.map(task => <article key={task.id} className="rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{task.title}</h3><p className="text-xs text-muted-foreground mt-1">{users.find(u => u.id === task.owner_id)?.name || "Nije dodijeljeno"} · {displayDate(task.due_at)}</p></div><span className={`text-xs rounded-full px-2 py-1 shrink-0 ${task.status === "done" && !task.source_changed ? "bg-emerald-50 text-emerald-800" : "bg-slate-100"}`}>{task.source_changed ? "Ponovo provjeriti izvor" : labels[task.status]}</span></div>
        {task.due_at && new Date(task.due_at).getTime() < Date.now() && task.status !== "done" && <p className="text-xs text-red-700">Interni rok je prošao.</p>}
        {task.source_quote && <blockquote className="border-l-2 border-blue-300 pl-3 text-sm whitespace-pre-wrap"><p className="text-xs text-muted-foreground mb-1">{task.document_name || "Izvorni dokument više nije dostupan"}{task.source_page ? ` · stranica ${task.source_page}` : ""}</p>{task.source_quote}</blockquote>}
        {task.source_changed && <p className="text-sm text-amber-800">Sačuvani citat nije potvrđen u trenutnom tekstu dokumenta. Otvorite dokumentaciju i ažurirajte stavku.</p>}
        {task.proof && <p className="text-sm whitespace-pre-wrap"><strong>Dokaz / provjera: </strong>{task.proof}</p>}
        <Button size="sm" variant="outline" disabled={mutation.isPending || !!editing} onClick={() => { mutation.reset(); setEditing(task); }}>Uredi stavku</Button>
      </article>)}
    </section>
    <SubmissionReadiness tenderId={tenderId} />
    <details className="rounded-xl border bg-white p-5"><summary className="font-semibold cursor-pointer">Historija rada tima ({events.length}{events.length === 50 ? "+" : ""})</summary><div className="space-y-3 mt-4">{!events.length && <p className="text-sm text-muted-foreground">Još nema zabilježenih izmjena.</p>}{events.map(e => <div key={e.id} className="border-l-2 pl-3 text-sm"><p className="font-medium">{e.message}</p><p className="text-xs text-muted-foreground">{e.actor_name || "Uklonjen korisnik"} · {displayDate(e.created_at)}</p>{e.details.decision && <p>{labels[e.details.decision]} — {e.details.reason || "Bez napomene"}</p>}{e.details.title && <p>{e.details.title} · {labels[e.details.status || ""]}</p>}</div>)}</div></details>
  </div>;
}

type DayData = { tasks: (Task & { tender_title: string })[]; decisions: (Decision & { title: string; deadline: string | null })[]; changes: { id: string; tender_id: string; title: string; field: string; old_value: string | null; new_value: string | null; changed_at: string }[] };
export function MyWorkday() {
  const query = useQuery({ queryKey: ["workday"], queryFn: () => customFetch<DayData>("/api/workspace/day"), refetchInterval: 60000 });
  const [section, setSection] = useState("tasks");
  if (query.isPending) return <p className="p-5">Učitavanje radnog dana…</p>;
  if (!query.data) return <div><ErrorBox error={query.error} /><Button variant="outline" onClick={() => query.refetch()}>Ponovi učitavanje</Button></div>;
  const { tasks, decisions, changes } = query.data;
  const overdue = tasks.filter(t => t.due_at && new Date(t.due_at).getTime() < Date.now()).length;
  return <section className="rounded-xl border bg-white overflow-hidden">
    <div className="bg-slate-900 text-white p-5"><h2 className="font-semibold text-xl flex gap-2 items-center"><CalendarClock className="w-5 h-5" />Moj radni dan</h2><p className="text-sm text-slate-300 mt-1">Vaša zaduženja, odluke i promjene na tenderima koje pratite.</p></div>
    <div className="p-5 space-y-4"><ErrorBox error={query.error} /><div className="grid grid-cols-3 gap-3">{[[tasks.length, "Otvorenih zadataka"], [overdue, "Prošlih internih rokova"], [decisions.filter(d => d.decision === "pending").length, "Čeka moju odluku"]].map(([n, label]) => <div key={label} className="bg-slate-50 rounded-lg p-3"><div className="text-2xl font-semibold">{n}</div><div className="text-xs text-muted-foreground">{label}</div></div>)}</div>
      <div className="flex flex-wrap gap-2">{[["tasks", "Moji zadaci"], ["decisions", "Moje ponude"], ["changes", "Izmjene · 7 dana"]].map(([value, label]) => <Button key={value} size="sm" variant={section === value ? "secondary" : "ghost"} onClick={() => setSection(value)}>{label}</Button>)}</div>
      {section === "tasks" && (!tasks.length ? <p className="text-sm text-muted-foreground py-4">Nemate otvorenih zaduženja. Na tenderu otvorite „Odluka i zadaci“ i dodijelite odgovorne osobe.</p> : tasks.map(t => <Link key={t.id} href={`/tenders/${t.tender_id}?tab=radni-dosje`} className="flex justify-between gap-3 border-b py-3 hover:text-primary"><div><p className="font-medium text-sm">{t.title}</p><p className="text-xs text-muted-foreground">{t.tender_title}</p><p className="text-xs mt-1">{labels[t.status]} · {displayDate(t.due_at)}</p></div><ArrowRight className="w-4 h-4 shrink-0" /></Link>))}
      {section === "decisions" && (!decisions.length ? <p className="text-sm text-muted-foreground py-4">Nema aktivnih ponuda za koje ste odgovorna osoba.</p> : decisions.map(d => <Link key={d.tender_id} href={`/tenders/${d.tender_id}?tab=radni-dosje`} className="block border-b py-3"><p className="font-medium text-sm">{d.title}</p><p className="text-xs mt-1">{labels[d.decision]} · Interni rok: {displayDate(d.internal_deadline)}</p><p className="text-xs text-muted-foreground">Predaja: {displayDate(d.deadline)}</p></Link>))}
      {section === "changes" && (!changes.length ? <p className="text-sm text-muted-foreground py-4">Nema zabilježenih promjena u posljednjih sedam dana.</p> : changes.map(c => <Link key={c.id} href={`/tenders/${c.tender_id}`} className="block border-b py-3 text-sm"><p className="font-medium">{c.title}</p><p>{({ deadline: "Rok", status: "Status", estimatedValue: "Procijenjena vrijednost" } as Record<string,string>)[c.field] || c.field}: {c.old_value || "Nije poznato"} → {c.new_value || "Nije poznato"}</p><p className="text-xs text-muted-foreground">{displayDate(c.changed_at)}</p></Link>))}
    </div>
  </section>;
}
