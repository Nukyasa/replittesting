import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  Loader2,
  FileText,
  BookmarkCheck,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const PRESET_QUESTIONS = [
  {
    id: "servisna_mreza",
    text: "Da li ispunjavamo uslove za servisnu mrežu?",
    icon: "🔧",
    description: "Provjera lokacija, ovlaštenih servisa i operativnog radijusa",
  },
  {
    id: "podugovaraci_reference",
    text: "Koji su traženi podugovarači i reference?",
    icon: "📋",
    description: "Iskustvo, minimalni iznosi ranijih ugovora i uslovi za partnere",
  },
  {
    id: "osnov_za_zalbu",
    text: "Ima li osnova za žalbu na rok ili tehničku specifikaciju?",
    icon: "⚖️",
    description: "Analiza zakonskih rokova, diskriminatornih stavki i kriterija",
  },
];

export function PitajAsuCard({
  tenderId,
  tenderTitle,
  tenderNoticeNumber,
}: {
  tenderId: string;
  tenderTitle?: string;
  tenderNoticeNumber?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleAsk = async (questionText: string) => {
    if (!questionText.trim() || loading) return;

    const userMessage: Message = { role: "user", content: questionText.trim() };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await customFetch<{ response: string }>(`/api/tenders/${tenderId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: questionText.trim(),
          history: messages.slice(-8),
        }),
      });

      if (res?.response) {
        setMessages([...newHistory, { role: "assistant", content: res.response }]);
      } else {
        setMessages([
          ...newHistory,
          {
            role: "assistant",
            content: "Odgovor nije mogao biti generisan. Molimo provjerite izvornu tendersku dokumentaciju.",
          },
        ]);
      }
    } catch (err: any) {
      toast.error("Greška pri komunikaciji sa Asom: " + (err.message || ""));
      setMessages([
        ...newHistory,
        {
          role: "assistant",
          content: "Došlo je do greške pri analizi dokumentacije. Pokušajte ponovo.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    toast.success("Citat kopiran u međuspremnik!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Card className="border-border bg-card shadow-sm overflow-hidden">
      {/* Header sa ASA brendiranjem */}
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border py-3.5 px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>Pitaj Asu</span>
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5">
                  AI Asistent
                </Badge>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Interaktivna analiza dokumentacije tendera sa citatima članova i stranica
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px] text-muted-foreground hidden sm:inline-flex">
            Pravilo: [Citat] → Stranica X / Član Y
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Predefinisana brza 1-klik pitanja ("One-click Asu Q&A") */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Brza jednokratna pitanja (1-klik):</span>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
              >
                Očisti historiju
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {PRESET_QUESTIONS.map((q) => (
              <button
                key={q.id}
                type="button"
                disabled={loading}
                onClick={() => handleAsk(q.text)}
                className="text-left p-3 rounded-lg border border-border bg-muted/30 hover:bg-primary/5 hover:border-primary/40 transition-all group disabled:opacity-60 flex flex-col justify-between"
              >
                <div className="flex items-start gap-2">
                  <span className="text-base">{q.icon}</span>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                      {q.text}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{q.description}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-primary font-medium mt-2 self-end">
                  Klikni za odgovor →
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Prikaz odgovora i konverzacije */}
        {messages.length > 0 ? (
          <div className="space-y-3 pt-2 max-h-[420px] overflow-y-auto pr-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-lg text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary/10 border border-primary/20 text-primary-foreground font-medium ml-8"
                    : "bg-background border border-border shadow-xs mr-4"
                }`}
              >
                <div className="flex items-center justify-between mb-1 text-[10px] font-mono text-muted-foreground">
                  <span className="font-bold flex items-center gap-1">
                    {m.role === "user" ? "Vaše pitanje:" : "Asa odgovor & citat:"}
                  </span>
                  {m.role === "assistant" && (
                    <button
                      onClick={() => copyToClipboard(m.content, idx)}
                      className="hover:text-foreground flex items-center gap-1"
                      title="Kopiraj odgovor"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Kopirano</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopiraj</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="prose prose-xs max-w-none text-foreground whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="p-3.5 rounded-lg border border-border bg-background shadow-xs mr-4 flex items-center gap-2.5 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                <span>Asa analizira tekst i pronalazi tačne članove i stranice dokumentacije…</span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center bg-muted/20">
            <HelpCircle className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-xs font-medium text-foreground">
              Postavite pitanje o servisnoj mreži, referencama, podugovaračima ili osnovama za žalbu.
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Odgovor će izvući tačne formulacije uz navod stranice i člana ugovora.
            </p>
          </div>
        )}

        {/* Slobodni unos za pitanje */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(input);
          }}
          className="flex items-center gap-2 pt-1"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Postavite specifično pitanje za Asu o ovom tenderu..."
            className="text-xs h-9 bg-background"
            disabled={loading}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || loading}
            className="h-9 px-3 gap-1.5 font-semibold shrink-0"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Pitaj Asu</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
