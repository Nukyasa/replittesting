import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  FileCheck,
  Building,
  Shield,
  FileText,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ComplianceItem {
  id: string;
  category: "licna" | "ekonomska" | "tehnicka" | "garancije";
  title: string;
  legalBasis: string;
  requiredForm: string;
  validityDays?: number;
  status: "ready" | "in_progress" | "missing";
  notes?: string;
}

const DEFAULT_CHECKLIST: ComplianceItem[] = [
  // Lična sposobnost (Član 45)
  {
    id: "c45_izjava",
    category: "licna",
    title: "Izjava o ispunjenosti uslova iz Člana 45. ZJN BiH",
    legalBasis: "Član 45. stav (1) ZJN BiH",
    requiredForm: "Ovjerena kod notara ili nadležnog općinskog organa",
    status: "ready",
    notes: "Potpisana od strane ovlaštenog lica ASA Central",
  },
  {
    id: "c45_porezi_fbih",
    category: "licna",
    title: "Uvjerenje Porezne uprave o izmirenim direktnim porezima",
    legalBasis: "Član 45. stav (2) tačka c) ZJN BiH",
    requiredForm: "Original ili ovjerena kopija (ne starija od 3 mjeseca)",
    status: "ready",
    notes: "Izvaditi u Poreznoj ispostavi Novo Sarajevo",
  },
  {
    id: "c45_uio",
    category: "licna",
    title: "Uvjerenje UIO BiH o izmirenim indirektnim porezima (PDV)",
    legalBasis: "Član 45. stav (2) tačka d) ZJN BiH",
    requiredForm: "Original ili ovjerena kopija (ne starija od 3 mjeseca)",
    status: "ready",
  },
  // Ekonomska i finansijska sposobnost (Član 46)
  {
    id: "c46_azobih",
    category: "ekonomska",
    title: "Dozvola Agencije za nadzor osiguranja (AZOBiH)",
    legalBasis: "Član 46. stav (1) ZJN BiH & Zakon o osiguranju",
    requiredForm: "Rješenje o upisu i dozvola za vršenje poslova neživotnog osiguranja",
    status: "ready",
    notes: "Trajna dozvola za osiguranje i tehnički pregled",
  },
  {
    id: "c46_fia_bilans",
    category: "ekonomska",
    title: "Bilans stanja i uspjeha ovjeren od FIA / APIF",
    legalBasis: "Član 46. stav (2) ZJN BiH",
    requiredForm: "GFO izvještaj za posljednju finansijsku godinu",
    status: "ready",
  },
  {
    id: "c46_solventnost",
    category: "ekonomska",
    title: "Potvrde poslovnih banaka o likvidnosti računa",
    legalBasis: "Član 46. ZJN BiH",
    requiredForm: "Originali od glavnih transakcijskih banaka (ASA Banka d.d.)",
    status: "in_progress",
    notes: "Zahtjev upućen banci, čekamo potpis",
  },
  // Tehnička i profesionalna sposobnost (Član 48-50)
  {
    id: "c48_reference",
    category: "tehnicka",
    title: "Spisak izvršenih ugovora u prethodne 3 godine (Reference)",
    legalBasis: "Član 48. i 50. ZJN BiH",
    requiredForm: "Tabela sa potvrdama o uredno izvršenim uslugama od naručilaca",
    status: "in_progress",
    notes: "Potrebno priložiti minimalno 2 potvrde za sličan vozni park",
  },
  {
    id: "c48_stanice",
    category: "tehnicka",
    title: "Mreža stanica tehničkog pregleda i servisa",
    legalBasis: "Član 48. stav (1) tačka b) ZJN BiH",
    requiredForm: "Vlastita rješenja ili ugovori o saradnji (ASA Rent / partneri)",
    status: "ready",
  },
  // Garancije i obrasci
  {
    id: "c61_garancija",
    category: "garancije",
    title: "Bankarska garancija za ozbiljnost ponude",
    legalBasis: "Član 61. ZJN BiH",
    requiredForm: "Bezuslovna, na prvi poziv, u originalu",
    status: "in_progress",
    notes: "Provjeriti tačan tekst garancije prema Aneksu TD",
  },
  {
    id: "obrazac_cijene",
    category: "garancije",
    title: "Popunjen obrazac za cijenu ponude (Aneks ponude)",
    legalBasis: "Član 58. ZJN BiH",
    requiredForm: "Potpisan, parafiran i pečatiran original",
    status: "ready",
  },
];

