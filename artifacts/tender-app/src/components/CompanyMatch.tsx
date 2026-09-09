import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Building2, CheckCircle2, AlertTriangle, FileSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Match = { profileConfigured: boolean; approvedEvidenceCount: number; requirementCount: number; suggestedEvidenceCount: number; profileTerms: string[]; disclaimer: string; matches: { requirementId: string; title: string; sourceQuote: string; documentId?: string | null; candidates: { id: string; title: string; validUntil?: string | null; terms: string[]; relevance: number }[] }[] };
export function CompanyMatch({ tenderId }: { tenderId: string }) {
  const query = useQuery({ queryKey: ["/api/company/match", tenderId], queryFn: ({ signal }) => customFetch<Match>(`/api/company/match/${tenderId}`, { signal }) });
  if (query.isLoading) return <p>Provjeravam profil firme i biblioteku dokaza…</p>;
  if (!query.data) return <p className="text-red-700">Podudaranje trenutno nije dostupno.</p>;
  const d = query.data;
  return <div className="space-y-5"><div className="grid sm:grid-cols-3 gap-3"><Metric label="Uslovi iz dokumentacije" value={d.requirementCount} /><Metric label="Odobreni važeći dokazi" value={d.approvedEvidenceCount} /><Metric label="Uslovi sa prijedlogom dokaza" value={d.suggestedEvidenceCount} /></div>
    {!d.profileConfigured && <p className="rounded-lg bg-amber-50 text-amber-900 p-4 flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0" />Popunite Profil firme u glavnom meniju da bi pretraga uzela u obzir kapacitete i CPV kodove.</p>}
    <Card><CardHeader><CardTitle className="flex gap-2 items-center"><Building2 className="w-5 h-5" />Podudaranje profila</CardTitle></CardHeader><CardContent><p className="text-sm">Prepoznati zajednički pojmovi: {d.profileTerms.length ? d.profileTerms.join(", ") : "nema dovoljno podataka za zaključak"}.</p></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex gap-2 items-center"><FileSearch className="w-5 h-5" />Uslovi i mogući dokazi</CardTitle></CardHeader><CardContent className="space-y-4">{d.matches.length === 0 ? <p className="text-sm text-muted-foreground">Još nema uslova u radnoj checklisti. Obradite dokumentaciju pa provjerite ovu karticu ponovo.</p> : d.matches.map(item => <div key={item.requirementId} className="border rounded-lg p-4"><p className="font-medium">{item.title}</p>{item.sourceQuote && <blockquote className="text-sm text-muted-foreground border-l-2 pl-3 mt-2">{item.sourceQuote}</blockquote>}<div className="mt-3">{item.candidates.length ? item.candidates.map(candidate => <div key={candidate.id} className="text-sm flex gap-2 items-start text-green-800"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /><span><strong>{candidate.title}</strong> — zajednički pojmovi: {candidate.terms.join(", ")}{candidate.validUntil ? `; važi do ${new Date(candidate.validUntil).toLocaleDateString("bs-BA")}` : ""}</span></div>) : <p className="text-sm text-amber-800">Nije pronađen odobren i važeći dokaz. Dodijelite odgovornu osobu ili dodajte dokaz u biblioteku.</p>}</div></div>)}</CardContent></Card>
    <p className="text-xs text-muted-foreground">{d.disclaimer}</p>
  </div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border bg-white p-4"><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground mt-1">{label}</p></div>; }
