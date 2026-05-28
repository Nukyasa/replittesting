import { useState } from "react";
import { useListTenders } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatMoney, formatDate, getScoreBadgeProps, getDeadlineBadgeProps, getStatusBadgeProps } from "@/lib/format";
import { Search, Filter, LayoutGrid, List, ChevronLeft, ChevronRight, X } from "lucide-react";

export default function TendersPage() {
  const [view, setView] = useState<"table" | "card">("table");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState(0);

  const { data, isLoading } = useListTenders({
    page,
    limit: 20,
    search: search || undefined,
    minScore: minScore > 0 ? minScore : undefined
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]">
      <aside className="w-full lg:w-64 flex-shrink-0 bg-white border border-gray-200 rounded-md p-4 overflow-y-auto">
        <div className="flex items-center gap-2 font-semibold text-gray-900 mb-4 pb-2 border-b">
          <Filter className="w-4 h-4" /> Filteri
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Pretraga</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input 
                placeholder="Ključne riječi..." 
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">Minimalni AI Score</label>
              <span className="text-xs font-semibold text-primary">{minScore}</span>
            </div>
            <Slider 
              value={[minScore]} 
              max={100} 
              step={5}
              onValueChange={(val) => setMinScore(val[0])}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <Select defaultValue="open">
              <SelectTrigger>
                <SelectValue placeholder="Odaberi status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Otvoreni</SelectItem>
                <SelectItem value="closed">Zatvoreni</SelectItem>
                <SelectItem value="awarded">Dodijeljeni</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {minScore > 0 && (
            <Button variant="outline" className="w-full text-xs" onClick={() => setMinScore(0)}>
              <X className="w-3 h-3 mr-1" /> Poništi AI Score
            </Button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-gray-50/50">
          <div className="text-sm font-medium text-gray-700">
            {isLoading ? <Skeleton className="w-32 h-5" /> : `Ukupno pronađeno: ${data?.total || 0}`}
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="newest">
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Sortiraj" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Najnovije</SelectItem>
                <SelectItem value="deadline">Rok prijave</SelectItem>
                <SelectItem value="score">AI Ocjena</SelectItem>
                <SelectItem value="value">Vrijednost</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex bg-gray-100 p-1 rounded-md">
              <Button variant={view === "table" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setView("table")}>
                <List className="w-4 h-4" />
              </Button>
              <Button variant={view === "card" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setView("card")}>
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : view === "table" ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b sticky top-0 z-10 text-gray-600 font-medium">
                <tr>
                  <th className="p-4 font-medium">Tender</th>
                  <th className="p-4 font-medium">Vrijednost</th>
                  <th className="p-4 font-medium">Rok</th>
                  <th className="p-4 font-medium">Status / AI</th>
                  <th className="p-4 font-medium text-right">Akcija</th>
                </tr>
              </thead>
              <tbody>
                {data?.tenders.map((t) => {
                  const scoreProps = getScoreBadgeProps(t.relevanceScore);
                  const deadlineProps = getDeadlineBadgeProps(t.deadline);
                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50 group">
                      <td className="p-4">
                        <div className="font-semibold text-primary max-w-[400px] truncate" title={t.title}>{t.title}</div>
                        <div className="text-xs text-gray-500 mt-1 max-w-[400px] truncate">{t.contractingAuth} • {t.entity}</div>
                      </td>
                      <td className="p-4 font-medium text-gray-900 whitespace-nowrap">{formatMoney(t.estimatedValue, t.currency)}</td>
                      <td className="p-4 whitespace-nowrap">
                        <Badge className={deadlineProps.className}>{deadlineProps.label}</Badge>
                      </td>
                      <td className="p-4 space-y-1">
                        <div><Badge variant="outline" className="bg-white">{getStatusBadgeProps(t.status).label}</Badge></div>
                        <div><Badge className={scoreProps.className}>{scoreProps.label} ({t.relevanceScore})</Badge></div>
                      </td>
                      <td className="p-4 text-right">
                        <Link href={`/tenders/${t.id}`}>
                          <Button variant="secondary" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            Otvori
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.tenders.map(t => {
                const scoreProps = getScoreBadgeProps(t.relevanceScore);
                const deadlineProps = getDeadlineBadgeProps(t.deadline);
                return (
                  <Card key={t.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className="text-xs bg-gray-50">{t.source}</Badge>
                        <Badge className={scoreProps.className}>{scoreProps.label}</Badge>
                      </div>
                      <h3 className="font-bold text-gray-900 line-clamp-2" title={t.title}>{t.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{t.contractingAuth}</p>
                      <div className="flex items-center justify-between pt-2 border-t mt-2">
                        <div className="font-semibold">{formatMoney(t.estimatedValue, t.currency)}</div>
                        <Badge className={deadlineProps.className}>{deadlineProps.label}</Badge>
                      </div>
                      <Link href={`/tenders/${t.id}`} className="block pt-2">
                        <Button variant="outline" className="w-full">Detalji tendera</Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">Stranica {page} od {data?.totalPages || 1}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= (data?.totalPages || 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
