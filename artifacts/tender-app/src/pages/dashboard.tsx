import { useState, useEffect } from "react";
import { useListTenders, useGetAnalyticsSummary, useGetAnalyticsByCategory, customFetch } from "@workspace/api-client-react";
import { LiveFeed } from "@/components/LiveFeed";
import { MyWorkday } from "@/components/TenderWorkspace";
import { EjnSyncPanel } from "@/components/EjnSyncPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate, getScoreBadgeProps } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { FileText, AlertTriangle, Target, Clock, BrainCircuit, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {

  const [timeTick, setTimeTick] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTick(Date.now());
    }, 60 * 60 * 1000); // refresh hourly
    return () => clearInterval(interval);
  }, []);

  const { data: followedTenders, isLoading: loadingFollowed } = useQuery({
    queryKey: ["kanbanBoard"],
    queryFn: () => customFetch<any[]>("/api/tenders/kanban/board"),
  });

  const sortedTenders = [...(followedTenders || [])].sort((a, b) => {
    const d1 = (a.deadline ? new Date(a.deadline).getTime() : Infinity);
    const d2 = (b.deadline ? new Date(b.deadline).getTime() : Infinity);
    const nowMs = Date.now();

    const isPastA = d1 <= nowMs;
    const isPastB = d2 <= nowMs;

    if (isPastA && !isPastB) return 1;
    if (!isPastA && isPastB) return -1;
    return d1 - d2;
  });

  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary();
  const { data: tendersData, isLoading: loadingTenders } = useListTenders({ 
    limit: 8, 
    sortBy: "publicationDate", 
    sortOrder: "desc",
    status: "open",
    scope: "asa"
  });
  const { data: catData, isLoading: loadingCat } = useGetAnalyticsByCategory();

  const chartData = catData?.map((c: { category?: string; count?: number }) => ({
    name: c.category || "Ostalo",
    count: c.count || 0,
  })).slice(0, 6) ?? [];


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Radni pregled</h1>
          <p className="text-gray-500 text-sm mt-1">Zaduženja tima, rokovi i pregled tendera</p>
        </div>
      </div>

      <MyWorkday />
      <EjnSyncPanel />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Aktivni tenderi" value={summary?.openTenders} icon={FileText} loading={loadingSummary} />
        <StatCard title="Novih danas" value={summary?.newToday} icon={Target} loading={loadingSummary} />
        <StatCard title="Rok u 7 dana" value={summary?.expiringIn7Days} icon={Clock} loading={loadingSummary} />
        <StatCard title="Na watchlisti" value={summary?.watchlistCount} icon={AlertTriangle} loading={loadingSummary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-primary" />
                Dnevni pregled podataka
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
                <p>
                  Pronađeno je <strong>{summary?.newToday ?? 0} novih tendera</strong> u posljednja 24 sata.
                  {summary?.openTenders ? ` Ukupno je aktivno ${summary.openTenders} tendera u sistemu.` : ""}
                </p>
                {summary?.expiringIn7Days && summary.expiringIn7Days > 0 && (
                  <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Pažnja: <strong>{summary.expiringIn7Days} tendera</strong> ističe u narednih 7 dana — provjerite listu i pokrenite prijavu na vrijeme.
                  </p>
                )}
                <p className="text-gray-500 italic text-xs">
                  Stanje i nastavak preuzimanja dostupni su u panelu EJN iznad.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Predaja ponuda — rokovi */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-gray-50/50">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Predaja ponuda — rokovi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {loadingFollowed ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !sortedTenders || sortedTenders.length === 0 ? (
                <div className="text-center text-gray-400 py-6 text-sm">
                  Nema tendera na praćenju. Dodajte tendere na praćenje da vidite odbrojavanje.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedTenders.map((t: any) => {
                    const countdown = calculateCountdown(t.deadline, timeTick);
                    return (
                      <div 
                        key={t.id} 
                        className="p-3.5 border rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span 
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${countdown.colorClass}`}
                            >
                              {countdown.badgeText}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono uppercase">
                              {t.externalId?.substring(0, 8) || "N/A"}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-gray-900 truncate" title={t.title}>
                            {t.title}
                          </h4>
                          <p className="text-xs text-gray-500 font-medium flex items-center gap-2">
                            <span>Rok: {formatDeadlineDate(t.deadline)}</span>
                            <span className="text-gray-300">|</span>
                            <span className="font-bold text-primary">
                              {t.estimatedValue ? `${t.estimatedValue.toLocaleString("bs-BA")} KM` : "Vrijednost nije navedena"}
                            </span>
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-primary hover:bg-primary/5 font-semibold px-2.5 py-1 border shrink-0 self-start sm:self-center"
                          onClick={() => window.location.href = `/tenders/${t.id}`}
                        >
                          Otvori tender →
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Posljednje objavljeni tenderi</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTenders ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-gray-500 font-medium">
                        <th className="p-3">Naziv i Ugovorni organ</th>
                        <th className="p-3">Vrijednost</th>
                        <th className="p-3">Rok</th>
                        <th className="p-3">AI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tendersData?.tenders?.map(t => {
                        const scoreProps = getScoreBadgeProps(t.relevanceScore);
                        return (
                           <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/tenders/${t.id}`}>
                            <td className="p-3">
                              <div className="font-medium text-primary line-clamp-1">{t.title}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{t.contractingAuth} • {t.entity}</div>
                            </td>
                            <td className="p-3 font-medium text-gray-700 whitespace-nowrap">{formatMoney(t.estimatedValue, t.currency)}</td>
                            <td className="p-3 text-gray-600 whitespace-nowrap">{formatDate(t.deadline)}</td>
                            <td className="p-3 whitespace-nowrap">
                              {t.relevanceScore != null ? (
                                <Badge className={scoreProps.className}>{t.relevanceScore}</Badge>
                              ) : (
                                <span className="text-xs text-gray-400">N/A</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {(!tendersData?.tenders || tendersData.tenders.length === 0) && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-gray-500">
                            Nema tendera za prikaz. Pokrenite sinkronizaciju da uvezete EJN podatke.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Tenderi po kategorijama</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] p-0 pb-4">
              {loadingCat ? (
                <div className="flex items-center justify-center h-full">
                  <Skeleton className="w-full h-full" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">Nema podataka</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={140}
                      tick={{ fontSize: 11, fill: "#4b5563" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => v.length > 20 ? v.slice(0, 19) + "…" : v}
                    />
                    <Tooltip
                      cursor={{ fill: "#f3f4f6" }}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      formatter={(v: number) => [v, "Tendera"]}
                    />
                    <Bar dataKey="count" fill="#002d82" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-primary/5 border-primary/20">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-primary text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4.5 h-4.5 text-primary" />
                EJN Portal Integracija
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Uvoz koristi javni EJN izvor. Dostupnost pune tenderske dokumentacije provjerava se zasebno za svaki tender.
              </p>
              <div className="text-xs text-gray-500 space-y-1 bg-white p-2.5 rounded border border-primary/10">
                <div className="flex justify-between"><span>Portal:</span><span className="font-semibold text-gray-800">www.ejn.gov.ba</span></div>
                <p>Javno obavještenje ne zamjenjuje punu dokumentaciju. Ako pristup nije dostupan, dodajte dokumente ručno u kartici Dokumenti.</p>
              </div>
            </CardContent>
          </Card>

          <LiveFeed />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, loading }: { title: string; value?: number; icon: React.ElementType; loading: boolean }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-2" />
            ) : (
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{value ?? 0}</h3>
            )}
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function calculateCountdown(deadlineStr: string | null, currentMs: number) {
  if (!deadlineStr) return { badgeText: "Rok nije poznat", colorClass: "bg-gray-100 text-gray-600" };
  const deadline = new Date(deadlineStr);
  const now = new Date(currentMs);
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      badgeText: "⚫ Rok prošao (arhiva)",
      colorClass: "bg-gray-100 text-gray-500 border-gray-200 font-normal",
    };
  }

  const isToday = deadline.toDateString() === now.toDateString();

  if (isToday) {
    const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
    const minutes = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
    return {
      badgeText: `🔴 HITNO — još ${hours}h ${minutes}m`,
      colorClass: "bg-red-50 text-red-700 border-red-200 animate-pulse font-extrabold",
    };
  }

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days <= 3) {
    return {
      badgeText: `🔴 HITNO — ${days} ${days === 1 ? 'dan' : 'dana'}`,
      colorClass: "bg-red-50 text-red-700 border-red-200 font-extrabold",
    };
  } else if (days <= 7) {
    return {
      badgeText: `🟡 ${days} dana`,
      colorClass: "bg-amber-50 text-amber-700 border-amber-200 font-bold",
    };
  } else {
    return {
      badgeText: `🟢 ${days} dana`,
      colorClass: "bg-green-50 text-green-700 border-green-200 font-semibold",
    };
  }
}

function formatDeadlineDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year}. u ${hours}:${minutes}`;
}
