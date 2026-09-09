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

      {/* WIN/LOSS POST-MORTEM & LOSS RATIO INTELLIGENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win/Loss Post-Mortem */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b pb-3 bg-gray-50/50">
            <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              🎯 Win / Loss Post-Mortem analiza tendera
            </CardTitle>
            <p className="text-xs text-gray-500">
              Analiza uzroka ishoda na javnim nabavkama osiguranja i tehničkih pregleda (zadnjih 12 mjeseci)
            </p>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">Damping i agresivni popust u e-aukciji</span>
                <span className="text-red-600 font-bold">42% izgubljenih</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-red-500 h-2.5 rounded-full" style={{ width: "42%" }}></div>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Dominantno Euroherc i Adriatic na tenderima komunalnih preduzeća</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">Diskriminirajući geografski uslovi (Čl. 54 ZJN)</span>
                <span className="text-amber-600 font-bold">26% propuštenih</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: "26%" }}></div>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Ugovorni organi tražili servis / stanicu u radijusu &lt; 15 km bez zakonskog osnova</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">Odbijena žalba URŽ-u / propušten prekluzivni rok</span>
                <span className="text-orange-600 font-bold">14% ishoda</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-orange-400 h-2.5 rounded-full" style={{ width: "14%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">Nepotpuna dokumentacija podugovarača / partnera</span>
                <span className="text-gray-600 font-bold">11% odbacivanja</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-gray-400 h-2.5 rounded-full" style={{ width: "11%" }}></div>
              </div>
            </div>

            <div className="pt-3 border-t bg-emerald-50/50 -mx-5 -mb-5 p-4 rounded-b-lg border-emerald-100">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">Ključni faktori pobjede ASA Central:</span>
              <ul className="text-xs text-emerald-700 space-y-1 list-disc list-inside">
                <li>Vlastita razgranata mreža stanica tehničkog pregleda u FBiH i RS</li>
                <li>Brza obrada i isplata odštetnih zahtjeva (reputacija kod direktora organa)</li>
                <li>Kompletna ZJN pravna usklađenost bez formalnih nedostataka</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Loss Ratio Intelligence */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b pb-3 bg-gray-50/50">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  📊 Profitabilnost i Loss Ratio portfelja (Štete / Premija)
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Usklađenost premijskih prihoda i šteta po linijama osiguranja
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                Ukupno: 52.8% (Zdrav portfelj)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
              <div>
                <span className="font-semibold text-sm text-gray-900 block">Autoodgovornost (AO)</span>
                <span className="text-xs text-gray-400">Flote vozila javnih institucija i komunalnih preduzeća</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-600">48.2%</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] ml-2">
                  Sigurna margina
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
              <div>
                <span className="font-semibold text-sm text-gray-900 block">Kasko osiguranje vozila</span>
                <span className="text-xs text-gray-400">Putnička, teretna i specijalna vozila (MUP, hitne pomoći)</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-600">64.5%</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] ml-2">
                  U granicama
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
              <div>
                <span className="font-semibold text-sm text-gray-900 block">Osiguranje imovine (Požar i lom mašina)</span>
                <span className="text-xs text-gray-400">Objekti bolnica, fakulteta, termoelektrana i vodovoda</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-600">32.1%</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] ml-2">
                  Visokoprofitabilno
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
              <div>
                <span className="font-semibold text-sm text-gray-900 block">Kolektivno osiguranje od nezgode radnika</span>
                <span className="text-xs text-gray-400">Zaposleni u organima uprave i javnim preduzećima</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-600">41.0%</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] ml-2">
                  Profitabilno
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
              <div>
                <span className="font-semibold text-sm text-gray-900 block">Dobrovoljno zdravstveno osiguranje (DZO)</span>
                <span className="text-xs text-gray-400">Sistematski pregledi i bolničko liječenje</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-amber-600">78.4%</span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] ml-2">
                  Oprez na aukciji
                </Badge>
              </div>
            </div>
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
