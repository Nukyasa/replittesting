import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Search,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  Briefcase,
  FileText,
  Calendar,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";

interface CompanyCheckData {
  searchQuery: string;
  resolvedName: string;
  jib: string | null;
  city: string | null;
  isRegisteredEjn: boolean;
  outcomes: {
    totalWins: number;
    totalValue: number;
    avgValue: number;
    winRatePct: number | null;
    earliestAwardYear: number | null;
    latestAwardYear: number | null;
    yearlyBreakdown: { year: number; wins: number; amount: number }[];
  };
  topBuyers: {
    name: string;
    contractsCount: number;
    totalAmount: number;
    latestDate: string | null;
    sharePct: number;
  }[];
  topCompetitors: {
    name: string;
    sharedTendersCount: number;
    competitorWins: number;
    relation: "direktan_rival" | "povremeni_rival";
  }[];
  dataCoverage: {
    level: "visoka" | "srednja" | "djelimicna" | "nedovoljno_podataka";
    totalRecordsFound: number;
    hasMissingValues: boolean;
    disclaimer: string;
  };
  sampleAwards: {
    procedureName: string;
    authorityName: string;
    amount: number | null;
    date: string | null;
  }[];
}

const SAMPLE_SEARCHES = [
  "ASA Central",
  "Bosnalijek d.d.",
  "Krajinagroup",
  "Sarajevo-osiguranje",
  "Euroasfalt",
  "BS Telecom Solutions",
];

