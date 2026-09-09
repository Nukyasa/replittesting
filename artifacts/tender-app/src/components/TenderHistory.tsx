import { useState } from 'react';
import { useMutation,useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { History,RefreshCw,ExternalLink } from 'lucide-react';

type Award = {source_entity:string;contract_id:number;procedure_name:string;procedure_number:string|null;winner_names:string[];amount:number|null;contract_date:string|null;sourceUrl:string;winnerSourceUrl:string;matchReason?:string};
type Intelligence = {contractRecords:number;knownWinnerRecords:number;amountRecords:number;amountRange:{min:number;median:number;max:number}|null;leadingWinner:{name:string;records:number;sharePct:number}|null;confidence:'high'|'medium'|'low';coveragePct:number;unavailable:string[]};
type Data = {authorityId:number|null;status:string;message?:string;error?:string;last_run?:string;has_more?:boolean;count?:number;current:Award[];previous:Award[];other:Award[];intelligence?:Intelligence};
export function TenderHistory({tenderId}:{tenderId:string}) {
  const [limit,setLimit]=useState(15);
  const q=useQuery({queryKey:['award-history',tenderId],queryFn:()=>customFetch<Data>(`/api/workspace/${tenderId}/history`),refetchInterval:query=>query.state.data?.status==='running'?2500:60000});
  const sync=useMutation({mutationFn:()=>customFetch(`/api/workspace/${tenderId}/history/sync`,{method:'POST'}),onSuccess:()=>q.refetch()});
  if(q.isPending)return <p className="text-sm">Učitavanje historije dodjela…</p>;
  if(!q.data)return <div role="alert">Historija nije dostupna. <Button onClick={()=>q.refetch()}>Ponovi</Button></div>;
  const d=q.data,running=d.status==='running'||sync.isPending, intelligence=d.intelligence;
  const money=(value:number)=>new Intl.NumberFormat('bs-BA',{maximumFractionDigits:2}).format(value)+' KM';
  function cards(items:Award[]){return items.map(a=><article key={`${a.source_entity}-${a.contract_id}`} className="border rounded-lg p-4 space-y-2">
    <p className="text-xs text-muted-foreground">{a.contract_date?new Date(a.contract_date).toLocaleDateString('bs-BA'):'Datum nije naveden'} · {a.procedure_number||`Zapis ${a.contract_id}`} · {a.source_entity === 'Awards' ? 'Dodjela / lot' : 'Ugovor'}</p>
    <h3 className="font-semibold text-sm">{a.procedure_name}</h3>
    <p className="text-sm"><span className="text-muted-foreground">Dobitnik / članovi grupe: </span><strong>{a.winner_names.length?a.winner_names.join(' · '):'Ime dobitnika nije potvrđeno u dostupnim podacima'}</strong></p>
    <p className="text-sm">Vrijednost ugovora: <strong>{a.amount===null?'Nije navedena':new Intl.NumberFormat('bs-BA',{maximumFractionDigits:2}).format(a.amount)+' KM'}</strong></p>
    {a.matchReason&&<p className="text-xs text-muted-foreground">{a.matchReason}</p>}
    <div className="flex flex-wrap gap-4 text-xs text-primary"><a href={a.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex gap-1 items-center">EJN zapis ugovora <ExternalLink className="w-3 h-3"/></a><a href={a.winnerSourceUrl} target="_blank" rel="noreferrer">Veza sa grupom ponuđača</a></div>
  </article>);}
  return <section className="rounded-xl border bg-white p-5 space-y-5">
    <div className="flex flex-wrap gap-3 justify-between"><div><h2 className="font-semibold text-lg flex gap-2 items-center"><History className="w-5 h-5 text-primary"/>Prethodni dobitnici i dodjele</h2><p className="text-sm text-muted-foreground">Službene EJN dodjele i ugovori, povezani identifikatorom naručioca.</p></div><Button variant="outline" disabled={!d.authorityId||running} onClick={()=>sync.mutate()}><RefreshCw className={running?'animate-spin':''}/>{running?'Preuzimanje…':d.has_more?'Preuzmi starije ugovore':'Osvježi historiju'}</Button></div>
    {d.message&&<p className="text-sm text-amber-800">{d.message}</p>}
    {d.authorityId&&<p className="text-xs text-muted-foreground">U bazi: {d.count||0} zapisa dodjela i ugovora ovog naručioca. {d.last_run?`Posljednji pokušaj: ${new Date(d.last_run).toLocaleString('bs-BA')}. `:''}{running?'Preuzimanje je u toku.':d.has_more?'Postoje stariji ugovori za preuzimanje.':'Završen dostupni pregled ugovora ovog naručioca.'}</p>}
    {intelligence&&<div className="rounded-lg border bg-slate-50 p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold text-sm">Dosje kupca i konkurencije</h3><p className="text-xs text-muted-foreground">Na osnovu službenih EJN ugovora i dodjela; pouzdanost: {intelligence.confidence === 'high' ? 'visoka' : intelligence.confidence === 'medium' ? 'srednja' : 'niska'} ({intelligence.coveragePct}% pokrivenosti).</p></div></div><div className="grid sm:grid-cols-3 gap-3 text-sm"><div><p className="text-muted-foreground text-xs">Zapisi sa dobitnikom</p><strong>{intelligence.knownWinnerRecords} / {intelligence.contractRecords}</strong></div><div><p className="text-muted-foreground text-xs">Najčešći dobitnik</p><strong>{intelligence.leadingWinner ? `${intelligence.leadingWinner.name} (${intelligence.leadingWinner.sharePct}%)` : 'Nije potvrđeno'}</strong></div><div><p className="text-muted-foreground text-xs">Historijski raspon ugovora</p><strong>{intelligence.amountRange ? `${money(intelligence.amountRange.min)} – ${money(intelligence.amountRange.max)}` : 'Nije naveden'}</strong>{intelligence.amountRange&&<p className="text-xs text-muted-foreground">Medijan: {money(intelligence.amountRange.median)}</p>}</div></div>{intelligence.unavailable.map(item=><p key={item} className="text-xs text-muted-foreground">{item}</p>)}</div>}
    {(d.error||sync.error||q.error)&&<p role="alert" className="text-sm text-red-700">{d.error||sync.error?.message||q.error?.message} Sačuvani rezultati ostaju dostupni.</p>}
    <div className="space-y-3"><h3 className="font-semibold">Rezultat ovog postupka</h3>{d.current.length?cards(d.current):<p className="text-sm text-muted-foreground">U preuzetim podacima nije pronađen ugovor za ovaj postupak. To ne potvrđuje da postupak nema rezultat.</p>}</div>
    <div className="space-y-3"><h3 className="font-semibold">Prethodne slične nabavke ({d.previous.length})</h3><p className="text-xs text-muted-foreground">Isti naručilac, ugovor prije objave ovog tendera i podudaranje naziva predmeta. Sličnost ne potvrđuje isti obuhvat, lot ili uslove.</p>{d.previous.length?cards(d.previous.slice(0,limit)):<p className="text-sm text-muted-foreground">Nema potvrđenih prethodnih sličnih nabavki u dosad preuzetoj historiji.</p>}{d.previous.length>limit&&<Button variant="ghost" onClick={()=>setLimit(limit+15)}>Prikaži još</Button>}</div>
    <details><summary className="cursor-pointer text-sm font-medium">Ostali prethodni ugovori naručioca ({d.other.length})</summary><div className="space-y-3 mt-3">{cards(d.other.slice(0,limit))}{d.other.length>limit&&<Button variant="ghost" onClick={()=>setLimit(limit+15)}>Prikaži još</Button>}</div></details>
  </section>;
}
