import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Download, FileText, RefreshCw, AlertTriangle, Upload, ExternalLink, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

type TenderDocument = { id: string; name: string; originalUrl: string; fileType: string; localPath?: string | null; parsedText?: string | null; fileSize?: number | null; version?: number; supersededBy?: string | null; textPages?: { page: number; text: string; method: "embedded" | "ocr" }[]; extractionMetadata?: { method?: string; pageCount?: number; warnings?: string[]; tables?: unknown[] } };
type Job = { status: string; progressMessage: string; progressPercent: number; error?: string; result?: { warnings?: string[] } };
export function TenderDocuments({ tenderId }: { tenderId: string; ejnBroj?: string; dbDeadline?: string | null }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TenderDocument | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [pollStarted, setPollStarted] = useState(0);
  const base = `/api/tenders/${tenderId}`;
  const documents = useQuery({ queryKey: [base, "documents"], queryFn: ({ signal }) => customFetch<TenderDocument[]>(`${base}/documents`, { signal }) });
  const refresh = () => { void documents.refetch(); void client.invalidateQueries({ queryKey: [base] }); };
  useEffect(() => { setJobId(null); setSelected(null); setMessage(""); }, [tenderId]);
  const job = useQuery({
    queryKey: [base, "document-job", jobId], enabled: !!jobId,
    queryFn: ({ signal }) => customFetch<Job>(`${base}/documents/scrape/${jobId}`, { signal }),
    retry: 2,
    refetchInterval: query => query.state.error || ["completed", "failed"].includes(query.state.data?.status ?? "") || Date.now() - pollStarted > 10 * 60_000 ? false : 2000,
  });
  useEffect(() => {
    if (!jobId) return;
    if (job.data?.status === "completed" || job.data?.status === "failed") {
      setMessage(job.data.status === "failed" ? (job.data.error || "Preuzimanje nije uspjelo.") : (job.data.result?.warnings?.join(" ") || "Preuzimanje završeno. Provjerite dostupne dokumente i čitljivost teksta ispod."));
      setJobId(null); refresh();
    } else if (job.isError || Date.now() - pollStarted > 10 * 60_000) {
      setMessage("Praćenje preuzimanja je prekinuto. Posao može i dalje raditi; osvježite dokumente prije novog pokušaja."); setJobId(null);
    }
  }, [job.data, job.isError, jobId, pollStarted]);
  const scrape = useMutation({
    mutationFn: () => customFetch<{ jobId: string }>(`${base}/documents/scrape`, { method: "POST" }),
    onSuccess: result => { setPollStarted(Date.now()); setJobId(result.jobId); setMessage(""); },
    onError: (error: Error) => setMessage(error.message),
  });
  const upload = useMutation({
    mutationFn: (files: FileList) => { const body = new FormData(); Array.from(files).forEach(file => body.append("files", file)); return customFetch<{ warnings?: string[] }>(`${base}/documents/upload`, { method: "POST", body }); },
    onSuccess: result => { setMessage(result.warnings?.join(" ") || "Dokumenti su dodani. Pokrenite obradu za ažuriranje pregleda uslova."); refresh(); },
    onError: (error: Error) => setMessage(error.message),
    onSettled: () => { if (input.current) input.current.value = ""; },
  });
  const analyze = useMutation({
    mutationFn: () => customFetch(`${base}/analyze`, { method: "POST" }),
    onSuccess: () => { refresh(); toast.success("Obrada je završena. Rezultati su u kartici AI analiza."); },
    onError: (error: Error) => setMessage(error.message),
  });
  const reprocess = useMutation({
    mutationFn: (doc: TenderDocument) => customFetch<TenderDocument>(`${base}/documents/${doc.id}/reprocess`, { method: "POST" }),
    onSuccess: result => { setMessage(result.extractionMetadata?.warnings?.join(" ") || "Dokument je ponovo pročitan i citati po stranicama su osvježeni."); refresh(); },
    onError: (error: Error) => setMessage(error.message),
  });
  const download = async (doc: TenderDocument) => {
    try {
      const blob = await customFetch<Blob>(`${base}/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = doc.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage((error as Error).message); }
  };
  const links = (documents.data ?? []).filter(doc => doc.fileType === "EJN_PORTAL_LINK");
  const files = (documents.data ?? []).filter(doc => doc.fileType !== "EJN_PORTAL_LINK").sort((a, b) => Number(!!a.supersededBy) - Number(!!b.supersededBy));
  const downloaded = files.filter(doc => doc.localPath || doc.originalUrl.startsWith("file://") || (doc.fileSize ?? 0) > 0);
  const readable = files.filter(doc => doc.parsedText?.trim());
  const busy = !!jobId || scrape.isPending || upload.isPending || analyze.isPending || reprocess.isPending;
  const text = selected?.textPages?.length ? selected.textPages.map(page => `STRANICA ${page.page}${page.method === "ocr" ? " · OCR" : ""}\n${page.text}`).join("\n\n") : selected?.parsedText ?? "";
  const chunks = search ? text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")) : [text];
  return <section className="rounded-xl border bg-white p-5 space-y-5">
    <div><h2 className="font-semibold text-lg">Dokumentacija i obrada</h2><p className="text-sm text-gray-500 mt-1">{downloaded.length} preuzetih datoteka · {readable.length} sa čitljivim tekstom · {links.length} poveznica na portal</p></div>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => scrape.mutate()} disabled={busy}><RefreshCw className={`w-4 h-4 mr-2 ${jobId ? "animate-spin" : ""}`} />{jobId ? "Preuzimanje…" : "Preuzmi s EJN portala"}</Button>
      <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}><Upload className="w-4 h-4 mr-2" />{upload.isPending ? "Dodavanje…" : "Dodaj dokumente"}</Button>
      <input ref={input} aria-label="Dodaj PDF, Word ili tekstualne dokumente" type="file" accept=".pdf,.docx,.txt" multiple className="hidden" onChange={event => { if (event.target.files?.length) upload.mutate(event.target.files); }} />
      <Button variant="outline" onClick={() => analyze.mutate()} disabled={busy || readable.length === 0}><BrainCircuit className="w-4 h-4 mr-2" />{analyze.isPending ? "Obrada…" : "Obradi dokumentaciju"}</Button>
      <Button variant="ghost" onClick={refresh} disabled={documents.isFetching}>Osvježi</Button>
    </div>
    <p className="text-xs text-gray-500">PDF, DOCX ili TXT · do 10 datoteka, najviše 20 MB po datoteci. Skenirani PDF se čita lokalnim OCR-om za bosanski i srpski; navodi prikazuju stranicu, a original ostaje mjerodavan za potpise i složene tabele.</p>
    {jobId && <p role="status" className="text-sm text-blue-700">{job.data?.progressMessage || "Pokretanje preuzimanja…"} {job.data ? `(${job.data.progressPercent}%)` : ""}</p>}
    {(message || documents.isError) && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{documents.isError ? "Dokumente nije moguće učitati. Pokušajte osvježiti." : message}</p>}
    {documents.isLoading ? <p>Učitavanje dokumenata…</p> : files.length === 0 ? <div className="p-8 text-center border border-dashed rounded-lg"><FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" /><p className="font-medium">Nema preuzete dokumentacije</p><p className="text-sm text-gray-500 mt-1">Poveznica na EJN nije preuzeta datoteka. Preuzmite dostupna obavještenja ili dodajte dokumente za obradu.</p></div> : <div className="divide-y border rounded-lg">{files.map(doc => <div key={doc.id} className={`p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between ${doc.supersededBy ? "bg-gray-50 opacity-70" : ""}`}><div className="min-w-0"><div className="flex flex-wrap gap-2 items-center"><p className="font-medium text-sm break-words">{doc.name}</p><span className="text-[11px] rounded-full bg-blue-50 text-blue-800 px-2 py-0.5">v{doc.version || 1}</span>{doc.supersededBy && <span className="text-[11px] rounded-full bg-gray-200 px-2 py-0.5">stara verzija</span>}</div><p className="text-xs text-gray-500 mt-1">{doc.fileType} · {doc.fileSize ? `${Math.ceil(doc.fileSize / 1024)} KB` : "Veličina nije poznata"} · {doc.parsedText?.trim() ? `${doc.extractionMetadata?.method?.includes("ocr") ? "OCR + provjera" : "tekst pročitan"}${doc.extractionMetadata?.pageCount ? ` · ${doc.extractionMetadata.pageCount} str.` : ""}` : "Tekst nije dostupan — ručna provjera"}</p>{!!doc.extractionMetadata?.warnings?.length && <p className="text-xs text-amber-700 mt-1">{doc.extractionMetadata.warnings.join(" ")}</p>}</div><div className="flex flex-wrap gap-2 shrink-0"><Button variant="outline" size="sm" onClick={() => { setSelected(doc); setSearch(""); }} disabled={!doc.parsedText?.trim()}>Pregled teksta</Button><Button variant="outline" size="sm" onClick={() => reprocess.mutate(doc)} disabled={busy}>{reprocess.isPending && reprocess.variables?.id === doc.id ? "Čitanje…" : "Ponovi čitanje"}</Button><Button variant="ghost" size="sm" onClick={() => void download(doc)} aria-label={`Preuzmi ${doc.name}`}><Download className="w-4 h-4" /></Button></div></div>)}</div>}
    {links.map(doc => <a key={doc.id} className="text-sm text-primary flex gap-2 items-center" href={doc.originalUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" />Otvori dokumentaciju na EJN portalu (nije preuzeta datoteka)</a>)}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-w-4xl max-h-[90vh] flex flex-col"><DialogHeader><DialogTitle>{selected?.name} · v{selected?.version || 1}</DialogTitle><DialogDescription>Tekst je razdvojen po stranicama radi provjerljivih citata. OCR navodi zahtijevaju poređenje s originalom.</DialogDescription></DialogHeader><Input aria-label="Pretraži tekst dokumenta" placeholder="Pretraži tekst dokumenta…" value={search} onChange={event => setSearch(event.target.value)} /><div className="overflow-auto whitespace-pre-wrap text-sm leading-relaxed p-2">{chunks.map((chunk, i) => search && chunk.toLocaleLowerCase() === search.toLocaleLowerCase() ? <mark key={i}>{chunk}</mark> : <span key={i}>{chunk}</span>)}</div></DialogContent></Dialog>
  </section>;
}
