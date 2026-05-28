import { useListTenders, useGetAnalyticsSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate, getScoreBadgeProps } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RefreshCw, FileText, AlertTriangle, Target, Clock, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary();
  const { data: tendersData, isLoading: loadingTenders } = useListTenders({ limit: 10, sortBy: "relevanceScore", sortOrder: "desc" });

  const mockCategoryData = [
    { name: "IT Usluge", count: 45 },
    { name: "Građevina", count: 32 },
    { name: "Uredski materijal", count: 18 },
    { name: "Medicinska oprema", count: 12 },
    { name: "Konsalting", count: 8 },
  ];

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
            <span className="font-medium text-gray-700">Skraper Aktivan</span>
          </div>
          <div className="w-px h-4 bg-gray-300 mx-2"></div>
          <Button variant="ghost" size="sm" className="h-6 text-xs text-primary px-2" data-testid="button-sync">
            <RefreshCw className="w-3 h-3 mr-1" /> Sinkroniziraj sada
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Aktivni tenderi" value={summary?.openTenders} icon={FileText} loading={loadingSummary} />
        <StatCard title="AI Relevantni (>75)" value={summary?.highRelevance} icon={Target} loading={loadingSummary} />
        <StatCard title="Rok u 7 dana" value={summary?.expiringIn7Days} icon={Clock} loading={loadingSummary} />
        <StatCard title="U obradi" value={summary?.watchlistCount} icon={AlertTriangle} loading={loadingSummary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-primary" />
                AI Jutarnji izvještaj
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
                <p>Pronađeno je <strong>{summary?.newToday || 0} novih tendera</strong> u posljednja 24 sata.</p>
                <p>Posebna pažnja: Tender <strong>"Nabavka osiguranja imovine i lica"</strong> za <em>Elektroprivreda BiH</em> ima AI ocjenu relevantnosti od 94% i izuzetno se poklapa s vašim portfoliom. Rok ističe za 6 dana.</p>
                <p className="text-gray-500 italic">Sistem automatski preporučuje da preuzmete dokumentaciju za top 3 procijenjena tendera.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Nedavni tenderi visoke relevantnosti</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTenders ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-gray-500 font-medium">
                        <th className="p-3">Naziv i Ugovorni organ</th>
                        <th className="p-3">Vrijednost</th>
                        <th className="p-3">Rok</th>
                        <th className="p-3">AI Ocjena</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tendersData?.tenders?.map(t => {
                        const scoreProps = getScoreBadgeProps(t.relevanceScore);
                        return (
                          <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-3">
                              <div className="font-medium text-primary line-clamp-1">{t.title}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{t.contractingAuth}</div>
                            </td>
                            <td className="p-3 font-medium text-gray-700 whitespace-nowrap">{formatMoney(t.estimatedValue, t.currency)}</td>
                            <td className="p-3 text-gray-600 whitespace-nowrap">{formatDate(t.deadline)}</td>
                            <td className="p-3 whitespace-nowrap">
                              <Badge className={scoreProps.className}>{scoreProps.label} ({t.relevanceScore})</Badge>
                            </td>
                          </tr>
                        );
                      })}
                      {(!tendersData?.tenders || tendersData.tenders.length === 0) && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-500">Nema tendera za prikaz</td>
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
            <CardContent className="h-[300px] flex items-center justify-center p-0 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockCategoryData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: "#4b5563" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f3f4f6" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, loading }: { title: string; value?: number; icon: any; loading: boolean }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-2" />
            ) : (
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{value || 0}</h3>
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
