import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Calculator,
  Gavel,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  ArrowDownRight,
  Info,
  RotateCcw,
  Zap,
  CheckCircle2,
} from "lucide-react";

interface EAuctionSimulatorProps {
  initialEstimatedValue?: number | null;
  currency?: string;
}

export function EAuctionSimulator({
  initialEstimatedValue,
  currency = "KM",
}: EAuctionSimulatorProps) {
  // Ulazni parametri
  const defaultVal = initialEstimatedValue && initialEstimatedValue > 0 ? initialEstimatedValue : 100000;
  const [estimatedValue, setEstimatedValue] = useState<number>(defaultVal);
  const [minStepPct, setMinStepPct] = useState<number>(0.5); // Minimalni zakonski korak (0.5% ili 1.0%)
  const [directCost, setDirectCost] = useState<number>(Math.round(defaultVal * 0.78)); // Troškovi izvršenja / štete / premije
  const [minMarginPct, setMinMarginPct] = useState<number>(7); // Minimalna prihvatljiva marža (npr. 7%)

  // Trenutna simulirana ponuda u toku aukcije
  const [currentBid, setCurrentBid] = useState<number>(defaultVal);

  const money = (val: number) =>
    new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 0 }).format(val) + " " + currency;

  // Izračun 3 nivoa ponude
  const offers = useMemo(() => {
    const val = estimatedValue || 0;
    const aggressive = Math.round(val * 0.86); // -14%
    const market = Math.round(val * 0.93);     // -7%
    const conservative = Math.round(val * 0.98); // -2%

    return {
      aggressive: {
        label: "Agresivna ponuda",
        amount: aggressive,
        discountPct: 14,
        margin: aggressive - directCost,
        marginPct: aggressive > 0 ? Math.round(((aggressive - directCost) / aggressive) * 100) : 0,
        desc: "Za tender sa jakom konkurencijom i prioritetom osvajanja",
      },
      market: {
        label: "Tržišna preporučena",
        amount: market,
        discountPct: 7,
        margin: market - directCost,
        marginPct: market > 0 ? Math.round(((market - directCost) / market) * 100) : 0,
        desc: "Optimalan omjer šanse za pobjedu i profitabilnosti",
      },
      conservative: {
        label: "Konzervativna ponuda",
        amount: conservative,
        discountPct: 2,
        margin: conservative - directCost,
        marginPct: conservative > 0 ? Math.round(((conservative - directCost) / conservative) * 100) : 0,
        desc: "Za situacije s malim brojem ponuđača ili specifičnim uslovima",
      },
    };
  }, [estimatedValue, directCost]);

  // Tačka odustajanja (Walk-Away Price)
  // Prag ispod kojeg se ne smije ići: troškovi + minimalna ciljana marža
  const walkAwayPrice = useMemo(() => {
    return Math.round(directCost * (1 + minMarginPct / 100));
  }, [directCost, minMarginPct]);

  // Minimalni zakonski korak u KM
  const minStepAmount = useMemo(() => {
    return Math.max(1, Math.round((estimatedValue * minStepPct) / 100));
  }, [estimatedValue, minStepPct]);

  // Stanje trenutne simulirane ponude
  const currentMargin = currentBid - directCost;
  const currentMarginPct = currentBid > 0 ? Math.round((currentMargin / currentBid) * 100) : 0;
  const isLoss = currentBid < directCost;
  const isBelowWalkAway = currentBid < walkAwayPrice;

  // Simulacija smanjenja za 1 zakonski korak
  const stepDown = () => {
    setCurrentBid((prev) => Math.max(0, prev - minStepAmount));
  };

  // Reset na početnu vrijednost
  const resetSimulation = () => {
    setCurrentBid(offers.market.amount);
  };

  return (
    <Card className="border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/40 border-b border-border py-3.5 px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-600 text-white shadow-xs">
              <Gavel className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>Simulator e-Aukcije & Tačka odustajanja</span>
                <Badge variant="outline" className="text-[10px] font-mono border-purple-300 text-purple-700 bg-purple-50">
                  Walk-Away Price
                </Badge>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Izračun minimalnog zakonskog koraka, marže i praga ispod kojeg kompanija ide u gubitak
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-muted-foreground block">Tačka odustajanja</span>
            <span className="text-xs font-bold text-rose-600 font-mono">
              {money(walkAwayPrice)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Sekcija 1: Ulazni parametri kalkulatora */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-muted/20 p-3.5 rounded-lg border border-border">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
              <span>Procijenjena vrijednost</span>
              <Info className="w-3 h-3 text-muted-foreground" />
            </label>
            <div className="relative">
              <Input
                type="number"
                value={estimatedValue}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setEstimatedValue(val);
                  setDirectCost(Math.round(val * 0.78));
                  setCurrentBid(Math.round(val * 0.93));
                }}
                className="h-8 text-xs font-mono pr-8 bg-background"
              />
              <span className="absolute right-2 top-2 text-[10px] font-mono text-muted-foreground">KM</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">
              Min. korak sniženja ({minStepPct}%)
            </label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={minStepPct === 0.5 ? "default" : "outline"}
                size="sm"
                className="h-8 flex-1 text-xs px-2"
                onClick={() => setMinStepPct(0.5)}
              >
                0.5% ({money(Math.round((estimatedValue * 0.5) / 100))})
              </Button>
              <Button
                type="button"
                variant={minStepPct === 1.0 ? "default" : "outline"}
                size="sm"
                className="h-8 flex-1 text-xs px-2"
                onClick={() => setMinStepPct(1.0)}
              >
                1.0% ({money(Math.round((estimatedValue * 1.0) / 100))})
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">
              Vlastiti procijenjeni troškovi
            </label>
            <div className="relative">
              <Input
                type="number"
                value={directCost}
                onChange={(e) => setDirectCost(Number(e.target.value) || 0)}
                className="h-8 text-xs font-mono pr-8 bg-background"
              />
              <span className="absolute right-2 top-2 text-[10px] font-mono text-muted-foreground">KM</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">
              Min. prihvatljiva marža (%)
            </label>
            <div className="relative">
              <Input
                type="number"
                value={minMarginPct}
                onChange={(e) => setMinMarginPct(Number(e.target.value) || 0)}
                className="h-8 text-xs font-mono pr-6 bg-background"
              />
              <span className="absolute right-2 top-2 text-[10px] font-mono text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        {/* Sekcija 2: Prikaz 3 preporučene ponude (Agresivna, Tržišna, Konzervativna) */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
            3 preporučena nivoa ponude:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Agresivna */}
            <div
              onClick={() => setCurrentBid(offers.aggressive.amount)}
              className="p-3 rounded-lg border border-border bg-background hover:border-purple-300 hover:shadow-xs cursor-pointer transition-all space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{offers.aggressive.label}</span>
                <Badge variant="secondary" className="text-[10px] font-mono">-{offers.aggressive.discountPct}%</Badge>
              </div>
              <div className="text-lg font-extrabold text-foreground font-mono">
                {money(offers.aggressive.amount)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-1">
                <span>Marža: {money(offers.aggressive.margin)}</span>
                <span className={`font-mono font-bold ${offers.aggressive.marginPct >= minMarginPct ? "text-emerald-700" : "text-amber-700"}`}>
                  {offers.aggressive.marginPct}%
                </span>
              </div>
            </div>

            {/* Tržišna preporučena */}
            <div
              onClick={() => setCurrentBid(offers.market.amount)}
              className="p-3 rounded-lg border-2 border-primary/40 bg-primary/5 hover:border-primary cursor-pointer transition-all space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">{offers.market.label}</span>
                <Badge className="text-[10px] font-mono bg-primary text-white">-{offers.market.discountPct}%</Badge>
              </div>
              <div className="text-lg font-extrabold text-primary font-mono">
                {money(offers.market.amount)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-primary/20 pt-1">
                <span>Marža: {money(offers.market.margin)}</span>
                <span className="font-mono font-bold text-emerald-700">
                  {offers.market.marginPct}%
                </span>
              </div>
            </div>

            {/* Konzervativna */}
            <div
              onClick={() => setCurrentBid(offers.conservative.amount)}
              className="p-3 rounded-lg border border-border bg-background hover:border-purple-300 hover:shadow-xs cursor-pointer transition-all space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{offers.conservative.label}</span>
                <Badge variant="secondary" className="text-[10px] font-mono">-{offers.conservative.discountPct}%</Badge>
              </div>
              <div className="text-lg font-extrabold text-foreground font-mono">
                {money(offers.conservative.amount)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-1">
                <span>Marža: {money(offers.conservative.margin)}</span>
                <span className="font-mono font-bold text-emerald-700">
                  {offers.conservative.marginPct}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sekcija 3: Interaktivni live simulator nadmetanja i Walk-Away limit */}
        <div className={`p-4 rounded-xl border transition-colors space-y-3 ${
          isLoss
            ? "bg-rose-50 border-rose-300 text-rose-900"
            : isBelowWalkAway
            ? "bg-amber-50 border-amber-300 text-amber-900"
            : "bg-emerald-50/60 border-emerald-300 text-emerald-950"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isLoss ? (
                <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
              ) : isBelowWalkAway ? (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              )}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                  {isLoss
                    ? "OPASNOST OD GUBITKA · PREKINUTI LICITACIJU!"
                    : isBelowWalkAway
                    ? "UPOZORENJE · ISPOD TAČKE ODUSTAJANJA (WALK-AWAY PRICE)"
                    : "SIGURNA ZONA · PROFITABILNO NADMETANJE"}
                </h4>
                <p className="text-[11px] opacity-90">
                  {isLoss
                    ? `Cijena je manja od direktnih troškova (${money(directCost)}). Ugovor bi donio čist gubitak.`
                    : isBelowWalkAway
                    ? `Marža je ispod minimalno zadatih ${minMarginPct}%. Preporučuje se odustajanje od daljeg spuštanja.`
                    : `Marža iznosi ${currentMarginPct}% (${money(currentMargin)} zarade). Nastaviti nadmetanje po koraku.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={stepDown}
                className="h-8 text-xs font-semibold gap-1 bg-white"
              >
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                <span>Spusti za korak (-{money(minStepAmount)})</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={resetSimulation}
                className="h-8 text-xs px-2"
                title="Vrati na početnu"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-current/10">
            <div>
              <span className="text-[10px] uppercase font-mono opacity-80 block">Trenutna ponuda u aukciji</span>
              <span className="text-lg font-extrabold font-mono">{money(currentBid)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono opacity-80 block">Tačka odustajanja (Limit)</span>
              <span className="text-lg font-extrabold font-mono text-rose-700">{money(walkAwayPrice)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono opacity-80 block">Ukupna marža</span>
              <span className="text-lg font-extrabold font-mono">{money(currentMargin)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono opacity-80 block">Stopa marže</span>
              <span className="text-lg font-extrabold font-mono">{currentMarginPct}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
