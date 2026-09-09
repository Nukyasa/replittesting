import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuthStore } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Building2,
  Users,
  Briefcase,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Check,
  X,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { exportSenaOnePagerPdf } from "@/lib/senaPdfExport";
import { PitajAsuCard } from "./PitajAsuCard";
import { EAuctionSimulator } from "./EAuctionSimulator";

interface SenaRecommendedOffer {
  amount: number;
  discountPct: number;
  label: string;
  desc: string;
}

interface SenaIntelligenceData {
  tenderId: string;
  chancePct: number | null;
  confidence: "visoka" | "srednja" | "niska" | "nedovoljno_podataka";
  confidenceLabel: string;
  decisionRecommendation: "idi" | "ne_idi" | "za_odluku";
  decisionLabel: string;
  decisionReason: string;
  priceRange: {
    min: number;
    median: number;
    max: number;
    sampleCount: number;
    recommended: {
      aggressive: SenaRecommendedOffer;
      market: SenaRecommendedOffer;
      conservative: SenaRecommendedOffer;
    };
  } | null;
  buyerProfile: {
    authorityId: number | null;
    name: string;
    totalProcedures: number;
    categoryProcedures: number;
    cpvCode: string | null;
    singleBidderRate: number | null;
    directAgreementShare: number | null;
    leadingWinner: {
      name: string;
      wins: number;
      sharePct: number;
    } | null;
    opennessIndex: "otvoren" | "umjeren" | "zatvoren" | "nepoznato";
    opennessLabel: string;
    senaNote: string;
  };
  signals: {
    positive: { id: string; type: "positive"; title: string; description: string; source: string }[];
    risks: { id: string; type: "risk"; title: string; description: string; source: string }[];
  };
  pillars: {
    compliance: { number: string; name: string; question: string; verdict: string; details: string[]; status: string };
    buyer: { number: string; name: string; question: string; verdict: string; details: string[]; status: string };
    competition: { number: string; name: string; question: string; verdict: string; details: string[]; status: string };
    investment: { number: string; name: string; question: string; verdict: string; details: string[]; status: string };
  };
  sourcesFootnote: string;
  hasSufficientData: boolean;
}

