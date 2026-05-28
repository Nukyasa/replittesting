import { useState } from "react";
import { 
  useGetAnalyticsSummary, 
  useGetAnalyticsByCategory, 
  useGetAnalyticsByEntity, 
  useGetAnalyticsTimeline,
  useGetAnalyticsScoreDist,
  useGetAnalyticsExpiring
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatDate, getScoreBadgeProps } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import { FileText, Target, Wallet, Clock } from "lucide-react";

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary();
  const { data: catData, isLoading: loadingCat } = useGetAnalyticsByCategory();
  const { data: entityData, isLoading: loadingEntity } = useGetAnalyticsByEntity();
  const { data: timelineData, isLoading: loadingTimeline } = useGetAnalyticsTimeline();
  const { data: scoreData, isLoading: loadingScore } = useGetAnalyticsScoreDist();
  const { data: expiringData, isLoading: loadingExpiring } = useGetAnalyticsExpiring({ days });

  const PIE_COLORS = ["#002d82", "#1a52a0", "#3b82f6", "#93c5fd"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Analitika</h1>
          <p className="text-gray-500 text-sm mt-1">Detaljan pregled tenderskih aktivnosti</p>
        </div>
        <div className="w-40">
          <Select value={days.toString()} onValueChange={(val) => setDays(Number(val))}>
            <SelectTrigger>
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Zadnjih 7 dana</SelectItem>
              <SelectItem value="30">Zadnjih 30 dana</SelectItem>
              <SelectItem value="90">Zadnjih 90 dana</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ukupno tendera" value={summary?.totalTenders} icon={FileText} loading={loadingSummary} />
        <StatCard title="Prosječan AI Score" value={summary?.avgRelevanceScore ? Math.round(summary.avgRelevanceScore) : undefined} icon={Target} loading={loadingSummary} />
        <StatCard title="Ukupna vrijednost" value={formatMoney(summary?.totalEstimatedValue || 0)} icon={Wallet} loading={loadingSummary} textValue />
        <StatCard title="Ističe u 30 dana" value={summary?.expiringIn30Days} icon={Clock} loading={loadingSummary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Aktivnost ({days} dana)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pb-4">
            {loadingTimeline ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#002d82" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#002d82" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(val) => formatDate(val).substring(0, 5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="count" stroke="#002d82" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Distribucija AI Ocjena</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pb-4">
            {loadingScore ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px" }} cursor={{ fill: "#f3f4f6" }} />
                  <Bar dataKey="count" fill="#1a52a0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Tenderi po entitetima</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pb-4 flex items-center justify-center">
            {loadingEntity ? <Skeleton className="w-64 h-64 rounded-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={entityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="entity"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {entityData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top Kategorije</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pb-4">
            {loadingCat ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 11, fill: "#4b5563" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f3f4f6" }} contentStyle={{ borderRadius: "8px" }} />
                  <Bar dataKey="count" fill="#002d82" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Tenderi koji ističu u narednih {days} dana</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingExpiring ? (
            <Skeleton className="w-full h-32" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50 text-gray-500 font-medium">
                    <th className="p-3">Naziv</th>
                    <th className="p-3">Ugovorni organ</th>
                    <th className="p-3">Rok</th>
                    <th className="p-3">AI Ocjena</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringData?.map(t => {
                    const scoreProps = getScoreBadgeProps(t.relevanceScore);
                    return (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium text-primary max-w-[300px] truncate">{t.title}</td>
                        <td className="p-3 text-gray-600 max-w-[200px] truncate">{t.contractingAuth}</td>
                        <td className="p-3 font-medium text-red-600 whitespace-nowrap">{formatDate(t.deadline)}</td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge className={scoreProps.className}>{scoreProps.label} ({t.relevanceScore})</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {(!expiringData || expiringData.length === 0) && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-500">Nema tendera koji ističu u odabranom periodu.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, loading, textValue = false }: { title: string; value?: number | string; icon: any; loading: boolean; textValue?: boolean }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
              <h3 className={`font-bold text-gray-900 mt-1 ${textValue ? 'text-lg' : 'text-2xl'}`}>{value || 0}</h3>
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
