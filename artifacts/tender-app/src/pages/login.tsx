import { useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("admin@asacentral.ba");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Use the same origin in production. Vite's dev proxy handles /api locally.
      const apiBase = (import.meta as any).env?.VITE_API_URL || "";
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Pogrešan email ili lozinka.");
        setLoading(false);
        return;
      }

      queryClient.clear();
      setAuth(data.token, data.user);
      setLocation("/dashboard");
    } catch {
      setError("Greška u komunikaciji sa serverom. Pokušajte ponovo.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <img src="https://asacentral.ba/logo.webp" alt="ASA Central Osiguranje" className="h-12 object-contain mb-6" />
          <h1 className="text-2xl font-bold text-primary tracking-tight">ASA Tender Intelligence</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">Spojeni povjerenjem — Spojeni tenderima</p>
        </div>

        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Prijava u sistem</CardTitle>
            <CardDescription>Unesite vaše pristupne podatke za nastavak</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email adresa</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  placeholder="ime.prezime@asacentral.ba"
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Lozinka</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  required
                  data-testid="input-password"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  ⚠️ {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full mt-6 font-bold"
                disabled={loading}
                data-testid="button-submit"
              >
                {loading ? "Prijava u toku..." : "Prijavi se"}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block text-center">
                Brza testna prijava (1-klik):
              </span>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1.5 px-1 flex flex-col items-center bg-blue-50/50 hover:bg-blue-100 text-blue-900 border-blue-200"
                  onClick={() => {
                    setEmail("admin@asacentral.ba");
                    setPassword("Admin1234!");
                    setError(null);
                  }}
                >
                  <span className="font-bold">Admin</span>
                  <span className="text-[10px] text-blue-700">IT Služba</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1.5 px-1 flex flex-col items-center bg-emerald-50/50 hover:bg-emerald-100 text-emerald-900 border-emerald-200"
                  onClick={() => {
                    setEmail("nabavka@asacentral.ba");
                    setPassword("Nabavka2026!");
                    setError(null);
                  }}
                >
                  <span className="font-bold">Nabavka</span>
                  <span className="text-[10px] text-emerald-700">Amir K.</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1.5 px-1 flex flex-col items-center bg-purple-50/50 hover:bg-purple-100 text-purple-900 border-purple-200"
                  onClick={() => {
                    setEmail("pravna@asacentral.ba");
                    setPassword("Pravna2026!");
                    setError(null);
                  }}
                >
                  <span className="font-bold">Pravna</span>
                  <span className="text-[10px] text-purple-700">Amra H.</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-400">
          © 2026 ASA CENTRAL osiguranje d.d.
        </div>
      </div>
    </div>
  );
}
