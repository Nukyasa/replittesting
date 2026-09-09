import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Gavel,
  Clock,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ArrowDown,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface LiveAuctionWarRoomProps {
  isOpen: boolean;
  onClose: () => void;
  tender: {
    id: string;
    title: string;
    contractingAuth: string;
    estimatedValue?: number | null;
    currency?: string | null;
  };
}

export function LiveAuctionWarRoom({ isOpen, onClose, tender }: LiveAuctionWarRoomProps) {
  const estValue = tender.estimatedValue || 50000;
  const currency = tender.currency || "KM";

  const [currentBid, setCurrentBid] = useState<number>(estValue);
  const [internalCost, setInternalCost] = useState<number>(Math.round(estValue * 0.78)); // 78% troškovi šteta i obrade
  const [minMarginPct, setMinMarginPct] = useState<number>(6); // 6% apsolutni walkaway limit
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Timer states (10 min runda na e-aukciji)
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(600);
  const [isRunning, setIsRunning] = useState(false);

  // Log ponuda
  const [bidHistory, setBidHistory] = useState<{ round: number; amount: number; discountPct: number; marginPct: number; time: string }[]>([
    { round: 1, amount: estValue, discountPct: 0, marginPct: 22, time: "Početna" }
  ]);

  useEffect(() => {
    let timer: any;
    if (isRunning && timeLeftSeconds > 0) {
      timer = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev === 46 && soundEnabled) {
            toast.warning("SNIPER PROZOR! Preostalo je 45 sekundi do kraja runde!", {
              description: "Optimalan trenutak za plasiranje završne ponude.",
            });
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeftSeconds, soundEnabled]);

  const discountAmount = estValue - currentBid;
  const discountPct = Math.round((discountAmount / estValue) * 1000) / 10;
  const marginAmount = currentBid - internalCost;
  const marginPct = Math.round((marginAmount / currentBid) * 1000) / 10;

  const isSafe = marginPct >= 15;
  const isWarning = marginPct >= minMarginPct && marginPct < 15;
  const isDanger = marginPct < minMarginPct;

  const minStep05 = Math.round(currentBid * 0.005);
  const step10 = Math.round(currentBid * 0.01);

  const handleStepDown = (amountToReduce: number) => {
    const newBid = Math.max(0, currentBid - amountToReduce);
    setCurrentBid(newBid);

    const newMarginAmount = newBid - internalCost;
    const newMarginPct = Math.round((newMarginAmount / newBid) * 1000) / 10;
    const newDiscAmount = estValue - newBid;
    const newDiscPct = Math.round((newDiscAmount / estValue) * 1000) / 10;

    const round = bidHistory.length + 1;
    const timeStr = `${Math.floor(timeLeftSeconds / 60)}:${(timeLeftSeconds % 60).toString().padStart(2, "0")}`;
    setBidHistory((prev) => [{ round, amount: newBid, discountPct: newDiscPct, marginPct: newMarginPct, time: timeStr }, ...prev]);

    if (newMarginPct < minMarginPct) {
      toast.error("PAŽNJA: WALKAWAY LIMIT!", {
        description: `Ova cijena stvara gubitak za društvo (marža ispod ${minMarginPct}%). Prestanite sa spuštanjem!`,
      });
    } else {
      toast.success(`Cijena spuštena na ${new Intl.NumberFormat("bs-BA").format(newBid)} ${currency}`);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-2 border-slate-800 shadow-2xl bg-slate-950 text-slate-100">
        <div className="bg-slate-900 border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-600/20 text-rose-500 rounded-lg border border-rose-500/30">
              <Gavel className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                WAR ROOM: E-Aukcija u realnom vremenu
                <Badge className="bg-rose-600 text-white text-[10px] animate-pulse">LIVE LICITACIJA</Badge>
              </DialogTitle>
              <p className="text-xs text-slate-400">{tender.contractingAuth} — {tender.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white text-xs"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRunning(!isRunning)}
              className="bg-slate-800 border-slate-700 text-slate-200 hover:text-white text-xs gap-1.5"
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? "Pauza" : "Pokreni tajmer"}
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* TIMER I GLAVNI INDIKATOR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* TAJMER */}
            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center transition-colors ${
              timeLeftSeconds <= 45 ? "bg-rose-950/40 border-rose-600 animate-pulse" : "bg-slate-900/90 border-slate-800"
            }`}>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Preostalo vrijeme runde
              </div>
              <div className={`text-4xl font-mono font-black mt-2 tracking-tight ${
                timeLeftSeconds <= 45 ? "text-rose-400" : "text-white"
              }`}>
                {formatTimer(timeLeftSeconds)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {timeLeftSeconds <= 45 ? "🔥 SNIPER FAZA (Zadnjih 45s)" : "Standardna runda (10 min)"}
              </div>
            </div>

            {/* TRENUTNA CIJENA */}
            <div className="p-4 rounded-xl border bg-slate-900/90 border-slate-800 flex flex-col items-center justify-center">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Naša ponuda na aukciji
              </div>
              <div className="text-3xl font-black text-emerald-400 mt-1 font-mono">
                {new Intl.NumberFormat("bs-BA").format(currentBid)} {currency}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                Popust: <strong className="text-rose-400">-{discountPct}%</strong> (
                {new Intl.NumberFormat("bs-BA").format(discountAmount)} KM)
              </div>
            </div>

            {/* SEMAFOR PROFITABILNOSTI */}
            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center ${
              isDanger
                ? "bg-rose-950/50 border-rose-500"
                : isWarning
                ? "bg-amber-950/50 border-amber-500"
                : "bg-emerald-950/50 border-emerald-500"
            }`}>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Semafor marže i rentabilnosti
              </div>
              <div className={`text-3xl font-black mt-1 font-mono ${
                isDanger ? "text-rose-400" : isWarning ? "text-amber-400" : "text-emerald-400"
              }`}>
                {marginPct}%
              </div>
              <div className="text-[11px] font-bold mt-1 text-center">
                {isDanger
                  ? "🛑 STOP! WALKAWAY LIMIT"
                  : isWarning
                  ? "⚠️ OPREZ — BLIZU LIMITA"
                  : "✅ SIGURNA PROFITABILNA ZONA"}
              </div>
            </div>
          </div>

          {/* AKCIJSKA DUGMAD ZA SPUŠTANJE CIJENE */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-300">
              <span>Brzi koraci sniženja prema ZJN BiH:</span>
              <span className="text-slate-400 font-normal">
                Proc. troškovi: {new Intl.NumberFormat("bs-BA").format(internalCost)} KM
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                onClick={() => handleStepDown(minStep05)}
                disabled={isDanger}
                className="h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold flex flex-col items-center justify-center text-sm shadow-md"
              >
                <span>-0.5% (Min. korak)</span>
                <span className="text-[11px] font-mono font-normal opacity-90">
                  -{new Intl.NumberFormat("bs-BA").format(minStep05)} KM
                </span>
              </Button>

              <Button
                onClick={() => handleStepDown(step10)}
                disabled={isDanger}
                className="h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex flex-col items-center justify-center text-sm shadow-md"
              >
                <span>-1.0% (Agresivni korak)</span>
                <span className="text-[11px] font-mono font-normal opacity-90">
                  -{new Intl.NumberFormat("bs-BA").format(step10)} KM
                </span>
              </Button>

              <Button
                onClick={() => {
                  setCurrentBid(estValue);
                  setTimeLeftSeconds(600);
                  setIsRunning(false);
                }}
                variant="outline"
                className="h-14 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Resetuj licitaciju
              </Button>
            </div>
          </div>

          {/* LOG RUNDI NA AUKCIJI */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Historijat naših koraka u ovoj aukciji ({bidHistory.length}):
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs font-mono">
              {bidHistory.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded bg-slate-900/60 border border-slate-800"
                >
                  <span className="text-slate-400">Korak #{b.round} ({b.time})</span>
                  <span className="font-bold text-white">
                    {new Intl.NumberFormat("bs-BA").format(b.amount)} {currency}
                  </span>
                  <span className="text-rose-400">-{b.discountPct}%</span>
                  <span className={b.marginPct < minMarginPct ? "text-rose-400 font-bold" : "text-emerald-400"}>
                    Marža: {b.marginPct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
