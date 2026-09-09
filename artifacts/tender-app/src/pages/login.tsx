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
                className="w-full mt-6"
                disabled={loading}
                data-testid="button-submit"
              >
                {loading ? "Prijava u toku..." : "Prijavi se"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-400">
          © 2026 ASA CENTRAL osiguranje d.d.
        </div>
      </div>
    </div>
  );
}
