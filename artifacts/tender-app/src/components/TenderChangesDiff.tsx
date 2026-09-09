import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
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
  oldValue: string;
  newValue: string;
  changedAt: string;
  impactLevel: "high" | "medium" | "low";
  description: string;
};

type QuestionAnswer = {
  id: string;
  questionNumber: number;
  questionDate: string;
  questionText: string;
  answerText: string;
  answerDate: string;
  affectsClarification: boolean;
};

export function TenderChangesDiff({ tenderId, tenderTitle, deadline }: TenderChangesDiffProps) {
  const [expandedQA, setExpandedQA] = useState<Record<string, boolean>>({ "qa-1": true });

  // Sample or real data for amendments & Q&A
  const changes: ChangeItem[] = [
    {
      id: "ch-1",
      field: "deadline",
      label: "Produženje roka za prijem ponuda",
      oldValue: "18.03.2026. godine do 11:00h",
      newValue: "28.03.2026. godine do 12:00h",
      changedAt: "2026-03-05T14:30:00Z",
      impactLevel: "high",
      description: "Ugovorni organ je usvojio zahtjev ponuđača za produženjem roka radi pribavljanja inostranih potvrda o reosiguranju.",
    },
    {
      id: "ch-2",
      field: "technical_spec",
      label: "Izmjena tehničke specifikacije (Član 7. TD)",
      oldValue: "Zahtijevano posjedovanje minimalno 15 vlastitih servisnih radionica.",
      newValue: "Prihvata se posjedovanje vlastitih radionica ili ugovora o poslovno-tehničkoj saradnji sa ovlaštenim servisima.",
      changedAt: "2026-03-04T10:15:00Z",
      impactLevel: "high",
      description: "Otklonjen diskriminatorni uslov koji je ograničavao konkurenciju u skladu sa članom 54. ZJN BiH.",
    },
    {
      id: "ch-3",
      field: "guarantee",
      label: "Smanjenje iznosa garancije za ozbiljnost ponude",
      oldValue: "5% procijenjene vrijednosti nabavke",
      newValue: "2% procijenjene vrijednosti nabavke (zakonski maksimum)",
      changedAt: "2026-03-02T09:00:00Z",
      impactLevel: "medium",
      description: "Usklađen iznos garancije sa preporukom Agencije za javne nabavke BiH.",
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
    },
    {
      id: "qa-2",
      questionNumber: 2,
      questionDate: "2026-03-02T15:45:00Z",
      questionText: "S obzirom na to da je rok za dostavu originalnih polica 3 dana od potpisa ugovora, da li je moguće produžiti taj rok na 7 radnih dana?",
      answerText: "Ugovorni organ ostaje pri zahtjevu iz tenderske dokumentacije. Rok od 3 radna dana je nužan radi kontinuiteta pokrića osiguranja voznog parka bez prekida.",
      answerDate: "2026-03-03T13:30:00Z",
      affectsClarification: false,
    }
  ];

  const toggleQA = (id: string) => {
    setExpandedQA(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* 1. Status Alert Header */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
        <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-950">Aktivno praćenje izmjena tenderske dokumentacije</h4>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            Sistem automatski upoređuje verzije tenderske dokumentacije i preuzima zvanična pojašnjenja naručioca sa portala javnih nabavki (EJN). Evidentirane su <strong>3 izmjene TD</strong> i <strong>2 zvanična odgovora na pitanja</strong>.
          </p>
        </div>
      </div>

      {/* 2. Version Diffing Card */}
      <Card className="border-gray-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-primary" />
              <span>Hronologija izmjena TD (Version Diff)</span>
            </CardTitle>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
              Verzija 1.3 (Zadnja važeća)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {changes.map((item) => (
            <div key={item.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-900">{item.label}</span>
                  <Badge className={
                    item.impactLevel === "high"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }>
                    {item.impactLevel === "high" ? "Kritična izmjena" : "Dopuna"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDate(item.changedAt)}</span>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                {item.description}
              </p>

              {/* Before and After Comparison Block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-red-50/70 border border-red-200 rounded-lg text-xs">
                  <span className="font-bold text-red-900 block mb-1">❌ Raniji tekst (Poništeno):</span>
                  <span className="text-red-800 line-through">{item.oldValue}</span>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs">
                  <span className="font-bold text-emerald-900 block mb-1">✅ Novi važeći tekst:</span>
                  <span className="text-emerald-800 font-medium">{item.newValue}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 3. Official Q&A Section */}
      <Card className="border-gray-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <span>Pitanja i odgovori naručioca sa Portala javnih nabavki</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => toggleQA(q.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                    P{q.questionNumber}
                  </span>
                  <span className="font-medium text-sm text-gray-900 line-clamp-1">{q.questionText}</span>
                </div>
                {expandedQA[q.id] ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {expandedQA[q.id] && (
                <div className="p-4 pt-1 bg-gray-50/60 border-t border-gray-100 space-y-3">
                  <div className="text-xs text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                    <span className="font-bold text-gray-900 block mb-1">Pitanje ponuđača:</span>
                    <p className="leading-relaxed">{q.questionText}</p>
                    <span className="text-[10px] text-gray-400 block mt-1">Postavljeno: {formatDate(q.questionDate)}</span>
                  </div>

                  <div className="text-xs text-emerald-900 bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                    <span className="font-bold text-emerald-950 block mb-1">Zvanični odgovor ugovornog organa:</span>
                    <p className="leading-relaxed font-medium">{q.answerText}</p>
                    <span className="text-[10px] text-emerald-700 block mt-1">Objavljeno na portalu: {formatDate(q.answerDate)}</span>
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
