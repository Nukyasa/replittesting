import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";

interface LiveTender {
  id: string;
  title: string;
  contractingAuth: string;
  estimatedValue?: number | null;
  currency: string;
  deadline: string;
  receivedAt: string;
}

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("asa_auth_storage");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

export function LiveFeed() {
  const [liveTenders, setLiveTenders] = useState<LiveTender[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const connect = () => {
      const es = new EventSource(`/api/scraper/live-feed?token=${encodeURIComponent(token)}`);
      esRef.current = es;

      es.addEventListener("connected", () => setConnected(true));
      es.addEventListener("error", () => setConnected(false));

      es.addEventListener("new_insurance_tender", (e) => {
        const tender = JSON.parse(e.data) as LiveTender;
        setLiveTenders((prev) =>
          [{ ...tender, receivedAt: new Date().toISOString() }, ...prev].slice(0, 20)
        );
        setLastActivity(new Date());

        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification("Novi insurance tender!", {
            body: tender.title,
            icon: "/favicon.ico",
          });
        }
      });

      es.addEventListener("scraper_progress", (e) => {
        const data = JSON.parse(e.data) as { tendersNew?: number };
        if ((data.tendersNew ?? 0) > 0) setLastActivity(new Date());
      });
    };

    connect();

    return () => {
      esRef.current?.close();
    };
  }, []);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            Live feed — Insurance tenderi
          </span>
          <Badge
            className={connected ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}
            variant="outline"
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${connected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
            {connected ? "LIVE" : "Prekinuto"}
          </Badge>
        </CardTitle>
        {lastActivity && (
          <p className="text-xs text-gray-400">
            Zadnja aktivnost: {lastActivity.toLocaleTimeString("bs-BA")}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {liveTenders.length === 0 ? (
          <div className="px-5 pb-5 text-center text-gray-400 text-sm py-6">
            <Radio className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>Čekam nove insurance tendere...</p>
            <p className="text-xs mt-1 text-gray-300">Novi tenderi se sinkroniziraju svakih 30 min</p>
          </div>
        ) : (
          <div className="divide-y max-h-72 overflow-y-auto">
            {liveTenders.map((t, i) => (
              <div
                key={t.id + i}
                className={`px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors ${i === 0 ? "bg-amber-50" : ""}`}
                onClick={() => window.location.href = `/tenders/${t.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {i === 0 && (
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Novo</span>
                    )}
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                    <p className="text-xs text-gray-500 truncate">{t.contractingAuth}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {t.estimatedValue != null && (
                      <p className="text-xs font-semibold text-primary">
                        {new Intl.NumberFormat("de-DE").format(t.estimatedValue)} {t.currency}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(t.receivedAt).toLocaleTimeString("bs-BA")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
