import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Swords, TrendingDown, Building2, AlertTriangle, Lightbulb, Target } from "lucide-react";
import { useAuthStore } from "@/hooks/use-auth";

type Battlecard = {
  competitorName: string;
  totalWonCount: number;
  totalWonAmountKM: number;
  avgAuctionDiscountPct: number;
  strongholds: string[];
  aggressiveness: "Vrlo visoka" | "Visoka" | "Umjerena" | "Konzervativna";
  preferredSegments: string[];
  weakness: string;
  tacticalAdvice: string;
  complaintTendency: "Često se žali" | "Povremeno" | "Rijetko";
};

export function CompetitorBattlecards() {
  const token = useAuthStore((s) => s.token);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ battlecards: Battlecard[] }>({
    queryKey: ["competitor-battlecards"],
    queryFn: async () => {
      const res = await fetch("/api/history/battlecards", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Greška pri dohvatanju battlecards analize");
      return res.json();
    },
  });

  const cards = data?.battlecards || [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  const getAggressivenessBadge = (agg: string) => {
    if (agg === "Vrlo visoka") return <Badge className="bg-rose-600 text-white font-bold">{agg}</Badge>;
    if (agg === "Visoka") return <Badge className="bg-amber-600 text-white font-semibold">{agg}</Badge>;
    if (agg === "Umjerena") return <Badge className="bg-blue-600 text-white font-medium">{agg}</Badge>;
    return <Badge className="bg-slate-600 text-white">{agg}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Swords className="w-5 h-5 text-rose-600" />
            Competitor Battlecards (Glava-uz-glavu inteligencija)
          </h3>
          <p className="text-xs text-muted-foreground">
            Taktike, popusti na e-aukcijama i preporučeni potezi protiv vodećih rivala u BiH.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card
            key={card.competitorName}
            className={`border transition-all cursor-pointer hover:shadow-md ${
              selectedComp === card.competitorName
                ? "ring-2 ring-primary border-primary bg-blue-50/20"
                : "border-gray-200 bg-white"
            }`}
            onClick={() => setSelectedComp(card.competitorName === selectedComp ? null : card.competitorName)}
          >
            <CardHeader className="pb-2 border-b">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <CardTitle className="text-sm font-bold text-gray-900">
                    {card.competitorName}
                  </CardTitle>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Osvojeno: {card.totalWonCount} ugovora ({new Intl.NumberFormat("bs-BA").format(card.totalWonAmountKM)} KM)
                  </div>
                </div>
                {getAggressivenessBadge(card.aggressiveness)}
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3 text-xs">
              {/* E-AUKCIJA POPUST */}
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200/60">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Prosječan pad na e-aukciji:
                </span>
                <span className="font-bold text-rose-600 font-mono text-sm">
                  -{card.avgAuctionDiscountPct}%
                </span>
              </div>

              {/* DOMINANTNI SEGMENTI */}
              <div>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Fokusirani segmenti:
                </span>
                <div className="flex flex-wrap gap-1">
                  {card.preferredSegments.map((seg, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] bg-gray-50 text-gray-700">
                      {seg}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* RANJIVOST */}
              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 space-y-1">
                <div className="font-bold text-amber-900 flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Uočena slabost:
                </div>
                <p className="text-gray-700 text-[11px] leading-relaxed">{card.weakness}</p>
              </div>

              {/* TAKTIČKI SAVJET */}
              <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/80 space-y-1">
                <div className="font-bold text-blue-950 flex items-center gap-1 text-[11px]">
                  <Lightbulb className="w-3 h-3 text-blue-600" /> Taktika za ASA Central:
                </div>
                <p className="text-gray-800 text-[11px] leading-relaxed">{card.tacticalAdvice}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
