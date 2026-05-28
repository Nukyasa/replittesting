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
import { Search, Filter, LayoutGrid, List, ChevronLeft, ChevronRight, X, Download } from "lucide-react";

const ENTITIES = ["FBiH", "RS", "BD", "International"];
const CATEGORIES = ["Osiguranje", "IT usluge", "Građevinski radovi", "Medicinska oprema", "Uredski materijal", "Konsalting", "Vozila i transport", "Komunalne usluge", "Usluge", "Radovi", "Nabavka opreme", "Ostalo"];
const SOURCES = ["EJN", "EJN-Otvoreni", "EJN-Ograničeni", "EJN-Direktni", "Reference.ba", "UNDP"];

export default function TendersPage() {
  const [view, setView] = useState<"table" | "card">("table");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [entity, setEntity] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder] = useState("desc");
  const [minScore, setMinScore] = useState(0);

  const { data, isLoading } = useListTenders({
    page,
    limit: 20,
    search: search || undefined,
    status: status || undefined,
    entity: entity || undefined,
    category: category || undefined,
    source: source || undefined,
    sortBy,
    sortOrder,
    minScore: minScore > 0 ? minScore : undefined,
  });

  const hasFilters = !!(search || status || entity || category || source || minScore > 0);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setEntity("");
    setCategory("");
    setSource("");
    setMinScore(0);
    setPage(1);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (entity) params.set("entity", entity);
    if (category) params.set("category", category);
    if (source) params.set("source", source);
    const token = JSON.parse(localStorage.getItem("asa_auth_storage") || "{}").state?.token || "";
    const url = `/api/tenders/export?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.click();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]">
      <aside className="w-full lg:w-64 flex-shrink-0 bg-white border border-gray-200 rounded-md p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Filter className="w-4 h-4" /> Filteri
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-gray-500" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1" /> Poništi
            </Button>
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Pretraga</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Ključne riječi..."
                className="pl-9"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <Select value={status || "all"} onValueChange={v => { setStatus(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Svi statusi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi statusi</SelectItem>
                <SelectItem value="open">Otvoreni</SelectItem>
                <SelectItem value="closed">Zatvoreni</SelectItem>
                <SelectItem value="awarded">Dodijeljeni</SelectItem>
                <SelectItem value="cancelled">Poništeni</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Entitet</label>
            <Select value={entity || "all"} onValueChange={v => { setEntity(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Svi entiteti" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi entiteti</SelectItem>
                {ENTITIES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Kategorija</label>
            <Select value={category || "all"} onValueChange={v => { setCategory(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Sve kategorije" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sve kategorije</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Izvor</label>
            <Select value={source || "all"} onValueChange={v => { setSource(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Svi izvori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi izvori</SelectItem>
                {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">Min. AI Score</label>
              <span className="text-xs font-semibold text-primary">{minScore > 0 ? minScore : "Sve"}</span>
            </div>
            <Slider
              value={[minScore]}
              max={100}
              step={5}
              onValueChange={val => { setMinScore(val[0]); setPage(1); }}
            />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-gray-50/50">
          <div className="text-sm font-medium text-gray-700">
            {isLoading ? <Skeleton className="w-32 h-5" /> : `Ukupno: ${data?.total ?? 0} tendera`}
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={v => { setSortBy(v); setPage(1); }}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Sortiraj" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Najnovije</SelectItem>
                <SelectItem value="publicationDate">Datum objave</SelectItem>
                <SelectItem value="deadline">Rok prijave</SelectItem>
                <SelectItem value="estimatedValue">Vrijednost</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download className="w-4 h-4" /> CSV
            </Button>
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
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !data?.tenders?.length ? (
            <div className="p-12 text-center text-gray-500">
              <Filter className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Nema tendera koji odgovaraju filterima</p>
              {hasFilters && <Button variant="link" className="mt-2 text-primary" onClick={clearFilters}>Poništi filtere</Button>}
            </div>
          ) : view === "table" ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b sticky top-0 z-10 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Tender</th>
                  <th className="p-4 font-medium">Kategorija</th>
                  <th className="p-4 font-medium">Vrijednost</th>
                  <th className="p-4 font-medium">Rok</th>
                  <th className="p-4 font-medium">Status / AI</th>
                  <th className="p-4 font-medium text-right">Akcija</th>
                </tr>
              </thead>
              <tbody>
                {data.tenders.map((t) => {
                  const scoreProps = getScoreBadgeProps(t.relevanceScore);
                  const deadlineProps = getDeadlineBadgeProps(t.deadline);
                  const statusProps = getStatusBadgeProps(t.status);
                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50 group">
                      <td className="p-4">
                        <div className="font-semibold text-primary max-w-[320px] truncate" title={t.title}>{t.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5 max-w-[320px] truncate">{t.contractingAuth} • <span className="font-medium">{t.entity}</span></div>
                        <div className="text-xs text-gray-400 mt-0.5">{t.source}</div>
                      </td>
                      <td className="p-4 text-xs text-gray-600 max-w-[120px]">
                        <span className="line-clamp-2">{t.category}</span>
                      </td>
                      <td className="p-4 font-medium text-gray-900 whitespace-nowrap">{formatMoney(t.estimatedValue, t.currency)}</td>
                      <td className="p-4 whitespace-nowrap">
                        <Badge className={deadlineProps.className}>{deadlineProps.label}</Badge>
                        <div className="text-xs text-gray-500 mt-1">{formatDate(t.deadline)}</div>
                      </td>
                      <td className="p-4 space-y-1">
                        <div><Badge className={statusProps.className}>{statusProps.label}</Badge></div>
                        {t.relevanceScore != null && (
                          <div><Badge className={scoreProps.className}>{scoreProps.label} ({t.relevanceScore})</Badge></div>
                        )}
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
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.tenders.map(t => {
                const scoreProps = getScoreBadgeProps(t.relevanceScore);
                const deadlineProps = getDeadlineBadgeProps(t.deadline);
                return (
                  <Card key={t.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <Badge variant="outline" className="text-xs bg-gray-50 shrink-0">{t.source}</Badge>
                        {t.relevanceScore != null && <Badge className={scoreProps.className}>{scoreProps.label}</Badge>}
                      </div>
                      <h3 className="font-bold text-gray-900 line-clamp-2 text-sm" title={t.title}>{t.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{t.contractingAuth}</p>
                      <div className="text-xs text-gray-400">{t.entity} • {t.category}</div>
                      <div className="flex items-center justify-between pt-2 border-t mt-2">
                        <div className="font-semibold text-sm">{formatMoney(t.estimatedValue, t.currency)}</div>
                        <Badge className={deadlineProps.className}>{deadlineProps.label}</Badge>
                      </div>
                      <Link href={`/tenders/${t.id}`} className="block pt-1">
                        <Button variant="outline" className="w-full text-sm">Detalji tendera</Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Stranica <strong>{page}</strong> od <strong>{data?.totalPages || 1}</strong>
          </div>
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
