import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  Download,
  FileText,
  RefreshCw,
  AlertTriangle,
  Upload,
  ExternalLink,
  BrainCircuit,
  Sparkles,
  CheckCircle2,
  FileArchive,
  Search,
  ShieldCheck,
  Zap,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

type TenderDocument = {
  id: string;
  name: string;
  originalUrl: string;
  fileType: string;
  localPath?: string | null;
  parsedText?: string | null;
  fileSize?: number | null;
  version?: number;
  supersededBy?: string | null;
  keyData?: Record<string, any> | null;
  textPages?: { page: number; text: string; method: "embedded" | "ocr" }[];
  extractionMetadata?: { method?: string; pageCount?: number; warnings?: string[]; tables?: unknown[] };
};

type Job = {
  status: string;
  progressMessage: string;
  progressPercent: number;
  error?: string;
  result?: { warnings?: string[]; summaryMessage?: string };
};

export function TenderDocuments({
  tenderId,
  ejnBroj,
  dbDeadline,
}: {
  tenderId: string;
  ejnBroj?: string;
  dbDeadline?: string | null;
}) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TenderDocument | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [pollStarted, setPollStarted] = useState(0);

  const base = `/api/tenders/${tenderId}`;
  const documents = useQuery({
    queryKey: [base, "documents"],
    queryFn: ({ signal }) => customFetch<TenderDocument[]>(`${base}/documents`, { signal }),
  });

  const refresh = () => {
    void documents.refetch();
    void client.invalidateQueries({ queryKey: [base] });
    void client.invalidateQueries({ queryKey: [`/api/tenders/${tenderId}`] });
    void client.invalidateQueries({ queryKey: ["tenders", tenderId] });
  };

  useEffect(() => {
    setJobId(null);
    setSelected(null);
    setMessage("");
  }, [tenderId]);

  const job = useQuery({
    queryKey: [base, "document-job", jobId],
    enabled: !!jobId,
    queryFn: ({ signal }) => customFetch<Job>(`${base}/documents/scrape/${jobId}`, { signal }),
    retry: 2,
    refetchInterval: (query) =>
      query.state.error ||
      ["completed", "failed"].includes(query.state.data?.status ?? "") ||
      Date.now() - pollStarted > 10 * 60_000
        ? false
        : 1500,
  });

  useEffect(() => {
    if (!jobId) return;
    if (job.data?.status === "completed" || job.data?.status === "failed") {
      const isFailed = job.data.status === "failed";
      const displayMsg = isFailed
        ? (job.data.error || "Preuzimanje nije uspjelo.")
        : (job.data.result?.summaryMessage || "Preuzimanje i AI obrada su uspješno završeni.");

      setMessage(displayMsg);
      if (isFailed) {
        toast.error("Greška pri obradi", { description: displayMsg });
      } else {
        toast.success("Dokumentacija spremna", { description: displayMsg });
      }
      setJobId(null);
      refresh();
    } else if (job.isError || Date.now() - pollStarted > 10 * 60_000) {
      setMessage("Praćenje preuzimanja je isteklo. Osvježite dokumente.");
      setJobId(null);
    }
  }, [job.data, job.isError, jobId, pollStarted]);

  const scrape = useMutation({
    mutationFn: () => customFetch<{ jobId: string }>(`${base}/documents/scrape`, { method: "POST" }),
    onSuccess: (result) => {
      setPollStarted(Date.now());
      setJobId(result.jobId);
      setMessage("");
      toast.info("Pokrenuto automatsko preuzimanje sa EJN-a", {
        description: "Sistem preuzima TD arhivu i pokreće AI obradu.",
      });
    },
    onError: (error: Error) => {
      setMessage(error.message);
      toast.error("Greška pri pokretanju", { description: error.message });
    },
  });

  const upload = useMutation({
    mutationFn: (files: FileList) => {
      const body = new FormData();
      Array.from(files).forEach((file) => body.append("files", file));
      return customFetch<{ warnings?: string[] }>(`${base}/documents/upload`, { method: "POST", body });
    },
    onSuccess: (result) => {
      setMessage(result.warnings?.join(" ") || "Dokumenti su dodani. Pokrenite obradu za ažuriranje pregleda uslova.");
      refresh();
      toast.success("Dokumenti uspješno učitani.");
    },
    onError: (error: Error) => setMessage(error.message),
    onSettled: () => {
      if (input.current) input.current.value = "";
    },
  });

  const analyze = useMutation({
    mutationFn: () => customFetch(`${base}/analyze`, { method: "POST" }),
    onSuccess: () => {
      refresh();
      toast.success("AI obrada je završena. Rezultati su osvježeni.");
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const reprocess = useMutation({
    mutationFn: (doc: TenderDocument) =>
      customFetch<TenderDocument>(`${base}/documents/${doc.id}/reprocess`, { method: "POST" }),
    onSuccess: (result) => {
      setMessage(result.extractionMetadata?.warnings?.join(" ") || "Dokument je ponovo pročitan.");
      refresh();
      toast.success("Dokument ponovo pročitan");
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const download = async (doc: TenderDocument) => {
    try {
      const blob = await customFetch<Blob>(`${base}/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const links = (documents.data ?? []).filter((doc) => doc.fileType === "EJN_PORTAL_LINK");
  const files = (documents.data ?? [])
    .filter((doc) => doc.fileType !== "EJN_PORTAL_LINK")
    .sort((a, b) => Number(!!a.supersededBy) - Number(!!b.supersededBy));
  const downloaded = files.filter(
    (doc) => doc.localPath || doc.originalUrl.startsWith("file://") || (doc.fileSize ?? 0) > 0
  );
  const readable = files.filter((doc) => doc.parsedText?.trim());
  const isBusy = !!jobId || scrape.isPending || upload.isPending || analyze.isPending || reprocess.isPending;

  const text = selected?.textPages?.length
    ? selected.textPages.map((page) => `STRANICA ${page.page}${page.method === "ocr" ? " · OCR" : ""}\n${page.text}`).join("\n\n")
    : selected?.parsedText ?? "";
  const chunks = search ? text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")) : [text];

  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case "TENDERSKA_DOK":
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700">Tenderska Dokumentacija</Badge>;
      case "ANEKS":
        return <Badge className="bg-amber-600 text-white hover:bg-amber-700">Aneks / Izmjena</Badge>;
      case "POJASNJENJE":
        return <Badge className="bg-purple-600 text-white hover:bg-purple-700">Pojašnjenje</Badge>;
      case "DODJELA":
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Dodjela ugovora</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-700">Obavještenje</Badge>;
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-xs">
      {/* HEADER WITH EJN STATUS & ACTION CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-bold text-xl text-slate-900 flex items-center gap-2">
              <FileArchive className="w-5 h-5 text-blue-600" />
              Tenderska dokumentacija i EJN integracija
            </h2>
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              EJN Portal povezan
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {downloaded.length} preuzetih datoteka · {readable.length} sa čitljivim tekstom · {links.length} poveznica
            {ejnBroj ? ` · Broj obavještenja: ${ejnBroj}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => scrape.mutate()}
            disabled={isBusy}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-sm"
          >
            {jobId ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
            )}
            {jobId ? "Obrada u toku..." : "Automatski preuzmi i obradi sa EJN"}
          </Button>

          <Button
            variant="outline"
            onClick={() => input.current?.click()}
            disabled={isBusy}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Upload className="w-4 h-4 mr-2 text-slate-500" />
            {upload.isPending ? "Dodavanje..." : "Dodaj datoteke"}
          </Button>
          <input
            ref={input}
            aria-label="Dodaj PDF, Word ili tekstualne dokumente"
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) upload.mutate(event.target.files);
            }}
          />

          <Button
            variant="outline"
            onClick={() => analyze.mutate()}
            disabled={isBusy || readable.length === 0}
            className="border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            <BrainCircuit className="w-4 h-4 mr-2 text-purple-600" />
            {analyze.isPending ? "Analiza..." : "Pokreni AI analizu"}
          </Button>

          <Button variant="ghost" size="sm" onClick={refresh} disabled={documents.isFetching} className="text-slate-500">
            <RefreshCw className={`w-4 h-4 ${documents.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* QUICK COMPLIANCE BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/80 border border-emerald-200/90 rounded-xl px-4 py-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5 text-emerald-900">
          <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold text-emerald-950">ZJN Kontrola usklađenosti &amp; Obavezni dokazi: </span>
            <span className="text-emerald-800">
              Pripremite dokaze o ličnoj sposobnosti (čl. 45), AZOBiH dozvolu, solventnost (čl. 46) i bankarsku garanciju za ozbiljnost ponude.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const btn = document.querySelector('[data-state][value="kontrola-ponude"]') as HTMLButtonElement;
            if (btn) btn.click();
          }}
          className="shrink-0 font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100/70 hover:bg-emerald-200/80 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer self-start sm:self-center"
        >
          Otvori ZJN checklistu →
        </button>
      </div>
      {jobId && (
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="font-semibold text-blue-900 text-sm">
                {job.data?.progressMessage || "Pokretanje preuzimanja sa EJN portala..."}
              </span>
            </div>
            <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-blue-100 text-blue-800">
              {job.data?.progressPercent ?? 10}%
            </span>
          </div>

          <div className="w-full bg-blue-200/60 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(5, job.data?.progressPercent ?? 10)}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-semibold text-slate-600">
            <div className={`flex items-center gap-1.5 ${(job.data?.progressPercent ?? 0) >= 15 ? "text-blue-700 font-bold" : "opacity-60"}`}>
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              1. Preuzimanje sa EJN
            </div>
            <div className={`flex items-center gap-1.5 ${(job.data?.progressPercent ?? 0) >= 65 ? "text-blue-700 font-bold" : "opacity-60"}`}>
              <span className={`w-2 h-2 rounded-full ${(job.data?.progressPercent ?? 0) >= 65 ? "bg-blue-600" : "bg-slate-300"}`} />
              2. Ekstrakcija & OCR
            </div>
            <div className={`flex items-center gap-1.5 ${(job.data?.progressPercent ?? 0) >= 85 ? "text-blue-700 font-bold" : "opacity-60"}`}>
              <span className={`w-2 h-2 rounded-full ${(job.data?.progressPercent ?? 0) >= 85 ? "bg-blue-600" : "bg-slate-300"}`} />
              3. Sena AI Analiza
            </div>
          </div>
        </div>
      )}

      {/* ALERT / MESSAGE */}
      {(message || documents.isError) && !jobId && (
        <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{documents.isError ? "Dokumente nije moguće učitati sa servera." : message}</p>
          </div>
        </div>
      )}

      {/* HERO CTA IF NO DOCUMENTS ARE DOWNLOADED YET */}
      {!documents.isLoading && files.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-b from-blue-50/40 to-slate-50/60 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
            <Zap className="w-7 h-7 text-blue-600" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="font-bold text-base text-slate-900">
              Dokumentacija još nije preuzeta u aplikaciju
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tender trenutno ima samo evidenciju sa portala. Kliknite ispod za automatsko preuzimanje tenderske arhive sa EJN-a, ekstrakciju tekstova i kompletnu AI analizu uslova učešća.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => scrape.mutate()}
            disabled={isBusy}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md px-6"
          >
            <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
            Automatski preuzmi i obradi dokumentaciju sa EJN
          </Button>
        </div>
      )}

      {/* DOCUMENT LIST */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Preuzete datoteke i prilozi ({files.length})
          </h4>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            {files.map((doc) => (
              <div
                key={doc.id}
                className={`p-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between transition-colors hover:bg-slate-50/80 ${
                  doc.supersededBy ? "bg-slate-50/70 opacity-60" : ""
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <p className="font-semibold text-sm text-slate-900 break-words">{doc.name}</p>
                    {getDocTypeBadge(doc.fileType)}
                    <span className="text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 border border-slate-200">
                      v{doc.version || 1}
                    </span>
                    {doc.supersededBy && (
                      <span className="text-[10px] rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
                        zamijenjeno novijom verzijom
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <span>{doc.fileSize ? `${Math.ceil(doc.fileSize / 1024)} KB` : "Veličina nije poznata"}</span>
                    <span>·</span>
                    {doc.parsedText?.trim() ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {doc.extractionMetadata?.method?.includes("ocr") ? "OCR tekst izvučen" : "Tekst pročitan"}
                        {doc.extractionMetadata?.pageCount ? ` (${doc.extractionMetadata.pageCount} str.)` : ""}
                      </span>
                    ) : (
                      <span className="text-amber-600">Tekst nije dostupan</span>
                    )}
                  </p>

                  {/* KEY EXTRACTED METRICS BADGES IF PRESENT */}
                  {doc.keyData && Object.keys(doc.keyData).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {doc.keyData.garancija_iznos && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                          Garancija: {doc.keyData.garancija_iznos} KM
                        </span>
                      )}
                      {doc.keyData.rok_isporuke_dani && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                          Rok isporuke: {doc.keyData.rok_isporuke_dani} dana
                        </span>
                      )}
                      {doc.keyData.kontakt_email && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {doc.keyData.kontakt_email}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelected(doc);
                      setSearch("");
                    }}
                    disabled={!doc.parsedText?.trim()}
                    className="text-xs border-slate-200"
                  >
                    <Search className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    Pregled teksta
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reprocess.mutate(doc)}
                    disabled={isBusy}
                    className="text-xs border-slate-200"
                  >
                    {reprocess.isPending && reprocess.variables?.id === doc.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    )}
                    Ponovi OCR
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void download(doc)}
                    aria-label={`Preuzmi ${doc.name}`}
                    className="text-slate-600 hover:text-blue-600"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PORTAL EXTERNAL LINKS */}
      {links.length > 0 && (
        <div className="pt-2">
          {links.map((doc) => (
            <a
              key={doc.id}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
              href={doc.originalUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Otvori izvorno obavještenje na EJN portalu (pregled u pretraživaču)
            </a>
          ))}
        </div>
      )}

      {/* TEXT PREVIEW MODAL */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {selected?.name} · v{selected?.version || 1}
            </DialogTitle>
            <DialogDescription>
              Tekst je indeksiran po stranicama. Koristite pretragu za brzo pronalaženje ključnih članova i zahtjeva.
            </DialogDescription>
          </DialogHeader>

          <Input
            aria-label="Pretraži tekst dokumenta"
            placeholder="Pretraži tekst dokumenta (npr. garancija, kasko, rok, standard)..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="my-2"
          />

          <div className="overflow-auto max-h-[60vh] bg-slate-50 rounded-xl p-4 border border-slate-200 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {chunks.map((chunk, i) =>
              search && chunk.toLocaleLowerCase() === search.toLocaleLowerCase() ? (
                <mark key={i} className="bg-amber-300 text-slate-900 rounded-xs px-0.5">
                  {chunk}
                </mark>
              ) : (
                <span key={i}>{chunk}</span>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
