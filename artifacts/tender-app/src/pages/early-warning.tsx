import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  AlertCircle,
  Search,
  Calendar,
  Building2,
  TrendingUp,
  Clock,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";

type PlannedItem = {
  id: string;
  name: string;
  contractType: string;
  procedureType: string;
  estimatedValue: number | null;
  estimatedStartDate: string | null;
  year: number;
  quarter: number;
  quarterLabel: string;
  isCurrentYear: boolean;
  isPast: boolean;
  planId?: number;
  planName: string;
  contractingAuthorityId?: number;
  contractingAuthority: string;
  city: string;
  entity: string;
  cpvCode: string;
  fundingSource: string;
  ejnUrl: string;
};

type EarlyWarningResponse = {
  data: PlannedItem[];
  byQuarter: Record<string, PlannedItem[]>;
  kpis: {
    totalPlanned: number;
    upcomingCount: number;
    totalEstimatedValue: number;
    authorities: number;
    currentQuarter: string;
  };
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  source: string;
};

const CURRENT_YEAR = new Date().getFullYear();

export default function EarlyWarningPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<number>(CURRENT_YEAR);
  const [quarterFilter, setQuarterFilter] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"quarterly" | "list">("quarterly");

  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._ewSearchTimeout);
    (window as any)._ewSearchTimeout = setTimeout(() => {
      setDebouncedSearch(val);
    }, 400);
  };

  const params = new URLSearchParams({
    limit: "200",
    year: String(yearFilter),
    ...(quarterFilter && { quarter: String(quarterFilter) }),
    ...(debouncedSearch && { search: debouncedSearch }),
  });

  const { data, isLoading, isFetching, refetch } = useQuery<EarlyWarningResponse>({
    queryKey: ["early-warning", yearFilter, quarterFilter, debouncedSearch],
    queryFn: () => customFetch<EarlyWarningResponse>(`/api/early-warning?${params}`),
    staleTime: 10 * 60 * 1000,
  });

  const kpis = data?.kpis;
  const byQuarter = data?.byQuarter || {};
  const allItems = data?.data || [];

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "—";
    try {
      return new Intl.DateTimeFormat("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateStr));
    } catch {
      return dateStr.slice(0, 10);
    }
  }

  function getQuarterColor(q: number) {
    const colors = ["", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
    return colors[q] || "bg-gray-500";
  }

  function getQuarterBg(q: number) {
    const colors = ["", "bg-blue-50 border-blue-200", "bg-emerald-50 border-emerald-200", "bg-amber-50 border-amber-200", "bg-rose-50 border-rose-200"];
    return colors[q] || "bg-gray-50 border-gray-200";
  }

  const quarters = [1, 2, 3, 4];

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
            <span className="font-semibold text-gray-800">Rano upozorenje</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 flex items-center gap-2.5">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            Rano upozorenje — Planirane nabavke
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Planirane nabavke iz oblasti osiguranja direktno iz EJN planova nabavki ugovornih organa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Osvježi
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => window.open("https://www.ejn.gov.ba/PlannedProcurement/Search", "_blank")}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            EJN Portal
          </Button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-700">{kpis?.totalPlanned?.toLocaleString() || "—"}</div>
            <div className="text-xs text-amber-600 mt-0.5">Ukupno planirano</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-700">{kpis?.upcomingCount?.toLocaleString() || "—"}</div>
            <div className="text-xs text-green-600 mt-0.5">Predstojeće nabavke</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-700">
              {kpis?.totalEstimatedValue ? formatMoney(kpis.totalEstimatedValue) : "—"}
            </div>
            <div className="text-xs text-blue-600 mt-0.5">Ukupna procij. vrijednost</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-700">{kpis?.authorities || "—"}</div>
            <div className="text-xs text-purple-600 mt-0.5">Ugovornih organa</div>
          </CardContent>
        </Card>
      </div>

      {/* SOURCE + FILTERS */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
          Live: open.ejn.gov.ba/PlannedProcurements
        </Badge>

        <div className="flex flex-1 gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži nabavku, organ..."
              className="pl-9 h-9"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>

          <select
            className="border border-input rounded-md px-3 py-2 text-sm bg-background h-9"
            value={yearFilter}
            onChange={e => setYearFilter(Number(e.target.value))}
          >
            {[CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
              <option key={y} value={y}>{y}. godina</option>
            ))}
          </select>

          <select
            className="border border-input rounded-md px-3 py-2 text-sm bg-background h-9"
            value={quarterFilter || ""}
            onChange={e => setQuarterFilter(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Svi kvartali</option>
            <option value="1">Q1 (Jan-Mar)</option>
            <option value="2">Q2 (Apr-Jun)</option>
            <option value="3">Q3 (Jul-Sep)</option>
            <option value="4">Q4 (Okt-Dec)</option>
          </select>

          <div className="flex gap-1">
            <Button
              variant={viewMode === "quarterly" ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs"
              onClick={() => setViewMode("quarterly")}
            >
              <Layers className="w-3.5 h-3.5 mr-1" />
              Kvartali
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs"
              onClick={() => setViewMode("list")}
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1" />
              Lista
            </Button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : viewMode === "quarterly" ? (
        // QUARTERLY VIEW
        <div className="space-y-6">
          {quarters.map(q => {
            const qLabel = `Q${q} ${yearFilter}`;
            const qItems = byQuarter[qLabel] || [];
            if (qItems.length === 0 && !quarterFilter) return null;
            const totalVal = qItems.reduce((s, p) => s + (p.estimatedValue || 0), 0);

            return (
              <div key={q}>
                {/* Quarter header */}
                <div className={`flex items-center gap-3 mb-3 p-3 rounded-xl border ${getQuarterBg(q)}`}>
                  <div className={`w-3 h-3 rounded-full ${getQuarterColor(q)}`} />
                  <div className="flex-1">
                    <span className="font-bold text-sm">{qLabel}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({qItems.length} nabavki{totalVal > 0 ? ` · ${formatMoney(totalVal)}` : ""})
                    </span>
                  </div>
                </div>

                {qItems.length === 0 ? (
                  <div className="text-xs text-muted-foreground px-3">Nema planiranih nabavki za ovaj kvartal.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {qItems.map(item => (
                      <Card key={item.id} className={`hover:shadow-md transition-shadow border ${item.isPast ? "opacity-60" : ""}`}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <Badge className={`text-xs ${getQuarterBg(item.quarter)} border`}>
                              {item.quarterLabel}
                            </Badge>
                            {item.estimatedValue && (
                              <span className="text-xs font-bold text-green-700">
                                {formatMoney(item.estimatedValue)}
                              </span>
                            )}
                          </div>

                          <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-2 leading-snug">
                            {item.name}
                          </h3>

                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="line-clamp-1">{item.contractingAuthority}</span>
                            </div>
                            {item.estimatedStartDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                <span>Planirani početak: {formatDate(item.estimatedStartDate)}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>{item.procedureType}</span>
                            </div>
                          </div>

                          {item.cpvCode && (
                            <div className="mt-2 text-xs text-blue-600 truncate" title={item.cpvCode}>
                              {item.cpvCode}
                            </div>
                          )}

                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary"
                              onClick={() => window.open(item.ejnUrl, "_blank")}
                            >
                              EJN Portal <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // LIST VIEW
        <div className="space-y-2">
          {allItems.map(item => (
            <Card key={item.id} className={`hover:shadow-sm transition-shadow ${item.isPast ? "opacity-60" : ""}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${getQuarterColor(item.quarter)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      <Badge className={`text-xs ${getQuarterBg(item.quarter)} border`}>{item.quarterLabel}</Badge>
                      <Badge variant="outline" className="text-xs">{item.procedureType}</Badge>
                    </div>
                    <h3 className="font-medium text-sm text-gray-900 line-clamp-1">{item.name}</h3>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {item.contractingAuthority}
                      </span>
                      {item.estimatedStartDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(item.estimatedStartDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.estimatedValue && (
                      <span className="text-xs font-bold text-green-700 whitespace-nowrap">
                        {formatMoney(item.estimatedValue)}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => window.open(item.ejnUrl, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {allItems.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nema planiranih nabavki za odabrane filtere.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
