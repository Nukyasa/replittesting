import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, Send, Bot, Loader2, Sparkles, BookOpen, 
  FileText, CheckCircle2, AlertTriangle, Copy, Check 
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { customFetch } from "@workspace/api-client-react";

interface AsaChatWithCitationsProps {
  tenderId: string;
  tenderTitle: string;
  contractingAuth: string;
}

const PREDEFINED_QUESTIONS = [
  {
    icon: "🚗",
    title: "Servisna mreža i tehnički pregled",
    prompt: "Koji su uslovi za servisnu mrežu i stanice tehničkog pregleda (radijus, vlastite ili ugovorne stanice)?",
  },
  {
    icon: "🤝",
    title: "Reference i podugovarači",
    prompt: "Koji su traženi podugovarači i reference (iznosi ugovora, period i minimalni broj referenci)?",
  },
  {
    icon: "⚖️",
    title: "Osnov za žalbu (Čl. 54 ZJN)",
    prompt: "Ima li osnova za žalbu na rok ili tehničku specifikaciju (npr. diskriminirajući geografski uslovi po Čl. 54 ZJN)?",
  },
  {
    icon: "🛡️",
    title: "Garancija za ozbiljnost ponude",
    prompt: "Kolika je tražena garancija za ozbiljnost ponude, u kom obliku i koliki je rok njenog važenja?",
  },
];

export function AsaChatWithCitations({ tenderId, tenderTitle, contractingAuth }: AsaChatWithCitationsProps) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    {
      role: "assistant",
      content: `Pozdrav! Ja sam **Pitaj Asu**, Vaš pravno-tehnički asistent za tender **"${tenderTitle}"** (${contractingAuth}).\n\nSvaki moj odgovor temelji se na analizi tenderske dokumentacije i citira **tačan član i broj stranice** kako biste imali 100% pravnu sigurnost.\n\nIzaberite jedno od brzih pitanja ispod ili postavite sopstveno.`
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async (questionText: string) => {
    const text = questionText.trim();
    if (!text || isLoading) return;

    setInput("");
    const newHistory = [...messages, { role: "user" as const, content: text }];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const data = await customFetch<{ response: string }>(`/api/tenders/${tenderId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          history: newHistory.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!data || typeof data.response !== "string") {
        throw new Error("Neuspješan odgovor asistenta");
      }
      setMessages([...newHistory, { role: "assistant", content: data.response }]);
    } catch (err: any) {
      console.error("Chat request failed:", err);
      toast.error(err.message || "Greška pri komunikaciji s asistentom");
      setMessages([
        ...newHistory,
        {
          role: "assistant",
          content: err.message?.includes("401") || err.message?.includes("Unauthorized")
            ? "Vaša sesija je istekla ili nije autorizovana. Molimo osvježite stranicu ili se ponovo prijavite na sistem."
            : "Došlo je do greške u komunikaciji sa serverom. Molimo pokušajte ponovo ili provjerite status tenderske dokumentacije."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyCitation = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Citat kopiran u međuspremnik");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to highlight citation badges in text
  const renderMessageContent = (content: string, msgIndex: number) => {
    // Check if message contains citation pattern: [Quote] → Source
    const citationRegex = /\[(.*?)\]\s*→\s*(Stranica\s*\d+[^/\n]*\/?\s*Član\s*[\d\w.]*|[^/\n]+)/gi;
    const hasCitations = citationRegex.test(content);

    return (
      <div className="space-y-3">
        <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed dark:text-gray-200">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>

        {hasCitations && (
          <div className="mt-2 pt-2 border-t border-indigo-100/80 bg-indigo-50/50 p-2.5 rounded-lg flex items-center justify-between text-xs text-indigo-900">
            <span className="flex items-center gap-1.5 font-semibold">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              Verifikovani citat tenderske dokumentacije
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyCitation(content, msgIndex)}
              className="h-6 px-2 text-[11px] text-indigo-700 hover:text-indigo-950 hover:bg-indigo-100"
            >
              {copiedIndex === msgIndex ? (
                <><Check className="w-3 h-3 mr-1 text-emerald-600" /> Kopirano</>
              ) : (
                <><Copy className="w-3 h-3 mr-1" /> Kopiraj nalaz</>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border-blue-100 shadow-md bg-white flex flex-col h-[650px] overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Bot className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                Pitaj Asu <span className="text-xs font-normal text-blue-200">(Sena-style Q&A)</span>
              </CardTitle>
              <p className="text-xs text-blue-200/80 truncate max-w-[400px]">
                AI asistent sa tačnim citatima stranica i članova tenderske dokumentacije
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[11px] font-mono">
            Član & Strana ZJN citiranje
          </Badge>
        </div>
      </CardHeader>

      {/* Chat Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`flex flex-col gap-1 max-w-[90%] sm:max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <span className="text-[10px] font-medium text-gray-400 px-1 uppercase tracking-wider">
                {msg.role === "user" ? "Vaš upit" : "Pitaj Asu · Zvanični nalaz"}
              </span>
              <div
                className={`rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-white border border-gray-200/80 text-gray-900 rounded-bl-sm"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  renderMessageContent(msg.content, index)
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-600 flex items-center gap-2 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Analiziram tendersku dokumentaciju i tražim tačne članove i stranice...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </CardContent>

      {/* Quick Questions & Input Bar */}
      <div className="p-3 border-t bg-white space-y-2.5 shrink-0">
        {/* Predefined 1-Click Questions */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider whitespace-nowrap pl-1">
            Brza pitanja:
          </span>
          {PREDEFINED_QUESTIONS.map((q, i) => (
            <button
              key={i}
              type="button"
              disabled={isLoading}
              onClick={() => sendMessage(q.prompt)}
              className="inline-flex items-center gap-1.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-900 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 shadow-2xs"
            >
              <span>{q.icon}</span>
              <span>{q.title}</span>
            </button>
          ))}
        </div>

        {/* Text Input Row */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Postavite pitanje o uslovima, servisnoj mreži, garantnom roku ili članu nacrta ugovora..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="text-xs sm:text-sm bg-gray-50/70 border-gray-200 focus-visible:ring-primary/20 h-10"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-primary hover:bg-primary/90 h-10 px-4 font-semibold shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </Card>
  );
}
