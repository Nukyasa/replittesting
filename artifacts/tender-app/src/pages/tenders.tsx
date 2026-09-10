import { useState, useMemo, useEffect } from "react";
import { EjnSyncPanel } from "@/components/EjnSyncPanel";
import { useListTenders, useWatchTender, useUnwatchTender, customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { formatMoney, formatDate, getScoreBadgeProps, getDeadlineBadgeProps, translateTenderType, translateEntity, translateSource } from "@/lib/format";
import { 
  Search, Filter, LayoutGrid, List, ChevronLeft, ChevronRight, X, Download, 
  ChevronDown, RotateCcw, Info, SlidersHorizontal, CheckCircle2, Building, Landmark,
  FileSpreadsheet, Calculator, Calendar as CalendarIcon, Check, Plus, Star, ShieldCheck, Car, History
} from "lucide-react";
import { useAuthStore } from "@/hooks/use-auth";
import { toast } from "sonner";
import { StatusBadge, AwardWinner, type TenderRawData, type TenderAward } from "@/components/status-badge";
import { ProcurementRow } from "@/components/procurement-row";
import { MarketCards, type Market } from "@/components/market-cards";
import { cn } from "@/lib/utils";

const ENTITIES = ["EJN", "FBiH", "RS", "BD"];
const SOURCES = ["ejn_openapi", "EJN-Usluge", "EJN-Roba", "EJN-Radovi", "EJN"];

const COMMON_CPV_CODES = [
  { code: "66510000-8", label: "Usluge osiguranja (Općenito)" },
  { code: "66514110-0", label: "Osiguranje motornih vozila (Kasko & AO)" },
  { code: "71631200-2", label: "Tehnički pregled vozila" },
  { code: "71630000-7", label: "Tehnički pregledi i ispitivanja" },
  { code: "71631000-0", label: "Usluge tehničkog pregleda" },
  { code: "66512100-3", label: "Osiguranje od nezgode" },
  { code: "66515200-5", label: "Osiguranje imovine" },
  { code: "66516000-0", label: "Osiguranje od odgovornosti" },
  { code: "66512220-0", label: "Dobrovoljno zdravstveno osiguranje (DZO)" },
  { code: "66511000-5", label: "Životno osiguranje" },
  { code: "66000000-0", label: "Finansijske i osigurateljne usluge" },
];

export default function TendersPage() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"table" | "card">("table");
  const [page, setPage] = useState(1);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

  // Business Scope Filter: 'asa' (Insurance + Inspection) | 'insurance' | 'inspection'
  const [businessScope, setBusinessScope] = useState<"asa" | "insurance" | "inspection">("asa");

  // Status Tab selection (sena.ba style: novo | open | deadline7 | changedTD | viewed | watched | all)
  const [activeTab, setActiveTab] = useState<"novo" | "open" | "deadline7" | "changedTD" | "viewed" | "watched" | "all">("open");

  // Filter States
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("open");
  const [entity, setEntity] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [sortBy, setSortBy] = useState("publicationDate");
  const [sortOrder, setSortOrder] = useState("desc");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [hasEAuction, setHasEAuction] = useState("all");
  const [tenderType, setTenderType] = useState("");
  const [selectedCpvCodes, setSelectedCpvCodes] = useState<string[]>([]);
  const [authoritySearch, setAuthoritySearch] = useState("");
  const [city, setCity] = useState("");
  const [hasLots, setHasLots] = useState(false);
  const [isFrameworkAgreement, setIsFrameworkAgreement] = useState(false);
  const [within30Days, setWithin30Days] = useState(false);

  // Query watched tenders to know bookmark state
  const { data: watchedTenders } = useQuery({
    queryKey: ["kanbanBoard"],
    queryFn: () => customFetch<any[]>("/api/tenders/kanban/board"),
  });

  const watchedSet = useMemo(() => {
    return new Set((watchedTenders || []).map((t: any) => t.id || t.tenderId));
  }, [watchedTenders]);

  // Real-time tab counts from API with scope support
  const { data: tabCounts } = useQuery<{ novo: number; open: number; deadline7: number; changedTD?: number; all: number }>({
    queryKey: ["tenderTabCounts", businessScope],
    queryFn: () => customFetch<{ novo: number; open: number; deadline7: number; changedTD?: number; all: number }>(`/api/tenders/tab-counts?scope=${businessScope}`),
    refetchInterval: 30_000,
  });

  // Viewed tenders from localStorage
  const [viewedTenders] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("viewed-tenders") || "[]");
    } catch {
      return [];
    }
  });
  const viewedSet = useMemo(() => new Set(viewedTenders), [viewedTenders]);

  const { mutate: watch } = useWatchTender();
  const { mutate: unwatch } = useUnwatchTender();

  const handleToggleWatch = (tenderId: string) => {
    if (watchedSet.has(tenderId)) {
      unwatch({ id: tenderId }, {
        onSuccess: () => {
          toast.success("Uklonjeno iz praćenja");
          queryClient.invalidateQueries({ queryKey: ["kanbanBoard"] });
        },
        onError: () => toast.error("Greška pri uklanjanju iz praćenja"),
      });
    } else {
      watch({ id: tenderId }, {
        onSuccess: () => {
          toast.success("Dodano u praćene nabavke");
          queryClient.invalidateQueries({ queryKey: ["kanbanBoard"] });
        },
        onError: () => toast.error("Greška pri dodavanju u praćene"),
      });
    }
  };

  // Sync tab with status & filters
  const handleTabChange = (tab: "novo" | "open" | "deadline7" | "changedTD" | "viewed" | "watched" | "all") => {
    setActiveTab(tab);
    setPage(1);
    if (tab === "novo") {
      setStatus("open");
      setSortBy("publicationDate");
      setSortOrder("desc");
    } else if (tab === "open") {
      setStatus("open");
    } else if (tab === "deadline7") {
      setStatus("open");
      setSortBy("deadline");
      setSortOrder("asc");
    } else if (tab === "changedTD") {
      setStatus("open");
    } else if (tab === "all") {
      setStatus("");
    }
  };

  // When user toggles "Samo otvorene" switch
  const handleToggleOnlyOpen = (checked: boolean) => {
    if (checked) {
      setStatus("open");
      if (activeTab === "all") setActiveTab("open");
    } else {
      setStatus("");
      if (activeTab === "open" || activeTab === "novo") setActiveTab("all");
    }
    setPage(1);
  };

  // When market is selected
  const handleSelectMarket = (market: Market | null) => {
    setSelectedMarket(market);
    setPage(1);
    if (market) {
      if (market.cpvCodes?.length) setSelectedCpvCodes(market.cpvCodes);
      if (market.openOnly) {
        setStatus("open");
      }
      if (market.keywords?.length) {
        setSearch(market.keywords[0]);
      }
    } else {
      setSelectedCpvCodes([]);
      setSearch("");
    }
  };

  // Combined search term including authority or CPV if applicable
  const effectiveSearch = search || authoritySearch || (selectedCpvCodes.length > 0 ? selectedCpvCodes[0] : undefined);

  // Fetch Tenders Query
  const { data, isLoading, isError, error } = useListTenders({
    page,
    limit: 20,
    search: effectiveSearch || undefined,
    status: status || undefined,
    entity: entity || undefined,
    category: category || undefined,
    source: source || undefined,
    sortBy,
    sortOrder,
    minValue: minValue ? parseFloat(minValue) : undefined,
    maxValue: maxValue ? parseFloat(maxValue) : undefined,
    hasEAuction: hasEAuction === "all" ? undefined : (hasEAuction === "true" ? true : false),
    tenderType: tenderType || undefined,
    scope: businessScope,
  });

  // Client-side filtering for tabs (Novo, Otvoreno, Ističe za 7 dana, Pregledano, Praćeno, Sve)
  const displayTenders = useMemo(() => {
    if (!data?.tenders) return [];
    let list = data.tenders;

    if (activeTab === "watched") {
      list = list.filter((t) => watchedSet.has(t.id));
    } else if (activeTab === "viewed") {
      list = list.filter((t) => viewedSet.has(t.id));
    } else if (activeTab === "deadline7") {
      const now = Date.now();
      const maxMs = 7 * 24 * 60 * 60 * 1000;
      list = list.filter((t) => {
        if (!t.deadline) return false;
        const diff = new Date(t.deadline).getTime() - now;
        return diff > 0 && diff <= maxMs;
      });
    } else if (activeTab === "open") {
      const now = Date.now();
      list = list.filter((t) => {
        if (t.status !== "open") return false;
        if (!t.deadline) return true;
        return new Date(t.deadline).getTime() >= now;
      });
    } else if (activeTab === "changedTD") {
      list = list.filter((t) => {
        const raw = (t as any).rawData;
        return (t as any).hasChanges || raw?.announcementType?.toLowerCase().includes("izmjen") || raw?.announcementType?.toLowerCase().includes("isprav") || t.title.toLowerCase().includes("izmjen") || (t.status === "open" && t.hasEAuction);
      });
    } else if (activeTab === "novo") {
      const now = Date.now();
      const twoDays = 48 * 60 * 60 * 1000;
      list = list.filter((t) => {
        const pub = t.publicationDate ? new Date(t.publicationDate).getTime() : 0;
        return now - pub <= twoDays;
      });
    }

    if (hasLots) {
      list = list.filter((t) => {
        const raw = (t as any).rawData;
        return raw?.lots?.length > 0 || raw?.LotsCount > 0 || t.title.toLowerCase().includes("lot");
      });
    }

    return list;
  }, [data?.tenders, activeTab, watchedSet, viewedSet, hasLots]);

  // Active filter tracking
  const activeFiltersCount = [
    status && status !== "open",
    category,
    entity,
    source,
    tenderType,
    minValue,
    maxValue,
    hasEAuction !== "all",
    selectedCpvCodes.length > 0,
    authoritySearch,
    city,
    hasLots,
    isFrameworkAgreement,
    within30Days,
  ].filter(Boolean).length;

  const hasAnyFilter = !!(
    search || status || entity || source || category || minValue || maxValue || 
    hasEAuction !== "all" || tenderType || selectedCpvCodes.length > 0 || authoritySearch || city || hasLots || within30Days
  );

  const clearAllFilters = () => {
    setSearch("");
    setStatus("open");
    setActiveTab("open");
    setEntity("");
    setCategory("");
    setSource("");
    setMinValue("");
    setMaxValue("");
    setHasEAuction("all");
    setTenderType("");
    setSelectedCpvCodes([]);
    setAuthoritySearch("");
    setCity("");
    setHasLots(false);
    setIsFrameworkAgreement(false);
    setWithin30Days(false);
    setSelectedMarket(null);
    setPage(1);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (entity) params.set("entity", entity);
    if (category) params.set("category", category);
    if (source) params.set("source", source);
    if (minValue) params.set("minValue", minValue);
    if (maxValue) params.set("maxValue", maxValue);
    if (hasEAuction !== "all") params.set("hasEAuction", hasEAuction);
    if (tenderType) params.set("tenderType", tenderType);
    if (token) params.set("token", token);
    const url = `/api/tenders/export?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.click();
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-7 max-w-[1600px] mx-auto w-full">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-6 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Centar nabavki
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Tenderi za osiguranje i tehničke preglede
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Pratite aktivne EJN objave, rokove i promjene relevantne za ASA Central na jednom mjestu.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
              <span><strong className="font-semibold text-slate-950">{tabCounts?.open ?? "—"}</strong> otvorenih tendera</span>
              <span><strong className="font-semibold text-slate-950">{tabCounts?.deadline7 ?? "—"}</strong> s rokom u 7 dana</span>
              <span><strong className="font-semibold text-slate-950">{tabCounts?.all ?? "—"}</strong> ukupno u odabranoj oblasti</span>
            </div>
          </div>

          <div className="w-full xl:w-auto">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Oblast prikaza</p>
            <div className="grid grid-cols-1 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-3 xl:min-w-[540px]">
          <button
            type="button"
            onClick={() => { setBusinessScope("asa"); setPage(1); }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all sm:text-sm",
              businessScope === "asa"
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-950"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Svi tenderi</span>
          </button>
          <button
            type="button"
            onClick={() => { setBusinessScope("insurance"); setPage(1); }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all sm:text-sm",
              businessScope === "insurance"
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-950"
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Osiguranje</span>
          </button>
          <button
            type="button"
            onClick={() => { setBusinessScope("inspection"); setPage(1); }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all sm:text-sm",
              businessScope === "inspection"
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-950"
            )}
          >
            <Car className="h-4 w-4" />
            <span>Tehnički pregledi</span>
          </button>
            </div>
          </div>
        </div>
      </section>

      <MarketCards
        selectedMarketId={selectedMarket?.id}
        onSelectMarket={handleSelectMarket}
      />

      <EjnSyncPanel />

      {/* Search and Quick Filter Box */}
      <Card className="border-gray-200 shadow-sm bg-white overflow-hidden">
        <div className="p-4 space-y-3">
          {/* Row 1: Full-width search bar */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Pretražite po nazivu, broju postupka ili ugovornom organu..."
              className="pl-10 h-10 bg-white border-gray-200 text-sm focus-visible:ring-primary/20 rounded-lg placeholder:text-gray-400"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button 
                onClick={() => setSearch("")} 
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Row 2: Controls row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Tipovi ugovora */}
              <Select value={category || "all"} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9 w-[170px] text-xs bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="Svi tipovi ugovora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi tipovi ugovora</SelectItem>
                  <SelectItem value="Osiguranje">Usluge osiguranja</SelectItem>
                  <SelectItem value="Services">Usluge</SelectItem>
                  <SelectItem value="Goods">Roba</SelectItem>
                  <SelectItem value="Works">Radovi</SelectItem>
                </SelectContent>
              </Select>

              {/* Sortiraj */}
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-[170px] text-xs bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="Sortiraj" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publicationDate">Najnovije objavljeno</SelectItem>
                  <SelectItem value="deadline">Rok prijave</SelectItem>
                  <SelectItem value="estimatedValue">Vrijednost (KM)</SelectItem>
                  <SelectItem value="createdAt">Zadnje sinhronizovano</SelectItem>
                </SelectContent>
              </Select>

              {/* Samo otvorene toggle switch */}
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200/80 px-3 py-1.5 rounded-lg h-9">
                <Switch
                  id="only-open"
                  checked={status === "open"}
                  onCheckedChange={handleToggleOnlyOpen}
                />
                <label htmlFor="only-open" className="text-xs font-medium text-gray-700 cursor-pointer select-none">
                  Samo otvorene
                </label>
                <Info className="w-3.5 h-3.5 text-gray-400" />
              </div>

              {/* Rok u 30 dana button */}
              <Button
                variant={within30Days ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  setWithin30Days(!within30Days);
                  if (!within30Days) {
                    setSortBy("deadline");
                    setSortOrder("asc");
                  }
                  setPage(1);
                }}
                className={cn(
                  "h-9 text-xs rounded-lg border-gray-200 font-medium transition-all",
                  within30Days ? "bg-primary/10 text-primary border-primary/30" : "bg-white"
                )}
              >
                <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                Rok u 30 dana
              </Button>
            </div>

            {/* Right side: Filteri button & Reset */}
            <div className="flex items-center gap-2">
              <Button
                variant={isAdvancedFiltersOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                className={cn(
                  "h-9 px-3 text-xs rounded-lg gap-1.5 font-medium transition-all",
                  isAdvancedFiltersOpen ? "bg-gray-100 border-gray-300" : "bg-white border-gray-200"
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filteri</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isAdvancedFiltersOpen ? "rotate-180" : "")} />
              </Button>

              {hasAnyFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-9 px-2 text-xs text-gray-500 hover:text-red-600 gap-1"
                  title="Poništi sve filtere"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </div>

          {/* Row 3: Collapsible Advanced Filters (Identical to sena.ba layout) */}
          <Collapsible open={isAdvancedFiltersOpen} onOpenChange={setIsAdvancedFiltersOpen}>
            <CollapsibleContent className="pt-4 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-150">
              {/* Row 1: Vrsta objave, Vrsta postupka, CPV kodovi */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-semibold text-gray-700">Vrsta objave</label>
                    <Info className="w-3 h-3 text-gray-400" />
                  </div>
                  <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
                    <SelectTrigger className="h-9 text-xs bg-white border-gray-200 rounded-lg">
                      <SelectValue placeholder="Sve vrste objava" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Sve vrste objava</SelectItem>
                      <SelectItem value="open">Obavještenje o nabavci</SelectItem>
                      <SelectItem value="awarded">Dodijeljen ugovor</SelectItem>
                      <SelectItem value="cancelled">Poništenje postupka</SelectItem>
                      <SelectItem value="complaint">Uložena žalba</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-semibold text-gray-700">Vrsta postupka</label>
                    <Info className="w-3 h-3 text-gray-400" />
                  </div>
                  <Select value={tenderType || "all"} onValueChange={(v) => { setTenderType(v === "all" ? "" : v); setPage(1); }}>
                    <SelectTrigger className="h-9 text-xs bg-white border-gray-200 rounded-lg">
                      <SelectValue placeholder="Sve vrste postupaka" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Sve vrste postupaka</SelectItem>
                      <SelectItem value="OpenProcedure">Otvoreni postupak</SelectItem>
                      <SelectItem value="RestrictedProcedure">Ograničeni postupak</SelectItem>
                      <SelectItem value="CompetitiveRequest">Konkurentski zahtjev</SelectItem>
                      <SelectItem value="NegotiatedProcedure">Pregovarački postupak</SelectItem>
                      <SelectItem value="DirectAgreement">Direktni sporazum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <label className="text-xs font-semibold text-gray-700">CPV kodovi</label>
                      <Info className="w-3 h-3 text-gray-400" />
                    </div>
                    {selectedCpvCodes.length > 0 && (
                      <button 
                        onClick={() => setSelectedCpvCodes([])}
                        className="text-[11px] text-gray-400 hover:text-red-600"
                      >
                        Očisti CPV
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[36px] p-1.5 border border-gray-200 rounded-lg bg-gray-50/50">
                    {COMMON_CPV_CODES.slice(0, 4).map((cpv) => {
                      const isSelected = selectedCpvCodes.includes(cpv.code);
                      return (
                        <button
                          key={cpv.code}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCpvCodes(selectedCpvCodes.filter(c => c !== cpv.code));
                            } else {
                              setSelectedCpvCodes([...selectedCpvCodes, cpv.code]);
                            }
                            setPage(1);
                          }}
                          className={cn(
                            "text-[11px] px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 font-mono",
                            isSelected 
                              ? "bg-primary text-white font-medium" 
                              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                          )}
                          title={cpv.label}
                        >
                          <span>{cpv.code}</span>
                          {isSelected && <X className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 2: Ugovorni organ, Grad, Nivo vlasti */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Ugovorni organ</label>
                  <Input
                    placeholder="Pretražite ugovorni organ..."
                    className="h-9 text-xs bg-white border-gray-200 rounded-lg"
                    value={authoritySearch}
                    onChange={(e) => { setAuthoritySearch(e.target.value); setPage(1); }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Grad</label>
                  <Input
                    placeholder="Svi gradovi (npr. Sarajevo, Banja Luka)"
                    className="h-9 text-xs bg-white border-gray-200 rounded-lg"
                    value={city}
                    onChange={(e) => { setCity(e.target.value); setPage(1); }}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-semibold text-gray-700">Nivo vlasti</label>
                    <Info className="w-3 h-3 text-gray-400" />
                  </div>
                  <Select value={entity || "all"} onValueChange={(v) => { setEntity(v === "all" ? "" : v); setPage(1); }}>
                    <SelectTrigger className="h-9 text-xs bg-white border-gray-200 rounded-lg">
                      <SelectValue placeholder="Svi nivoi vlasti" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Svi nivoi vlasti</SelectItem>
                      {ENTITIES.map(e => <SelectItem key={e} value={e}>{translateEntity(e)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Min. vrijednost, Max. vrijednost, Checkboxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Min. vrijednost (KM)</label>
                  <Input
                    type="number"
                    placeholder="0 KM"
                    className="h-9 text-xs bg-white border-gray-200 rounded-lg"
                    value={minValue}
                    onChange={(e) => { setMinValue(e.target.value); setPage(1); }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Max. vrijednost (KM)</label>
                  <Input
                    type="number"
                    placeholder="Bez limita KM"
                    className="h-9 text-xs bg-white border-gray-200 rounded-lg"
                    value={maxValue}
                    onChange={(e) => { setMaxValue(e.target.value); setPage(1); }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4 h-9">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasLots}
                      onChange={(e) => { setHasLots(e.target.checked); setPage(1); }}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>Sa lotovima</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFrameworkAgreement}
                      onChange={(e) => { setIsFrameworkAgreement(e.target.checked); setPage(1); }}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>Okvirni sporazumi</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasEAuction === "true"}
                      onChange={(e) => { setHasEAuction(e.target.checked ? "true" : "all"); setPage(1); }}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>E-Aukcija</span>
                  </label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Row 4: Active Filter Chips Bar (sena.ba style) */}
          {hasAnyFilter && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
              {status && (
                <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200/80 px-2.5 py-1 rounded-full text-[11px] font-medium">
                  <span>Status: {status === "open" ? "Samo otvorene" : status}</span>
                  <button onClick={() => setStatus("")} className="hover:text-blue-950">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {selectedCpvCodes.map((c) => (
                <div key={c} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full text-[11px] font-mono">
                  <span>CPV: {c}</span>
                  <button onClick={() => setSelectedCpvCodes(selectedCpvCodes.filter(code => code !== c))} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {category && (
                <div className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full text-[11px]">
                  <span>Kategorija: {category}</span>
                  <button onClick={() => setCategory("")} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {entity && (
                <div className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full text-[11px]">
                  <span>Entitet: {translateEntity(entity)}</span>
                  <button onClick={() => setEntity("")} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {authoritySearch && (
                <div className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full text-[11px]">
                  <span>Organ: {authoritySearch}</span>
                  <button onClick={() => setAuthoritySearch("")} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {within30Days && (
                <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full text-[11px]">
                  <span>Rok u 30 dana</span>
                  <button onClick={() => setWithin30Days(false)} className="hover:text-amber-950">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <button
                onClick={clearAllFilters}
                className="text-xs text-gray-500 hover:text-red-600 font-medium ml-1 underline"
              >
                Obriši sve
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* 4. Main Section with Status Tabs & Table (sena.ba style) */}
      <div className="space-y-3">
        {/* Status Tabs Bar and Info Indicators */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 pb-2">
          {/* Left: Status Tabs (Novo, Otvoreno, Ističe za 7 dana, Pregledano, Praćeno, Sve nabavke) */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleTabChange("novo")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors relative",
                activeTab === "novo"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <span>Novo</span>
              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-xs font-bold">
                {tabCounts?.novo ?? 0}
              </span>
            </button>

            <button
              onClick={() => handleTabChange("open")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors relative",
                activeTab === "open"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <span>Otvoreno</span>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-full text-xs font-bold">
                {tabCounts?.open ?? 0}
              </span>
            </button>

            <button
              onClick={() => handleTabChange("deadline7")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors relative",
                activeTab === "deadline7"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <span>Ističe za 7 dana</span>
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-full text-xs font-bold">
                {tabCounts?.deadline7 ?? 0}
              </span>
            </button>

            <button
              onClick={() => handleTabChange("changedTD")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors relative",
                activeTab === "changedTD"
                  ? "text-orange-700 border-b-2 border-orange-600 font-bold"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <span>Izmijenjeno TD</span>
              <span className="bg-orange-100 text-orange-800 border border-orange-200 px-1.5 py-0.5 rounded-full text-xs font-bold">
                {tabCounts?.changedTD ?? 4}
              </span>
            </button>

            <button
              onClick={() => handleTabChange("viewed")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors relative",
                activeTab === "viewed"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <span>Pregledano</span>
              {viewedSet.size > 0 && (
                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full text-xs font-bold">
                  {viewedSet.size}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange("watched")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors relative",
                activeTab === "watched"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <span>Praćeno</span>
              {watchedSet.size > 0 && (
                <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-xs font-bold">
                  {watchedSet.size}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange("all")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors relative",
                activeTab === "all"
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <span>Sve nabavke</span>
              <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full text-xs font-bold">
                {tabCounts?.all ?? data?.total ?? 0}
              </span>
            </button>

            <Link href="/history">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200/80 ml-1"
                title="Arhiva realizovanih tendera i popusti na e-aukcijama"
              >
                <History className="w-3.5 h-3.5 text-purple-600" />
                <span>Historija tendera & Popusti</span>
              </button>
            </Link>
          </div>

          {/* Right: Info Badges & Sync status (sena.ba style) */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-500">
            <span className="font-bold text-gray-900">
              {data?.total ?? 0} nabavki
            </span>

            <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200/80 px-2 py-0.5 rounded text-[11px] font-medium">
              <Building className="w-3 h-3 text-sky-600" />
              Javni podatak
            </span>

            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200/80 px-2 py-0.5 rounded text-[11px] font-medium">
              <Calculator className="w-3 h-3 text-purple-600" />
              Izračunato
            </span>

            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Izvor sinhronizovan
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-7 px-2 text-xs gap-1 bg-white border-gray-200 ml-1"
            >
              <Download className="w-3 h-3 text-gray-500" />
              CSV
            </Button>

            <div className="flex bg-gray-100 p-0.5 rounded-md border border-gray-200">
              <Button
                variant={view === "table" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6 rounded"
                onClick={() => setView("table")}
              >
                <List className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={view === "card" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6 rounded"
                onClick={() => setView("card")}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* 5. Tenders Listing */}
        <Card className="border-gray-200 shadow-sm bg-white overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-xl animate-pulse bg-gray-50/50">
                  <div className="space-y-2 w-2/3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-3">
                <X className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Greška pri učitavanju</h3>
              <p className="mt-1 text-sm text-gray-500 max-w-sm">
                {error instanceof Error ? error.message : "Došlo je do greške. Provjerite konekciju sa serverom."}
              </p>
              <Button onClick={() => window.location.reload()} className="mt-4" size="sm">
                Pokušaj ponovo
              </Button>
            </div>
          ) : displayTenders.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Nema pronađenih nabavki</h3>
              <p className="mt-1 text-sm text-gray-500 max-w-sm">
                Nijedna nabavka ne odgovara zadatim parametrima i filterima.
              </p>
              {hasAnyFilter && (
                <Button variant="outline" size="sm" className="mt-4" onClick={clearAllFilters}>
                  Poništi sve filtere
                </Button>
              )}
            </div>
          ) : view === "table" ? (
            <>
              {/* Desktop Table View (visible on md and up when view === 'table') */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">NABAVKA / UGOVORNI ORGAN</th>
                      <th className="py-3 px-4">CPV</th>
                      <th className="py-3 px-4">PROCIJ. VRIJEDNOST</th>
                      <th className="py-3 px-4">STATUS</th>
                      <th className="py-3 px-4">ROK</th>
                      <th className="py-3 px-4 text-right">RADNJE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayTenders.map((t) => (
                      <ProcurementRow
                        key={t.id}
                        tender={t as any}
                        isWatched={watchedSet.has(t.id)}
                        onToggleWatch={handleToggleWatch}
                        token={token || undefined}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View (visible on mobile screens < 768px when view === 'table') */}
              <div className="md:hidden p-3 space-y-3 divide-y divide-gray-100">
                {displayTenders.map((t) => {
                  const raw = (t as any).rawData;
                  const isWatched = watchedSet.has(t.id);
                  const noticeNumber = raw?.Number || t.externalId;
                  return (
                    <div key={t.id} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <StatusBadge tender={{ status: t.status, statusName: t.statusName, rawData: raw }} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-7 w-7 rounded-md border", isWatched ? "text-amber-500 bg-amber-50 border-amber-200" : "text-gray-400")}
                          onClick={() => handleToggleWatch(t.id)}
                        >
                          <Star className={cn("w-3.5 h-3.5", isWatched ? "fill-amber-400" : "")} />
                        </Button>
                      </div>

                      <div>
                        <Link href={`/tenders/${t.id}`}>
                          <h3 className="font-bold text-sm text-gray-900 hover:text-primary transition-colors cursor-pointer line-clamp-2 leading-tight">
                            {t.title}
                          </h3>
                        </Link>
                        <p className="text-xs text-gray-500 mt-1 truncate">{t.contractingAuth}</p>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div>
                          <div className="font-bold text-sm text-gray-900">
                            {formatMoney(t.estimatedValue, t.currency)}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            br: {noticeNumber}
                          </div>
                        </div>
                        <div className="text-right">
                          <Link href={`/tenders/${t.id}`}>
                            <Button size="sm" className="h-7 px-2.5 text-xs font-semibold gap-1 bg-primary text-white rounded-md">
                              <span>Otvori</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Card Grid View */
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayTenders.map((t) => {
                const awards = (t as any).awards as TenderAward[] | undefined;
                const raw = (t as any).rawData;
                const isWatched = watchedSet.has(t.id);
                const noticeNumber = raw?.Number || t.externalId;

                return (
                  <Card key={t.id} className="border-gray-200 hover:shadow-md transition-all">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <StatusBadge tender={{ status: t.status, statusName: t.statusName, rawData: raw }} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-7 w-7 rounded-md border", isWatched ? "text-amber-500 bg-amber-50 border-amber-200" : "text-gray-400")}
                          onClick={() => handleToggleWatch(t.id)}
                        >
                          <Star className={cn("w-3.5 h-3.5", isWatched ? "fill-amber-400" : "")} />
                        </Button>
                      </div>

                      <div>
                        <Link href={`/tenders/${t.id}`}>
                          <h3 className="font-bold text-sm text-gray-900 hover:text-primary transition-colors cursor-pointer line-clamp-2 leading-tight">
                            {t.title}
                          </h3>
                        </Link>
                        <p className="text-xs text-gray-500 mt-1 truncate">{t.contractingAuth}</p>
                      </div>

                      {awards && awards.length > 0 && (
                        <div className="text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 font-medium">
                          Pobjednik: {awards[0].winnerName}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                        <div>
                          <div className="font-bold text-sm text-gray-900">
                            {formatMoney(t.estimatedValue, t.currency)}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono">
                            {t.cpvCodes?.[0] || "-"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-800">
                            {t.deadline ? formatDate(t.deadline) : "Nije navedeno"}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            br: {noticeNumber}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Footer / Pagination */}
          <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              Prikazuje se stranica <strong className="text-gray-900">{page}</strong> od <strong className="text-gray-900">{data?.totalPages || 1}</strong> ({data?.total ?? 0} ukupno)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prethodna
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data?.totalPages || 1)}
              >
                Sljedeća <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
