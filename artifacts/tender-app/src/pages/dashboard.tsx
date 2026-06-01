import { useState } from "react";
import { useListTenders, useGetAnalyticsSummary, useGetAnalyticsByCategory, useTriggerScraper } from "@workspace/api-client-react";
import { LiveFeed } from "@/components/LiveFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate, getScoreBadgeProps } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RefreshCw, FileText, AlertTriangle, Target, Clock, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary();
  const { data: tendersData, isLoading: loadingTenders } = useListTenders({ limit: 8, sortBy: "relevanceScore", sortOrder: "desc" });
  const { data: catData, isLoading: loadingCat } = useGetAnalyticsByCategory();
  const triggerScraper = useTriggerScraper();

  const chartData = catData?.map((c: { category?: string; count?: number }) => ({
    name: c.category || "Ostalo",
    count: c.count || 0,
  })).slice(0, 6) ?? [];

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerScraper.mutateAsync({ data: { source: "ejn" } });
      toast.success("Sinkronizacija pokrenuta — preuzimam podatke s EJN portala...");
      setTimeout(() => {
        queryClient.invalidateQueries();
        setSyncing(false);
      }, 5000);
    } catch {
      toast.error("Greška pri pokretanju sinkronizacije");
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Pregled vaših tendera i AI analitike</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 border rounded-md shadow-sm text-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="font-medium text-gray-700">EJN Sinkronizacija</span>
          </div>
          <div className="w-px h-4 bg-gray-300 mx-2"></div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-primary px-2"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sinkronizacija..." : "Sinkroniziraj EJN"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Aktivni tenderi" value={summary?.openTenders} icon={FileText} loading={loadingSummary} />
        <StatCard title="AI Relevantni (>75)" value={summary?.highRelevance} icon={Target} loading={loadingSummary} />
        <StatCard title="Rok u 7 dana" value={summary?.expiringIn7Days} icon={Clock} loading={loadingSummary} />
        <StatCard title="Na watchlisti" value={summary?.watchlistCount} icon={AlertTriangle} loading={loadingSummary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-primary" />
                AI Dnevni pregled
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
                  Sistem automatski preuzima podatke s EJN portala (open.ejn.gov.ba). Koristite "Sinkroniziraj EJN" za ručno ažuriranje.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Tenderi visoke relevantnosti</CardTitle>
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
                      width={100}
                      tick={{ fontSize: 11, fill: "#4b5563" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => v.length > 14 ? v.slice(0, 13) + "…" : v}
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
              <h3 className="font-semibold text-primary text-sm">EJN Integracija</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Sistem je integrisan s <strong>open.ejn.gov.ba</strong> OData API-jem. Filtriraju se isključivo <strong>insurance tenderi</strong> (CPV 665xx + ključne riječi).
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between"><span>Izvor:</span><span className="font-medium">EJN BiH</span></div>
                <div className="flex justify-between"><span>Endpoint:</span><span className="font-medium">Announcements</span></div>
                <div className="flex justify-between"><span>Sinkronizacija:</span><span className="font-medium">Svakih 30 min</span></div>
                <div className="flex justify-between"><span>Format:</span><span className="font-medium">OData / JSON</span></div>
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
