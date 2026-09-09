import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2, CheckCircle2, ShieldCheck, Package, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/hooks/use-auth";

interface BidPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  tender: {
    id: string;
    title: string;
    contractingAuth: string;
    externalId?: string | null;
    estimatedValue?: number | null;
    currency?: string | null;
  };
}

export function BidPackModal({ isOpen, onClose, tender }: BidPackModalProps) {
  const token = useAuthStore((s) => s.token);
  const [offerAmount, setOfferAmount] = useState<number>(tender.estimatedValue || 50000);
  const [signatoryName, setSignatoryName] = useState("Feđa Morankić");
  const [signatoryTitle, setSignatoryTitle] = useState("Predsjednik Uprave");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      const res = await fetch(`/api/tenders/${tender.id}/generate-bid-pack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customOfferAmount: offerAmount,
          signatoryName,
          signatoryTitle,
        }),
      });

      if (!res.ok) throw new Error("Greška pri generisanju paketa ponude");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Ponuda_ASACentral_${(tender.title || "Tender").slice(0, 25).replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Uspješno kreiran i preuzet Bid Pack!", {
        description: "Kompletan paket sa svim aneksima i izjavama je spreman za potpis.",
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Greška pri kreiranju paketa: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-primary font-bold">
            <Package className="w-5 h-5" /> 1-Click "Bid Pack" Generator (ZJN BiH)
          </DialogTitle>
          <DialogDescription>
            Automatsko generisanje cjelokupnog paketa tenderske dokumentacije za ASA Central osiguranje u .zip arhivi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1">
            <div className="font-semibold text-blue-900">Postupak: {tender.title}</div>
            <div className="text-blue-700">Ugovorni organ: {tender.contractingAuth}</div>
            {tender.externalId && <div className="text-blue-600 font-mono">EJN ID: {tender.externalId}</div>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Ponuđena cijena bez PDV-a (KM):
              </label>
              <Input
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(Number(e.target.value))}
                className="font-mono text-base font-bold text-primary"
              />
              <span className="text-[11px] text-muted-foreground">
                (Osiguranje oslobođeno PDV-a shodno čl. 25 ZPDV)
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Ovlašteni potpisnik:
              </label>
              <Input
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                className="mb-1"
              />
              <Input
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
                placeholder="Funkcija"
              />
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
            <div className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" /> Sadržaj generisane arhive (7 DOCX dokumenata):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-700">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 01 Popratni dopis uz ponudu
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 02 Aneks 1 — Obrazac ponude
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 03 Aneks 2 — Cijena i premije
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 04 Izjava Čl. 45 ZJN (Nekažnjavanje)
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 05 Izjava Čl. 47 ZJN (Ekon. sposobnost)
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 06 Izjava Čl. 52 ZJN (Sukob interesa)
              </div>
              <div className="flex items-center gap-1.5 col-span-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 07 Kontrolna lista priloga prije kovertiranja
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={isGenerating}>
              Odustani
            </Button>
            <Button
              onClick={handleDownload}
              disabled={isGenerating}
              className="bg-primary hover:bg-primary/90 font-semibold gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generišem ZIP paket...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" /> Preuzmi kompletan paket (.zip)
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
