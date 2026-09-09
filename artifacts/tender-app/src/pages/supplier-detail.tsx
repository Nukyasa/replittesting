import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { 
  Building, Calculator, Lock, Sparkles, Shield, Bookmark, 
  MapPin, CheckCircle2, AlertTriangle, Info, ArrowLeft,
  FileText, TrendingUp, AlertCircle, Handshake, Briefcase, 
  Check, ExternalLink, Scale, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SupplierProfile {
  id: string;
  name: string;
  jib: string;
  city: string;
  address?: string;
  registrationStatus: "registered" | "unregistered" | "verified";
  dataQuality: "confirmed" | "partial";
  cpvCodes: string[];
  categories: string[];
  mbs: string;
  court: string;
  ownership: string;
  encountersCount: number;
  marketOverlap: string;
  baseWins: number;
  baseValue: number;
  successRate: number | null;
  teamClassification?: string;
  isWatched?: boolean;
  contracts: {
    id: string;
    procedureName: string;
    contractingAuth: string;
    winningBidAmount: number;
    currency: string;
    awardDate: string;
    competitorOffersCount?: number;
    cpvKod?: string;
    ejnBroj?: string;
  }[];
  topBuyers: {
    name: string;
    count: number;
    total: number;
  }[];
  yearlyStats: {
    year: string;
    wins: number;
    amount: number;
  }[];
  risks: {
    complaintsFiled: number;
    complaintsAccepted: number;
    disqualificationRisk: string;
    eAuctionParticipationRate: number;
  };
  sourceCoverage?: { supplierId?: number; linkedGroups?: number; awardedGroups?: number; localAwardRecords: number; awardValueRecords?: number; lotContractValueRecords?: number };
}

function formatValKM(val: number): string {
  if (val >= 1000000) {
    return `${(val / 1000000).toLocaleString("bs-BA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M KM`;
  }
  if (val >= 1000) {
    return `${(val / 1000).toLocaleString("bs-BA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} K KM`;
  }
  return `${val.toLocaleString("bs-BA")} KM`;
}

export default function SupplierDetailPage() {
  const [, params] = useRoute("/suppliers/:id");
  const supplierId = params?.id;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"overview" | "contracts" | "registry" | "fit" | "analytics" | "risks">("overview");

  // Query supplier details
  const { data: supplier, isLoading, isError } = useQuery<SupplierProfile>({
    queryKey: ["supplier", supplierId],
    enabled: !!supplierId,
    queryFn: ({ signal }) => customFetch<SupplierProfile>(`/api/suppliers/${supplierId}`, { signal }),
  });

  // Watch mutation
  const toggleWatch = useMutation({
    mutationFn: async () => {
      return customFetch(`/api/suppliers/${supplierId}/watch`, {
        method: supplier?.isWatched ? "DELETE" : "POST",
      });
    },
    onSuccess: () => {
      toast.success(supplier?.isWatched ? "Uklonjeno iz praćenih" : "Dodano u praćene dobavljače");
      queryClient.invalidateQueries({ queryKey: ["supplier", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });

  // Classification mutation
  const setClassification = useMutation({
    mutationFn: async (classification: string) => {
      return customFetch(`/api/suppliers/${supplierId}/classification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification }),
      });
    },
    onSuccess: () => {
      toast.success("Timska klasifikacija ažurirana");
      queryClient.invalidateQueries({ queryKey: ["supplier", supplierId] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <div className="p-16 text-center max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold">Dobavljač nije pronađen</h2>
        <p className="text-sm text-gray-500 mt-1">Provjerite URL adresu ili se vratite na listu dobavljača.</p>
        <Link href="/suppliers">
          <Button className="mt-4" size="sm">Nazad na dobavljače</Button>
        </Link>
      </div>
    );
  }

  const classificationLabels: Record<string, string> = {
    unclassified: "Nije klasifikovan",
    competitor: "Direktni konkurent",
    partner: "Potencijalni partner",
    subcontractor: "Podizvođač",
    neutral: "Neutralan subjekt",
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-[1500px] mx-auto w-full">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/dashboard" className="hover:text-primary">Početna</Link>
        <span>›</span>
        <Link href="/suppliers" className="hover:text-primary">Dobavljači</Link>
        <span>›</span>
        <span className="text-foreground font-medium truncate max-w-md">{supplier.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-950">Detalji dobavljača</h1>
        <Link href="/suppliers">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Nazad na listu
          </Button>
        </Link>
      </div>

      {/* 2. Main Header Profile Card (sena.ba stil) */}
      <Card className="border-gray-200/90 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-6 space-y-6">
          {/* Top row: Name, JIB, City, Actions */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-gray-900 leading-tight">
                „{supplier.name}“
              </h2>
              <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                <span>JIB: {supplier.jib}</span>
                <span className="flex items-center gap-1 font-sans text-gray-700">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {supplier.city}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 bg-white border-gray-200"
                onClick={() => toast.info("Modul za uporedbu dobavljača je pripremljen za analizu.")}
              >
                <Scale className="w-4 h-4 text-gray-500" />
                Uporedi
              </Button>

              <Button
                variant={supplier.isWatched ? "secondary" : "outline"}
                size="sm"
                className={cn(
                  "h-9 text-xs gap-1.5 transition-colors",
                  supplier.isWatched ? "bg-amber-50 text-amber-700 border-amber-200 font-semibold" : "bg-white border-gray-200"
                )}
                onClick={() => toggleWatch.mutate()}
              >
                <Bookmark className={cn("w-4 h-4", supplier.isWatched ? "fill-amber-500 text-amber-500" : "text-gray-500")} />
                {supplier.isWatched ? "Praćeno" : "Prati"}
              </Button>
            </div>
          </div>

          {/* 4 Metric Boxes (sena.ba stil) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
            <div className="p-4 bg-gray-50/60 rounded-xl border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{supplier.baseWins}</p>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">{supplier.sourceCoverage?.awardedGroups != null ? "EJN DODIJELJENE GRUPE" : "LOKALNO UČITANE DODJELE"}</p>
            </div>

            <div className="p-4 bg-gray-50/60 rounded-xl border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">
                {supplier.successRate == null ? "Nije objavljeno" : `${supplier.successRate}%`}
              </p>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
                uspješnost zahtijeva ukupan broj ponuda · nije objavljeno
              </p>
            </div>

            <div className="p-4 bg-gray-50/60 rounded-xl border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{formatValKM(supplier.baseValue)}</p>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">EJN VRIJEDNOST DODJELA</p>
            </div>

            <div className="p-4 bg-gray-50/60 rounded-xl border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">—</p>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">PROSJEČNI POPUST</p>
            </div>
          </div>

          {supplier.sourceCoverage && <p className="text-xs text-muted-foreground col-span-2 lg:col-span-4">Izvor: EJN Supplier ID {supplier.sourceCoverage.supplierId ?? "nije pronađen"}. Provjereno {supplier.sourceCoverage.linkedGroups ?? 0} grupa ponuda; dodijeljeno {supplier.sourceCoverage.awardedGroups ?? "nije provjereno"}. Vrijednost je zbir {supplier.sourceCoverage.awardValueRecords ?? 0} zapisa iz EJN Awards i {supplier.sourceCoverage.lotContractValueRecords ?? 0} zapisa iz LotContractsBase; lokalni dosje sadrži {supplier.sourceCoverage.localAwardRecords} preuzetih zapisa.</p>}

          <div className="flex items-center justify-between pt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Sinhronizovano sa zvaničnim registrima
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. ŠTA GLEDATE Legenda */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-600 bg-gray-50/70 p-2.5 rounded-xl border border-gray-200/80">
        <span className="font-bold uppercase tracking-wider text-[11px] text-gray-400">ŠTA GLEDATE</span>
        <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 border border-sky-200/70 px-2 py-0.5 rounded-md font-medium text-[11px]">
          <Building className="w-3 h-3 text-sky-600" />
          Javni podatak
        </span>
        <span className="text-gray-400 text-[11px]">identitet, dodjele i registri</span>

        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 border border-purple-200/70 px-2 py-0.5 rounded-md font-medium text-[11px] ml-2">
          <Calculator className="w-3 h-3 text-purple-600" />
          Izračunato
        </span>
        <span className="text-gray-400 text-[11px]">naš izračun samo kada postoje potpuni javni podaci</span>

        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200/70 px-2 py-0.5 rounded-md font-medium text-[11px] ml-2">
          <Lock className="w-3 h-3 text-blue-600" />
          Interni podatak
        </span>
        <span className="text-gray-400 text-[11px]">samo za vaš tim, bez EJN efekta</span>
      </div>

      {/* 4. Notice / Warning banner (sena.ba stil) */}
      <div className="space-y-2">
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Identitet potvrđen u domaćem registru</p>
            <p className="text-amber-800/90 mt-0.5">
              Profil je verifikovan na osnovu zvaničnih evidencija dodjela i javnih nabavki. Svi ugovori i pobjede su javno zabilježeni.
            </p>
          </div>
        </div>

        {/* 5. Team Classification Box (Privatno za vaš tim) */}
        <div className="bg-blue-50/40 border border-blue-200/70 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            <span className="text-gray-700">
              Privatno za vaš tim: <strong className="text-gray-950 font-bold">{classificationLabels[supplier.teamClassification || "unclassified"]}</strong>
            </span>
            <span className="text-gray-400 text-[11px]">· Klasifikacija se ne dijeli javno i vidljiva je samo vašem timu.</span>
          </div>

          <Select
            value={supplier.teamClassification || "unclassified"}
            onValueChange={(val) => setClassification.mutate(val)}
          >
            <SelectTrigger className="w-[180px] h-8 text-xs bg-white border-blue-200 rounded-lg">
              <SelectValue placeholder="Promijeni status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unclassified">Nije klasifikovan</SelectItem>
              <SelectItem value="competitor">Direktni konkurent</SelectItem>
              <SelectItem value="partner">Potencijalni partner</SelectItem>
              <SelectItem value="subcontractor">Podizvođač</SelectItem>
              <SelectItem value="neutral">Neutralan subjekt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 6. Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors relative rounded-lg",
            activeTab === "overview" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Javni pregled</span>
          <span className="text-[10px] opacity-80">(Javno)</span>
        </button>

        <button
          onClick={() => setActiveTab("contracts")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors relative rounded-lg",
            activeTab === "contracts" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Ugovori</span>
          <span className="text-[10px] opacity-80">({supplier.contracts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("registry")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors relative rounded-lg",
            activeTab === "registry" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Poslovni registar</span>
        </button>

        <button
          onClick={() => setActiveTab("fit")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors relative rounded-lg",
            activeTab === "fit" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <Handshake className="w-3.5 h-3.5" />
          <span>Fit i partneri</span>
          <span className="text-[10px] opacity-80">(Izračunato)</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors relative rounded-lg",
            activeTab === "analytics" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Analitika</span>
        </button>

        <button
          onClick={() => setActiveTab("risks")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors relative rounded-lg",
            activeTab === "risks" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Rizici</span>
        </button>
      </div>

      {/* 7. Tab Contents */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Potvrđeni identitet */}
          <Card className="border-gray-200 shadow-sm bg-white">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Potvrđeni identitet</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Iz EJN-a i registarskog zapisa. Ništa ovdje nije procjena.</p>
              </div>
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px]">
                Javni podatak
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Pravni naziv:</span>
                <span className="font-semibold text-gray-900 text-right">{supplier.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">JIB:</span>
                <span className="font-mono font-semibold text-gray-900">{supplier.jib}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Status u registru:</span>
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                  {supplier.registrationStatus === "registered" ? "Registrovani ponuđač" : "Neregistrovani ponuđač"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Uloga:</span>
                <span className="font-medium text-gray-900">dobavljač / ponuđač</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500">Izvor:</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <Check className="w-3.5 h-3.5" /> ejn.gov.ba
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card: Šta javno isporučuje */}
          <Card className="border-gray-200 shadow-sm bg-white">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Šta javno isporučuje</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Direktno iz CPV kodova na dodjelama.</p>
              </div>
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px]">
                Javni podatak
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              {supplier.cpvCodes?.map((code, i) => (
                <div key={code} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="space-y-0.5">
                    <p className="font-mono font-bold text-gray-900">{code}</p>
                    <p className="text-gray-500 text-[11px]">{supplier.categories[i] || "Usluge i nabavke"}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-primary bg-blue-50 px-2 py-0.5 rounded">
                    Zabilježeno
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Card: Najčešći kupci (Ugovorni organi) */}
          <Card className="border-gray-200 shadow-sm bg-white lg:col-span-2">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Najčešći kupci</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Ugovorni organi kod kojih je zabilježen najveći obim poslova.</p>
              </div>
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px]">
                Javni podatak
              </Badge>
            </CardHeader>
            <CardContent className="p-4">
              <div className="divide-y divide-gray-100 text-xs">
                {supplier.topBuyers.map((b, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{b.name}</p>
                      <p className="text-gray-400 text-[11px] mt-0.5">{b.count} zabilježenih dodjela</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <strong className="text-sm text-gray-900">{formatValKM(b.total)}</strong>
                      <p className="text-[10px] text-emerald-700 font-medium">realizovano</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Ugovori */}
      {activeTab === "contracts" && (
        <Card className="border-gray-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-bold">Dodijeljeni ugovori ({supplier.contracts.length})</CardTitle>
            <p className="text-xs text-gray-500">Svi zabilježeni tenderi i ugovori dodijeljeni ovom dobavljaču.</p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">PREDMET NABAVKE</th>
                  <th className="py-3 px-4">UGOVORNI ORGAN</th>
                  <th className="py-3 px-4">IZNOS (KM)</th>
                  <th className="py-3 px-4">DATUM DODJELE</th>
                  <th className="py-3 px-4">BROJ PONUĐAČA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supplier.contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-gray-900 max-w-xs">
                      <div>{c.procedureName}</div>
                      {c.ejnBroj && <div className="text-[10px] text-gray-400 font-mono mt-0.5">{c.ejnBroj}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">{c.contractingAuth}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">{formatMoney(c.winningBidAmount, c.currency)}</td>
                    <td className="py-3.5 px-4 text-gray-600">{formatDate(c.awardDate)}</td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {c.competitorOffersCount ? `${c.competitorOffersCount} ponude` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab: Poslovni registar */}
      {activeTab === "registry" && (
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-bold">Podaci iz sudskog i poslovnog registra</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-gray-500">Matični broj subjekta (MBS):</span>
                <p className="font-mono font-bold text-sm text-gray-900">{supplier.mbs}</p>
              </div>

              <div className="space-y-1">
                <span className="text-gray-500">Registarski sud:</span>
                <p className="font-bold text-sm text-gray-900">{supplier.court}</p>
              </div>

              <div className="space-y-1">
                <span className="text-gray-500">Oblik organizovanja:</span>
                <p className="font-bold text-sm text-gray-900">{supplier.ownership}</p>
              </div>

              <div className="space-y-1">
                <span className="text-gray-500">Sjedište i adresa:</span>
                <p className="font-bold text-sm text-gray-900">{supplier.address || supplier.city}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Fit i partneri */}
      {activeTab === "fit" && (
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-bold">Fit i analiza za partnerstvo</CardTitle>
            <p className="text-xs text-gray-500">Procjena sinergije za konzorcijume i zajedničke ponude.</p>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-gray-500 uppercase font-bold text-[10px]">PREKLAPANJE TRŽIŠTA</span>
                <p className="text-lg font-bold text-gray-900 mt-1">{supplier.marketOverlap}</p>
                <p className="text-gray-400 text-[11px] mt-0.5">Visok stepen zajedničkih CPV tendera</p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-gray-500 uppercase font-bold text-[10px]">ZAJEDNIČKI SUSRETI</span>
                <p className="text-lg font-bold text-gray-900 mt-1">{supplier.encountersCount}</p>
                <p className="text-gray-400 text-[11px] mt-0.5">Direktnih nadmetanja na tenderima</p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-gray-500 uppercase font-bold text-[10px]">PREPORUKA</span>
                <p className="text-lg font-bold text-blue-700 mt-1">
                  {supplier.marketOverlap === "Visoko" ? "Konkurentski nastup" : "Mogući konzorcij"}
                </p>
                <p className="text-gray-400 text-[11px] mt-0.5">Na osnovu historijskih obrazaca učešća</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Analitika */}
      {activeTab === "analytics" && (
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-bold">Historijat osvojenih ugovora po godinama</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {supplier.yearlyStats.map((y) => (
                <div key={y.year} className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="font-bold text-gray-500 text-sm">{y.year}</span>
                  <p className="text-xl font-extrabold text-gray-900 mt-1">{formatValKM(y.amount)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{y.wins} ugovora</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Rizici */}
      {activeTab === "risks" && (
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-bold">Procjena rizika i žalbeni profil</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-gray-500 uppercase font-bold text-[10px]">PODNESENE ŽALBE</span>
                <p className="text-lg font-bold text-gray-900 mt-1">{supplier.risks.complaintsFiled}</p>
                <p className="text-gray-400 text-[11px] mt-0.5">Pred URŽ organom</p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-gray-500 uppercase font-bold text-[10px]">RIZIK DISKVALIFIKACIJE</span>
                <p className="text-lg font-bold text-emerald-700 mt-1">{supplier.risks.disqualificationRisk}</p>
                <p className="text-gray-400 text-[11px] mt-0.5">Uredna dokumentacija i reference</p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-gray-500 uppercase font-bold text-[10px]">UČEŠĆE U E-AUKCIJAMA</span>
                <p className="text-lg font-bold text-gray-900 mt-1">{supplier.risks.eAuctionParticipationRate}%</p>
                <p className="text-gray-400 text-[11px] mt-0.5">Agresivnost u spuštanju cijena</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
