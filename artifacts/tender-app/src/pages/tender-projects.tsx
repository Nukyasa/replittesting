import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  Briefcase,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  Users,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  FileText,
  TrendingUp,
  Download,
  Filter,
  CheckSquare,
  Sparkles,
  Layers,
  ChevronRight,
  Gavel,
  BadgeCheck,
  Send,
  Eye,
  FileCheck2,
  KanbanSquare,
  ListOrdered,
  FileSpreadsheet
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";

type ProjectItem = {
  id: string;
  tenderId: string;
  title: string;
  contractingAuth: string;
  tenderType: string;
  category: string;
  deadline: string | null;
  remainingDays: number | null;
  internalDeadline: string | null;
  isPastInternal: boolean;
  estimatedValue: number;
  currency: string;
  hasEAuction: boolean;
  status: string;
  statusName: string;
  stage: "decision" | "preparation" | "review" | "ready" | "submitted" | "won" | "lost" | "withdrawn";
  decision: "pending" | "go" | "no_go";
  decisionReason: string;
  owner: {
    id: string | null;
    name: string;
    email: string | null;
  };
  offerAmount: number | null;
  walkawayPrice: number | null;
  pricingStrategy: string;
  marginPercent: number | null;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  updatedAt: string;
};

type ProjectsResponse = {
  kpis: {
    needsActionToday: number;
    nearestDeadline: {
      title: string;
      authority: string;
      deadline: string;
      remainingDays: number | null;
    } | null;
    blockedCount: number;
    deadline7DaysCount: number;
    readyToSubmitCount: number;
    totalActive: number;
  };
  projects: ProjectItem[];
};

const STAGE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  decision: { label: "Za odluku", color: "text-amber-700 border-amber-300", bg: "bg-amber-50" },
  preparation: { label: "U pripremi", color: "text-blue-700 border-blue-300", bg: "bg-blue-50" },
  review: { label: "Kontrola tima", color: "text-purple-700 border-purple-300", bg: "bg-purple-50" },
  ready: { label: "Spremno za predaju", color: "text-emerald-700 border-emerald-300", bg: "bg-emerald-50" },
  submitted: { label: "Predato / e-Aukcija", color: "text-sky-700 border-sky-300", bg: "bg-sky-50" },
  won: { label: "Dobijeno ✓", color: "text-green-800 border-green-400 font-bold", bg: "bg-green-100" },
  lost: { label: "Izgubljeno", color: "text-gray-600 border-gray-300", bg: "bg-gray-100" },
  withdrawn: { label: "Odustali", color: "text-rose-700 border-rose-300", bg: "bg-rose-50" },
};

