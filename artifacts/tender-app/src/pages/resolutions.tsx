import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/hooks/use-auth";
import {
  Gavel,
  Search,
  ExternalLink,
  Scale,
  Building2,
  Calendar,
  Filter,
  ChevronRight,
  RefreshCw,
  FileText,
  AlertTriangle,
  Info,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Resolution = {
  id: string;
  number: string;
  date: string;
  type: string;
  procedureId?: number;
  procedureName: string;
  procedureNumber: string;
  procedureType: string;
  contractingAuthorityId?: number;
  contractingAuthority: string;
  city: string;
  entity: string;
  category: string;
  contractType: string;
  isAuctionOnline: boolean;
  awardCriterion: string;
  hasLots: boolean;
  lastUpdated?: string;
  ejnUrl: string;
  outcome?: string;
  outcomeLabel?: string;
  sporniUslov?: string;
  legalBasis?: string;
  summary?: string;
};

type ResolutionsResponse = {
  data: Resolution[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: {
    total: number;
    byType: Record<string, number>;
  };
  source: string;
};

const PROCEDURE_TYPES = [
  { value: "all", label: "Svi tipovi" },
  { value: "OpenProcedure", label: "Otvoreni postupak" },
  { value: "CompetitiveRequest", label: "Zahtjev za ponude" },
  { value: "DirectAgreement", label: "Direktni sporazum" },
  { value: "RestrictedProcedure", label: "Ograničeni postupak" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function ResolutionsPage() {
  const token = useAuthStore(s => s.token);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);

  // Debounce search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._resSearchTimeout);
    (window as any)._resSearchTimeout = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const params = new URLSearchParams({
    page: String(page),
    limit: "25",
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(typeFilter !== "all" && { type: typeFilter }),
    ...(yearFilter && { year: String(yearFilter) }),
  });

  const { data, isLoading, isFetching, refetch } = useQuery<ResolutionsResponse>({
    queryKey: ["resolutions", page, debouncedSearch, typeFilter, yearFilter],
    queryFn: async () => {
      const res = await fetch(`/api/resolutions?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error("Neuspješno preuzimanje rješenja");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const items = data?.data || [];
  const meta = data?.meta;
  const stats = data?.stats;

  function formatDate(dateStr?: string) {
    if (!dateStr) return "—";
    try {
      return new Intl.DateTimeFormat("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateStr));
    } catch {
      return dateStr.slice(0, 10);
    }
  }

  function getTypeColor(type?: string) {
    const t = type || "";
    if (t.includes("Otvoreni")) return "bg-blue-100 text-blue-800";
    if (t.includes("Zahtjev")) return "bg-amber-100 text-amber-800";
    if (t.includes("Direktni")) return "bg-gray-100 text-gray-700";
    if (t.includes("Ograničeni")) return "bg-purple-100 text-purple-800";
    return "bg-slate-100 text-slate-700";
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <span>Početna</span>
            <ChevronRight className="w-3 h-3" />
            <span>Nabavke</span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-semibold text-gray-800">Rješenja URŽ</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-primary" />
            Rješenja URŽ BiH
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Zvanična rješenja Ureda za razmatranje žalbi BiH — žalbeni predmeti iz oblasti osiguranja iz EJN registra.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5"
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Osvježi
          </Button>
          <Button
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/5 text-xs font-semibold"
            onClick={() => window.open("https://urz.gov.ba", "_blank")}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Portal URŽ BiH
          </Button>
        </div>
      </div>

      {/* KPI STRIP */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-700">{stats.total.toLocaleString()}</div>
              <div className="text-xs text-blue-600 mt-0.5">Ukupno rješenja</div>
            </CardContent>
          </Card>
          {Object.entries(stats.byType).slice(0, 3).map(([type, count]) => (
            <Card key={type} className="border-slate-200">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-800">{String(count)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{type}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* SOURCE BADGE */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
          Live podaci: open.ejn.gov.ba
        </Badge>
        {meta && (
          <span className="text-xs text-muted-foreground">
            {meta.total.toLocaleString()} rješenja pronađeno
          </span>
        )}
      </div>

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži postupak, organ, broj..."
            className="pl-9"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <select
            className="border border-input rounded-md px-3 py-2 text-sm bg-background"
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          >
            {PROCEDURE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <select
            className="border border-input rounded-md px-3 py-2 text-sm bg-background"
            value={yearFilter || ""}
            onChange={e => { setYearFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          >
            <option value="">Sve godine</option>
            {YEARS.map(y => <option key={y} value={y}>{y}.</option>)}
          </select>
        </div>
      </div>

      {/* RESULTS */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Scale className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nema rješenja za zadane filtere.</p>
            <Button variant="ghost" className="mt-3 text-sm" onClick={() => { setSearch(""); setDebouncedSearch(""); setTypeFilter("all"); setYearFilter(undefined); }}>
              Poništi filtere
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow border-gray-200">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-xs font-mono text-gray-600 border-gray-300">
                        {item.number || `URŽ-${item.id}`}
                      </Badge>
                      <Badge className={`text-xs ${getTypeColor(item.procedureType)}`}>
                        {item.procedureType}
                      </Badge>
                      {item.isAuctionOnline && (
                        <Badge className="text-xs bg-indigo-100 text-indigo-800">
                          E-aukcija
                        </Badge>
                      )}
                      {item.hasLots && (
                        <Badge className="text-xs bg-slate-100 text-slate-700">
                          <Layers className="w-3 h-3 mr-1" />
                          Lotovi
                        </Badge>
                      )}
                      {item.outcomeLabel && (
                        <Badge className={`text-xs font-semibold ${item.outcome === "USVOJENA" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : item.outcome === "DJELIMICNO_USVOJENA" ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-rose-100 text-rose-800 border border-rose-300"}`}>
                          <Scale className="w-3 h-3 mr-1" />
                          {item.outcomeLabel}
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">
                      {item.procedureName}
                    </h3>

                    {item.procedureNumber && (
                      <div className="text-xs text-blue-600 font-mono mb-1.5">
                        EJN: {item.procedureNumber}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {item.contractingAuthority}
                      </span>
                      {item.city && (
                        <span>{item.city}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(item.date)}
                      </span>
                    </div>

                    {item.category && (
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Kategorija:</span> {item.category}
                      </div>
                    )}

                    {(item.sporniUslov || item.summary) && (
                      <div className="mt-3 p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 text-xs space-y-1.5">
                        {item.sporniUslov && (
                          <div className="text-amber-950 font-medium">
                            <span className="font-bold text-amber-800">Sporni zahtjev TD:</span> {item.sporniUslov}
                          </div>
                        )}
                        {item.legalBasis && (
                          <div className="text-slate-600 font-mono text-[11px]">
                            <span className="font-bold text-slate-700">Pravni osnov (ZJN BiH):</span> {item.legalBasis}
                          </div>
                        )}
                        {item.summary && (
                          <div className="text-slate-700 italic border-l-2 border-amber-400 pl-2 mt-1">
                            {item.summary}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col gap-2 sm:min-w-[120px]">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex-1 sm:flex-none"
                      onClick={() => window.open(item.ejnUrl, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      EJN Portal
                    </Button>
                    {item.procedureId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs flex-1 sm:flex-none text-blue-600 hover:text-blue-800"
                        onClick={() => window.open(`https://www.ejn.gov.ba/Announcement/Details/${item.procedureId}`, "_blank")}
                      >
                        <Info className="w-3.5 h-3.5 mr-1" />
                        Detalji
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* PAGINATION */}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
          >
            ← Prethodna
          </Button>
          <span className="text-sm text-muted-foreground">
            Stranica {page} od {meta.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
            disabled={page >= meta.pages || isFetching}
          >
            Sljedeća →
          </Button>
        </div>
      )}

      {/* INFO NOTE */}
      <div className="flex items-start gap-2.5 p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
        <div>
          <strong>Napomena:</strong> Ova stranica prikazuje rješenja iz EJN (Elektronski javni nabavke) registra filtriranih za oblast osiguranja.
          Za kompletan pregled svih rješenja URŽ-a posjetite <a href="https://urz.gov.ba" target="_blank" rel="noopener noreferrer" className="underline font-medium">urz.gov.ba</a>.
        </div>
      </div>
    </div>
  );
}
