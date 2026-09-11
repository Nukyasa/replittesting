import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Zap,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Flame,
  ArrowDownRight,
  DollarSign,
  CheckCircle2,
  Percent,
} from "lucide-react";

interface EAuctionSimulatorProps {
  tenderEstimatedValue?: number | null;
  initialEstimatedValue?: number | null;
  currency?: string;
  hasEAuction?: boolean;
  ourOfferAmount?: number | null;
}

export function EAuctionSimulator({
  tenderEstimatedValue,
  initialEstimatedValue,
  currency = "KM",
  hasEAuction = true,
  ourOfferAmount,
}: EAuctionSimulatorProps) {
  const effectiveValue = (tenderEstimatedValue && tenderEstimatedValue > 0)
    ? tenderEstimatedValue
    : (initialEstimatedValue && initialEstimatedValue > 0)
    ? initialEstimatedValue
    : 100000;
  const baseValue = effectiveValue;

  // Selected competitor
  const [selectedCompetitor, setSelectedCompetitor] = useState<"euroherc" | "sarajevo" | "triglav" | "grawe">("euroherc");
  // Target profit margin discount slider (0% to 35%)
  const [stopLossDiscount, setStopLossDiscount] = useState<number>(20);
  // Initial bid discount slider (0% to 15%)
  const [initialDiscount, setInitialDiscount] = useState<number>(() => {
    if (ourOfferAmount && baseValue > 0 && ourOfferAmount < baseValue) {
      const disc = Math.round(((baseValue - ourOfferAmount) / baseValue) * 100);
      return Math.min(15, Math.max(0, disc));
    }
    return 5;
  });

  const competitorProfiles = {
    euroherc: {
      name: "Euroherc Osiguranje d.d.",
      aggression: "Visoka (agresivno spuštanje cijena)",
      typicalDiscountMin: 15,
      typicalDiscountMax: 24,
      color: "text-rose-600",
      bgBadge: "bg-rose-100 text-rose-800",
    },
    sarajevo: {
      name: "Sarajevo-osiguranje d.d.",
      aggression: "Umjereno-visoka",
      typicalDiscountMin: 10,
      typicalDiscountMax: 18,
      color: "text-amber-600",
      bgBadge: "bg-amber-100 text-amber-800",
    },
    triglav: {
      name: "Triglav Osiguranje d.d.",
      aggression: "Umjerena (fokus na profitabilnost)",
      typicalDiscountMin: 8,
      typicalDiscountMax: 15,
      color: "text-blue-600",
      bgBadge: "bg-blue-100 text-blue-800",
    },
    grawe: {
      name: "GRAWE osiguranje d.d.",
      aggression: "Selektivna",
      typicalDiscountMin: 6,
      typicalDiscountMax: 14,
      color: "text-emerald-600",
      bgBadge: "bg-emerald-100 text-emerald-800",
    },
  };

  const comp = competitorProfiles[selectedCompetitor];

  // Calculations
  const initialBidAmount = baseValue * (1 - initialDiscount / 100);
  const stopLossAmount = baseValue * (1 - stopLossDiscount / 100);
  const competitorExpectedFinal = baseValue * (1 - (comp.typicalDiscountMin + comp.typicalDiscountMax) / 200);
  
  // Minimal step in e-auction (typically 0.5% of estimated value according to ZJN)
  const auctionStepKm = Math.max(10, Math.round(baseValue * 0.005));

  // Win probability calculation based on stop loss vs competitor average
  const compAvgDiscount = (comp.typicalDiscountMin + comp.typicalDiscountMax) / 2;
  let estimatedWinChance = 50;
  if (stopLossDiscount >= comp.typicalDiscountMax) {
    estimatedWinChance = 85;
  } else if (stopLossDiscount >= compAvgDiscount) {
    estimatedWinChance = 68;
  } else if (stopLossDiscount >= comp.typicalDiscountMin) {
    estimatedWinChance = 42;
  } else {
    estimatedWinChance = 18;
  }

  const formatKm = (val: number) =>
    `${new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 0 }).format(val)} ${currency}`;

  return (
    <Card className="border shadow-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-900 to-blue-950 text-white pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                E-Aukcija Simulator & Preporuka granične cijene
                <Badge className="bg-amber-400 text-slate-950 font-bold text-xs">AI Procjena</Badge>
              </CardTitle>
              <CardDescription className="text-blue-200 text-xs mt-0.5">
                Simulacija koraka nadmetanja, profila konkurenata i izračun profitabilnog praga (Stop-loss)
              </CardDescription>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] text-blue-300 block">Procijenjena vrijednost</span>
            <span className="text-base font-extrabold text-white">{formatKm(baseValue)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {Boolean(ourOfferAmount && ourOfferAmount > 0) && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">Naša kalkulisana ponuda je uvezana:</p>
                <p className="text-sm font-extrabold text-emerald-800">{formatKm(ourOfferAmount!)}</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (baseValue > 0 && ourOfferAmount) {
                  const disc = Math.round(((baseValue - ourOfferAmount) / baseValue) * 100);
                  setInitialDiscount(Math.min(15, Math.max(0, disc)));
                }
              }}
              className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100 h-8"
            >
              Uskladi početni slajder
            </Button>
          </div>
        )}

        {/* 1. Odabir glavnog konkurenta */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
            1. Očekivani glavni konkurent na e-aukciji:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(Object.keys(competitorProfiles) as Array<keyof typeof competitorProfiles>).map((key) => {
              const p = competitorProfiles[key];
              const isSelected = selectedCompetitor === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCompetitor(key)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-xs"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/60"
                  }`}
                >
                  <span className="font-bold text-xs text-gray-900 block truncate">{p.name.split(" ")[0]}</span>
                  <span className="text-[11px] text-gray-500 block mt-0.5">Popust: {p.typicalDiscountMin}-{p.typicalDiscountMax}%</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Slajderi za cijene */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/70 p-4 rounded-xl border border-gray-200/80">
          {/* Početna ponuda */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">Početna ponuda (koverta):</span>
              <span className="text-sm font-extrabold text-blue-700">-{initialDiscount}% ({formatKm(initialBidAmount)})</span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              step="1"
              value={initialDiscount}
              onChange={(e) => setInitialDiscount(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <p className="text-[11px] text-gray-500">
              Preporuka: Otvoriti sa blagim popustom (3–6%) kako bi se ostavio manevarski prostor za nadmetanje na e-aukciji.
            </p>
          </div>

          {/* Stop-loss prag */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">Prag isplativosti (Stop-loss):</span>
              <span className="text-sm font-extrabold text-rose-700">-{stopLossDiscount}% ({formatKm(stopLossAmount)})</span>
            </div>
            <input
              type="range"
              min="5"
              max="35"
              step="1"
              value={stopLossDiscount}
              onChange={(e) => setStopLossDiscount(Number(e.target.value))}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <p className="text-[11px] text-gray-500">
              Minimalna prihvatljiva premija. Ispod ovog iznosa ASA Central ne bi trebala ići kako ne bi ušla u damping/štetnost.
            </p>
          </div>
        </div>

        {/* 3. Rezultati i preporuke */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl border border-blue-100 shadow-2xs">
            <span className="text-xs text-gray-500 font-semibold block uppercase">Preporučeni start</span>
            <span className="text-lg font-black text-blue-900 block mt-1">{formatKm(initialBidAmount)}</span>
            <span className="text-[11px] text-blue-600 mt-1 block">Siguran start prije aukcije</span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-rose-100 shadow-2xs">
            <span className="text-xs text-gray-500 font-semibold block uppercase">Stop-loss granica</span>
            <span className="text-lg font-black text-rose-700 block mt-1">{formatKm(stopLossAmount)}</span>
            <span className="text-[11px] text-rose-600 mt-1 block">Apsolutni minimum ASA</span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-xs text-gray-500 font-semibold block uppercase">Šansa za pobjedu</span>
            <span className="text-lg font-black text-emerald-700 block mt-1">{estimatedWinChance}%</span>
            <span className="text-[11px] text-emerald-600 mt-1 block">
              {estimatedWinChance >= 70 ? "Visoka vjerovatnoća" : estimatedWinChance >= 40 ? "Umjerena borba" : "Rizična ponuda"}
            </span>
          </div>
        </div>

        {/* 4. Koraci na e-aukciji */}
        <div className="p-4 bg-blue-900/5 rounded-xl border border-blue-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              Taktički savjeti za e-aukciju sa {comp.name}:
            </span>
            <Badge variant="outline" className="text-xs font-semibold bg-white">
              Min. korak sniženja: ~{formatKm(auctionStepKm)}
            </Badge>
          </div>
          <ul className="text-xs text-gray-700 space-y-2 list-disc pl-4 leading-relaxed">
            <li>
              <strong>Ponašanje {comp.name.split(" ")[0]}:</strong> Obično spuštaju cijenu za minimalni korak u zadnjih 45 sekundi kruga kako bi testirali vašu odlučnost.
            </li>
            <li>
              <strong>Pravilo zadnjeg kruga:</strong> Ako konkurent dođe do <strong>{formatKm(competitorExpectedFinal)}</strong>, ne ulazite u dumping ako je vaš prag profitabilnosti viši od te cifre.
            </li>
            <li>
              <strong>Član 66. ZJN (Neuobičajeno niska cijena):</strong> Ako ponuda padne za više od 20% ispod prosjeka ostalih ponuda, ugovorni organ je dužan tražiti pismeno obrazloženje kalkulacije.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
