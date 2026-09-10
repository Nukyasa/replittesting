import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { RefreshCw, ExternalLink, AlertTriangle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type SourceState = {
  source: string; status: string; lastRun?: string | null; nextRun?: string | null;
  tendersFound: number; tendersNew?: number; tendersUpdated?: number;
  lastError?: string | null; warnings?: string[]; hasMore?: boolean; message?: string; supported?: boolean;
};
export function EjnSyncPanel() {
  const client = useQueryClient();
  const previouslyRunning = useRef(false);
  const status = useQuery({
    queryKey: ["/api/scraper/status"],
    queryFn: () => customFetch<{ sources: SourceState[]; isRunning: boolean }>("/api/scraper/status"),
    refetchInterval: query => query.state.data?.isRunning ? 2500 : 30000,
  });
  const trigger = useMutation({
    mutationFn: () => customFetch("/api/scraper/trigger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "ejn", maxPages: 5, processDocuments: true }) }),
    onSuccess: () => { previouslyRunning.current = true; void status.refetch(); toast.success("Preuzimanje s EJN portala je pokrenuto."); },
    onError: (error: Error) => { toast.error(error.message); void status.refetch(); },
  });
  const running = status.data?.isRunning || trigger.isPending;
  const ejn = status.data?.sources.find(s => s.source === "ejn" || s.source === "ejn_openapi");
  const warnings = [...new Set((ejn?.warnings ?? []).map(warning => warning.replace(/Dokumentacija [0-9a-f-]{36}:/gi, "Dokumentacija:")))];
  useEffect(() => {
    if (!status.data) return;
    if (previouslyRunning.current && !status.data.isRunning) {
      void client.invalidateQueries({ predicate: query => {
        const key = String(query.queryKey[0]);
        return key.includes("/api/tenders") || key.includes("/api/analytics") || key === "kanbanBoard";
      } });
    }
    previouslyRunning.current = status.data.isRunning;
  }, [status.data, client]);
  const stateText = running ? "Sinhronizacija je u toku" : ejn?.status === "failed" ? "Sinhronizacija nije uspjela" : ejn?.status === "partial" ? "Djelimično sinhronizovano" : ejn?.lastRun ? "Posljednja sinhronizacija" : "Spremno za sinhronizaciju";
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Sinhronizacija tendera s EJN portala">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Database className="h-5 w-5" />
        </span>
        <div><h2 className="text-base font-semibold text-slate-950">EJN sinhronizacija</h2>
          <p className="mt-0.5 text-sm text-slate-600">Nova obavještenja provjeravaju se automatski svakih 15 minuta dok server radi.</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" asChild><a href="https://www.ejn.gov.ba/Announcement/Search" target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Otvori EJN</a></Button>
        <Button size="sm" onClick={() => trigger.mutate()} disabled={!!running || status.isLoading || status.isError}><RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />{running ? "Sinhronizujem…" : ejn?.hasMore ? "Nastavi sinhronizaciju" : "Sinhronizuj sada"}</Button>
      </div>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:text-sm" role="status" aria-live="polite">
      <span className="font-medium text-slate-700">{stateText}{ejn?.lastRun && !running ? `: ${new Date(ejn.lastRun).toLocaleString("bs-BA")}` : ""}</span>
      {ejn?.lastRun && <span>{ejn.tendersFound} obrađeno · {ejn.tendersNew ?? 0} novih · {ejn.tendersUpdated ?? 0} ažuriranih</span>}
    </div>
    {(status.isError || ejn?.lastError) && <p role="alert" className="text-sm text-amber-800 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{status.isError ? "Status preuzimanja trenutno nije dostupan. Provjerite vezu sa serverom." : ejn?.lastError}</p>}
    {warnings.length > 0 && <details className="text-xs text-amber-800"><summary className="cursor-pointer font-medium">Napomene o preuzimanju i dostupnosti dokumentacije ({warnings.length})</summary><div className="space-y-2 mt-2 max-h-48 overflow-auto">{warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div></details>}
    <p className="text-xs text-slate-500">Za pripremu ponude otvorite tender, dodajte dokumentaciju i pratite napredak u Kanbanu.</p>
  </section>;
}