interface TenderComplianceMatrixProps {
  tenderId: string;
  tenderTitle: string;
  contractingAuth: string;
}

export function TenderComplianceMatrix({
  tenderId,
  tenderTitle,
  contractingAuth,
}: TenderComplianceMatrixProps) {
  const [items, setItems] = useState<ComplianceItem[]>(DEFAULT_CHECKLIST);

  const toggleStatus = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextStatus = item.status === "ready" ? "in_progress" : item.status === "in_progress" ? "missing" : "ready";
        return { ...item, status: nextStatus };
      })
    );
  };

  const readyCount = items.filter((i) => i.status === "ready").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const missingCount = items.filter((i) => i.status === "missing").length;
  const percentReady = Math.round((readyCount / items.length) * 100);

  const handlePrint = () => {
    window.print();
  };

  const categories = [
    { key: "licna", label: "I. Lična sposobnost (Član 45. ZJN)", icon: Shield },
    { key: "ekonomska", label: "II. Ekonomska i finansijska sposobnost (Član 46. ZJN)", icon: Building },
    { key: "tehnicka", label: "III. Tehnička i profesionalna sposobnost (Član 48-50. ZJN)", icon: FileText },
    { key: "garancije", label: "IV. Ponuda, obrasci i garancija (Član 58. i 61. ZJN)", icon: FileCheck },
  ];

  return (
    <Card className="border shadow-sm print:border-none print:shadow-none">
      <CardHeader className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white rounded-t-xl pb-5 print:bg-none print:text-black">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-400/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 print:hidden">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Matrica usklađenosti &amp; Kontrolni list ponude
                <Badge className="bg-emerald-500 text-slate-950 font-bold text-xs print:hidden">ZJN BiH</Badge>
              </CardTitle>
              <CardDescription className="text-emerald-200 text-xs mt-0.5 print:text-gray-600">
                Radni nalog za pakovanje koverte sa ponudom ASA Central bez rizika od formalnog odbacivanja
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 shrink-0 print:hidden"
          >
            <Printer className="w-4 h-4 mr-2" />
            Štampaj radni nalog
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Progress summary */}
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Spremnost dokumentacije za predaju:
            </span>
            <span className="text-sm font-extrabold text-emerald-700">{percentReady}% kompletirano</span>
          </div>
          <Progress value={percentReady} className="h-2.5 bg-gray-200" />
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> {readyCount} Spremno
            </span>
            <span className="flex items-center gap-1.5 text-amber-600">
              <Clock className="w-3.5 h-3.5" /> {inProgressCount} U pripremi
            </span>
            {missingCount > 0 && (
              <span className="flex items-center gap-1.5 text-rose-600">
                <AlertCircle className="w-3.5 h-3.5" /> {missingCount} Nedostaje
              </span>
            )}
          </div>
        </div>

        {/* Categorized Checklist */}
        <div className="space-y-6">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category === cat.key);
            const Icon = cat.icon;
            return (
              <div key={cat.key} className="space-y-3">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                  <Icon className="w-4 h-4 text-blue-600" />
                  {cat.label}
                </h3>
                <div className="divide-y border rounded-xl overflow-hidden bg-white">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleStatus(item.id)}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 cursor-pointer transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">{item.title}</span>
                          <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                            {item.legalBasis}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{item.requiredForm}</p>
                        {item.notes && (
                          <p className="text-[11px] text-blue-700 font-medium italic">
                            Napomena tima: {item.notes}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {item.status === "ready" && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Spremno za kovertu
                          </Badge>
                        )}
                        {item.status === "in_progress" && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-xs">
                            <Clock className="w-3 h-3 mr-1 text-amber-600" /> U pripremi
                          </Badge>
                        )}
                        {item.status === "missing" && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-semibold text-xs">
                            <AlertCircle className="w-3 h-3 mr-1 text-rose-600" /> Nedostaje
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
