import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { 
  Users, Search, ChevronRight, ChevronLeft, Building, Calculator, 
  Lock, Sparkles, Shield, Bookmark, RotateCcw, ArrowUpDown, 
  CheckCircle2, AlertTriangle, ExternalLink, Info, Building2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  jib: string;
  city: string;
  address?: string;
  registrationStatus: "registered" | "unregistered" | "verified";
  dataQuality: "confirmed" | "partial";
  cpvCodes: string[];
  categories: string[];
  encountersCount: number;
  marketOverlap: string;
  totalWins: number | null;
  totalValue: number | null;
  successRate: number | null;
  teamClassification?: string;
  isWatched?: boolean;
}

interface SuppliersResponse {
  suppliers: Supplier[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    activeProfiles: number;
    noContactCount: number;
    duplicatesCount: number;
    bidCoverageCount: number;
  };
}

const CITIES = [
  "Sarajevo", "Banja Luka", "Tuzla", "Zenica", "Mostar", 
  "Bijeljina", "Bihać", "Prijedor", "Doboj", "Brčko", 
  "Trebinje", "Široki Brijeg", "Laktaši", "Milići"
];

const COMMON_CPVS = [
  { code: "66510000-8", label: "Usluge osiguranja" },
  { code: "66514110-0", label: "Osiguranje motornih vozila" },
  { code: "66512100-3", label: "Osiguranje od nezgode" },
  { code: "66515200-5", label: "Osiguranje imovine" },
  { code: "72000000-5", label: "IT usluge" },
  { code: "45200000-9", label: "Građevinski radovi" },
  { code: "33100000-1", label: "Medicinska oprema" },
  { code: "09132000-3", label: "Gorivo i derivati" },
];

