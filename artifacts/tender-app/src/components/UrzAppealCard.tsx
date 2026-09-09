import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, AlertTriangle, FileDown, ShieldAlert, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/hooks/use-auth";

interface UrzAppealCardProps {
  tenderId: string;
  tenderTitle: string;
  contractingAuth: string;
}

export function UrzAppealCard({ tenderId, tenderTitle, contractingAuth }: UrzAppealCardProps) {
  const token = useAuthStore((s) => s.token);
  const [isGeneratingAppeal, setIsGeneratingAppeal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["discrimination-check", tenderId],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${tenderId}/discrimination-check`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Greška pri provjeri");
      return res.json() as Promise<{
        hasRedFlags: boolean;
        score: number;
        detectedIssues: {
          ruleId: string;
          title: string;
          severity: "visoka" | "srednja" | "oprez";
          legalBasis: string;
          description: string;
          urzPrecedent?: string;
          remedyRecommendation: string;
        }[];
      }>;
    },
    enabled: !!tenderId,
  });

  const handleDownloadAppeal = async (issueId?: string) => {
    try {
      setIsGeneratingAppeal(true);
      const res = await fetch(`/api/tenders/${tenderId}/generate-urz-appeal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ issueId }),
      });

      if (!res.ok) throw new Error("Greška pri generisanju žalbe");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Zalba_URZ_BiH_${(tenderTitle || "Tender").slice(0, 25).replace(/\s+/g, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Uspješno generisan nacrt žalbe URŽ-u!", {
        description: "Dokument u .docx formatu je pripremljen sa članovima zakona i sudskom praksom.",
      });
    } catch (err: any) {
      toast.error("Greška: " + err.message);
    } finally {
      setIsGeneratingAppeal(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  const issues = data?.detectedIssues || [];

  return (
    <Card className="border-amber-200 bg-amber-50/30 shadow-sm border-l-4 border-l-amber-500">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <CardTitle className="text-base font-bold text-amber-950 flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-700" />
            AI Detektor diskriminacije u TD & Pravna zaštita (URŽ BiH)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              className={`text-xs font-semibold ${
                data?.hasRedFlags
                  ? "bg-rose-600 text-white"
                  : data?.score && data.score > 40
                  ? "bg-amber-500 text-white"
                  : "bg-emerald-600 text-white"
              }`}
            >
              Indeks rizika TD: {data?.score || 0}/100
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Automatsko skeniranje uslova tenderske dokumentacije prema Zakonu o javnim nabavkama BiH i bazi rješenja URŽ-a.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        <div className="space-y-3">
          {issues.map((issue, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-white border border-amber-200/90 rounded-lg shadow-2xs space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    className={`w-4 h-4 ${
                      issue.severity === "visoka"
                        ? "text-rose-600"
                        : issue.severity === "srednja"
                        ? "text-amber-600"
                        : "text-blue-600"
                    }`}
                  />
                  <span className="font-bold text-sm text-gray-900">{issue.title}</span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[11px] font-semibold ${
                    issue.severity === "visoka"
                      ? "border-rose-300 text-rose-700 bg-rose-50"
                      : "border-amber-300 text-amber-700 bg-amber-50"
                  }`}
                >
                  {issue.severity.toUpperCase()} PRIORITET
                </Badge>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed">{issue.description}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-gray-100">
                <div className="text-slate-700">
                  <strong>Pravni osnov:</strong> <span className="font-mono">{issue.legalBasis}</span>
                </div>
                {issue.urzPrecedent && (
                  <div className="text-blue-900">
                    <strong>Presedan URŽ-a:</strong> {issue.urzPrecedent}
                  </div>
                )}
              </div>

              <div className="p-2 bg-slate-50 rounded text-[11px] text-slate-800 flex items-center justify-between gap-2">
                <div>
                  <strong>Preporuka:</strong> {issue.remedyRecommendation}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-amber-200/60">
          <div className="text-xs text-amber-900">
            Pripremljen formalni podnesak žalbe sa zakonskim rokovima i kalkulacijom takse.
          </div>
          <Button
            onClick={() => handleDownloadAppeal()}
            disabled={isGeneratingAppeal}
            className="bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs gap-2 shrink-0"
          >
            {isGeneratingAppeal ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generišem podnesak...
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" /> Generiši žalbu URŽ-u (.docx)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
