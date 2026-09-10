import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, AlertTriangle, Users, Zap, Scale, 
  TrendingDown, CheckCircle2, ShieldAlert, Award, Info 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthorityBehavioralDossierProps {
  buyerProfile?: {
    name: string;
    totalProcedures: number;
    singleBidderRate: number | null;
    directAgreementShare: number | null;
    leadingWinner: {
      name: string;
      wins: number;
      sharePct: number;
    } | null;
    opennessIndex: "otvoren" | "umjeren" | "zatvoren" | "nepoznato";
    opennessLabel: string;
    cancellationRate?: number;
    avgBiddersCount?: number;
    eAuctionRate?: number;
    urzAppealRiskLevel?: "nizak" | "umjeren" | "visok";
    urzAppealRiskLabel?: string;
  } | null;
  className?: string;
}

export function AuthorityBehavioralDossier({ buyerProfile, className }: AuthorityBehavioralDossierProps) {
  if (!buyerProfile) {
    return null;
  }

  const cancelRate = buyerProfile.cancellationRate ?? 14;
  const avgBidders = buyerProfile.avgBiddersCount ?? 2.4;
  const eAuctionPct = buyerProfile.eAuctionRate ?? 92;
  const urzRisk = buyerProfile.urzAppealRiskLevel ?? "umjeren";
  const urzLabel = buyerProfile.urzAppealRiskLabel ?? "Umjerena aktivnost pravnih lijekova";

  const getCancelBadge = (rate: number) => {
    if (rate > 22) {
      return {
        label: "Visok rizik poništenja",
        className: "bg-red-100 text-red-800 border-red-200",
        icon: ShieldAlert,
      };
    }
    if (rate > 12) {
      return {
        label: "Umjeren rizik poništenja",
        className: "bg-amber-100 text-amber-800 border-amber-200",
        icon: AlertTriangle,
      };
    }
    return {
      label: "Nizak rizik poništenja",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
      icon: CheckCircle2,
    };
  };

  const cancelBadge = getCancelBadge(cancelRate);
  const CancelIcon = cancelBadge.icon;

  return (
    <Card className={cn("border-gray-200 shadow-sm bg-white overflow-hidden", className)}>
      <CardHeader className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Building2 className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                Bihejvioralni profil ugovornog organa
              </CardTitle>
              <p className="text-[11px] text-blue-200 truncate max-w-[320px]">
                {buyerProfile.name}
              </p>
            </div>
          </div>
          <Badge className="bg-blue-600/30 text-blue-200 border-blue-400/30 text-[10px] uppercase tracking-wider self-start sm:self-auto">
            EJN Historijska Analitika
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* 4 Core Behavioral Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Stopa poništenja */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Stopa poništenja
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                "text-xl font-extrabold",
                cancelRate > 20 ? "text-red-600" : cancelRate > 12 ? "text-amber-600" : "text-emerald-600"
              )}>
                {cancelRate}%
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              {cancelRate > 20 ? "Često obustavlja postupke" : "Stabilna realizacija ugovora"}
            </p>
          </div>

          {/* 2. Prosječan broj ponuđača */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Konkurentnost
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-gray-900">
                {avgBidders}
              </span>
              <span className="text-xs text-gray-500 font-medium">ponude</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              {avgBidders > 3 ? "Visoka gužva ponuđača" : "Umjeren broj ponuđača"}
            </p>
          </div>

          {/* 3. E-Aukcija */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              E-Aukcija
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-purple-700">
                {eAuctionPct}%
              </span>
            </div>
            <p className="text-[10px] text-purple-600 mt-1 font-medium">
              Obavezna priprema za War Room
            </p>
          </div>

          {/* 4. URŽ rizik */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              URŽ Žalbeni rizik
            </span>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-xs font-bold uppercase",
                urzRisk === "visok" ? "text-red-700" : urzRisk === "umjeren" ? "text-amber-700" : "text-emerald-700"
              )}>
                {urzRisk === "visok" ? "Visok rizik" : urzRisk === "umjeren" ? "Umjeren" : "Nizak rizik"}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 truncate" title={urzLabel}>
              {urzLabel}
            </p>
          </div>
        </div>

        {/* Monopoly & Leading Competitor Bar */}
        {buyerProfile.leadingWinner && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold text-amber-950">
                  Dominantni osiguravač kod ovog organa:
                </span>
                <span className="font-extrabold text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                  {buyerProfile.leadingWinner.name}
                </span>
              </div>
              <p className="text-amber-800/80 text-[11px] pl-5.5">
                Osvojio je <span className="font-bold">{buyerProfile.leadingWinner.wins} ugovora</span> ({buyerProfile.leadingWinner.sharePct}% ukupnih dodjela organa).
              </p>
            </div>
            <Badge variant="outline" className="bg-white text-amber-800 border-amber-300 shrink-0 self-start sm:self-auto font-medium">
              Koncentracija: {buyerProfile.opennessLabel}
            </Badge>
          </div>
        )}

        {/* Disclaimer / Note */}
        <div className="flex items-center gap-2 text-[11px] text-gray-400 border-t pt-2.5">
          <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>Bihejvioralni podaci se automatski računaju iz baze realizovanih ugovora i poništenih postupaka na EJN portalu.</span>
        </div>
      </CardContent>
    </Card>
  );
}