function formatValKM(val: number): string {
  if (val >= 1000000) {
    return `${(val / 1000000).toLocaleString("bs-BA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M KM`;
  }
  if (val >= 1000) {
    return `${(val / 1000).toLocaleString("bs-BA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} K KM`;
  }
  return `${val.toLocaleString("bs-BA")} KM`;
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"all" | "relevant" | "watched">("all");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");
  const [cpvCode, setCpvCode] = useState("all");
  const [minWins, setMinWins] = useState("");
  const [registration, setRegistration] = useState("all");
  const [quality, setQuality] = useState("all");
  const [encountersFilter, setEncountersFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Query suppliers
  const { data, isLoading, isError } = useQuery<SuppliersResponse>({
    queryKey: ["suppliers", tab, search, city, cpvCode, minWins, registration, quality, page],
    queryFn: ({ signal }) => {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", "20");
      p.set("tab", tab);
      if (search) p.set("search", search);
      if (city && city !== "all") p.set("city", city);
      if (cpvCode && cpvCode !== "all") p.set("cpvCode", cpvCode);
      if (minWins) p.set("minWins", minWins);
      if (registration && registration !== "all") p.set("registration", registration);
      if (quality && quality !== "all") p.set("quality", quality);
      return customFetch<SuppliersResponse>(`/api/suppliers?${p.toString()}`, { signal });
    },
  });

  // Watch mutation
  const toggleWatch = useMutation({
    mutationFn: async ({ id, isWatched }: { id: string; isWatched: boolean }) => {
      return customFetch(`/api/suppliers/${id}/watch`, {
        method: isWatched ? "DELETE" : "POST",
      });
    },
    onSuccess: (_, vars) => {
      toast.success(vars.isWatched ? "Uklonjeno iz praćenih dobavljača" : "Dodano u praćene dobavljače");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });

  const resetFilters = () => {
    setSearch("");
    setCity("all");
    setCpvCode("all");
    setMinWins("");
    setRegistration("all");
    setQuality("all");
    setEncountersFilter("all");
    setPage(1);
  };

  const hasFilters = search || city !== "all" || cpvCode !== "all" || minWins || registration !== "all" || quality !== "all";

  const stats = data?.stats || {
    activeProfiles: 0,
    noContactCount: 0,
    duplicatesCount: 0,
    bidCoverageCount: 0,
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
      {/* 1. Breadcrumbs & Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/dashboard" className="hover:text-primary">Početna</Link>
          <span>›</span>
          <span className="text-foreground font-medium">Dobavljači</span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-950">Dobavljači</h1>
        <p className="text-sm text-gray-500">Pretražite dobavljače i analizirajte njihove uspjehe</p>
      </div>

      {/* 2. ŠTA GLEDATE Legenda (sena.ba stil) */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-600 bg-gray-50/70 p-2.5 rounded-xl border border-gray-200/80">
        <span className="font-bold uppercase tracking-wider text-[11px] text-gray-400">ŠTA GLEDATE</span>
        <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 border border-sky-200/70 px-2 py-0.5 rounded-md font-medium text-[11px]">
          <Building className="w-3 h-3 text-sky-600" />
          Javni podatak
        </span>
        <span className="text-gray-400 text-[11px]">identitet, dodjele i registri</span>

        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 border border-purple-200/70 px-2 py-0.5 rounded-md font-medium text-[11px] ml-2">
          <Calculator className="w-3 h-3 text-purple-600" />
          Izračunato
        </span>
        <span className="text-gray-400 text-[11px]">naš izračun samo kada postoje potpuni javni podaci</span>

        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200/70 px-2 py-0.5 rounded-md font-medium text-[11px] ml-2">
          <Lock className="w-3 h-3 text-blue-600" />
          Interni podatak
        </span>
        <span className="text-gray-400 text-[11px]">samo za vaš tim, bez EJN efekta</span>

        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/70 px-2 py-0.5 rounded-md font-medium text-[11px] ml-2">
          <Sparkles className="w-3 h-3 text-amber-600" />
          AI analiza
        </span>
        <span className="text-gray-400 text-[11px]">troši kredite, opcionalno</span>
      </div>

      {/* 3. Top 4 KPI Metrics (sena.ba stil) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-200/90 shadow-sm bg-white hover:shadow transition-shadow">
          <CardContent className="p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">AKTIVNI PROFILI</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-2">
              {stats.activeProfiles.toLocaleString("bs-BA")}
            </p>
            <p className="text-xs text-gray-400 mt-1">sa najmanje jednom javnom dodjelom</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200/90 shadow-sm bg-white hover:shadow transition-shadow">
          <CardContent className="p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">KONTAKT PODATAK</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-2">
              —
            </p>
            <p className="text-xs text-gray-400 mt-1">EJN dodjele ga ne objavljuju</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200/90 shadow-sm bg-white hover:shadow transition-shadow">
          <CardContent className="p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">DUPLIKATI</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-2">
              —
            </p>
            <p className="text-xs text-gray-400 mt-1">nisu automatski zaključeni bez registra</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200/90 shadow-sm bg-white hover:shadow transition-shadow">
          <CardContent className="p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">EJN DOBITNICI</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-2">
              {stats.bidCoverageCount.toLocaleString("bs-BA")}
            </p>
            <p className="text-xs text-gray-400 mt-1">s najmanje jednom učitanom dodjelom</p>
          </CardContent>
        </Card>
      </div>

      {/* 4. Tabs (Javni registar, Relevantni za nas, Praćeni) */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
          <Button
            variant={tab === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => { setTab("all"); setPage(1); }}
            className={cn(
              "rounded-lg font-semibold text-xs px-4 h-9 transition-colors",
              tab === "all" ? "bg-primary text-white hover:bg-primary/95 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            Javni registar
          </Button>

          <Button
            variant={tab === "relevant" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => { setTab("relevant"); setPage(1); }}
            className={cn(
              "rounded-lg font-semibold text-xs px-4 h-9 transition-colors",
              tab === "relevant" ? "bg-primary text-white hover:bg-primary/95 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            Relevantni za nas
          </Button>

          <Button
            variant={tab === "watched" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => { setTab("watched"); setPage(1); }}
            className={cn(
              "rounded-lg font-semibold text-xs px-4 h-9 transition-colors",
              tab === "watched" ? "bg-primary text-white hover:bg-primary/95 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            Praćeni
          </Button>
        </div>
        <p className="text-xs text-gray-500 pt-1">
          Sve pravne osobe s javnim tragom dodjele. Bez rangiranja po &quot;uspješnosti&quot;.
        </p>
      </div>

      {/* 5. Search and Filters Box */}
      <Card className="border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4 space-y-3">
          {/* Main search row */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Naziv ili JIB..."
              className="pl-10 h-10 bg-white border-gray-200 text-sm focus-visible:ring-primary/20 rounded-lg"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Row 1: Grad, CPV, Min pobjeda */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Grad</label>
              <Select value={city} onValueChange={(v) => { setCity(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="Svi gradovi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi gradovi</SelectItem>
                  {CITIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">CPV kod (po ugovorima)</label>
              <Select value={cpvCode} onValueChange={(v) => { setCpvCode(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="Filtriraj po CPV kodu..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi CPV kodovi</SelectItem>
                  {COMMON_CPVS.map((cpv) => (
                    <SelectItem key={cpv.code} value={cpv.code}>{cpv.code} - {cpv.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Min. pobjeda</label>
              <Input
                type="number"
                placeholder="0"
                className="h-9 text-xs bg-white border-gray-200 rounded-lg"
                value={minWins}
                onChange={(e) => { setMinWins(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Row 2: Registracija, Kvalitet podataka, Susreti */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Registracija</label>
              <Select value={registration} onValueChange={(v) => { setRegistration(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="Svi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi</SelectItem>
                  <SelectItem value="registered">Registrovani ponuđač</SelectItem>
                  <SelectItem value="unregistered">Neregistrovani ponuđač</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Kvalitet podataka</label>
              <Select value={quality} onValueChange={(v) => { setQuality(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="Svi nivoi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi nivoi</SelectItem>
                  <SelectItem value="confirmed">Potvrđeni identitet</SelectItem>
                  <SelectItem value="partial">Djelimičan profil</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-400">Duplikat znači da isti registarski broj nosi više zapisa.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Susreti</label>
              <Select value={encountersFilter} onValueChange={(v) => { setEncountersFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="Svi dobavljači" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi dobavljači</SelectItem>
                  <SelectItem value="met">Samo oni sa zajedničkim nadmetanjima</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-400">Nadmetanja na kojima ste ponudu predali i vi i oni.</p>
            </div>
          </div>

          {hasFilters && (
            <div className="pt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-gray-500 hover:text-red-600 gap-1">
                <RotateCcw className="w-3.5 h-3.5" /> Poništi filtere
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Sena Performance Banner */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <p className="font-semibold text-amber-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Vaš učinak protiv svakog dobavljača na listi — koliko ste se puta sreli, ko je dobijao, i koliko njihovog posla je u vašim tržištima.
          </p>
          <p className="text-amber-700 text-[11px]">
            Statistika i analitika se generišu automatski iz svih službenih zabilježenih dodjela i učešća.
          </p>
        </div>
      </div>

      {/* 7. Suppliers Table */}
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
          <div className="p-16 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-base font-bold text-gray-900">Greška pri dohvatu dobavljača</p>
            <Button onClick={() => window.location.reload()} size="sm" className="mt-3">Pokušaj ponovo</Button>
          </div>
        ) : !data?.suppliers.length ? (
          <div className="p-16 text-center text-gray-500">
            <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-base font-bold text-gray-900">Nema pronađenih dobavljača</p>
            <p className="text-xs text-gray-400 mt-1">Pokušajte prilagoditi parametre pretrage ili grad.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">DOBAVLJAČ ↓</th>
                  <th className="py-3 px-4">JAVNI DOKAZ</th>
                  <th className="py-3 px-4">VAŠI SUSRETI</th>
                  <th className="py-3 px-4">PREKLAPANJE S VAŠIM TRŽIŠTIMA</th>
                  <th className="py-3 px-4">POBJEDA</th>
                  <th className="py-3 px-4">USPJEŠNOST</th>
                  <th className="py-3 px-4">VRIJEDNOST</th>
                  <th className="py-3 px-4">KATEGORIJE</th>
                  <th className="py-3 px-4 text-right">RADNJE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {data.suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* DOBAVLJAČ */}
                    <td className="py-3.5 px-4 align-top max-w-[280px]">
                      <Link href={`/suppliers/${s.id}`}>
                        <div className="font-bold text-sm text-gray-900 hover:text-primary transition-colors cursor-pointer line-clamp-1">
                          {s.name}
                        </div>
                      </Link>
                      <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
                        JIB: {s.jib}
                      </div>
                      <div className="text-[11px] text-gray-700 font-semibold uppercase mt-0.5">
                        {s.city}
                      </div>
                    </td>

                    {/* JAVNI DOKAZ */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
                        s.registrationStatus === "registered"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      )}>
                        {s.registrationStatus === "registered" ? "Registrovani ponuđač" : "Neregistrovani ponuđač"}
                      </span>
                    </td>

                    {/* VAŠI SUSRETI */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      {s.encountersCount > 0 ? (
                        <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                          {s.encountersCount} {s.encountersCount === 1 ? "susret" : s.encountersCount < 5 ? "susreta" : "susreta"}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* PREKLAPANJE S VAŠIM TRŽIŠTIMA */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold",
                        s.marketOverlap === "Visoko" ? "bg-red-50 text-red-700" :
                        s.marketOverlap === "Srednje" ? "bg-amber-50 text-amber-700" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {s.marketOverlap}
                      </span>
                    </td>

                    {/* POBJEDA */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <strong className="text-sm font-bold text-gray-900">{s.totalWins ?? "—"}</strong>
                    </td>

                    {/* USPJEŠNOST */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      {s.successRate == null ? <span className="text-gray-400">Nije objavljeno</span> : (
                        <span className="font-semibold text-emerald-700">{s.successRate}%</span>
                      )}
                    </td>

                    {/* VRIJEDNOST */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap font-semibold text-gray-900">
                      {s.totalValue == null ? <span className="text-gray-400">Otvori profil</span> : formatValKM(s.totalValue)}
                    </td>

                    {/* KATEGORIJE */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex flex-wrap gap-1">
                        {s.cpvCodes?.slice(0, 1).map((c) => (
                          <span key={c} className="bg-gray-100 text-gray-700 text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-200">
                            {c}
                          </span>
                        ))}
                        {s.cpvCodes?.length > 1 && (
                          <span className="text-[10px] text-gray-400 px-1 py-0.5">
                            +{s.cpvCodes.length - 1}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* RADNJE */}
                    <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8 rounded-lg border border-gray-200 transition-colors",
                            s.isWatched
                              ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                              : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                          )}
                          title={s.isWatched ? "Ukloni iz praćenja" : "Prati dobavljača"}
                          onClick={() => toggleWatch.mutate({ id: s.id, isWatched: !!s.isWatched })}
                        >
                          <Bookmark className={cn("w-4 h-4", s.isWatched ? "fill-amber-500" : "")} />
                        </Button>

                        <Link href={`/suppliers/${s.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg border border-gray-200 text-gray-400 hover:text-primary hover:bg-blue-50"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div>
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
  );
}