export default function CompanyCheckPage() {
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const { data: result, isLoading, error, refetch } = useQuery({
    queryKey: ["company-market-check", activeQuery],
    queryFn: () => customFetch<CompanyCheckData>(`/api/company/market-check?query=${encodeURIComponent(activeQuery)}`),
    enabled: activeQuery.length >= 2,
    staleTime: 300_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim().length >= 2) {
      setActiveQuery(searchInput.trim());
    }
  };

  const handleQuickSelect = (name: string) => {
    setSearchInput(name);
    setActiveQuery(name);
  };

  const money = (val?: number | null) =>
    val ? new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 0 }).format(val) + " KM" : "—";

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* HERO SEKCIJA (IDENTIČNO KAO NA SENA.BA/PROVJERA-FIRME) */}
      <div className="text-center max-w-3xl mx-auto space-y-4 pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/60 text-xs font-mono text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Provjera firme · Javni podaci od 2014.</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Vaše brojke u javnim nabavkama.
        </h1>

        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Upišite naziv ili identifikacioni broj (JIB) firme. ASA pretražuje javno objavljene ponude i ishode,
          kupce kod kojih se pojavljujete i konkurente s kojima se susrećete.
          <strong className="text-foreground"> Ako podatak nije potpun, to jasno označimo.</strong>
        </p>

        <p className="text-xs font-mono text-muted-foreground border-t border-border pt-3 max-w-md mx-auto">
          Podaci od 2014. · Svaka procjena ima izvor · Bez kartice
        </p>
      </div>

      {/* INPUT PRETRAGE (ASA WIDGET) */}
      <Card className="max-w-2xl mx-auto shadow-md border-border">
        <CardHeader className="bg-muted/40 border-b border-border py-3 px-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              ASA — pretraga i provjera firme
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="npr. ASA Central, Bosnalijek d.d. ili 4200598340009"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 h-11 text-sm bg-background"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={isLoading || searchInput.trim().length < 2} className="h-11 px-6">
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Provjeri firmu
            </Button>
          </form>

          {/* Brzi prijedlozi */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground font-mono">Isprobajte:</span>
            {SAMPLE_SEARCHES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => handleQuickSelect(name)}
                className="text-xs px-2.5 py-1 rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* REZULTATI PRETRAGE */}
      {isLoading && (
        <div className="text-center py-12 space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-foreground">ASA analizira bazu ugovora i dodjela od 2014. godine…</p>
          <p className="text-xs text-muted-foreground font-mono">Povezivanje dobavljača, ugovornih organa i konkurencije</p>
        </div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm text-center">
          Greška pri dohvatanju podataka. Provjerite naziv firme ili pokušajte ponovo.
        </div>
      )}

      {result && (
        <div className="space-y-6 pt-4">
          {/* NASLOVNA KARTICA SUBJEKTA */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{result.resolvedName}</h2>
                {result.isRegisteredEjn && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 gap-1 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Registrovani EJN dobavljač
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {result.jib ? `JIB: ${result.jib}` : "JIB: Nije javno objavljen"} · {result.city ? `Sjedište: ${result.city}` : "Sjedište: BiH"}
              </p>
            </div>

            {/* Oznaka potpunosti */}
            <div className="text-left sm:text-right shrink-0">
              <Badge
                variant="outline"
                className={`font-mono text-xs ${
                  result.dataCoverage.level === "visoka"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : result.dataCoverage.level === "srednja"
                    ? "bg-blue-50 text-blue-800 border-blue-300"
                    : "bg-amber-50 text-amber-800 border-amber-300"
                }`}
              >
                Pouzdanost baze: {result.dataCoverage.level}
              </Badge>
              <p className="text-[11px] text-muted-foreground mt-1">
                {result.dataCoverage.totalRecordsFound} potvrđenih ugovornih zapisa
              </p>
            </div>
          </div>

          {/* 3 GLAVNA BLOKA: PONUDE I ISHODI, VAŠI KUPCI, VAŠA KONKURENCIJA */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. VAŠE PONUDE I ISHODI */}
            <Card className="lg:col-span-1 shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Vaše ponude i ishodi
                </CardTitle>
                <p className="text-xs text-muted-foreground">Broj dobijenih ugovora i realizovana vrijednost</p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <span className="text-xs font-mono text-muted-foreground uppercase">Dobijeni ugovori</span>
                    <p className="text-2xl font-extrabold text-foreground mt-0.5">{result.outcomes.totalWins}</p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <span className="text-xs font-mono text-muted-foreground uppercase">Stopa prolaza</span>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">
                      {result.outcomes.winRatePct !== null ? `${result.outcomes.winRatePct}%` : "—"}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1">
                  <span className="text-xs font-mono text-muted-foreground uppercase">Ukupna realizacija</span>
                  <p className="text-xl font-bold text-primary">{money(result.outcomes.totalValue)}</p>
                  <p className="text-xs text-muted-foreground">
                    Prosječno po ugovoru: <strong>{money(result.outcomes.avgValue)}</strong>
                  </p>
                </div>

                {/* Godišnji raspored */}
                {result.outcomes.yearlyBreakdown.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <span className="text-xs font-semibold text-foreground block">Aktivnost po godinama:</span>
                    <div className="space-y-1.5">
                      {result.outcomes.yearlyBreakdown.slice(-5).map((y) => (
                        <div key={y.year} className="flex items-center justify-between text-xs">
                          <span className="font-mono text-muted-foreground">{y.year}:</span>
                          <span className="font-medium text-foreground">{y.wins} ugovora ({money(y.amount)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. VAŠI KUPCI */}
            <Card className="lg:col-span-1 shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Building2 className="w-4 h-4 text-primary" />
                  Vaši kupci (Ugovorni organi)
                </CardTitle>
                <p className="text-xs text-muted-foreground">Gdje firma najčešće pobjeđuje</p>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {result.topBuyers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center italic">Nema evidentiranih kupaca.</p>
                ) : (
                  <div className="divide-y border-border">
                    {result.topBuyers.map((buyer, idx) => (
                      <div key={idx} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-medium text-foreground line-clamp-1">{buyer.name}</span>
                          <Badge variant="secondary" className="text-[10px] shrink-0 font-mono">
                            {buyer.contractsCount} {buyer.contractsCount === 1 ? "ugovor" : "ugovora"}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Ukupno: <strong>{money(buyer.totalAmount)}</strong></span>
                          <span>Udio: {buyer.sharePct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. VAŠA KONKURENCIJA */}
            <Card className="lg:col-span-1 shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Users className="w-4 h-4 text-primary" />
                  Vaša konkurencija
                </CardTitle>
                <p className="text-xs text-muted-foreground">Rivali s kojima se susrećete na tenderima</p>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {result.topCompetitors.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center italic">
                    Nisu identifikovani direktni rivali kod istih kupaca.
                  </p>
                ) : (
                  <div className="divide-y border-border">
                    {result.topCompetitors.map((comp, idx) => (
                      <div key={idx} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-semibold text-foreground line-clamp-1">{comp.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              comp.relation === "direktan_rival"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            }`}
                          >
                            {comp.relation === "direktan_rival" ? "Glavni rival" : "Povremeni"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Evidentirano <strong>{comp.competitorWins}</strong> pobjeda u istoj grupi kupaca.
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* NEDAVNI EVIDENTIRANI UGOVORI */}
          {result.sampleAwards.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <FileText className="w-4 h-4 text-primary" />
                  Izvod iz baze ugovora i dodjela (EJN arhiva)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground font-mono uppercase text-[11px] border-b">
                      <tr>
                        <th className="py-2.5 px-4">Predmet nabavke</th>
                        <th className="py-2.5 px-4">Ugovorni organ</th>
                        <th className="py-2.5 px-4 text-right">Iznos ugovora</th>
                        <th className="py-2.5 px-4 text-right">Datum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-b">
                      {result.sampleAwards.map((item, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="py-2.5 px-4 font-medium max-w-sm truncate">{item.procedureName}</td>
                          <td className="py-2.5 px-4 text-muted-foreground max-w-xs truncate">{item.authorityName}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-foreground">{money(item.amount)}</td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground font-mono">
                            {item.date ? new Date(item.date).toLocaleDateString("bs-BA") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TRANSPARENTNOST PODATAKA (ASA FOOTER) */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs font-mono text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span>{result.dataCoverage.disclaimer}</span>
            <span className="font-semibold text-foreground">ASA Intelligence · Podaci od 2014.</span>
          </div>
        </div>
      )}
    </div>
  );
}
