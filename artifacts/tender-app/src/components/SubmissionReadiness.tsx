import { useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

type Result = { blockers: string[]; fingerprint: string; ready: boolean; verified: number; total: number; tasks: { id: string; title: string; proof_name: string | null; issues: string[] }[]; review: { reviewer_name: string; reviewed_at: string; current: boolean; note: string } | null };
export function SubmissionReadiness({ tenderId }: { tenderId: string }) {
  const client = useQueryClient();
  const [note,setNote] = useState(''), [ack,setAck] = useState(false);
  const q = useQuery({ queryKey: ['readiness',tenderId], queryFn: () => customFetch<Result>(`/api/workspace/${tenderId}/readiness`) });
  const save = useMutation({ mutationFn: () => customFetch(`/api/workspace/${tenderId}/readiness/review`,{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fingerprint:q.data?.fingerprint,note,completeDocumentationReviewed:ack}) }), onSuccess: async () => { setAck(false);setNote('');await client.invalidateQueries({queryKey:['readiness',tenderId]});await client.invalidateQueries({queryKey:['workspace',tenderId]}); } });
  if(q.isPending) return <p>Provjera spremnosti…</p>;
  if(!q.data) return <div role="alert">Spremnost trenutno nije dostupna. <Button onClick={()=>q.refetch()}>Ponovi</Button></div>;
  const r=q.data;
  return <section className="rounded-xl border bg-white p-5 space-y-4">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="w-5 h-5 text-primary"/>Spremnost za predaju</h2>
    <div className={`rounded-lg p-4 ${r.review?.current?'bg-emerald-50 text-emerald-900':'bg-amber-50 text-amber-900'}`}>
      <p className="font-semibold">{r.review?.current?'Završna interna provjera evidentirana':r.ready?'Stavke su spremne za završni pregled':'Potrebna dopuna prije završnog pregleda'}</p>
      <p className="text-sm mt-1">{r.verified} / {r.total} stavki sa provjerom i potrebnim dokazima.</p>
    </div>
    {!!r.blockers.length && <ul className="list-disc pl-5 text-sm space-y-1">{r.blockers.map(b=><li key={b}>{b}</li>)}</ul>}
    {r.tasks.filter(t=>t.issues.length).map(t=><div className="border-l-2 border-amber-300 pl-3 text-sm" key={t.id}><p className="font-medium">{t.title}</p><p>{t.issues.join(' · ')}</p></div>)}
    <details className="text-sm"><summary className="cursor-pointer">Povezani dokazni prilozi</summary><ul className="space-y-2 mt-2">{r.tasks.map(t=><li key={t.id}>{t.title} → {t.proof_name || 'Nema povezanog priloga'}</li>)}</ul></details>
    {r.review && <div className="border rounded-lg p-3 text-sm"><p className="font-medium">{r.review.current?'Važeća provjera':'Ranija provjera — potrebno ponoviti nakon izmjena'}</p><p>{r.review.reviewer_name || 'Uklonjen korisnik'} · {new Date(r.review.reviewed_at).toLocaleString('bs-BA')}</p><p className="whitespace-pre-wrap">{r.review.note}</p></div>}
    <p className="text-xs text-muted-foreground">Ovaj pregled provjerava evidentirane stavke. Potpunost TD, priloga, izmjena i pojašnjenja potvrđuje tim. Evidentiranje ne šalje ponudu na EJN.</p>
    {!r.review?.current && <form className="space-y-3" onSubmit={e=>{e.preventDefault();save.mutate();}}>
      <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} disabled={!r.ready} className="mt-1"/>Pregledao/la sam punu tendersku dokumentaciju, priloge, izmjene i pojašnjenja te provjerio/la da lista obuhvata sve zahtjeve za ovu ponudu.</label>
      <label className="block text-sm space-y-1"><span>Bilješka završnog pregleda</span><Textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={4000} required disabled={!r.ready}/></label>
      <Button disabled={!r.ready||!ack||!note.trim()||save.isPending}>Evidentiraj završnu provjeru</Button>
    </form>}
    {(q.error||save.error) && <p role="alert" className="text-red-700 text-sm"><AlertTriangle className="inline w-4 h-4 mr-1"/>{(q.error||save.error)?.message} <Button variant="ghost" onClick={()=>q.refetch()}>Osvježi stanje</Button></p>}
  </section>;
}
