import { useState } from "react";
import { useGetMe, useGetScraperStatus, useTriggerScraper } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { User, Bell, Database, Briefcase, Settings2, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: user } = useGetMe();
  const { data: scraperStatus, refetch: refetchStatus } = useGetScraperStatus();
  const triggerScraper = useTriggerScraper();
  const [triggeringSource, setTriggeringSource] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleTrigger = async (source: string) => {
    setTriggeringSource(source);
    try {
      await triggerScraper.mutateAsync({ data: { source } });
      toast.success(`Sinkronizacija "${source}" pokrenuta`);
      setTimeout(() => { refetchStatus(); setTriggeringSource(null); }, 3000);
    } catch {
      toast.error("Greška pri pokretanju skrapera");
      setTriggeringSource(null);
    }
  };

  const handleSave = () => {
    setSaveSuccess(true);
    toast.success("Profil ažuriran");
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Postavke</h1>
        <p className="text-gray-500 text-sm mt-1">Upravljanje vašim računom i sistemom</p>
      </div>

      <Tabs defaultValue="profil" className="w-full">
        <TabsList className="bg-white border w-full justify-start overflow-x-auto h-auto p-1">
          <TabsTrigger value="profil" className="py-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
            <User className="w-4 h-4 mr-2" /> Profil
          </TabsTrigger>
          <TabsTrigger value="kompanija" className="py-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
            <Briefcase className="w-4 h-4 mr-2" /> Kompanija
          </TabsTrigger>
          <TabsTrigger value="notifikacije" className="py-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
            <Bell className="w-4 h-4 mr-2" /> Notifikacije
          </TabsTrigger>
          <TabsTrigger value="skraperi" className="py-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
            <Database className="w-4 h-4 mr-2" /> Skraperi
          </TabsTrigger>
          <TabsTrigger value="sistem" className="py-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
            <Settings2 className="w-4 h-4 mr-2" /> Sistem
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Korisnički profil</CardTitle>
              <CardDescription>Ažurirajte svoje lične podatke</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ime i prezime</Label>
                  <Input defaultValue={user?.name || ""} />
                </div>
                <div className="space-y-2">
                  <Label>Email adresa</Label>
                  <Input defaultValue={user?.email || ""} disabled className="bg-gray-50" />
                </div>
                <div className="space-y-2">
                  <Label>Odjel</Label>
                  <Input defaultValue={user?.department || ""} />
                </div>
                <div className="space-y-2">
                  <Label>Uloga u sistemu</Label>
                  <Input defaultValue={user?.role || ""} disabled className="bg-gray-50" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
                  {saveSuccess ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Sačuvano</> : "Sačuvaj promjene"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kompanija" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Podaci o kompaniji</CardTitle>
              <CardDescription>Informacije o ASA CENTRAL Osiguranje</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Naziv kompanije</Label>
                  <Input defaultValue="ASA CENTRAL Osiguranje d.d. Sarajevo" />
                </div>
                <div className="space-y-2">
                  <Label>JIB / Porezni broj</Label>
                  <Input defaultValue="4200000000000" />
                </div>
                <div className="space-y-2">
                  <Label>Adresa</Label>
                  <Input defaultValue="Sarajevo, Federacija BiH" />
                </div>
                <div className="space-y-2">
                  <Label>Kategorije od interesa</Label>
                  <Input defaultValue="Osiguranje" />
                </div>
              </div>
              <Button onClick={() => toast.success("Podaci o kompaniji sačuvani")} className="bg-primary hover:bg-primary/90">
                Sačuvaj
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifikacije" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notifikacijske postavke</CardTitle>
              <CardDescription>Upravljajte kada i kako primate obavijesti</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: "Novi tenderi visoke relevantnosti", desc: "Email obavijest kada AI ocjena tendera pređe 80.", defaultChecked: true },
                { label: "Istek roka u 7 dana", desc: "Upozorenje za tendere na listi praćenja.", defaultChecked: true },
                { label: "Promjena statusa praćenog tendera", desc: "Kada se status tendera promijeni (otvoren → zatvoren).", defaultChecked: false },
                { label: "Sedmični pregled", desc: "Sedmični email sa pregledom novih tendera.", defaultChecked: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{item.label}</Label>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <Switch defaultChecked={item.defaultChecked} />
                </div>
              ))}
              <Button onClick={() => toast.success("Notifikacijske postavke sačuvane")} className="bg-primary hover:bg-primary/90">
                Sačuvaj
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skraperi" className="mt-6 space-y-4">
          <Card className="border-t-4 border-t-primary shadow-sm bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                EJN Portal Kredencijali i Autentikacija
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-700">
              <p className="text-xs text-gray-500 leading-relaxed">
                Sljedeći podaci se koriste za prijavu na Elektronski sistem javnih nabavki BiH (EJN) kako bi se preuzimali zaštićeni PDF dokumenti, specifikacije i Aneksi.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 bg-white border rounded">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase block">Portal za prijavu</span>
                  <span className="font-bold text-gray-800 break-all">https://www.ejn.gov.ba/Home/Index</span>
                </div>
                <div className="p-3 bg-white border rounded">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase block">Korisničko ime</span>
                  <span className="font-bold text-primary">almir.zeljkovic</span>
                </div>
                <div className="p-3 bg-white border rounded">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase block">Status konekcije</span>
                  <span className="font-bold text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-600" /> Povezan i aktivan
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status skrapera</CardTitle>
              <CardDescription>
                Upravljanje integracijom s EJN (Elektronski sistem javnih nabavki BiH) i ostalim izvorima podataka
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scraperStatus?.sources == null ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                ) : (
                  scraperStatus.sources.map((s: { source: string; status: string; tendersFound: number; lastRun: string | null }, i: number) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-gray-50/50 gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="font-semibold text-gray-900 flex flex-wrap items-center gap-2 capitalize">
                          {s.source === "ejn" ? "EJN — open.ejn.gov.ba" : s.source === "reference" ? "Reference.ba" : "UNDP Portal"}
                          <Badge
                            variant="outline"
                            className={
                              s.status === "completed" ? "bg-green-50 text-green-700 border-green-200" :
                              s.status === "running" ? "bg-blue-50 text-blue-700 border-blue-200" :
                              s.status === "failed" ? "bg-red-50 text-red-700 border-red-200" :
                              "bg-gray-50 text-gray-600"
                            }
                          >
                            {s.status === "completed" ? "Završen" : s.status === "running" ? "U toku" : s.status === "failed" ? "Greška" : s.status === "never" ? "Nikad" : s.status}
                          </Badge>
                          {s.source === "ejn" && <Badge className="bg-primary/10 text-primary border-transparent text-xs">Live EJN integracija</Badge>}
                        </div>
                        <div className="text-xs text-gray-500">
                          Pronađeno: <strong>{s.tendersFound}</strong> tendera
                          {s.lastRun && ` · Zadnje pokretanje: ${formatDate(s.lastRun)}`}
                          {!s.lastRun && " · Još nije pokrenuto"}
                        </div>
                        {s.source !== "ejn" && (
                          <div className="text-xs text-amber-600">Integracija još nije povezana</div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="sm:ml-4 shrink-0 w-full sm:w-auto"
                        onClick={() => handleTrigger(s.source)}
                        disabled={s.source !== "ejn" || triggeringSource === s.source || scraperStatus?.isRunning}
                      >
                        {triggeringSource === s.source ? (
                          <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1.5" />
                        )}
                        Pokreni
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 pt-4 border-t">
                <Button
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => handleTrigger("all")}
                  disabled={!!triggeringSource || scraperStatus?.isRunning}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${scraperStatus?.isRunning ? "animate-spin" : ""}`} />
                  Preuzmi s EJN portala
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sistem" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sistemske postavke</CardTitle>
              <CardDescription>Konfiguracija sistema i integracija</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>EJN API baza (OData)</Label>
                <Input defaultValue="https://open.ejn.gov.ba" disabled className="bg-gray-50 font-mono text-sm" />
                <p className="text-xs text-gray-500">Trenutno korišćen entitet: AnnouncementProcedureNotices</p>
              </div>
              <div className="space-y-2">
                <Label>EJN Portal (pregledavanje)</Label>
                <Input defaultValue="https://www.ejn.gov.ba" disabled className="bg-gray-50 font-mono text-sm" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Lokalni pregled izvora (bez AI ključa)</Label>
                  <p className="text-xs text-gray-500">Izdvaja navode iz dokumenata bez izmišljenih uslova ili procjena.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Auto-sinkronizacija s EJN</Label>
                  <p className="text-xs text-gray-500">Automatska provjera svakih 15 minuta dok server radi.</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