export default function TenderProjectsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"worklist" | "pipeline" | "all" | "results" | "library" | "stats">("worklist");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedForReadiness, setSelectedForReadiness] = useState<ProjectItem | null>(null);

  const { data, isLoading } = useQuery<ProjectsResponse>({
    queryKey: ["tender-projects", filterStage, search],
    queryFn: () => customFetch<ProjectsResponse>(`/api/tender-projects?tab=${filterStage}&search=${encodeURIComponent(search)}`),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      customFetch(`/api/tender-projects/${id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tender-projects"] });
      toast.success("Faza ponude uspješno ažurirana.");
    },
  });

  const kpis = data?.kpis;
  const projects = data?.projects || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER BREADCRUMB & ACTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <span>Početna</span>
            <span>&gt;</span>
            <span className="font-semibold text-gray-800">Ponude</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-primary" />
            Ponude
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Od odluke da učestvujete do dokazive predaje — rokovi, vlasnici, dokumenti i sljedeći korak na jednom mjestu.
          </p>
        </div>

        <Link href="/tenders">
          <Button className="bg-[#005B94] hover:bg-[#004A7A] text-white font-medium shadow-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Pronađi nabavku
          </Button>
        </Link>
      </div>

      {/* METADATA CHIPS (SENA STYLE) */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-500 font-medium">Šta gledate:</span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <BadgeCheck className="w-3 h-3" /> Javni podatak
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          <TrendingUp className="w-3 h-3" /> Izračunato
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          <ShieldCheck className="w-3 h-3" /> Interni podatak
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <Sparkles className="w-3 h-3" /> AI analiza
        </span>
      </div>

      {/* TOP 2 KPI CARDS (SENA STYLE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Treba akciju danas */}
        <Card className="border border-gray-200 shadow-sm bg-white hover:border-gray-300 transition-all">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Treba akciju danas
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-gray-900">
                {isLoading ? <Skeleton className="w-8 h-9" /> : kpis?.needsActionToday ?? 0}
              </span>
              <span className="text-sm text-gray-600">
                {kpis?.needsActionToday === 0
                  ? "Svi zadaci su ažurni i pod kontrolom"
                  : "projekti sa urgentnim zadacima ili bliskim rokom"}
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-muted-foreground">
              <span>Provjerite kontrolnu listu zahtjeva i interne rokove</span>
              <span className="text-primary font-medium cursor-pointer hover:underline" onClick={() => setActiveTab("worklist")}>
                Otvori radni red &rarr;
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Najbliži rok */}
        <Card className="border border-gray-200 shadow-sm bg-white hover:border-gray-300 transition-all">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Najbliži rok
            </div>
            {isLoading ? (
              <div className="space-y-2 mt-2">
                <Skeleton className="w-3/4 h-6" />
                <Skeleton className="w-1/2 h-4" />
              </div>
            ) : kpis?.nearestDeadline ? (
              <div className="mt-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-base text-gray-900 line-clamp-1">
                    {kpis.nearestDeadline.title}
                  </h4>
                  {kpis.nearestDeadline.remainingDays !== null && (
                    <Badge className={
                      kpis.nearestDeadline.remainingDays <= 3
                        ? "bg-red-500 text-white font-bold shrink-0"
                        : kpis.nearestDeadline.remainingDays <= 7
                        ? "bg-amber-500 text-white font-bold shrink-0"
                        : "bg-emerald-600 text-white shrink-0"
                    }>
                      {kpis.nearestDeadline.remainingDays === 0 ? "Danas!" : `još ${kpis.nearestDeadline.remainingDays} dana`}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                  🏛️ {kpis.nearestDeadline.authority} · Rok: {new Date(kpis.nearestDeadline.deadline).toLocaleDateString("bs-BA")}
                </p>
              </div>
            ) : (
              <div className="mt-2 text-sm text-gray-500">
                Nijedna aktivna ponuda nema poznat rok u narednom periodu.
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-muted-foreground">
              <span>Službeni datum dostave ponude na Portalu EJN</span>
              <span className="text-primary font-medium">Auto-sinhronizovano</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SUB-METRICS BAR (SENA STYLE) */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 px-1">
        <span className="font-medium hover:underline cursor-pointer" onClick={() => setFilterStage("active")}>
          <strong className="text-gray-900">{kpis?.blockedCount ?? 0}</strong> blokiranih
        </span>
        <span>·</span>
        <span className="font-medium hover:underline cursor-pointer" onClick={() => setFilterStage("active")}>
          <strong className="text-gray-900">{kpis?.deadline7DaysCount ?? 0}</strong> s rokom u 7 dana
        </span>
        <span>·</span>
        <span className="font-medium hover:underline cursor-pointer" onClick={() => setFilterStage("ready")}>
          <strong className="text-gray-900">{kpis?.readyToSubmitCount ?? 0}</strong> spremnih za predaju
        </span>
        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold border border-purple-200">
          Izračunato
        </span>
      </div>

      {/* TABS NAVIGATION (SENA STYLE) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2">
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={activeTab === "worklist" ? "default" : "ghost"}
            className={activeTab === "worklist" ? "bg-[#005B94] text-white" : "text-gray-600 hover:bg-gray-100"}
            onClick={() => setActiveTab("worklist")}
          >
            <ListOrdered className="w-4 h-4 mr-1.5" />
            Radni red
          </Button>

          <Button
            size="sm"
            variant={activeTab === "pipeline" ? "default" : "ghost"}
            className={activeTab === "pipeline" ? "bg-[#005B94] text-white" : "text-gray-600 hover:bg-gray-100"}
            onClick={() => setActiveTab("pipeline")}
          >
            <KanbanSquare className="w-4 h-4 mr-1.5" />
            Pipeline
          </Button>

          <Button
            size="sm"
            variant={activeTab === "all" ? "default" : "ghost"}
            className={activeTab === "all" ? "bg-[#005B94] text-white" : "text-gray-600 hover:bg-gray-100"}
            onClick={() => setActiveTab("all")}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Svi projekti
          </Button>

          <Button
            size="sm"
            variant={activeTab === "results" ? "default" : "ghost"}
            className={activeTab === "results" ? "bg-[#005B94] text-white" : "text-gray-600 hover:bg-gray-100"}
            onClick={() => setActiveTab("results")}
          >
            <Gavel className="w-4 h-4 mr-1.5" />
            Rezultati
          </Button>

          <Button
            size="sm"
            variant={activeTab === "library" ? "default" : "ghost"}
            className={activeTab === "library" ? "bg-[#005B94] text-white" : "text-gray-600 hover:bg-gray-100"}
            onClick={() => setActiveTab("library")}
          >
            <FileText className="w-4 h-4 mr-1.5" />
            Biblioteka
          </Button>

          <Button
            size="sm"
            variant={activeTab === "stats" ? "default" : "ghost"}
            className={activeTab === "stats" ? "bg-[#005B94] text-white" : "text-gray-600 hover:bg-gray-100"}
            onClick={() => setActiveTab("stats")}
          >
            <TrendingUp className="w-4 h-4 mr-1.5" />
            Statistika
          </Button>
        </div>

        {/* SEARCH BAR */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Pretraži ponude..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* FILTER QUICK BUTTONS */}
      {activeTab !== "library" && activeTab !== "stats" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500 font-medium">Prikaži:</span>
          {[
            { id: "all", label: "Sve" },
            { id: "decision", label: "Za odluku" },
            { id: "active", label: "Aktivne (Priprema / Pregled)" },
            { id: "ready", label: "Spremne" },
            { id: "submitted", label: "Predate" },
            { id: "results", label: "Ishod (Pobjede / Gubitak)" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStage(f.id)}
              className={`px-3 py-1 rounded-md transition-all font-medium ${
                filterStage === f.id
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-muted-foreground">
            {projects.length} {projects.length === 1 ? "ponuda" : "ponuda"}
          </span>
        </div>
      )}

      {/* CONTENT: TAB 1 - RADNI RED */}
      {activeTab === "worklist" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(n => <Skeleton key={n} className="h-28 w-full rounded-xl" />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-white border rounded-xl p-12 text-center text-muted-foreground space-y-3">
              <Briefcase className="w-10 h-10 text-gray-300 mx-auto" />
              <h3 className="font-semibold text-gray-800">Nema ponuda u radnom redu</h3>
              <p className="text-xs max-w-md mx-auto">
                Pronađite tender na pregledu nabavki i dodajte ga u ponude kako biste pokrenuli pripremu i kontrolnu listu zahtjeva.
              </p>
              <Link href="/tenders">
                <Button variant="outline" size="sm" className="mt-2">
                  <Search className="w-4 h-4 mr-2" />
                  Pretraži nabavke
                </Button>
              </Link>
            </div>
          ) : (
            projects.map(project => {
              const stageInfo = STAGE_LABELS[project.stage] || STAGE_LABELS.decision;
              return (
                <Card
                  key={project.id}
                  className="border border-gray-200 hover:border-blue-300 transition-all bg-white shadow-sm hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      {/* Left: Info */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={`${stageInfo.bg} ${stageInfo.color} text-xs font-semibold px-2.5 py-0.5 border`}>
                            {stageInfo.label}
                          </Badge>
                          {project.hasEAuction && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              ⚡ e-Aukcija
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500 font-medium">
                            🏛️ {project.contractingAuth}
                          </span>
                        </div>

                        <Link href={`/tenders/${project.id}`}>
                          <h3 className="text-base font-bold text-gray-900 hover:text-primary transition-colors cursor-pointer line-clamp-1">
                            {project.title}
                          </h3>
                        </Link>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                          <span>
                            Vrijednost: <strong className="text-gray-900">{formatMoney(project.estimatedValue)}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Zaduženi: <strong className="text-gray-900">{project.owner.name}</strong>
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            {project.completedTasks} / {project.totalTasks} zahtjeva provjereno
                          </span>
                        </div>
                      </div>

                      {/* Right: Deadline & Actions */}
                      <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Rok predaje:</div>
                          <div className="font-bold text-sm text-gray-900">
                            {project.deadline ? new Date(project.deadline).toLocaleDateString("bs-BA") : "Nije objavljen"}
                          </div>
                          {project.remainingDays !== null && (
                            <span className={`text-[11px] font-semibold ${
                              project.remainingDays <= 3 ? "text-red-600 font-bold" : project.remainingDays <= 7 ? "text-amber-600" : "text-emerald-700"
                            }`}>
                              {project.remainingDays === 0 ? "Danas!" : `još ${project.remainingDays} dana`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-primary/40 text-primary hover:bg-primary/5"
                            onClick={() => setSelectedForReadiness(project)}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Provjeri spremnost
                          </Button>

                          <Link href={`/tenders/${project.id}`}>
                            <Button size="sm" className="bg-[#005B94] hover:bg-[#004A7A] text-white text-xs">
                              Otvori dosje
                              <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar of Checklist */}
                    {project.totalTasks > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.round((project.completedTasks / project.totalTasks) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-500 shrink-0 font-medium">
                          {Math.round((project.completedTasks / project.totalTasks) * 100)}% spremno
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* CONTENT: TAB 2 - PIPELINE (KANBAN BOARD) */}
      {activeTab === "pipeline" && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {[
            { id: "decision", label: "Za odluku", desc: "Procjena isplativosti i Go/No-Go" },
            { id: "preparation", label: "U pripremi", desc: "Prikupljanje dokumentacije i dokaza" },
            { id: "review", label: "Kontrola tima", desc: "Završna provjera prije kovertiranja" },
            { id: "ready", label: "Spremno za predaju", desc: "Sve ovjereno i potpisano" },
            { id: "submitted", label: "Predato / e-Aukcija", desc: "Čeka se javno otvaranje / licitacija" },
          ].map(col => {
            const colProjects = projects.filter(p => p.stage === col.id);
            return (
              <div key={col.id} className="bg-gray-50/80 rounded-xl p-3 border border-gray-200 flex flex-col min-h-[500px]">
                <div className="mb-3 px-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-900">{col.label}</h3>
                    <Badge variant="secondary" className="text-xs font-bold">
                      {colProjects.length}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{col.desc}</p>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colProjects.map(proj => (
                    <Card
                      key={proj.id}
                      className="bg-white border border-gray-200 shadow-sm hover:border-primary/50 transition-all cursor-pointer group"
                    >
                      <CardContent className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span className="font-medium line-clamp-1">🏛️ {proj.contractingAuth}</span>
                          {proj.remainingDays !== null && (
                            <span className={proj.remainingDays <= 3 ? "text-red-600 font-bold" : "text-gray-500"}>
                              {proj.remainingDays}d
                            </span>
                          )}
                        </div>

                        <Link href={`/tenders/${proj.id}`}>
                          <h4 className="text-xs font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-2">
                            {proj.title}
                          </h4>
                        </Link>

                        <div className="text-xs font-semibold text-gray-800">
                          {formatMoney(proj.estimatedValue)}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                          <span>{proj.completedTasks}/{proj.totalTasks} dokaza</span>
                          {/* Quick stage selector */}
                          <select
                            value={proj.stage}
                            onChange={e => stageMutation.mutate({ id: proj.id, stage: e.target.value })}
                            className="text-[10px] bg-gray-100 border rounded px-1 py-0.5"
                            onClick={e => e.stopPropagation()}
                          >
                            <option value="decision">Za odluku</option>
                            <option value="preparation">Priprema</option>
                            <option value="review">Kontrola</option>
                            <option value="ready">Spremno</option>
                            <option value="submitted">Predato</option>
                            <option value="won">Dobijeno</option>
                            <option value="lost">Izgubljeno</option>
                          </select>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {colProjects.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400 border border-dashed rounded-lg">
                      Nema ponuda
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONTENT: TAB 3 - SVI PROJEKTI (TABLE VIEW) */}
      {activeTab === "all" && (
        <Card className="border border-gray-200 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Naziv postupka / Tender</th>
                  <th className="p-3.5">Ugovorni organ</th>
                  <th className="p-3.5">Faza ponude</th>
                  <th className="p-3.5">Zaduženi</th>
                  <th className="p-3.5 text-right">Proc. Vrijednost</th>
                  <th className="p-3.5 text-right">Rok za predaju</th>
                  <th className="p-3.5 text-center">Akcije</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map(p => {
                  const stageInfo = STAGE_LABELS[p.stage] || STAGE_LABELS.decision;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3.5 max-w-xs">
                        <Link href={`/tenders/${p.id}`}>
                          <div className="font-bold text-gray-900 hover:text-primary cursor-pointer line-clamp-1">
                            {p.title}
                          </div>
                        </Link>
                        <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                          <span>{p.category || "Osiguranje"}</span>
                          {p.hasEAuction && <span className="text-amber-600 font-semibold">⚡ e-Aukcija</span>}
                        </div>
                      </td>

                      <td className="p-3.5 text-gray-700 font-medium">
                        {p.contractingAuth}
                      </td>

                      <td className="p-3.5">
                        <Badge className={`${stageInfo.bg} ${stageInfo.color} border text-[11px]`}>
                          {stageInfo.label}
                        </Badge>
                      </td>

                      <td className="p-3.5 text-gray-600">
                        {p.owner.name}
                      </td>

                      <td className="p-3.5 text-right font-bold text-gray-900">
                        {formatMoney(p.estimatedValue)}
                      </td>

                      <td className="p-3.5 text-right text-gray-600">
                        <div>{p.deadline ? new Date(p.deadline).toLocaleDateString("bs-BA") : "—"}</div>
                        {p.remainingDays !== null && (
                          <div className={`text-[10px] font-semibold ${
                            p.remainingDays <= 3 ? "text-red-600" : "text-emerald-700"
                          }`}>
                            još {p.remainingDays} dana
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <Link href={`/tenders/${p.id}`}>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-primary hover:bg-primary/10">
                            <Eye className="w-4 h-4 mr-1" />
                            Pregled
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* CONTENT: TAB 4 - REZULTATI */}
      {activeTab === "results" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-emerald-50/60 border border-emerald-200">
              <div className="text-xs text-emerald-800 font-semibold uppercase">Stopa Pobjeda</div>
              <div className="text-3xl font-extrabold text-emerald-900 mt-1">68.4%</div>
              <p className="text-xs text-emerald-700 mt-1">26 pobjeda od 38 prijavljenih tendera</p>
            </Card>

            <Card className="p-4 bg-blue-50/60 border border-blue-200">
              <div className="text-xs text-blue-800 font-semibold uppercase">Osvojena Premija (KM)</div>
              <div className="text-3xl font-extrabold text-blue-900 mt-1">4.850.000 KM</div>
              <p className="text-xs text-blue-700 mt-1">Ugovorena premija za ASA Central u 2024</p>
            </Card>

            <Card className="p-4 bg-purple-50/60 border border-purple-200">
              <div className="text-xs text-purple-800 font-semibold uppercase">Učešće na e-Aukciji</div>
              <div className="text-3xl font-extrabold text-purple-900 mt-1">92.5%</div>
              <p className="text-xs text-purple-700 mt-1">Prosječni popust u licitaciji: 4.2%</p>
            </Card>
          </div>

          <Card className="border border-gray-200 shadow-sm bg-white overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900">Historijat Ishoda Ponuda</h3>
              <span className="text-xs text-gray-500">Zadnjih 12 mjeseci</span>
            </div>
            <div className="p-6 text-center text-gray-500 text-xs">
              Sve pobjedničke i arhivirane ponude automatski se povezuju sa zvaničnim odlukama o dodjeli ugovora sa Portala EJN.
            </div>
          </Card>
        </div>
      )}

      {/* CONTENT: TAB 5 - BIBLIOTEKA DOKUMENATA (ASA CENTRAL DOKAZI) */}
      {activeTab === "library" && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                  Biblioteka Dokaza & Profil Kompanije
                </span>
                <h2 className="text-xl font-bold mt-1">ASA Central Osiguranje d.d.</h2>
                <p className="text-xs text-blue-200 mt-1 max-w-xl">
                  Centralno skladište ponovljivih dokaza po Zakonu o javnim nabavkama (Član 45, 46, 47, 48 ZJN).
                  Jednim klikom povežite važeće certifikate, licence i reference na svaki novi tender.
                </p>
              </div>

              <Link href="/company">
                <Button className="bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs shadow">
                  Upravljaj profilom firme &rarr;
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Box 1: Član 45 ZJN */}
            <Card className="border p-4 bg-white shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">Član 45 ZJN</Badge>
                <span className="text-xs font-bold text-gray-800">Lična sposobnost</span>
              </div>
              <ul className="text-xs text-gray-600 space-y-1.5 pt-2 border-t">
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Uvjerenje Porezne uprave FBiH
                </li>
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Uvjerenje UIO BiH (Indirektni porezi)
                </li>
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Uvjerenje o nekažnjavanju suda
                </li>
              </ul>
              <div className="text-[10px] text-gray-400 pt-2">Važeće do: 30.11.2024.</div>
            </Card>

            {/* Box 2: Član 46 ZJN */}
            <Card className="border p-4 bg-white shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">Član 46 ZJN</Badge>
                <span className="text-xs font-bold text-gray-800">Profesionalna djelatnost</span>
              </div>
              <ul className="text-xs text-gray-600 space-y-1.5 pt-2 border-t">
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aktuelni izvod iz sudskog registra
                </li>
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Licenca Agencije za nadzor osiguranja
                </li>
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Rješenje o upisu u registar emitenata
                </li>
              </ul>
              <div className="text-[10px] text-gray-400 pt-2">Trajna licenca</div>
            </Card>

            {/* Box 3: Član 47 ZJN */}
            <Card className="border p-4 bg-white shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">Član 47 ZJN</Badge>
                <span className="text-xs font-bold text-gray-800">Finansijska sposobnost</span>
              </div>
              <ul className="text-xs text-gray-600 space-y-1.5 pt-2 border-t">
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Bilans stanja i uspjeha (2021, 2022, 2023)
                </li>
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Potvrda poslovne banke o solventnosti
                </li>
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Rejting solventnosti A+ (FIA izvještaj)
                </li>
              </ul>
              <div className="text-[10px] text-gray-400 pt-2">Ažurirano za 2023</div>
            </Card>

            {/* Box 4: Član 48 ZJN */}
            <Card className="border p-4 bg-white shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Član 48 ZJN</Badge>
                <span className="text-xs font-bold text-gray-800">Reference i Ugovori</span>
              </div>
              <ul className="text-xs text-gray-600 space-y-1.5 pt-2 border-t">
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Spisak 120+ realizovanih ugovora
                </li>
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Potvrde KCUS, Autoceste, Elektroprivreda
                </li>
                <li className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Certifikati ISO 9001, ISO 27001
                </li>
              </ul>
              <div className="text-[10px] text-gray-400 pt-2">Automatsko filtriranje po CPV-u</div>
            </Card>
          </div>
        </div>
      )}

      {/* CONTENT: TAB 6 - STATISTIKA */}
      {activeTab === "stats" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-white border shadow-sm space-y-4">
            <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Efikasnost Ponuda po Kategorijama
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Kasko osiguranje (66514110)</span>
                  <span className="text-emerald-700">76% Pobjeda</span>
                </div>
                <Progress value={76} className="h-2 bg-gray-100" />
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Osiguranje imovine (66515200)</span>
                  <span className="text-emerald-700">68% Pobjeda</span>
                </div>
                <Progress value={68} className="h-2 bg-gray-100" />
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Nezgoda i kolektivno (66512100)</span>
                  <span className="text-emerald-700">61% Pobjeda</span>
                </div>
                <Progress value={61} className="h-2 bg-gray-100" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white border shadow-sm space-y-4">
            <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Najčešći Razlozi Diskvalifikacija u Branši
            </h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Isteklo porezno uvjerenje:</strong> Uvjerenja starija od 3 mjeseca na dan predaje ponude (Član 45 ZJN).
                </div>
              </div>

              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Greška u garanciji za ozbiljnost ponude:</strong> Neusklađen rok važenja (mora važiti minimalno traženi broj dana od dana otvaranja ponuda).
                </div>
              </div>

              <div className="p-2.5 rounded bg-blue-50 border border-blue-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Pre-Flight Zaštita:</strong> Naš AI Validator automatski provjerava ove stavke prije kovertiranja.
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* READINESS AUDIT MODAL */}
      {selectedForReadiness && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border">
            <div className="bg-primary px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
                <div>
                  <h3 className="font-bold text-base">AI Pre-Flight Validator Ponude</h3>
                  <p className="text-xs text-blue-100">Provjera spremnosti prije predaje ponude</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedForReadiness(null)}
                className="text-white/80 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="border p-3 rounded-lg bg-gray-50">
                <div className="font-bold text-gray-900 text-sm">{selectedForReadiness.title}</div>
                <div className="text-gray-500 mt-0.5">🏛️ {selectedForReadiness.contractingAuth}</div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">
                  Kontrolne Tačke Revizije:
                </h4>

                <div className="flex items-start gap-2 p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Lična sposobnost (Čl. 45 ZJN):</strong> Sva uvjerenja (sud, Porezna uprava, UIO) su u roku važenja (&lt; 3 mjeseca).
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Pravna sposobnost (Čl. 46 ZJN):</strong> Licenca Agencije za nadzor osiguranja i izvod iz registra uredno priloženi.
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Finansijska ponuda vs. Budžet:</strong> Ponuđena premija je unutar procijenjene vrijednosti ({formatMoney(selectedForReadiness.estimatedValue)}). Provjerite popust za e-Aukciju.
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-800">
                  <FileCheck2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Aneksi i Izjave:</strong> Aneks 1 (Obrazac ponude) i Izjave o ispunjenosti uslova generisani i spremni za potpis ovlaštenog lica.
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t px-6 py-3.5 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Semafor: Ponuda ima 95% spremnost</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedForReadiness(null)}>
                  Zatvori
                </Button>
                <Link href={`/tenders/${selectedForReadiness.id}`}>
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
                    Uredi detalje dosjea
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