export function SenaDecisionCard({
  tenderId,
  currentDecision,
  tender,
}: {
  tenderId: string;
  currentDecision?: string;
  tender?: any;
}) {
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedOfferStrategy, setSelectedOfferStrategy] = useState<"market" | "aggressive" | "conservative">("market");
  
  // Modal za evidentiranje odluke
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<"go" | "no_go">("go");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionDeadline, setDecisionDeadline] = useState("");

  const { data: sena, isLoading, error, refetch } = useQuery({
    queryKey: ["sena-intelligence", tenderId],
    queryFn: () => customFetch<SenaIntelligenceData>(`/api/tenders/${tenderId}/sena-intelligence`),
    staleTime: 60_000,
  });

  const saveDecisionMutation = useMutation({
    mutationFn: async ({ decision, reason, internalDeadline }: { decision: string; reason: string; internalDeadline?: string }) => {
      // Preuzmi trenutnu verziju workspace-a
      const ws = await customFetch<{ workspace: { version: number } }>(`/api/workspace/${tenderId}`);
      const version = ws?.workspace?.version ?? 0;

      return customFetch(`/api/workspace/${tenderId}/decision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reason,
          owner_id: user?.id || null,
          internal_deadline: internalDeadline || null,
          version,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sena-intelligence", tenderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace", tenderId] });
      toast.success("Odluka je uspješno zabilježena u dosje tendera.");
      setDecisionModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Greška pri evidentiranju odluke.");
    },
  });

  const handleOpenDecision = (type: "go" | "no_go") => {
    setDecisionType(type);
    setDecisionReason(type === "go" ? (sena?.decisionReason || "Ispunjavamo uslove i imamo konkurentnu ponudu.") : "Procijenjen visok nivo rizika i nepovoljan povrat ulaganja.");
    setDecisionModalOpen(true);
  };

  const submitDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionReason.trim()) {
      toast.error("Razlog odluke je obavezan.");
      return;
    }
    saveDecisionMutation.mutate({
      decision: decisionType,
      reason: decisionReason.trim(),
      internalDeadline: decisionDeadline || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm flex items-center justify-center gap-3 py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">ASA analizira podatke kupca, konkurencije i uslove dokumentacije…</p>
      </div>
    );
  }

  if (error || !sena) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm text-sm text-muted-foreground flex justify-between items-center">
        <span>ASA procjena trenutno nije dostupna za ovaj tender.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Pokušaj ponovo</Button>
      </div>
    );
  }

  const money = (val?: number | null) =>
    val ? new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 0 }).format(val) + " KM" : "—";

  const getChanceBadge = (confidence: string, chancePct: number | null) => {
    if (confidence === "nedovoljno_podataka" || chancePct === null) {
      return {
        bg: "bg-gray-100 text-gray-700 border-gray-300",
        label: "Nedovoljno podataka",
      };
    }
    if (chancePct >= 65) {
      return {
        bg: "bg-emerald-50 text-emerald-800 border-emerald-300",
        label: `${chancePct}%`,
      };
    }
    if (chancePct >= 40) {
      return {
        bg: "bg-amber-50 text-amber-800 border-amber-300",
        label: `${chancePct}%`,
      };
    }
    return {
      bg: "bg-rose-50 text-rose-800 border-rose-300",
      label: `${chancePct}%`,
    };
  };

  const chanceBadge = getChanceBadge(sena.confidence, sena.chancePct);

  const handleExportPdf = () => {
    try {
      exportSenaOnePagerPdf({
        tenderId,
        title: tender?.title || `Tender #${tenderId}`,
        noticeNumber: tender?.rawData?.announcement?.Number || tender?.rawData?.Number || tender?.externalId,
        contractingAuth: tender?.contractingAuth || sena.buyerProfile.name,
        estimatedValue: tender?.estimatedValue,
        currency: tender?.currency || "KM",
        deadline: tender?.deadline,
        chancePct: sena.chancePct,
        confidence: sena.confidence,
        confidenceLabel: sena.confidenceLabel,
        decisionRecommendation: sena.decisionRecommendation,
        decisionLabel: sena.decisionLabel,
        decisionReason: sena.decisionReason,
        currentDecision,
        recordedBy: user?.name || "Tim za javne nabavke",
        priceRange: sena.priceRange,
        signals: sena.signals,
        pillars: sena.pillars,
      });
      toast.success("Jednostrani sažetak za Upravu uspješno preuzet u PDF formatu!");
    } catch (err: any) {
      toast.error("Greška pri generisanju PDF sažetka: " + (err.message || ""));
    }
  };

  return (
    <div className="space-y-6">
      {/* GLAVNA KARTICA PROCJENE (ASA INTELLIGENCE STIL) */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Header traka u ASA stilu */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              ASA Tender Intelligence · Procjena šanse i odluke
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground hidden sm:inline">
              Podaci od 2014. · Svaka procjena ima izvor
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              className="h-7 text-xs font-mono font-semibold border-primary/30 text-primary hover:bg-primary/10"
            >
              Jednostrani sažetak za Upravu (PDF)
            </Button>
          </div>
        </div>

        {/* 3 GLAVNE METRIKE (Šansa, Raspon cijena, Kupac) */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b border-border bg-background">
          {/* 1. Procjena šanse */}
          <div className="p-5 sm:p-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
                Procjena šanse
              </span>
              <Badge variant="outline" className={`font-mono text-xs font-semibold ${chanceBadge.bg}`}>
                {sena.confidence === "nedovoljno_podataka" ? "Nedovoljno podataka" : `Pouzdanost: ${sena.confidence}`}
              </Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight tabular-nums text-foreground">
                {sena.chancePct !== null ? `${sena.chancePct}%` : "—"}
              </span>
              {sena.chancePct !== null && (
                <span className="text-xs text-muted-foreground">izračunato iz 4 stuba</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {sena.confidence === "nedovoljno_podataka"
                ? "Kad podataka nema dovoljno — piše. Potrebno je pregledati dokumente i unijeti historiju kupca."
                : sena.decisionReason}
            </p>
          </div>

          {/* 2. Raspon iz sličnih postupaka & Preporučene ponude */}
          <div className="p-5 sm:p-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
                Raspon iz sličnih postupaka
              </span>
              {sena.priceRange && (
                <span className="text-xs text-muted-foreground font-mono">
                  {sena.priceRange.sampleCount} uzoraka
                </span>
              )}
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {sena.priceRange ? `${money(sena.priceRange.min)} – ${money(sena.priceRange.max)}` : "Nema historijskih cijena"}
              </span>
              <p className="text-xs text-primary font-medium mt-0.5">
                Sa tri preporučene strategije ponude
              </p>
            </div>

            {/* Dugmad za odabir strategije */}
            {sena.priceRange && (
              <div className="pt-2">
                <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg text-center text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedOfferStrategy("aggressive")}
                    className={`py-1 rounded font-medium transition-all ${
                      selectedOfferStrategy === "aggressive" ? "bg-background shadow-xs text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Agresivna
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOfferStrategy("market")}
                    className={`py-1 rounded font-medium transition-all ${
                      selectedOfferStrategy === "market" ? "bg-background shadow-xs text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Preporučena
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOfferStrategy("conservative")}
                    className={`py-1 rounded font-medium transition-all ${
                      selectedOfferStrategy === "conservative" ? "bg-background shadow-xs text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Konzervativna
                  </button>
                </div>
                {/* Prikaz odabrane ponude */}
                {sena.priceRange.recommended[selectedOfferStrategy] && (
                  <div className="mt-2 text-xs bg-primary/5 border border-primary/20 rounded-md p-2 flex items-center justify-between">
                    <div>
                      <strong className="text-primary text-sm">
                        {money(sena.priceRange.recommended[selectedOfferStrategy].amount)}
                      </strong>
                      <span className="text-muted-foreground ml-1.5 font-mono text-[11px]">
                        (-{sena.priceRange.recommended[selectedOfferStrategy].discountPct}%)
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground max-w-[180px] text-right truncate">
                      {sena.priceRange.recommended[selectedOfferStrategy].desc}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Historija kupca */}
          <div className="p-5 sm:p-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
                Historija kupca
              </span>
              <Badge
                variant="outline"
                className={`text-[11px] ${
                  sena.buyerProfile.opennessIndex === "otvoren"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : sena.buyerProfile.opennessIndex === "zatvoren"
                    ? "bg-rose-50 text-rose-800 border-rose-300"
                    : "bg-amber-50 text-amber-800 border-amber-300"
                }`}
              >
                {sena.buyerProfile.opennessLabel}
              </Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {sena.buyerProfile.totalProcedures > 0 ? `${sena.buyerProfile.totalProcedures} nabavki` : "Nema nabavki"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {sena.buyerProfile.categoryProcedures > 0
                ? `${sena.buyerProfile.categoryProcedures} u ovoj kategoriji (${sena.buyerProfile.cpvCode || "CPV"})`
                : "Nema zabilježenih nabavki u ovoj CPV kategoriji"}
              {sena.buyerProfile.leadingWinner && (
                <> · Vodeći: <strong>{sena.buyerProfile.leadingWinner.name}</strong> ({sena.buyerProfile.leadingWinner.sharePct}%)</>
              )}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground/80 pt-1">
              {sena.buyerProfile.senaNote}
            </p>
          </div>
        </div>

        {/* POZITIVNI SIGNALI I RIZICI SA IZVORIMA */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b border-border p-5 sm:p-6 gap-6 md:gap-0">
          {/* Pozitivni signali (+) */}
          <div className="md:pr-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-mono text-xs font-bold">
                +
              </span>
              <h4 className="text-sm font-bold text-foreground">Pozitivni signali</h4>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {sena.signals.positive.length}
              </Badge>
            </div>

            {sena.signals.positive.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nisu evidentirani posebni pozitivni signali u preuzetim podacima.</p>
            ) : (
              <ul className="space-y-3">
                {sena.signals.positive.map((signal) => (
                  <li key={signal.id} className="flex items-start gap-2.5 text-xs">
                    <span className="mt-0.5 shrink-0 font-mono font-bold text-emerald-600">+</span>
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground leading-snug">{signal.title}</p>
                      <p className="text-muted-foreground leading-relaxed">{signal.description}</p>
                      <span className="inline-block text-[10px] font-mono text-emerald-700/80 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Izvor: {signal.source}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Rizici (!) */}
          <div className="md:pl-6 space-y-3 pt-6 md:pt-0">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-mono text-xs font-bold">
                !
              </span>
              <h4 className="text-sm font-bold text-foreground">Rizici i prepreke</h4>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {sena.signals.risks.length}
              </Badge>
            </div>

            {sena.signals.risks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nema automatski identifikovanih eliminatornih rizika.</p>
            ) : (
              <ul className="space-y-3">
                {sena.signals.risks.map((risk) => (
                  <li key={risk.id} className="flex items-start gap-2.5 text-xs">
                    <span className="mt-0.5 shrink-0 font-mono font-bold text-amber-600">!</span>
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground leading-snug">{risk.title}</p>
                      <p className="text-muted-foreground leading-relaxed">{risk.description}</p>
                      <span className="inline-block text-[10px] font-mono text-amber-800/80 bg-amber-50 px-1.5 py-0.5 rounded">
                        Izvor: {risk.source}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ČETIRI STUBA PROCJENE (SENA 4 PITANJA) */}
        <div className="border-b border-border bg-muted/20 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-foreground">Četiri stuba procjene</h4>
              <p className="text-xs text-muted-foreground">Svaka procjena odgovara na četiri pitanja. Na kraju ostaje jedna odluka.</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">Čl. 45–51 ZJN · Tržišni dosje</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 01 Podudarnost */}
            <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground font-bold">01</span>
                  <span className="font-semibold text-xs text-foreground">Podudarnost</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{sena.pillars.compliance.verdict}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium line-clamp-2">
                {sena.pillars.compliance.question}
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border">
                {sena.pillars.compliance.details.slice(0, 2).map((d, i) => (
                  <li key={i} className="line-clamp-2">• {d}</li>
                ))}
              </ul>
            </div>

            {/* 02 Kupac */}
            <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground font-bold">02</span>
                  <span className="font-semibold text-xs text-foreground">Kupac</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{sena.pillars.buyer.verdict}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium line-clamp-2">
                {sena.pillars.buyer.question}
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border">
                {sena.pillars.buyer.details.slice(0, 2).map((d, i) => (
                  <li key={i} className="line-clamp-2">• {d}</li>
                ))}
              </ul>
            </div>

            {/* 03 Konkurencija */}
            <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground font-bold">03</span>
                  <span className="font-semibold text-xs text-foreground">Konkurencija</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{sena.pillars.competition.verdict}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium line-clamp-2">
                {sena.pillars.competition.question}
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border">
                {sena.pillars.competition.details.slice(0, 2).map((d, i) => (
                  <li key={i} className="line-clamp-2">• {d}</li>
                ))}
              </ul>
            </div>

            {/* 04 Ulaganje */}
            <div className="rounded-lg border border-border bg-background p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground font-bold">04</span>
                  <span className="font-semibold text-xs text-foreground">Ulaganje</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{sena.pillars.investment.verdict}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium line-clamp-2">
                {sena.pillars.investment.question}
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border">
                {sena.pillars.investment.details.slice(0, 2).map((d, i) => (
                  <li key={i} className="line-clamp-2">• {d}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* JEDNA ODLUKA: IĆI / NE IĆI (FOOTER CTA) */}
        <div className="p-5 sm:p-6 bg-background flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                Četiri odgovora, jedna odluka:
              </span>
              <strong className="text-base text-foreground font-bold tracking-tight">
                {currentDecision === "go" ? "Zabilježeno: Idemo" : currentDecision === "no_go" ? "Zabilježeno: Ne idemo" : "Ići / ne ići"}
              </strong>
            </div>
            <p className="text-xs text-muted-foreground">
              {sena.decisionReason}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={currentDecision === "no_go" ? "default" : "outline"}
              size="sm"
              onClick={() => handleOpenDecision("no_go")}
              className={currentDecision === "no_go" ? "bg-rose-700 hover:bg-rose-800 text-white" : "border-rose-200 text-rose-700 hover:bg-rose-50"}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Ne idemo
            </Button>
            <Button
              variant={currentDecision === "go" ? "default" : "outline"}
              size="sm"
              onClick={() => handleOpenDecision("go")}
              className={currentDecision === "go" ? "bg-emerald-700 hover:bg-emerald-800 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Idemo na tender
            </Button>
          </div>
        </div>

        {/* Footer sa izvorima */}
        <div className="border-t border-border px-5 py-2.5 bg-muted/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
          <span>{sena.sourcesFootnote}</span>
          <span>ASA Central analitički model za javne nabavke</span>
        </div>
      </div>

      {/* SIMULATOR E-AUKCIJE I IZRAČUN TAČKE ODUSTAJANJA (WALK-AWAY PRICE) */}
      <EAuctionSimulator
        initialEstimatedValue={tender?.estimatedValue}
        currency={tender?.currency || "KM"}
      />

      {/* PITAJ ASU - INTERAKTIVNI AI ASISTENT SA TAČNIM CITATIMA */}
      <PitajAsuCard
        tenderId={tenderId}
        tenderTitle={tender?.title}
        tenderNoticeNumber={tender?.rawData?.announcement?.Number || tender?.rawData?.Number || tender?.externalId}
      />

      {/* MODAL ZA EVIDENTIRANJE ODLUKE */}
      <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionType === "go" ? "Evidentiraj odluku: Idemo na tender" : "Evidentiraj odluku: Ne idemo (Odustajanje)"}
            </DialogTitle>
            <DialogDescription>
              Zapisana odluka s datumom i razlogom ostaje firmi u dosjeu ponude.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitDecision} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Razlog odluke (obavezno)
              </label>
              <Textarea
                rows={3}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Obrazložite zašto se ide ili odustaje od ovog tendera..."
                className="text-xs"
                required
              />
            </div>
            {decisionType === "go" && (
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Interni rok za pripremu ponude (opcionalno)
                </label>
                <Input
                  type="date"
                  value={decisionDeadline}
                  onChange={(e) => setDecisionDeadline(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setDecisionModalOpen(false)}>
                Odustani
              </Button>
              <Button
                type="submit"
                disabled={saveDecisionMutation.isPending}
                className={decisionType === "go" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
              >
                {saveDecisionMutation.isPending ? "Spremanje…" : "Potvrdi i spremi odluku"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
