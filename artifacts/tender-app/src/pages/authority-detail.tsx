import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Building2, FileText, AlertCircle, ShieldAlert, CheckCircle2, TrendingUp, Users } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";

type Result = {
  authority: {
    name: string;
    municipality?: string | null;
    level?: string | null;
    vrsta?: string | null;
    ejnId: string;
    jib?: string | null;
    address?: string | null;
  };
  tenders: {
    id: string;
    title: string;
    externalId: string;
    publicationDate: string;
    deadline?: string | null;
    estimatedValue?: number | null;
    currency: string;
    status: string;
  }[];
  senaDossier?: {
    totalContracts: number;
    singleBidderRate: number | null;
    directAgreementShare: number | null;
    leadingWinner: { name: string; wins: number; sharePct: number } | null;
    topWinners: { name: string; wins: number; totalAmount: number; sharePct: number }[];
    opennessIndex: "otvoren" | "umjeren" | "zatvoren" | "nepoznato";
    opennessLabel: string;
    senaNote: string;
  };
};

export default function AuthorityDetailPage() {
  const [, params] = useRoute("/authorities/:id");
  const result = useQuery({
    queryKey: ["authority", params?.id],
    enabled: !!params?.id,
    queryFn: ({ signal }) => customFetch<Result>(`/api/authorities/${params!.id}/tenders`, { signal }),
  });

  if (result.isLoading) return <p className="p-6 text-sm text-muted-foreground">Učitavanje ugovornog organa…</p>;
  if (!result.data) return <p className="p-6 text-sm text-destructive">Ugovorni organ nije pronađen.</p>;

  const { authority, tenders, senaDossier } = result.data;
  const money = (val: number) =>
    new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 0 }).format(val) + " KM";

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link href="/authorities" className="text-xs font-mono text-primary hover:underline">
          ← Nazad na ugovorne organe
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2 mt-2 text-foreground">
          <Building2 className="text-primary w-6 h-6" />
          {authority.name}
        </h1>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          {[authority.municipality, authority.level, authority.vrsta].filter(Boolean).join(" · ") || `EJN ID: ${authority.ejnId}`}
          {authority.jib && ` · JIB: ${authority.jib}`}
        </p>
      </div>

      {/* ASA DOSJE UGOVORNOG ORGANA (KUPAC INTELLIGENCE) */}
      {senaDossier && (
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/40 border-b border-border py-3 px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <CardTitle className="text-xs font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  ASA Dosje Ugovornog Organa · Signali otvorenosti
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className={`font-mono text-xs ${
                  senaDossier.opennessIndex === "otvoren"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : senaDossier.opennessIndex === "zatvoren"
                    ? "bg-rose-50 text-rose-800 border-rose-300"
                    : "bg-amber-50 text-amber-800 border-amber-300"
                }`}
              >
                {senaDossier.opennessLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground font-mono uppercase">Zabilježeni ugovori</span>
                <p className="text-2xl font-extrabold text-foreground mt-0.5">{senaDossier.totalContracts}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">iz baze od 2014.</p>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground font-mono uppercase">Stopa 1 ponuđača</span>
                <p className={`text-2xl font-extrabold mt-0.5 ${
                  (senaDossier.singleBidderRate || 0) > 60 ? "text-rose-600" : "text-foreground"
                }`}>
                  {senaDossier.singleBidderRate !== null ? `${senaDossier.singleBidderRate}%` : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">postupaka bez konkurencije</p>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground font-mono uppercase">Direktni sporazumi</span>
                <p className="text-2xl font-extrabold text-foreground mt-0.5">
                  {senaDossier.directAgreementShare !== null ? `${senaDossier.directAgreementShare}%` : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">udio ugovora bez objave</p>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground font-mono uppercase">Vodeći dobitnik</span>
                <p className="text-sm font-bold text-foreground mt-1 truncate" title={senaDossier.leadingWinner?.name}>
                  {senaDossier.leadingWinner ? senaDossier.leadingWinner.name : "Nema podataka"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {senaDossier.leadingWinner ? `${senaDossier.leadingWinner.sharePct}% svih poslova` : ""}
                </p>
              </div>
            </div>

            {/* Top dobavljači tabela */}
            {senaDossier.topWinners.length > 0 && (
              <div className="pt-2 border-t border-border space-y-2">
                <span className="text-xs font-semibold text-foreground block">
                  Top dobavljači kod ovog ugovornog organa:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {senaDossier.topWinners.map((w, idx) => (
                    <div key={idx} className="p-2.5 rounded-md border border-border bg-background flex justify-between items-center text-xs">
                      <div className="truncate mr-2">
                        <strong className="block truncate text-foreground">{w.name}</strong>
                        <span className="text-[11px] text-muted-foreground">{w.wins} ugovora ({money(w.totalAmount)})</span>
                      </div>
                      <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
                        {w.sharePct}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ASA standardna napomena */}
            <div className="rounded-md bg-muted/50 p-2.5 text-xs font-mono text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{senaDossier.senaNote || (senaDossier as any).note || "Obrazac je signal za oprez prije pripreme — ne optužba."}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela nabavki ugovornog organa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <FileText className="w-5 h-5 text-primary" />
            Nabavke ugovornog organa ({tenders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenders.length ? (
            <div className="space-y-2">
              {tenders.map((tender) => (
                <Link key={tender.id} href={`/tenders/${encodeURIComponent(tender.id)}`}>
                  <div className="border rounded-lg p-4 hover:border-primary hover:bg-primary/5 transition-colors flex justify-between items-center gap-4">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{tender.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {tender.externalId} · Objavljeno {formatDate(tender.publicationDate)} · Rok {formatDate(tender.deadline)}
                      </p>
                    </div>
                    <div className="text-right text-sm shrink-0">
                      <strong className="text-foreground">{formatMoney(tender.estimatedValue, tender.currency)}</strong>
                      <p className="text-xs text-muted-foreground">{tender.status}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Nema učitanih nabavki za ovaj organ u bazi.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
