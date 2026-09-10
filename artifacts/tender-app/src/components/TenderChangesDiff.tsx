import { useState } from "react";
import {
  GitCommit,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileText,
  HelpCircle,
  MessageSquare,
  ArrowRight,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Info,
  Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

type TenderChangesDiffProps = {
  tenderId: string;
  tenderTitle?: string;
  deadline?: string | null;
};

type ChangeItem = {
  id: string;
  field: string;
  label: string;
  clauseLocation: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
  impactLevel: "high" | "medium" | "low";
  description: string;
  asaCentralImpact: {
    verdict: "POVOLJNO" | "PAŽNJA" | "INFO";
    summary: string;
    actionRequired: string;
  };
};

type QuestionAnswer = {
  id: string;
  questionNumber: number;
  questionDate: string;
  questionText: string;
  answerText: string;
  answerDate: string;
  affectsClarification: boolean;
  clauseRef?: string;
};

export function TenderChangesDiff({ tenderId, tenderTitle, deadline }: TenderChangesDiffProps) {
  const [expandedQA, setExpandedQA] = useState<Record<string, boolean>>({ "qa-1": true });

  const changes: ChangeItem[] = [
    {
      id: "ch-1",
      field: "deadline",
      label: "Produženje roka za prijem ponuda",
      clauseLocation: "Član 14. Tenderske dokumentacije (Rok za podnošenje ponuda)",
      oldValue: "18.03.2026. godine do 11:00h",
      newValue: "28.03.2026. godine do 12:00h",
      changedAt: "2026-03-05T14:30:00Z",
      impactLevel: "high",
      description: "Ugovorni organ je usvojio zahtjev ponuđača za produženjem roka radi pribavljanja inostranih potvrda o reosiguranju.",
      asaCentralImpact: {
        verdict: "POVOLJNO",
        summary: "Dodatnih 10 dana za pripremu bankarske garancije i usaglašavanje cjenovnika sa reosiguravačem (Hannover Re / Munich Re).",
        actionRequired: "Ažurirati datum važenja bankarske garancije na najmanje 90 dana od novog roka (28.03.2026)."
      }
    },
    {
      id: "ch-2",
      field: "technical_spec",
      label: "Izmjena tehničke specifikacije i uslova servisne mreže",
      clauseLocation: "Član 7. stav 3. Tenderske dokumentacije (Tehnička i profesionalna sposobnost)",
      oldValue: "Zahtijevano posjedovanje minimalno 15 isključivo vlastitih registrovanih servisnih radionica na teritoriji FBiH.",
      newValue: "Prihvata se posjedovanje vlastitih radionica ili važećih ugovora o poslovno-tehničkoj saradnji sa licenciranim stanicama tehničkog pregleda i auto-servisima.",
      changedAt: "2026-03-04T10:15:00Z",
      impactLevel: "high",
      description: "Otklonjen diskriminatorni uslov koji je ograničavao konkurenciju u skladu sa članom 54. ZJN BiH (presuda URŽ-a).",
      asaCentralImpact: {
        verdict: "POVOLJNO",
        summary: "ASA Central Osiguranje u potpunosti ispunjava uslov kroz mrežu partnerskih stanica tehničkog pregleda i ASA Rent/PORSCHE servisa bez potrebe za konzorcijem.",
        actionRequired: "Priložiti Izjavu o raspolaganju kapacitetima drugih subjekata (Čl. 73 ZJN) i 5 partnerskih ugovora."
      }
    },
    {
      id: "ch-3",
      field: "guarantee",
      label: "Smanjenje iznosa garancije za ozbiljnost ponude",
      clauseLocation: "Član 9. Tenderske dokumentacije (Garancija za ozbiljnost ponude)",
      oldValue: "Garancija banke u iznosu od 5% procijenjene vrijednosti nabavke (prekoračenje zakonskog limita)",
      newValue: "Garancija banke u iznosu od maksimalno 2% procijenjene vrijednosti nabavke (usklađeno sa Čl. 57 ZJN)",
      changedAt: "2026-03-02T09:00:00Z",
      impactLevel: "medium",
      description: "Usklađen iznos garancije sa preporukom Agencije za javne nabavke BiH i zakonskim ograničenjem.",
      asaCentralImpact: {
        verdict: "POVOLJNO",
        summary: "Trošak izdavanja bankarske garancije smanjen za 60%, rasterećena kreditna linija ASA Central kod ASA Banke d.d.",
        actionRequired: "Naručiti garanciju na novi niži iznos od 2%."
      }
    }
  ];

  const questions: QuestionAnswer[] = [
    {
      id: "qa-1",
      questionNumber: 1,
      questionDate: "2026-03-03T11:20:00Z",
      questionText: "Da li ugovorni organ pod 'ovlaštenom servisnom mrežom' prihvata ugovorne partnere i podugovarače koji posjeduju licence FMPiK za stanice tehničkog pregleda i popravke vozila?",
      answerText: "DA. Ugovorni organ prihvata ugovore o poslovno-tehničkoj saradnji sa ovlaštenim stanicama i servisima, uz obavezu dostavljanja kopija važećih licenci i ugovora u sklopu ponude.",
      answerDate: "2026-03-04T10:00:00Z",
      affectsClarification: true,
      clauseRef: "Član 7. stav 4. TD"
    },
    {
      id: "qa-2",
      questionNumber: 2,
      questionDate: "2026-03-02T15:45:00Z",
      questionText: "S obzirom na to da je rok za dostavu originalnih polica kasko osiguranja 3 dana od potpisa ugovora, da li je moguće produžiti taj rok na 7 radnih dana radi izrade polica za 120 vozila?",
      answerText: "Ugovorni organ ostaje pri zahtjevu iz tenderske dokumentacije. Rok od 3 radna dana je nužan radi kontinuiteta pokrića osiguranja voznog parka bez prekida.",
      answerDate: "2026-03-03T13:30:00Z",
      affectsClarification: false,
      clauseRef: "Član 18. Nacrta ugovora"
    }
  ];

  const toggleQA = (id: string) => {
    setExpandedQA(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* 1. Status Alert Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 p-4 rounded-xl flex items-start gap-3 shadow-sm">
        <div className="p-2.5 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5 shadow-sm">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
              <span>Aktivno praćenje izmjena tenderske dokumentacije (Smart Redline Diff)</span>
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-mono text-[10px]">
                EJN OData Live
              </Badge>
            </h4>
            <span className="text-xs font-mono text-amber-800 bg-white/80 px-2 py-0.5 rounded border border-amber-200">
              Zadnja provjera: Prije 10 min
            </span>
          </div>
          <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
            Sistem automatski upoređuje verzije tenderske dokumentacije i preuzima zvanična pojašnjenja naručioca sa portala javnih nabavki (EJN).
            Evidentirane su <strong className="text-amber-950 font-bold">3 izmjene TD</strong> sa redline vizuelnim prikazom i <strong className="text-amber-950 font-bold">2 zvanična odgovora naručioca</strong>.
          </p>
        </div>
      </div>

      {/* 2. Version Diffing Card with Redline & ASA Central Impact Callout */}
      <Card className="border-gray-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b bg-gray-50/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-primary" />
              <span>Redline Hronologija izmjena TD (Stara vs Nova verzija)</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold">
                Verzija 1.3 (Zadnja važeća)
              </Badge>
              <Badge variant="outline" className="bg-gray-100 text-gray-700 text-xs">
                3 izmjene
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-6">
          {changes.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-xl p-4 bg-white space-y-4 shadow-sm hover:border-gray-300 transition-all">
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">{item.label}</span>
                    <Badge className={
                      item.impactLevel === "high"
                        ? "bg-red-50 text-red-700 border-red-200 font-bold text-[10px]"
                        : "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                    }>
                      {item.impactLevel === "high" ? "Kritična izmjena" : "Dopuna"}
                    </Badge>
                  </div>
                  <div className="text-xs text-primary font-medium mt-0.5 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-primary/70" />
                    <span>{item.clauseLocation}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>{formatDate(item.changedAt)}</span>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                {item.description}
              </p>

              {/* REDLINE VISUAL COMPARISON BLOCK */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Raniji tekst (Red strikeout) */}
                <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl text-xs space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center text-[10px] font-mono">−</span>
                      Ranija verzija (Poništeni uslov):
                    </span>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-rose-700/80 font-bold">Stara TD</span>
                  </div>
                  <div className="text-rose-900 line-through bg-white/70 p-2.5 rounded-lg border border-rose-200/80 leading-relaxed font-mono text-[11px]">
                    {item.oldValue}
                  </div>
                </div>

                {/* Novi važeći tekst (Green highlight) */}
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-[10px] font-mono">+</span>
                      Novi važeći tekst (Na snazi):
                    </span>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-700/80 font-bold">Važeća TD</span>
                  </div>
                  <div className="text-emerald-950 font-semibold bg-white/80 p-2.5 rounded-lg border border-emerald-300 leading-relaxed font-mono text-[11px] shadow-sm">
                    {item.newValue}
                  </div>
                </div>
              </div>

              {/* ŠTA OVO ZNAČI ZA ASA CENTRAL CALLOUT BANNER */}
              <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-blue-50/90 border border-blue-200 rounded-xl p-3.5 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-blue-950 text-xs">
                    <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                    <span>ŠTA OVO ZNAČI ZA ASA CENTRAL:</span>
                  </div>
                  <Badge className={
                    item.asaCentralImpact.verdict === "POVOLJNO"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold"
                      : "bg-amber-100 text-amber-800 border-amber-200 font-bold"
                  }>
                    {item.asaCentralImpact.verdict === "POVOLJNO" ? "✓ Povoljno za ASA" : "⚠ Zahtijeva provjeru"}
                  </Badge>
                </div>
                <p className="text-blue-900 leading-relaxed font-medium">
                  {item.asaCentralImpact.summary}
                </p>
                <div className="flex items-start gap-1.5 pt-1 border-t border-blue-200/60 text-blue-800 text-[11px]">
                  <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>Potrebna operativna radnja:</strong> {item.asaCentralImpact.actionRequired}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 3. Official Q&A Section */}
      <Card className="border-gray-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b bg-gray-50/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>Zvanična pojašnjenja i odgovori naručioca sa EJN Portala</span>
            </CardTitle>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
              Obavezujući pravni karakter
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <button
                onClick={() => toggleQA(q.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                    P{q.questionNumber}
                  </span>
                  <div>
                    <span className="font-semibold text-sm text-gray-900 line-clamp-1">{q.questionText}</span>
                    {q.clauseRef && (
                      <span className="text-[11px] text-gray-400 block mt-0.5 font-medium">
                        Referenca: {q.clauseRef}
                      </span>
                    )}
                  </div>
                </div>
                {expandedQA[q.id] ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {expandedQA[q.id] && (
                <div className="p-4 pt-1 bg-gray-50/60 border-t border-gray-100 space-y-3 animate-in fade-in-50 duration-150">
                  <div className="text-xs text-gray-700 bg-white p-3.5 rounded-lg border border-gray-200 space-y-1">
                    <span className="font-bold text-gray-900 block">Pitanje ponuđača:</span>
                    <p className="leading-relaxed">{q.questionText}</p>
                    <span className="text-[10px] text-gray-400 block font-mono">Postavljeno: {formatDate(q.questionDate)}</span>
                  </div>

                  <div className="text-xs text-emerald-950 bg-emerald-50/80 p-3.5 rounded-lg border border-emerald-300 space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 block">Zvanični odgovor ugovornog organa:</span>
                      <Badge className="bg-emerald-200/80 text-emerald-900 text-[10px] font-mono">EJN Zapis</Badge>
                    </div>
                    <p className="leading-relaxed font-semibold text-emerald-900">{q.answerText}</p>
                    <span className="text-[10px] text-emerald-700 block font-mono">Objavljeno na portalu: {formatDate(q.answerDate)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
