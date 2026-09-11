import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Radar,
  Calendar,
  AlertTriangle,
  Clock,
  Building2,
  TrendingDown,
  ExternalLink,
  ChevronRight,
  Search,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

type RenewalItem = {
  id: string;
  procedureName: string;
  contractingAuth: string;
  winnerName: string;
  winningBidAmount: number;
  estimatedValue: number;
  discountPct: number;
  awardDate: string;
  expiryDate: string;
  projectedNoticeDate: string;
  daysUntilExpiry: number;
  urgency: "critical" | "high" | "medium" | "low" | "expired";
  category: string;
  ejnBroj?: string;
};

type RenewalResponse = {
  renewals: RenewalItem[];
  stats: {
    total: number;
    urgentCount: number;
    upcomingCount: number;
    expiredCount?: number;
    totalPipelineKM: number;
  };
};

export default function RenewalRadarPage() {
  const token = useAuthStore((s) => s.token);
  const [search, setSearch] = useState("");
  const [selectedWinner, setSelectedWinner] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<RenewalResponse>({
    queryKey: ["history-renewals"],
    queryFn: async () => {
      const res = await fetch("/api/history/renewals", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Neuspješno dohvatanje radara");
      return res.json();
    },
  });

  const renewals = data?.renewals || [];
  const stats = data?.stats;

  const filtered = renewals.filter((r) => {
    const matchesSearch =
      r.procedureName.toLowerCase().includes(search.toLowerCase()) ||
      r.contractingAuth.toLowerCase().includes(search.toLowerCase()) ||
      r.winnerName.toLowerCase().includes(search.toLowerCase());
    const matchesWinner = selectedWinner === "all" || r.winnerName.includes(selectedWinner);
    const matchesUrgency = urgencyFilter === "all" || r.urgency === urgencyFilter;
    return matchesSearch && matchesWinner && matchesUrgency;
  });

  const uniqueWinners = Array.from(new Set(renewals.map((r) => r.winnerName))).filter(Boolean);

  const getUrgencyBadge = (urgency: string, days: number) => {
    if (urgency === "expired") {
      return (
        <Badge className="bg-indigo-700 text-white font-medium flex items-center gap-1 shadow-xs">
          <AlertTriangle className="w-3 h-3 text-amber-300" /> Ugovor istekao prije {Math.abs(days)} dana (Očekuje se novi tender)
        </Badge>
      );
    }
    if (urgency === "critical") {
      return (
        <Badge className="bg-rose-600 text-white font-bold animate-pulse flex items-center gap-1 shadow-xs">
          <Flame className="w-3 h-3" /> Ističe za {days} dana (Hitno!)
        </Badge>
      );
    }
    if (urgency === "high") {
      return (
        <Badge className="bg-amber-500 text-white font-semibold flex items-center gap-1 shadow-xs">
          <Clock className="w-3 h-3" /> Ističe za {days} dana
        </Badge>
      );
    }
    if (urgency === "medium") {
      return (
        <Badge className="bg-blue-600 text-white font-medium flex items-center gap-1 shadow-xs">
          <Calendar className="w-3 h-3" /> Ističe za {days} dana
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-gray-600 border-gray-300">
        Ističe za {days} dana
      </Badge>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <span>Početna</span>
            <ChevronRight className="w-3 h-3" />
            <span>Tržišna inteligencija</span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-semibold text-gray-800">Radar za obnovu ugovora</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 flex items-center gap-2.5">
            <Radar className="w-6 h-6 text-primary animate-pulse" />
            Prediktivni radar za obnovu ugovora konkurenata
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Prognoza raspisivanja novih tendera za osiguranje i tehničke preglede 45 dana prije isteka trenutnih ugovora u BiH.
          </p>
        </div>
      </div>

      {/* KPI KARTICE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-blue-700 font-semibold uppercase tracking-wider">Ugovora na radaru</div>
              <div className="text-2xl font-bold text-blue-950 mt-1">{stats?.total || 0}</div>
              <div className="text-xs text-blue-600 mt-0.5">Praćeni ugovori u BiH</div>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl text-blue-700">
              <Radar className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-rose-700 font-semibold uppercase tracking-wider">Hitna obnova (&lt; 30 dana)</div>
              <div className="text-2xl font-bold text-rose-950 mt-1">{stats?.urgentCount || 0}</div>
              <div className="text-xs text-rose-600 mt-0.5">
                {stats?.expiredCount ? `${stats.expiredCount} isteklih (re-tendering uskoro)` : "Tender u pripremi ili objavljen"}
              </div>
            </div>
            <div className="p-3 bg-rose-100 rounded-xl text-rose-700">
              <Flame className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-amber-700 font-semibold uppercase tracking-wider">U pripremi (30–60 dana)</div>
              <div className="text-2xl font-bold text-amber-950 mt-1">{stats?.upcomingCount || 0}</div>
              <div className="text-xs text-amber-600 mt-0.5">Vrijeme za flotne kalkulacije</div>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl text-amber-700">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">Vrijednost pipeline-a</div>
              <div className="text-xl font-bold text-emerald-950 mt-1">
                {new Intl.NumberFormat("bs-BA").format(stats?.totalPipelineKM || 0)} KM
              </div>
              <div className="text-xs text-emerald-600 mt-0.5">Ukupan volumen u isteku</div>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700">
              <TrendingDown className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTERI */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži po nazivu postupka, ugovornom organu ili pobjedniku..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="border border-input rounded-md px-3 py-2 text-sm bg-background"
          value={selectedWinner}
          onChange={(e) => setSelectedWinner(e.target.value)}
        >
          <option value="all">Svi konkurenti (Pobjednici)</option>
          {uniqueWinners.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <select
          className="border border-input rounded-md px-3 py-2 text-sm bg-background"
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
        >
          <option value="all">Svi rokovi &amp; ugovori</option>
          <option value="critical">Hitno (&lt; 30 dana)</option>
          <option value="high">Uskoro (30–60 dana)</option>
          <option value="medium">Na radaru (60–120 dana)</option>
          <option value="expired">Istekli ugovori (novi tender uskoro)</option>
        </select>
      </div>

      {/* LISTA RADOVA ZA OBNOVU */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Radar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nema ugovora za odabrane filtere.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow border-gray-200">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getUrgencyBadge(item.urgency, item.daysUntilExpiry)}
                      <Badge variant="outline" className="text-xs bg-gray-50 font-medium">
                        {item.category}
                      </Badge>
                      {item.ejnBroj && (
                        <span className="text-xs font-mono text-gray-500">EJN: {item.ejnBroj}</span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 text-base leading-snug">
                      {item.procedureName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-gray-500" />
                        <span className="font-medium text-gray-800">{item.contractingAuth}</span>
                      </span>
                      <span>
                        Trenutni pobjednik: <strong className="text-blue-900">{item.winnerName}</strong>
                      </span>
                      <span>
                        Ugovorena cijena:{" "}
                        <strong className="text-gray-900">
                          {new Intl.NumberFormat("bs-BA").format(item.winningBidAmount)} KM
                        </strong>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs flex flex-wrap items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>
                          Prognoza novog tendera:{" "}
                          <strong className="text-primary font-bold">{item.projectedNoticeDate}</strong>{" "}
                          (45 dana prije isteka)
                        </span>
                      </div>
                      <div className="text-slate-600">
                        Popust koji je konkurent dao na aukciji:{" "}
                        <strong className="text-rose-600">-{item.discountPct}%</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-xs font-semibold"
                      onClick={() => {
                        toast.success("Kreiran pripremni dosje", {
                          description: `Započeta kalkulacija za ugovor: ${item.contractingAuth}`,
                        });
                      }}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                      Započni kalkulaciju
                    </Button>
                    <Link href="/tenders">
                      <Button variant="outline" size="sm" className="text-xs w-full">
                        Pregledaj slične tendere
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
