import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Scale,
  Copy,
  Check,
  FileDown,
  AlertTriangle,
  BookOpen,
  Sparkles,
  DollarSign,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface UrzAppealGeneratorProps {
  tenderId: string;
  tenderTitle: string;
  contractingAuth: string;
  estimatedValue?: number | null;
}

export function UrzAppealGenerator({
  tenderId,
  tenderTitle,
  contractingAuth,
  estimatedValue,
}: UrzAppealGeneratorProps) {
  const [violationType, setViolationType] = useState("tehnicki_cenzus");
  const [customGrounds, setCustomGrounds] = useState("");
  const [copied, setCopied] = useState(false);
  const [appealData, setAppealData] = useState<{
    appealText: string;
    feeKm: number;
    relevantDecisions: Array<{
      caseNumber: string;
      summary: string;
      outcome: string;
      legalBasis: string;
    }>;
  } | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      return customFetch<{
        appealText: string;
        feeKm: number;
        relevantDecisions: Array<{
          caseNumber: string;
          summary: string;
          outcome: string;
          legalBasis: string;
        }>;
      }>("/api/resolutions/generate-appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenderId,
          violationType,
          customGrounds,
        }),
      });
    },
    onSuccess: (data) => {
      setAppealData(data);
      toast.success("Nacrt žalbe URŽ-u je uspješno generisan!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Greška pri generisanju žalbe");
    },
  });

  const handleCopy = () => {
    if (!appealData?.appealText) return;
    navigator.clipboard.writeText(appealData.appealText);
    setCopied(true);
    toast.success("Nacrt žalbe je kopiran u međuspremnik!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!appealData?.appealText) return;
    const blob = new Blob([appealData.appealText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `URZ_Zalba_ASA_Central_${tenderId.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Preuzet nacrt žalbe (.txt)");
  };

  const violationOptions = [
    {
      id: "tehnicki_cenzus",
      label: "Član 54. ZJN — Diskriminatorni tehnički uslovi",
      desc: "Zahtjevi koji upućuju na postojećeg ponuđača ili neopravdano sužavaju konkurenciju",
    },
    {
      id: "servisne_stanice",
      label: "Uski radijus stanica tehničkog pregleda",
      desc: "Zabranjeno uslovljavanje vlastitih stanica bez prava na partnersku mrežu",
    },
    {
      id: "previsoke_reference",
      label: "Član 48. ZJN — Nesrazmjerne reference premije",
      desc: "Traženi minimalni promet višestruko veći od procijenjene vrijednosti nabavke",
    },
    {
      id: "podugovaranje",
      label: "Član 73. ZJN — Ograničavanje podugovarača",
      desc: "Nezakonita zabrana oslanjanja na tehničke kapacitete partnera",
    },
  ];

  return (
    <Card className="border shadow-sm">
      <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-t-xl pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                1-Klik URŽ Žalbeni Generator
                <Badge className="bg-amber-500 text-slate-950 font-bold text-xs">Pravna zaštita</Badge>
              </CardTitle>
              <CardDescription className="text-slate-300 text-xs mt-0.5">
                Automatska izrada pravnog podneska po Članu 54. i 101. ZJN BiH sa povezivanjem stvarne sudske prakse URŽ-a
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Odabir spornog uslova */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
            1. Odaberite tip povrede tenderske dokumentacije:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {violationOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setViolationType(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  violationType === opt.id
                    ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 shadow-xs"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                }`}
              >
                <div className="font-semibold text-sm text-gray-900 flex items-center justify-between w-full">
                  <span>{opt.label}</span>
                  {violationType === opt.id && <Check className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Dodatne primjedbe */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
            2. Specifični sporni član TD ili opis (opcionalno):
          </label>
          <Textarea
            value={customGrounds}
            onChange={(e) => setCustomGrounds(e.target.value)}
            placeholder="Npr. Tačka 5.2 TD: Ugovorni organ traži da ponuđač ima stanicu tehničkog pregleda najviše 3 km od sjedišta organa, što favorizuje isključivo jednog lokalnog ponuđača..."
            rows={3}
            className="text-xs"
          />
        </div>

        {/* Dugme za generisanje */}
        <div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 shadow-sm"
          >
            <Sparkles className={`w-4 h-4 mr-2 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            {generateMutation.isPending ? "Sastavljanje pravnog podneska..." : "Generiši nacrt žalbe prema URŽ-u"}
          </Button>
        </div>

        {/* Prikaz generisane žalbe */}
        {appealData && (
          <div className="space-y-5 pt-4 border-t border-gray-100">
            {/* KPI Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border rounded-lg">
                <span className="text-[11px] text-gray-500 font-medium block">Zakonska naknada za žalbu</span>
                <span className="text-base font-bold text-slate-900">
                  {appealData.feeKm.toLocaleString("bs-BA")} KM
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">Po Čl. 108. ZJN BiH</span>
              </div>
              <div className="p-3 bg-slate-50 border rounded-lg">
                <span className="text-[11px] text-gray-500 font-medium block">Pravni osnov</span>
                <span className="text-base font-bold text-indigo-900">Član 54. i 101. ZJN</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">Blagovremena žalba na TD</span>
              </div>
              <div className="p-3 bg-slate-50 border rounded-lg">
                <span className="text-[11px] text-gray-500 font-medium block">URŽ Presedani</span>
                <span className="text-base font-bold text-emerald-700">
                  {appealData.relevantDecisions.length} citirane odluke
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">Ustaljena sudska praksa</span>
              </div>
            </div>

            {/* Presedani box */}
            {appealData.relevantDecisions.length > 0 && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Citirana stvarna rješenja URŽ-a iz baze presedana:
                </h4>
                <div className="space-y-2">
                  {appealData.relevantDecisions.slice(0, 2).map((d, i) => (
                    <div key={i} className="text-xs text-emerald-800 bg-white/70 p-2.5 rounded border border-emerald-100">
                      <span className="font-bold text-emerald-950">{d.caseNumber}:</span> {d.summary} —{" "}
                      <span className="font-semibold text-emerald-700">{d.outcome}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prikaz teksta žalbe */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nacrt pravnog podneska (spreman za pravnu službu):
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs">
                    {copied ? <Check className="w-3.5 h-3.5 mr-1 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copied ? "Kopirano" : "Kopiraj tekst"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} className="text-xs">
                    <FileDown className="w-3.5 h-3.5 mr-1" />
                    Preuzmi (.txt)
                  </Button>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed border border-slate-800 select-all">
                {appealData.appealText}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
