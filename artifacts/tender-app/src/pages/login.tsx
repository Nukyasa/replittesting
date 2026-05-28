import { useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  const login = useLogin();
  
  const [email, setEmail] = useState("admin@asacentral.ba");
  const [password, setPassword] = useState("Admin1234!");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ data: { email, password } }, {
      onSuccess: (data) => {
        setAuth(data.token, data.user);
        toast({ title: "Prijava uspješna", description: "Dobrodošli u ASA Tender Intelligence" });
        setLocation("/dashboard");
      },
      onError: () => {
        toast({ title: "Greška", description: "Pogrešan email ili lozinka", variant: "destructive" });
      }
    });
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
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ime.prezime@asacentral.ba" 
                  required 
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Lozinka</Label>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required 
                  data-testid="input-password"
                />
              </div>
              <Button type="submit" className="w-full mt-6" disabled={login.isPending} data-testid="button-submit">
                {login.isPending ? "Prijava u toku..." : "Prijavi se"}
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
