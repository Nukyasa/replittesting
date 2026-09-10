import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  Bookmark,
  Building2,
  Users,
  Search,
  Plus,
  Trash2,
  Clock,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Eye,
  Tag,
  KeyRound,
  FileText
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";

type WatchlistsData = {
  tenders: any[];
  authorities: any[];
  suppliers: any[];
  keywords: any[];
  counts: {
    tenders: number;
    authorities: number;
    suppliers: number;
    keywords: number;
  };
};

export default function WatchlistsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"tenders" | "authorities" | "suppliers" | "keywords">("tenders");
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState("Vozila");

  const { data, isLoading } = useQuery<WatchlistsData>({
    queryKey: ["watchlists"],
    queryFn: () => customFetch<WatchlistsData>("/api/watchlists"),
  });

  const addKeywordMutation = useMutation({
    mutationFn: (body: { keyword: string; category: string }) =>
      customFetch("/api/watchlists/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      setNewKeyword("");
      toast.success("Ključna riječ uspješno dodata u praćenje.");
    },
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: (id: string) =>
      customFetch(`/api/watchlists/keywords/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      toast.success("Ključna riječ uklonjena iz praćenja.");
    },
  });

  const toggleCompetitorMutation = useMutation({
    mutationFn: (name: string) =>
      customFetch("/api/watchlists/competitors/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      if (res.isTracked) {
        toast.success(`Konkurent "${res.name}" je dodan u aktivno praćenje.`);
      } else {
        toast.success(`Konkurent "${res.name}" je uklonjen iz praćenja.`);
      }
    },
    onError: (err: any) => {
      toast.error("Greška pri promjeni praćenja konkurenta: " + (err.message || ""));
    },
  });

  const counts = data?.counts;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <span>Početna</span>
            <span>&gt;</span>
            <span>Moje aktivnosti</span>
            <span>&gt;</span>
            <span className="font-semibold text-gray-800">Praćenje</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 flex items-center gap-2.5">
            <Bookmark className="w-6 h-6 text-primary" />
            Praćenje (Watchlists)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Centralni hub praćenja ugovornih organa, konkurencije, označenih nabavki i obavještajnih ključnih riječi.
          </p>
        </div>
      </div>

      {/* 4 TABS (MATCHING SENA.BA) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        <Button
          size="sm"
          variant={activeTab === "tenders" ? "default" : "ghost"}
          className={activeTab === "tenders" ? "bg-[#005B94] text-white" : "text-gray-600 hover:bg-gray-100"}
          onClick={() => setActiveTab("tenders")}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          Nabavke
          <Badge variant="secondary" className="ml-2 text-xs">
            {counts?.tenders ?? 0}
          </Badge>
        </Button>

        <Button
          size="sm"
          variant={activeTab === "authorities" ? "default" : "ghost"}
          className={activeTab === "authorities" ? "bg-[#005B94] text-white" : "text-gray-600 hover:bg-gray-100"}
          onClick={() => setActiveTab("authorities")}
        >
          <Building2 className="w-4 h-4 mr-1.5" />
          Ugovorni organi
          <Badge variant="secondary" className="ml-2 text-xs">
            {counts?.authorities ?? 0}
          </Badge>
        </Button>

        <Button
          size="sm"
          variant={activeTab === "suppliers" ? "default" : "ghost"}
          className={activeTab === "suppliers" ? "bg-[#005B94] text-white" : "text-gray-600 hover:bg-gray-100"}
          onClick={() => setActiveTab("suppliers")}
        >
          <Users className="w-4 h-4 mr-1.5" />
          Dobavljači (Konkurencija)
          <Badge variant="secondary" className="ml-2 text-xs">
            {counts?.suppliers ?? 0}
          </Badge>
        </Button>

        <Button
          size="sm"
          variant={activeTab === "keywords" ? "default" : "ghost"}
          className={activeTab === "keywords" ? "bg-[#005B94] text-white" : "text-gray-600 hover:bg-gray-100"}
          onClick={() => setActiveTab("keywords")}
        >
          <KeyRound className="w-4 h-4 mr-1.5" />
          Ključne riječi
          <Badge variant="secondary" className="ml-2 text-xs">
            {counts?.keywords ?? 0}
          </Badge>
        </Button>
      </div>

      {/* TAB 1: NABAVKE */}
      {activeTab === "tenders" && (
        <div className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (data?.tenders || []).length === 0 ? (
            <div className="bg-white border rounded-xl p-12 text-center text-muted-foreground">
              <Bookmark className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              Nema praćenih tendera. Kliknite na ikonu bookmarka na pregledu nabavki da biste pratili tender.
            </div>
          ) : (
            (data?.tenders || []).map(t => (
              <Card key={t.id} className="border bg-white shadow-sm hover:border-blue-300 transition-all">
                <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">🏛️ {t.contractingAuth || t.contracting_auth}</div>
                    <Link href={`/tenders/${encodeURIComponent(t.id)}`}>
                      <h3 className="font-bold text-sm text-gray-900 hover:text-primary cursor-pointer">
                        {t.title}
                      </h3>
                    </Link>
                    <div className="text-xs text-gray-600">
                      Vrijednost: <strong>{formatMoney(t.estimatedValue || t.estimated_value || 0)}</strong> · Rok: {t.deadline ? new Date(t.deadline).toLocaleDateString("bs-BA") : "—"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/tenders/${encodeURIComponent(t.id)}`}>
                      <Button size="sm" className="bg-[#005B94] text-white text-xs">
                        Dosje tendera
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 2: UGOVORNI ORGANI */}
      {activeTab === "authorities" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data?.authorities || []).map(a => (
            <Card key={a.id} className="border bg-white p-5 space-y-3 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">{a.name}</h3>
                  <div className="text-xs text-gray-500 mt-0.5">📍 {a.city} · {a.level}</div>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  {a.activeTendersCount} aktivne nabavke
                </Badge>
              </div>

              <div className="pt-2 border-t flex justify-between items-center text-xs text-gray-600">
                <span>Ukupan obim osiguranja: <strong className="text-gray-900">{formatMoney(a.totalAwardsKM)}</strong></span>
                <Link href="/tenders">
                  <Button variant="ghost" size="sm" className="h-7 text-primary text-xs">
                    Vidi tendere &rarr;
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 3: DOBAVLJAČI (KONKURENCIJA) */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-foreground">Praćenje konkurenata u realnom vremenu:</span>
              <span className="text-muted-foreground">Označena društva se automatski prate na tenderima, osvojenim ugovorima i žalbama.</span>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {(data?.suppliers || []).filter(s => s.isTracked).length} aktivno praćenih
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.suppliers || []).map(s => (
              <Card key={s.id} className={`border bg-white p-5 space-y-3 shadow-sm hover:shadow-md transition-all ${s.isTracked ? "border-primary/40 ring-1 ring-primary/20" : ""}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-gray-900">{s.name}</h3>
                      {s.isTracked && (
                        <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] h-5">
                          Praćeno društvo
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">🏢 {s.city} · Stopa pobjeda: <strong className="text-emerald-700">{s.winRate}%</strong></div>
                  </div>
                  <Badge className={
                    s.threatLevel === "Visok" ? "bg-red-100 text-red-800 border-red-300 text-xs shrink-0" : "bg-amber-100 text-amber-800 border-amber-300 text-xs shrink-0"
                  }>
                    Rizik: {s.threatLevel}
                  </Badge>
                </div>

                <div className="pt-2 border-t flex flex-wrap justify-between items-center gap-2 text-xs text-gray-600">
                  <span>Osvojeni poslovi: <strong className="text-gray-900">{s.totalWins}</strong> ({formatMoney(s.totalWonValueKM)})</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={s.isTracked ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => toggleCompetitorMutation.mutate(s.name)}
                      disabled={toggleCompetitorMutation.isPending}
                      className="h-7 text-xs"
                    >
                      {s.isTracked ? "✓ Praćeno" : "+ Prati konkurenta"}
                    </Button>
                    <Link href={`/suppliers/${s.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-primary text-xs">
                        Profil &rarr;
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: KLJUČNE RIJEČI */}
      {activeTab === "keywords" && (
        <div className="space-y-4">
          {/* Add keyword bar */}
          <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-end shadow-sm">
            <div className="flex-1 space-y-1 w-full">
              <label className="text-xs font-bold text-gray-700">Nova ključna riječ ili fraza za praćenje:</label>
              <Input
                placeholder="Npr. kasko, osiguranje imovine, nezgoda..."
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="w-full sm:w-44 space-y-1">
              <label className="text-xs font-bold text-gray-700">Kategorija:</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-700"
              >
                <option value="Vozila">Vozila (Kasko/AO)</option>
                <option value="Imovina">Imovina i požar</option>
                <option value="Nezgoda">Nezgoda i lica</option>
                <option value="Odgovornost">Odgovornost</option>
                <option value="Opšte">Opšte</option>
              </select>
            </div>

            <Button
              className="bg-[#005B94] hover:bg-[#004A7A] text-white text-xs h-9"
              disabled={!newKeyword.trim() || addKeywordMutation.isPending}
              onClick={() => addKeywordMutation.mutate({ keyword: newKeyword, category: newCategory })}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Dodaj riječ
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.keywords || []).map(kw => (
              <Card key={kw.id} className="border bg-white p-4 shadow-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">"{kw.keyword}"</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {kw.category}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {kw.matchesCount} pronađenih objava u zadnjih 30 dana
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-red-600 h-8 w-8"
                  onClick={() => deleteKeywordMutation.mutate(kw.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
