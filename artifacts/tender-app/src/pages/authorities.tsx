import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Building2, Search, SlidersHorizontal, Bookmark, ChevronLeft, ChevronRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Authority = { id: string; name: string; ejnId: string; jib: string; level?: string; municipality?: string; activity?: string; status?: string; lastUpdated?: string; localCount?: number; openCount?: number; localValue?: number | null };
type Result = { authorities: Authority[]; total: number; totalPages: number };
const levels: Record<string,string> = { Country: "Državni nivo", Entity: "Entitetski nivo", Canton: "Kantonalni nivo", City: "Grad/Općina", Municipality: "Grad/Općina", District: "Distrikt" };
const views = ["Javni registar", "Relevantni za nas", "Aktivno sada", "U planu", "Praćeni"];
const money = (value?: number | null) => value == null ? "—" : new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 1, notation: "compact" }).format(value) + " KM";

export default function AuthoritiesPage() {
  const [search,setSearch] = useState("");
  const [city,setCity] = useState("");
  const [level,setLevel] = useState("");
  const [view,setView] = useState(views[0]);
  const [sector,setSector] = useState("");
  const [activity,setActivity] = useState("");
  const [valueRange,setValueRange] = useState("");
  const [sort,setSort] = useState<"name"|"count"|"value">("count");
  const [page,setPage] = useState(1);
  const [limit,setLimit] = useState(25);
  const [watched,setWatched] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("authority-watches") || "[]"); } catch { return []; } });
  useEffect(() => { localStorage.setItem("authority-watches",JSON.stringify(watched)); },[watched]);
  useEffect(() => { setPage(1); },[search,city,level,view,limit]);
  const query = useQuery({ queryKey: ["authority-registry"], staleTime: 300000, queryFn: async ({signal}) => {
    const first = await customFetch<Result>("/api/authorities?limit=100&page=1",{signal});
    const rows = [...first.authorities];
    for (let start=2;start<=first.totalPages;start+=4) {
      const pages = await Promise.all(Array.from({length: Math.min(4,first.totalPages-start+1)},(_,i) => customFetch<Result>("/api/authorities?limit=100&page="+(start+i),{signal})));
      pages.forEach(part => rows.push(...part.authorities));
    }
    return rows;
  }});
  const plans = useQuery({ queryKey:["authority-plans"], enabled:view==="U planu", queryFn:async ({signal})=>{
    const result = await customFetch<{data?: {contractingAuthorityId:number}[]}>("/api/early-warning?limit=200",{signal});
    return result;
  }});
  const metrics = useQuery({queryKey:["authority-metrics"], staleTime:3600000, queryFn:({signal})=>customFetch<{fetchedAt:string; procedures:{ContractingAuthorityId:number;ProcurementCount:number}[];awards:{ContractingAuthorityId:number;ProcurementCount:number;TotalValue:number|null}[]}>("/api/authorities/metrics",{signal})});
  const all = useMemo(()=>(query.data || []).map(a=>({...a, procedureCount:metrics.data?.procedures.find(r=>String(r.ContractingAuthorityId)===a.ejnId)?.ProcurementCount, awardValue:metrics.data?.awards.find(r=>String(r.ContractingAuthorityId)===a.ejnId)?.TotalValue})),[query.data,metrics.data]);
  const rows = useMemo(() => all.filter(a=>{
    const matches = (a.name+" "+a.jib).toLocaleLowerCase("bs").includes(search.toLocaleLowerCase("bs")) && (!city || a.municipality?.toLocaleLowerCase("bs").includes(city.toLocaleLowerCase("bs"))) && (!level || a.level===level);
    if(!matches || (sector && a.activity!==sector) || (activity==="open" && !(a.openCount||0)) || (valueRange && (a.awardValue==null || (valueRange==="small"?a.awardValue>=1000000:a.awardValue<1000000)))) return false;
    if(view==="Praćeni") return watched.includes(a.id);
    if(view==="Aktivno sada") return (a.openCount || 0)>0;
    if(view==="Relevantni za nas") return watched.includes(a.id) || (a.localCount || 0)>0;
    if(view==="U planu") return (plans.data?.data || []).some(p=>String(p.contractingAuthorityId)===a.ejnId);
    return true;
  }).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name,"bs"):sort==="value"?(b.awardValue??-1)-(a.awardValue??-1):(b.procedureCount??-1)-(a.procedureCount??-1)),[all,search,city,level,view,watched,plans.data,sector,activity,valueRange,sort]);
  const pages = Math.max(1,Math.ceil(rows.length/limit));
  const current = Math.min(page,pages);
  const toggle = (id:string) => setWatched(values=>values.includes(id)?values.filter(v=>v!==id):[...values,id]);
  return <div className="p-4 lg:p-6 mx-auto max-w-none space-y-5 text-[13px]">
    <div className="text-xs text-muted-foreground"><Link href="/dashboard">Početna</Link><span className="mx-2">›</span>Ugovorni organi</div>
    <header><h1 className="text-xl font-bold tracking-tight">Ugovorni organi</h1><p className="text-muted-foreground text-sm mt-1">Pretražujte i pratite ugovorne organe</p></header>
    <div><div className="inline-flex flex-wrap gap-1 border rounded-md p-1 bg-slate-50" role="tablist">{views.map(item=><Button key={item} role="tab" aria-selected={view===item} className={view===item?"bg-white shadow-sm text-slate-900":"text-slate-500"} variant="ghost" size="sm" onClick={()=>setView(item)}>{item}</Button>)}</div>
      <p className="text-xs text-muted-foreground mt-3">{view==="Javni registar"?"Zvanične pravne osobe iz EJN registra; bez zbirne ocjene rizika organa.":view==="Praćeni"?"Organi koje pratite u ovom pregledniku.":view==="Aktivno sada"?"Organi sa otvorenim, lokalno učitanim tenderima čiji rok nije istekao.":view==="U planu"?"Organi u posljednjih 200 preuzetih stavki planova. Obuhvat nije potpuna arhiva planova.":"Praćeni organi i organi s nabavkama učitanim u naš sistem."}</p></div>
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><strong>Šta gledate:</strong>{["Javni podatak","Izračunato","Interni podatak","AI analiza"].map((label,i)=><span key={label} className={["bg-sky-50 text-sky-800","bg-purple-50 text-purple-800","bg-blue-50 text-blue-800","bg-amber-50 text-amber-800"][i]+" rounded border px-2 py-1"}>{label}</span>)}</div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        ["AKTIVNI BUYER PROFILI",metrics.data?metrics.data.procedures.length:null,"sa najmanje jednim javnim EJN postupkom"],
        ["ASA INDEKS OTVORENOSTI","Uvid na profilu","Single-bidder rate i direktni sporazumi"],
        ["BEZ OBJAVLJENE VRIJEDNOSTI",metrics.data?all.filter(a=>a.procedureCount && a.awardValue==null).length:null,"Bez dostupne vrijednosti u EJN Awards"],
        ["RELEVANTNI KUPCI",null,"CPV podudaranje sa sačuvanim tržištima još nije izračunato"]
      ].map(([label,value,note])=><div key={String(label)} className="border bg-white rounded-xl px-4 py-4 shadow-sm min-h-32"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="text-2xl font-bold font-mono mt-2">{value==null?"—":Number(value).toLocaleString("bs-BA")}</p><p className="text-[11px] text-slate-400 border-t pt-2 mt-2">{note}</p></div>)}
    </div>
    <section className="border rounded-xl bg-white p-5 shadow-sm space-y-3">
      <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/><Input aria-label="Pretraga ugovornih organa" className="pl-9 h-9" placeholder="Pretraži ugovorne organe…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="grid md:grid-cols-3 gap-x-3 gap-y-4">
        <label className="text-xs">Grad<select className="block w-full border rounded h-9 px-2 mt-1 bg-white" value={city} onChange={e=>setCity(e.target.value)}><option value="">Svi gradovi</option>{[...new Set(all.map(a=>a.municipality).filter(Boolean))].sort().map(c=><option key={c}>{c}</option>)}</select></label>
        <label className="text-xs">CPV područje<select disabled className="block w-full border rounded h-9 px-2 mt-1 bg-slate-50"><option>Sva CPV područja</option></select><p className="text-[10px] text-slate-400 mt-1">CPV indeks svih lotova još nije učitan.</p></label>
        <label className="text-xs">Sektor<select className="block w-full border rounded h-9 px-2 mt-1 bg-white" value={sector} onChange={e=>setSector(e.target.value)}><option value="">Svi sektori</option>{[...new Set(all.map(a=>a.activity).filter(Boolean))].sort().map(c=><option key={c}>{c}</option>)}</select><p className="text-[10px] text-slate-400 mt-1">Djelatnost organa iz zvaničnog EJN registra.</p></label>
        <label className="text-xs">Aktivnost<select className="block w-full border rounded h-9 px-2 mt-1 bg-white" value={activity} onChange={e=>setActivity(e.target.value)}><option value="">Bilo kada</option><option value="open">Otvorene nabavke u lokalnom dosjeu</option></select></label>
        <label className="text-xs">Vrijednosni raspon<select className="block w-full border rounded h-9 px-2 mt-1 bg-white" value={valueRange} onChange={e=>setValueRange(e.target.value)}><option value="">Sve vrijednosti</option><option value="small">Manje od 1 milion KM</option><option value="large">1 milion KM i više</option></select><p className="text-[10px] text-slate-400 mt-1">Zbir objavljenih EJN dodjela; organi bez vrijednosti ispadaju.</p></label>
        <label className="text-xs">Administrativni nivo<select className="block w-full border rounded h-9 px-2 mt-1 bg-white" value={level} onChange={e=>setLevel(e.target.value)}><option value="">Svi nivoi</option>{Object.entries(levels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      </div>
    </section>
    <div className="flex justify-between text-[11px] text-slate-500 gap-4"><span>{metrics.isFetching?"EJN obračun svih postupaka i dodjela je u toku…":metrics.isError?"EJN zbirni podaci nisu dostupni.":"Nabavke = EJN postupci. Vrijednost = zbir EJN dodjela; nije ostvarena potrošnja."}</span><button onClick={()=>{query.refetch();metrics.refetch();}} className="flex items-center gap-1"><RefreshCw className="w-3 h-3"/>Osvježi</button></div>
    <div className="border rounded-xl overflow-x-auto bg-white">
      <table className="w-full text-xs"><thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase tracking-wide"><tr><th className="text-left p-3"><button onClick={()=>setSort("name")}>Ugovorni organ ↕</button></th><th className="p-3 text-right"><button onClick={()=>setSort("count")}>Nabavke ↓</button></th><th className="p-3 text-right"><button onClick={()=>setSort("value")}>Vrijednost ↕</button></th><th className="p-3 text-left">Indeks otvorenosti</th><th/><th/></tr></thead>
      <tbody>{query.isLoading?<tr><td colSpan={6} className="p-10 text-center">Učitavanje javnog registra…</td></tr>:query.isError?<tr><td colSpan={6} className="p-10 text-center text-red-600">Registar nije dostupan. Pokušajte osvježiti.</td></tr>:rows.slice((current-1)*limit,current*limit).map(a=><tr key={a.id} className="border-b last:border-0 hover:bg-slate-50/70"><td className="px-3 py-2"><Link className="font-medium hover:text-sky-700" href={"/authorities/"+a.id}>{a.name}</Link><div className="flex gap-2 items-center text-[10px] text-slate-500 mt-1"><span className="rounded-full border border-sky-200 bg-sky-50 text-sky-700 px-2">♧ Zvanični registar</span><span>{levels[a.level||""]||a.level}</span><span>{a.municipality}</span></div></td><td className="px-3 py-2 text-right font-mono whitespace-nowrap">{a.procedureCount?.toLocaleString("bs-BA")??"—"}</td><td className="px-3 py-2 text-right font-mono whitespace-nowrap">{money(a.awardValue)}</td><td className="p-3"><Link href={"/authorities/"+a.id} className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors">ASA dosje &gt;</Link></td><td className="p-2"><Button className="h-7 text-[10px]" size="sm" variant="outline" onClick={()=>toggle(a.id)}>{watched.includes(a.id)?"✓ Pratite":"Prati"}</Button></td><td className="p-2 text-right text-[10px] text-slate-400 whitespace-nowrap">Registar ažuriran {a.lastUpdated?new Date(a.lastUpdated).toLocaleDateString("bs-BA"):"—"}<br/><a className="font-mono" target="_blank" rel="noreferrer" href={"https://open.ejn.gov.ba/ContractingAuthorities?$filter=Id%20eq%20"+a.ejnId}>♧ ejn.gov.ba</a></td></tr>)}
      {!query.isLoading&&!query.isError&&!rows.length&&<tr><td colSpan={6} className="p-10 text-center">Nema organa za odabrane filtere.</td></tr>}</tbody></table>
    </div>
    <footer className="flex flex-wrap gap-4 items-center justify-between text-xs"><span>{rows.length?(current-1)*limit+1:0}–{Math.min(current*limit,rows.length)} od {rows.length.toLocaleString("bs-BA")}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={current<=1} onClick={()=>setPage(current-1)}><ChevronLeft className="w-4 h-4"/>Prethodna</Button><span>{current} / {pages}</span><Button size="sm" variant="outline" disabled={current>=pages} onClick={()=>setPage(current+1)}>Sljedeća<ChevronRight className="w-4 h-4"/></Button></div><label>Redova <select className="border rounded p-2 ml-2" value={limit} onChange={e=>setLimit(Number(e.target.value))}>{[25,50,100].map(n=><option key={n}>{n}</option>)}</select></label></footer>
  </div>;
}
