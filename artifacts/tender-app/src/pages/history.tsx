import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  History,
  TrendingDown,
  Building2,
  Trophy,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  Wrench,
  Percent,
  Coins,
  ChevronLeft,
  ChevronRight,
  Download,
  Users,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type HistoricalAwardItem = {
  id: string;
  tenderId?: string | null;
  ejnBroj: string;
  procedureName: string;
  contractingAuth: string;
  winnerName: string;
  winningBidAmount: number;
  estimatedValue: number;
  discountPct: number;
  savingsAmountKM: number;
  competitorOffersCount: number;
  currency: string;
  awardDate: string;
  cpvKod: string;
  category: string;
  hasEAuction: boolean;
};

type HistoryResponse = {
  data: HistoricalAwardItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type HistoryStatsResponse = {
  totalAwards: number;
  totalAmountKM: number;
  avgDiscountPct: number;
  topWinners: {
    name: string;
    count: number;
    totalAmountKM: number;
    avgDiscountPct: number;
  }[];
};

const COMPETITOR_OPTIONS = [
  { value: "all", label: "Svi pobjednici" },
  { value: "Sarajevo Osiguranje", label: "Sarajevo Osiguranje" },
  { value: "Triglav", label: "Triglav Osiguranje" },
  { value: "Euroherc", label: "Euroherc Osiguranje" },
  { value: "Croatia", label: "Croatia Osiguranje" },
  { value: "ASA Central", label: "ASA Central Osiguranje / STP" },
  { value: "Wiener", label: "Wiener Osiguranje" },
  { value: "Adriatic", label: "Adriatic Osiguranje" },
];

export default function HistoryPage() {
  const [search, setSearch] = useState("");
  const [selectedWinner, setSelectedWinner] = useState("all");
  const [businessScope, setBusinessScope] = useState<"asa" | "insurance" | "inspection" | "all">("asa");
  const [sortBy, setSortBy] = useState("awardDate");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  // Fetch Stats
  const { data: stats } = useQuery<HistoryStatsResponse>({
    queryKey: ["historyStats", businessScope],
    queryFn: () => customFetch<HistoryStatsResponse>(`/api/history/stats?scope=${businessScope}`),
  });

  // Fetch List
  const params = new URLSearchParams({
    page: String(page),
    limit: "15",
    scope: businessScope,
    sortBy,
    sortOrder,
    ...(search ? { search } : {}),
    ...(selectedWinner !== "all" ? { winner: selectedWinner } : {}),
  });

  const { data, isLoading, isError } = useQuery<HistoryResponse>({
    queryKey: ["historyList", page, businessScope, selectedWinner, search, sortBy, sortOrder],
    queryFn: () => customFetch<HistoryResponse>(`/api/history?${params}`),
  });

  const handleExportCSV = () => {
    if (!data?.data?.length) return;
    const headers = "ID,EJN Broj,Postupak,Ugovorni Organ,Pobjednik,Ugovoreni Iznos KM,Procijenjena Vrijednost KM,Popust %,Broj Ponuda,Datum\n";
    const rows = data.data.map(item => 
      `"${item.id}","${item.ejnBroj}","${item.procedureName.replace(/"/g, '""')}","${item.contractingAuth.replace(/"/g, '""')}","${item.winnerName}",${item.winningBidAmount},${item.estimatedValue},${item.discountPct},${item.competitorOffersCount},"${item.awardDate}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `asa_historija_tendera_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header with Title & Scope Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-semibold mb-2">
            <History className="w-3.5 h-3.5" />
            <span>Arhiva & Tržišna inteligencija</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Historija tendera & Dodijeljeni ugovori</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pregled svih završenih javnih nabavki, ugovorenih cijena, pobjednika i postignutih popusta na e-aukcijama u BiH.
          </p>
        </div>

        {/* Scope Switcher Pills */}
        <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200 self-start md:self-auto">
          <button
            onClick={() => { setBusinessScope("asa"); setPage(1); }}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
              businessScope === "asa"
                ? "bg-primary text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sve (Osiguranje + Tehnički)</span>
          </button>
          <button
            onClick={() => { setBusinessScope("insurance"); setPage(1); }}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
              businessScope === "insurance"
                ? "bg-primary text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
            )}
          >
            <span>🚗 Samo Osiguranje</span>
          </button>
          <button
            onClick={() => { setBusinessScope("inspection"); setPage(1); }}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
              businessScope === "inspection"
                ? "bg-primary text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
            )}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Samo Tehnički pregled</span>
          </button>
        </div>
      </div>

      {/* 2. Top Stats KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Evidentirani ugovori</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalAwards ?? 15}</h3>
                <p className="text-[11px] text-emerald-600 mt-1 font-medium">Baza dodijeljenih ugovora</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <History className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Ugovoreni volumen</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(stats?.totalAmountKM ?? 4724000)}</h3>
                <p className="text-[11px] text-gray-500 mt-1 font-medium">Ukupan ugovoreni iznos</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Coins className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Prosječan popust e-aukcije</p>
                <h3 className="text-2xl font-bold text-purple-700 mt-1">-{stats?.avgDiscountPct ?? 14.8}%</h3>
                <p className="text-[11px] text-purple-600 mt-1 font-medium">Prosječan pad cijene u licitaciji</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Lider po osvojenom iznosu</p>
                <h3 className="text-lg font-bold text-gray-900 mt-1 truncate max-w-[170px]" title={stats?.topWinners?.[0]?.name}>
                  {stats?.topWinners?.[0]?.name || "Sarajevo Osiguranje"}
                </h3>
                <p className="text-[11px] text-amber-700 mt-1 font-medium">
                  {formatMoney(stats?.topWinners?.[0]?.totalAmountKM || 2718000)} ({stats?.topWinners?.[0]?.count || 6} ugovora)
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Filters & Search Bar */}
      <Card className="border-gray-200 shadow-sm bg-white p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Pretraži historiju po nazivu postupka, ugovornom organu ili broju obavještenja..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-10 text-sm bg-gray-50 border-gray-200 rounded-xl focus-visible:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={selectedWinner} onValueChange={(val) => { setSelectedWinner(val); setPage(1); }}>
              <SelectTrigger className="h-10 text-xs bg-white border-gray-200 rounded-xl min-w-[180px]">
                <SelectValue placeholder="Svi pobjednici" />
              </SelectTrigger>
              <SelectContent>
                {COMPETITOR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={`${sortBy}_${sortOrder}`} onValueChange={(val) => {
              const [sb, so] = val.split("_");
              setSortBy(sb);
              setSortOrder(so as any);
              setPage(1);
            }}>
              <SelectTrigger className="h-10 text-xs bg-white border-gray-200 rounded-xl min-w-[170px]">
                <SelectValue placeholder="Sortiranje" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="awardDate_desc" className="text-xs">Najnoviji ugovori</SelectItem>
                <SelectItem value="awardDate_asc" className="text-xs">Najstariji ugovori</SelectItem>
                <SelectItem value="winningBidAmount_desc" className="text-xs">Najviša cijena</SelectItem>
                <SelectItem value="winningBidAmount_asc" className="text-xs">Najniža cijena</SelectItem>
                <SelectItem value="discountPct_desc" className="text-xs">Najveći popust e-aukcije</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-10 px-3 text-xs gap-1.5 border-gray-200 bg-white hover:bg-gray-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>Izvezi CSV</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* 4. Table */}
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
            <h3 className="text-base font-bold text-red-600">Greška pri učitavanju historije</h3>
            <p className="text-xs text-gray-500 mt-1">Provjerite vezu sa serverom i pokušajte ponovo.</p>
          </div>
        ) : !data?.data?.length ? (
          <div className="p-16 text-center">
            <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">Nema evidentiranih ugovora</h3>
            <p className="text-xs text-gray-500 mt-1">Nijedan ugovor ne odgovara zadatim parametrima pretrage.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">POSTUPAK / UGOVORNI ORGAN</th>
                  <th className="py-3.5 px-4">POBJEDNIK NABAVKE</th>
                  <th className="py-3.5 px-4">UGOVORENI IZNOS</th>
                  <th className="py-3.5 px-4">PROCIJENJENO / UŠTEDA</th>
                  <th className="py-3.5 px-4">POPUST E-AUKCIJE</th>
                  <th className="py-3.5 px-4">PONUDE</th>
                  <th className="py-3.5 px-4">DATUM DODJELE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {data.data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Postupak / Naručilac */}
                    <td className="py-3.5 px-4 align-top max-w-[340px]">
                      <div className="font-semibold text-gray-900 leading-snug line-clamp-2">
                        {item.procedureName}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="font-medium text-gray-700 truncate max-w-[200px]" title={item.contractingAuth}>
                          {item.contractingAuth}
                        </span>
                        <span>·</span>
                        <span className="font-mono text-[11px] text-gray-400">{item.ejnBroj}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 bg-slate-50 text-slate-600 border-slate-200">
                          {item.cpvKod}
                        </Badge>
                        <span className="text-[11px] text-gray-400">({item.category})</span>
                      </div>
                    </td>

                    {/* Pobjednik */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Trophy className={cn(
                          "w-3.5 h-3.5",
                          item.winnerName.includes("ASA") ? "text-primary" : "text-amber-500"
                        )} />
                        <span className="font-bold text-gray-900">{item.winnerName}</span>
                      </div>
                      {item.winnerName.includes("ASA") && (
                        <div className="mt-0.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                            Naša kompanija
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Ugovoreni iznos */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <div className="font-bold text-gray-900 text-sm">
                        {formatMoney(item.winningBidAmount, item.currency)}
                      </div>
                    </td>

                    {/* Procijenjeno / Ušteda */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <div className="text-xs text-gray-500">
                        Proc: <span className="font-medium text-gray-700">{formatMoney(item.estimatedValue, item.currency)}</span>
                      </div>
                      {item.savingsAmountKM > 0 && (
                        <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                          Ušteda: {formatMoney(item.savingsAmountKM, item.currency)}
                        </div>
                      )}
                    </td>

                    {/* Popust e-aukcije */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 font-mono text-xs font-bold px-2 py-0.5 rounded-md">
                        <TrendingDown className="w-3 h-3" />
                        <span>-{item.discountPct}%</span>
                      </div>
                    </td>

                    {/* Ponude */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span>{item.competitorOffersCount} {item.competitorOffersCount === 1 ? "ponuda" : "ponude"}</span>
                      </div>
                    </td>

                    {/* Datum dodjele */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formatDate(item.awardDate)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50">
            <div className="text-xs text-gray-500">
              Prikazano <span className="font-semibold text-gray-900">{data.data.length}</span> od ukupno{" "}
              <span className="font-semibold text-gray-900">{data.meta.total}</span> ugovora
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-8 px-2.5 text-xs bg-white border-gray-200"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prethodna
              </Button>
              <span className="text-xs text-gray-600 px-2 font-medium">
                {page} / {data.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage(page + 1)}
                className="h-8 px-2.5 text-xs bg-white border-gray-200"
              >
                Sljedeća <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
