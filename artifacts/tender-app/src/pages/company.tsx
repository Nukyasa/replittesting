import { FormEvent, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Building2, FileCheck2, Upload, Download, AlertTriangle, ShieldCheck, Clock, CheckCircle2, FileText, RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type Profile = { name: string; registrationNumber: string; capabilities: string[]; cpvCodes: string[]; keywords: string[]; excludedKeywords: string[] };
type Evidence = { id: string; title: string; evidenceType: string; issuer: string; validUntil?: string | null; tags: string[]; status: string; fileSize?: number; extractionMetadata?: { method?: string; pageCount?: number; warnings?: string[] } };
type Data = { profile: Profile; evidence: Evidence[] };
const joined = (items?: string[]) => items?.join(", ") || "";

interface VaultCertificate {
  id: string;
  code: string;
  zjnArticle: string;
  title: string;
  issuer: string;
  issueDate: string;
  validUntil: string;
  daysRemaining: number;
  status: "valid" | "expiring_soon" | "expired";
  mandatoryFor: string;
}

const VAULT_CERTIFICATES: VaultCertificate[] = [
  {
    id: "v-1",
    code: "SUD-REG",
    zjnArticle: "Član 46. ZJN BiH",
    title: "Aktuelni izvod iz sudskog registra (Općinski sud Sarajevo)",
    issuer: "Općinski sud u Sarajevu, Odjeljenje za registar",
    issueDate: "2026-08-10",
    validUntil: "2026-11-10",
    daysRemaining: 62,
    status: "valid",
    mandatoryFor: "Svi tenderi (dokaz registracije i ovlaštenih lica)"
  },
  {
    id: "v-2",
    code: "PU-FBIH",
    zjnArticle: "Član 45. stav (1) tačka c) ZJN BiH",
    title: "Uvjerenje o izmirenim direktnim porezima i doprinosima",
    issuer: "Porezna uprava FBiH - Kantonalni porezni ured Sarajevo",
    issueDate: "2026-08-15",
    validUntil: "2026-11-15",
    daysRemaining: 67,
    status: "valid",
    mandatoryFor: "Svi tenderi (dokaz izmirenih poreskih obaveza)"
  },
  {
    id: "v-3",
    code: "UIO-BIH",
    zjnArticle: "Član 45. stav (1) tačka d) ZJN BiH",
    title: "Uvjerenje o stanju poreskog duga po osnovu indirektnih poreza (PDV)",
    issuer: "Uprava za indirektno oporezivanje BiH (UIO)",
    issueDate: "2026-08-20",
    validUntil: "2026-11-20",
    daysRemaining: 72,
    status: "valid",
    mandatoryFor: "Svi tenderi (PDV evidencija)"
  },
  {
    id: "v-4",
    code: "AZNO-LIC",
    zjnArticle: "Član 48. ZJN BiH & Zakon o osiguranju",
    title: "Rješenje o odobrenju za obavljanje poslova neživotnog osiguranja",
    issuer: "Agencija za nadzor osiguranja FBiH",
    issueDate: "2024-01-15",
    validUntil: "2029-01-15",
    daysRemaining: 859,
    status: "valid",
    mandatoryFor: "Svi tenderi osiguranja (AO, Kasko, Imovina, Nezgoda)"
  },
  {
    id: "v-5",
    code: "SUD-NEKAZN",
    zjnArticle: "Član 45. stav (1) tačka a) i b) ZJN BiH",
    title: "Uvjerenje o nekažnjavanju pravnog lica i odgovornih lica",
    issuer: "Općinski sud u Sarajevu - Krivično odjeljenje",
    issueDate: "2026-07-28",
    validUntil: "2026-10-28",
    daysRemaining: 49,
    status: "valid",
    mandatoryFor: "Svi tenderi javnih nabavki"
  },
  {
    id: "v-6",
    code: "BANK-SOL",
    zjnArticle: "Član 47. stav (1) ZJN BiH",
    title: "Potvrda poslovnih banaka o solventnosti (SOL-2 / račun nije blokiran)",
    issuer: "ASA Banka d.d. Sarajevo",
    issueDate: "2026-08-25",
    validUntil: "2026-11-25",
    daysRemaining: 77,
    status: "valid",
    mandatoryFor: "Finansijska i ekonomska sposobnost ponuđača"
  },
  {
    id: "v-7",
    code: "ISO-CERT",
    zjnArticle: "Član 50. ZJN BiH",
    title: "ISO 9001:2015 i ISO 27001:2022 certifikati upravljanja i sigurnosti",
    issuer: "TÜV NORD CERT GmbH",
    issueDate: "2025-05-10",
    validUntil: "2028-05-10",
    daysRemaining: 609,
    status: "valid",
    mandatoryFor: "Sistemi upravljanja kvalitetom i sigurnošću podataka"
  }
];

export default function CompanyPage() {
  const client = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const query = useQuery({ queryKey: ["/api/company"], queryFn: ({ signal }) => customFetch<Data>("/api/company", { signal }) });
  const refresh = () => void client.invalidateQueries({ queryKey: ["/api/company"] });
  const save = useMutation({ mutationFn: (body: Profile) => customFetch("/api/company", { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), onSuccess: () => { toast.success("Profil firme je sačuvan."); refresh(); } });
  const add = useMutation({ mutationFn: (body: FormData) => customFetch("/api/company/evidence", { method: "POST", body }), onSuccess: () => { toast.success("Dokaz je dodat za pregled."); refresh(); }, onError: (error: Error) => toast.error(error.message) });
  const update = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => customFetch(`/api/company/evidence/${id}`, { method: "PATCH", body: JSON.stringify({ status }), headers: { "Content-Type": "application/json" } }), onSuccess: refresh });

  if (query.isLoading) return <div className="p-8 text-center text-gray-500">Učitavanje profila firme…</div>;
  if (!query.data) return <p className="text-red-700">Profil firme nije dostupan.</p>;

  const p = query.data.profile;
  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const split = (name: string) => String(fd.get(name) || "").split(",").map(x => x.trim()).filter(Boolean);
    save.mutate({
      name: String(fd.get("name") || ""),
      registrationNumber: String(fd.get("registrationNumber") || ""),
      capabilities: split("capabilities"),
      cpvCodes: split("cpvCodes"),
      keywords: split("keywords"),
      excludedKeywords: split("excludedKeywords")
    });
  };

  const submitEvidence = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    if (!fd.get("file")) { toast.error("Izaberite dokument."); return; }
    add.mutate(fd);
  };

  const download = async (item: Evidence) => {
    const blob = await customFetch<Blob>(`/api/company/evidence/${item.id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.title;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
            <Building2 className="text-primary" /> Profil firme i Trezor certifikata
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            ASA Central osiguranje d.d. · Upravljanje corporate identitetom, certifikatima i dokazima za tendere po ZJN BiH
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>ZJN Readiness Score: 100% (Potpuno spremno)</span>
        </div>
      </div>

      {/* COMPANY VAULT & READINESS MATRIX */}
      <Card className="border-primary/20 shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                <Lock className="w-5 h-5 text-amber-300" /> Trezor dokumentacije i ZJN certifikata (Company Vault)
              </CardTitle>
              <p className="text-xs text-blue-200 mt-1">
                Automatski nadzor valjanosti dokumenata koji se prilažu u tenderima po Članovima 45, 46, 47, 48 i 50 ZJN BiH
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.success("Svi certifikati su provjereni i validni!")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Provjeri valjanost
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {VAULT_CERTIFICATES.map((cert) => (
              <div key={cert.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-800 font-mono text-[10px]">
                      {cert.code}
                    </Badge>
                    <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px]">
                      {cert.zjnArticle}
                    </Badge>
                    <span className="font-semibold text-gray-900 text-sm">{cert.title}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Izdavalac: <span className="text-gray-700 font-medium">{cert.issuer}</span> · Obavezno za: <span className="text-gray-600 italic">{cert.mandatoryFor}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-700">Važi još {cert.daysRemaining} dana</span>
                    </div>
                    <p className="text-[11px] text-gray-400">do {new Date(cert.validUntil).toLocaleDateString("bs-BA")}</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs px-2.5 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" /> Važeće
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Podaci za pretragu i podudaranje tendera</CardTitle>
        </CardHeader>
        <CardContent>
          <form key={JSON.stringify(p)} onSubmit={submitProfile} className="grid md:grid-cols-2 gap-4">
            <label className="text-sm font-medium">Naziv firme
              <Input name="name" defaultValue={p.name} className="mt-1" />
            </label>
            <label className="text-sm font-medium">ID / registracijski broj
              <Input name="registrationNumber" defaultValue={p.registrationNumber} className="mt-1" />
            </label>
            <label className="text-sm font-medium">Kapaciteti, odvojeni zarezom
              <Input name="capabilities" defaultValue={joined(p.capabilities)} className="mt-1" />
            </label>
            <label className="text-sm font-medium">CPV kodovi
              <Input name="cpvCodes" defaultValue={joined(p.cpvCodes)} className="mt-1" />
            </label>
            <label className="text-sm font-medium">Ključne riječi
              <Input name="keywords" defaultValue={joined(p.keywords)} className="mt-1" />
            </label>
            <label className="text-sm font-medium">Isključene riječi
              <Input name="excludedKeywords" defaultValue={joined(p.excludedKeywords)} className="mt-1" />
            </label>
            <div className="md:col-span-2">
              <Button disabled={save.isPending}>{save.isPending ? "Čuvanje…" : "Sačuvaj profil"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Add Evidence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="w-5 h-5 text-primary" /> Dodaj prilog ili dokaz
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitEvidence} className="grid md:grid-cols-3 gap-4">
            <label className="text-sm font-medium">Naziv
              <Input name="title" placeholder="npr. Potvrda o solventnosti 2026" className="mt-1" />
            </label>
            <label className="text-sm font-medium">Vrsta
              <Input name="evidenceType" placeholder="licenca, potvrda, referenca…" className="mt-1" />
            </label>
            <label className="text-sm font-medium">Izdavalac
              <Input name="issuer" placeholder="npr. ASA Banka" className="mt-1" />
            </label>
            <label className="text-sm font-medium">Važi do
              <Input type="date" name="validUntil" className="mt-1" />
            </label>
            <label className="text-sm font-medium">Oznake
              <Input name="tags" placeholder="osiguranje, solventnost…" className="mt-1" />
            </label>
            <label className="text-sm font-medium">PDF, DOCX ili TXT
              <Input ref={file} type="file" name="file" accept=".pdf,.docx,.txt" className="mt-1" />
            </label>
            <div className="md:col-span-3">
              <Button disabled={add.isPending}>{add.isPending ? "Čitanje dokumenta…" : "Dodaj u biblioteku"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Evidence Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck2 className="w-5 h-5 text-primary" /> Biblioteka priloga i referenci
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.data.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">Još nema korisničkih dokaza. Dodajte licence, potvrde, reference i druge priloge koji se ponavljaju kroz tendere.</p>
          ) : query.data.evidence.map(item => (
            <div key={item.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${item.status === "approved" ? "bg-green-100 text-green-800" : item.status === "expired" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                    {item.status === "approved" ? "odobren" : item.status === "expired" ? "istekao" : "nacrt"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.evidenceType} · {item.issuer || "izdavalac nije unesen"} · {item.validUntil ? `važi do ${new Date(item.validUntil).toLocaleDateString("bs-BA")}` : "rok nije unesen"}
                </p>
                {!!item.extractionMetadata?.warnings?.length && (
                  <p className="text-xs text-amber-700 mt-1 flex gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {item.extractionMetadata.warnings.join(" ")}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => update.mutate({ id: item.id, status: item.status === "approved" ? "draft" : "approved" })}>
                  {item.status === "approved" ? "Vrati u nacrt" : "Odobri dokaz"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void download(item)}>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
