import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Clock, FileText, Send, AlertCircle, FileSearch, ShieldCheck, Download } from "lucide-react";
import { toast } from "sonner";

interface PostSubmissionTrackerProps {
  tenderId: string;
  tenderTitle: string;
  contractingAuth: string;
  externalId?: string | null;
}

export function PostSubmissionTracker({ tenderId, tenderTitle, contractingAuth, externalId }: PostSubmissionTrackerProps) {
  const [currentStage, setCurrentStage] = useState<number>(2); // 1: Predato, 2: Otvaranje ponuda, 3: E-Aukcija, 4: Odluka, 5: Ugovor
  const [protocolNumber, setProtocolNumber] = useState("04-14-1120/26");
  const [competitorPriceInput, setCompetitorPriceInput] = useState("48.200 KM (Sarajevo Osiguranje)");

  const stages = [
    { id: 1, name: "Predaja ponude", desc: "Ponuda zaprimljena na pisarnici / EJN portalu" },
    { id: 2, name: "Otvaranje ponuda", desc: "Zapisnik sa otvaranja i rang lista cijena" },
    { id: 3, name: "E-Aukcija", desc: "Zakazan termin elektronskog nadmetanja" },
    { id: 4, name: "Odluka o izboru", desc: "Pristigla zvanična odluka ugovornog organa" },
    { id: 5, name: "Ugovor / Žalba", desc: "Potpisivanje ugovora ili pravni lijek" },
  ];

  const handleDownloadInspectionRequest = () => {
    // Generiši tekstualni/Word zahtjev za uvid u ponudu shodno čl. 11 ZJN BiH
    const text = `PREDMET: ZAHTJEV ZA UVID U PONUDU IZABRANOG PONUĐAČA\n(Shodno članu 11. Zakona o javnim nabavkama BiH)\n\nUGOVORNI ORGAN: ${contractingAuth}\nPREDMET NABAVKE: ${tenderTitle}\nBROJ OBAVJEŠTENJA: ${externalId || "N/A"}\n\nPoštovani,\n\nKao zainteresovani ponuđač koji je blagovremeno predao ponudu u predmetnom postupku javne nabavke, ovim putem podnosimo formalni Zahtjev za uvid u ponudu izabranog ponuđača, kao i u kompletan zapisnik o ocjeni ponuda komisije.\n\nUvid tražimo radi provjere ispunjenosti kvalifikacionih uslova, tehničke specifikacije i ponuđenih cijena, u zakonskom roku od 2 dana od prijema odluke.\n\nMolimo da nam omogućite uvid u prostorijama ugovornog organa ili dostavite kopiju na e-mail: tenderi@asacentral.ba.\n\nS poštovanjem,\nASA CENTRAL OSIGURANJE d.d.`;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Zahtjev_za_uvid_u_ponudu_${(externalId || "tender").replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("Kreiran zahtjev za uvid u ponudu!", {
      description: "Tekst zahtjeva prema Članu 11. ZJN BiH je preuzet i spreman za slanje naručiocu.",
    });
  };

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-3 border-b">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-primary" />
            Praćenje toka postupka nakon predaje ponude (Post-Submission Tracker)
          </CardTitle>
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
            Protokol: {protocolNumber}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-6">
        {/* FAZE POSTUPKA */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {stages.map((stage) => {
            const isDone = stage.id < currentStage;
            const isCurrent = stage.id === currentStage;
            return (
              <div
                key={stage.id}
                onClick={() => setCurrentStage(stage.id)}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                    : isDone
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-gray-200 bg-gray-50 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold text-gray-500">#{stage.id}</span>
                  {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {isCurrent && <Clock className="w-4 h-4 text-primary animate-pulse" />}
                </div>
                <div className="font-bold text-xs text-gray-900">{stage.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{stage.desc}</div>
              </div>
            );
          })}
        </div>

        {/* AKTIVNA FAZA AKCIJE */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="font-bold text-sm text-gray-900">
                Pravna zaštita i kontrola konkurentskih ponuda
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Ukoliko je ponuda konkurenta sumnjivo niska ili postoje indicije neregularnosti, podnesite formalni zahtjev za uvid shodno ZJN BiH.
              </div>
            </div>

            <Button
              onClick={handleDownloadInspectionRequest}
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/5 text-xs font-semibold gap-2 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Zahtjev za uvid u ponudu (Čl. 11 ZJN)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
