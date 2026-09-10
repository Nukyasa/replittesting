import { useState, useRef, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
import { useParams, Link } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import {
  useGetTender, useAnalyzeTender, useChatWithTender,
  useListTenderNotes, useCreateTenderNote, useDeleteTenderNote,
  useWatchTender, useUnwatchTender,
  getGetTenderQueryKey, getListTenderNotesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatMoney, formatDate, getScoreBadgeProps, getDeadlineBadgeProps, getStatusBadgeProps, translateTenderType, translateEntity, translateSource } from "@/lib/format";
import {
  ArrowLeft, BrainCircuit, ExternalLink, FileText, CheckCircle2, AlertTriangle,
  Send, Trash2, Plus, Bookmark, BookmarkCheck, Loader2, MessageSquare, StickyNote,
  FileDown, Clock, ShieldCheck, Gavel, ListChecks, History, Zap, ChevronRight,
  TrendingUp, Calendar, Download, Bot, RefreshCw, X, Package, Swords, FileSpreadsheet
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { bs } from "date-fns/locale";
import ReactMarkdown from 'react-markdown';
import { toast } from "sonner";
import { TenderDocuments } from "@/components/TenderDocuments";
import { TenderWorkspace } from "@/components/TenderWorkspace";
import { TenderHistory } from "@/components/TenderHistory";
import { CompanyMatch } from "@/components/CompanyMatch";
import { SenaDecisionCard } from "@/components/SenaDecisionCard";
import { TenderChangesDiff } from "@/components/TenderChangesDiff";
import { BidPackModal } from "@/components/BidPackModal";
import { LiveAuctionWarRoom } from "@/components/LiveAuctionWarRoom";
import { UrzAppealCard } from "@/components/UrzAppealCard";
import { PostSubmissionTracker } from "@/components/PostSubmissionTracker";
import { AsaChatWithCitations } from "@/components/AsaChatWithCitations";
import { AuthorityBehavioralDossier } from "@/components/AuthorityBehavioralDossier";

type TenderDetail = {
  id: string;
  externalId: string;
  source: string;
  title: string;
  description?: string | null;
  contractingAuth: string;
  category: string;
  cpvCodes: string[];
  estimatedValue?: number | null;
  currency: string;
  publicationDate: string;
  deadline: string | null;
  questionsDeadline?: string | null;
  tenderType: string;
  entity: string;
  status: string;
  statusName?: string | null;
  sourceUrl: string;
  hasEAuction: boolean;
  awardCriteria?: string | null;
  awardCriteriaDetails?: string | null;
  award?: {
    id: string;
    tenderId?: string | null;
    contractingAuth: string;
    procedureName: string;
    winnerName: string;
    winningBidAmount: number;
    currency: string;
    awardDate: string;
  } | null;
  exactAward?: {
    id: string;
    tenderId?: string | null;
    contractingAuth: string;
    procedureName: string;
    winnerName: string;
    winningBidAmount: number;
    currency: string;
    awardDate: string;
    competitorOffersCount?: number | null;
  } | null;
  guaranteeAmount?: number | null;
  guaranteeType?: string | null;
  tenderPreparationCost?: number | null;
  relevanceScore?: number | null;
  createdAt: string;
  rawData?: {
    announcement?: Record<string, unknown>;
    lots?: Record<string, unknown>[];
    [key: string]: unknown;
  } | null;
  aiAnalysis?: {
    id: string;
    summary: string;
    keyRequirements: string[];
    eligibilityCriteria: string[];
    risks: { risk: string; severity: string }[];
    opportunities: string[];
    redFlags: string[];
    estimatedWorkload: string;
    suggestedApproach: string;
    relevanceScore: number;
    relevanceTags: string[];
    competitionLevel: string;
    successProbability: number;
    insuranceRelevance: string;
    requiredDocs: string[];
    participationConditions?: {
      _analysis?: { status: string; provider: string; documentCount: number; readableDocumentCount: number; warnings: string[]; scoringAvailable: boolean; evidence?: { documentId: string; documentName: string; quote: string; kind: string }[] };
      financial?: string | null;
      technical?: string | null;
      legal?: string | null;
      experience?: string | null;
    } | null;
    requiredDeclarations?: string[] | null;
    awardAnalysis?: string | null;
    guaranteeInfo?: string | null;
    estimatedPrepTime?: string | null;
    analyzedAt: string;
  } | null;
  documents: {
    id: string;
    name: string;
    originalUrl: string;
    fileType: string;
    localPath?: string | null;
    parsedText?: string | null;
    fileSize?: number | null;
    createdAt: string;
  }[];
  userTender?: {
    id: string;
    status: string;
    priority: string;
  } | null;
  changes: {
    id: string;
    tenderId: string;
    field: string;
    oldValue?: string | null;
    newValue?: string | null;
    changedAt: string;
    notified: boolean;
  }[];
  winProbability?: any;
  authorityProfile?: any;
  historicalAwards?: any[];
};

function ValidatorPonude({ tender, notesList }: { tender: TenderDetail, notesList: any[] }) {
  const [isValidating, setIsValidating] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; status: "pending" | "pass" | "fail" | "warning"; message: string }[] | null>(null);

  const runValidation = () => {
    setIsValidating(true);
    setResults(null);
    
    setTimeout(() => {
      const newResults: any[] = [];
      
      // 1. Provjera roka
      const deadline = new Date(tender.deadline || "invalid");
      const now = new Date();
      if (Number.isNaN(deadline.getTime())) {
        newResults.push({ id: "1", name: "Rok za predaju", status: "warning", message: "Rok nije objavljen u preuzetim podacima. Provjerite EJN dokumentaciju." });
      } else if (deadline.getTime() < now.getTime()) {
        newResults.push({ id: "1", name: "Rok za predaju", status: "fail", message: "Rok za predaju ponude je istekao!" });
      } else if (deadline.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
        newResults.push({ id: "1", name: "Rok za predaju", status: "warning", message: "Rok ističe za manje od 24 sata." });
      } else {
        newResults.push({ id: "1", name: "Rok za predaju", status: "pass", message: "Validno - ima dovoljno vremena za predaju." });
      }

      // 2. Provjera izračuna cijene vs. Procijenjene vrijednosti
      const savedCalc = notesList.find(n => n.content.includes("KONAČNA PONUDA") || n.content.match(/Premija:\s*[\d.,\s]+/i));
      let isPriceOk = false;
      if (savedCalc && tender.estimatedValue) {
        const match = savedCalc.content.match(/(?:KONAČNA PONUDA|ponuda|Premija):\s*([\d.,\s]+)\s*KM/i);
        if (match && match[1]) {
          const price = parseFloat(match[1].replace(/[^\d,]/g, '').replace(',', '.'));
          if (price > tender.estimatedValue) {
            newResults.push({ id: "2", name: "Provjera Cijene", status: "warning", message: `Ponuda (${price} KM) prelazi procijenjenu vrijednost (${tender.estimatedValue} KM). Provjerite budžet i uslove konkretnog postupka.` });
          } else {
            newResults.push({ id: "2", name: "Provjera Cijene", status: "pass", message: `Ponuda (${price} KM) je unutar budžeta tendera.` });
            isPriceOk = true;
          }
        } else {
          newResults.push({ id: "2", name: "Provjera Cijene", status: "warning", message: "Nije pronađen jasan iznos ponude u bilješkama za poređenje." });
        }
      } else {
        newResults.push({ id: "2", name: "Provjera Cijene", status: "warning", message: "Kalkulacija cijene nije zabilježena u bilješkama." });
      }

      // 3. Provjera izjava i priloga
      newResults.push({ id: "3", name: "Dokumentacija (Izjave)", status: "warning", message: "Provjerite svaku izjavu, potpis, ovjeru i prilog prema originalnoj dokumentaciji. Generisani nacrt nije dokaz kompletnosti." });
      
      // 4. Garancija za ozbiljnost ponude
      if (tender.guaranteeAmount && tender.guaranteeAmount > 0) {
        newResults.push({ id: "4", name: "Bankarska garancija", status: "warning", message: `Obavezna garancija od ${tender.guaranteeAmount} KM. Provjerite da li je originalni dokument osiguran od banke.` });
      } else {
        newResults.push({ id: "4", name: "Bankarska garancija", status: "warning", message: "U preuzetim podacima nema potvrđenog iznosa garancije. Provjerite originalnu dokumentaciju." });
      }

      setResults(newResults);
      setIsValidating(false);
    }, 1500); // simulacija delay-a AI analize
  };

  return (
    <Card className="border-l-4 border-l-blue-500 shadow-sm mb-6">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              AI Validator Ponude
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Automatska provjera logičkih grešaka (rokovi, budžet, bankarska garancija) prije finalne predaje.
            </p>
          </div>
          <Button onClick={runValidation} disabled={isValidating} className="bg-blue-600 hover:bg-blue-700 text-white">
            {isValidating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Provjeravam...</> : <><ListChecks className="w-4 h-4 mr-2" /> Pokreni Provjeru</>}
          </Button>
        </div>

        {results && (
          <div className="space-y-3 mt-6">
            {results.map(r => (
              <div key={r.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                r.status === "pass" ? "bg-green-50 border-green-200 text-green-800" :
                r.status === "warning" ? "bg-amber-50 border-amber-200 text-amber-800" :
                "bg-red-50 border-red-200 text-red-800"
              }`}>
                {r.status === "pass" && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />}
                {r.status === "warning" && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
                {r.status === "fail" && <X className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                <div>
                  <h4 className="font-semibold text-sm">{r.name}</h4>
                  <p className="text-xs mt-1">{r.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChecklistaTab({ tender }: { tender: TenderDetail }) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem(`checklist_${tender.id}`);
    if (saved) {
      try { setCheckedItems(JSON.parse(saved)); } catch (e) {}
    }
  }, [tender.id]);

  const toggleItem = (item: string) => {
    const next = { ...checkedItems, [item]: !checkedItems[item] };
    setCheckedItems(next);
    localStorage.setItem(`checklist_${tender.id}`, JSON.stringify(next));
  };

  const docs = tender.aiAnalysis?.requiredDocs || [];
  const decls = tender.aiAnalysis?.requiredDeclarations || [];
  const allItems = [...docs, ...decls].filter(Boolean);

  if (allItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          <ListChecks className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Nisu pronađeni eksplicitni zahtjevi za dokumentaciju u AI analizi ili analiza još nije izvršena.</p>
        </CardContent>
      </Card>
    );
  }

  const completed = allItems.filter(item => checkedItems[item]).length;
  const progress = Math.round((completed / allItems.length) * 100);

  return (
    <Card className="border-t-4 border-t-amber-500 shadow-sm">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-amber-600" />
              Interaktivna Checklista Dokumentacije
            </h3>
            <p className="text-sm text-gray-500 mt-1">Označite dokumente koje ste pripremili za predaju.</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-amber-600">{progress}%</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Spremnost</div>
          </div>
        </div>
        
        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-6 overflow-hidden">
          <div className="bg-amber-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>

        <div className="space-y-3">
          {allItems.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleItem(item)}>
              <div className="mt-0.5 shrink-0">
                {checkedItems[item] ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>}
              </div>
              <div className={`text-sm leading-relaxed ${checkedItems[item] ? "text-gray-400 line-through" : "text-gray-800 font-medium"}`}>
                {item}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DeadlineCountdown({ date, label }: { date: string | null; label: string }) {
  if (!date) return <div className="p-3 border rounded-lg text-sm text-amber-800">{label}: nije objavljen — provjerite dokumentaciju.</div>;
  const deadline = new Date(date);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-gray-400" />
        </div>
        <div>
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</div>
          <div className="text-sm text-gray-500">{formatDate(date)} — Isteklo</div>
        </div>
      </div>
    );
  }

  let colorClass = "bg-green-50 border-green-200";
  let iconClass = "bg-green-100 text-green-600";
  let textClass = "text-green-700";
  if (diffDays <= 3) {
    colorClass = "bg-red-50 border-red-200";
    iconClass = "bg-red-100 text-red-600";
    textClass = "text-red-700";
  } else if (diffDays <= 7) {
    colorClass = "bg-amber-50 border-amber-200";
    iconClass = "bg-amber-100 text-amber-600";
    textClass = "text-amber-700";
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${colorClass}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
        <Clock className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</div>
        <div className={`text-sm font-semibold ${textClass}`}>{formatDate(date)}</div>
      </div>
      <div className={`text-right`}>
        <div className={`text-2xl font-bold tabular-nums ${textClass}`}>{diffDays}</div>
        <div className="text-xs text-gray-400">dana</div>
      </div>
    </div>
  );
}

function TimeMachine({ tender, history }: { tender: TenderDetail, history: any[] }) {
  const [diffData, setDiffData] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const findSimilar = () => {
    setIsSearching(true);
    setDiffData(null);

    setTimeout(() => {
      // Find history item with similar name or just the most recent one for this authority
      if (!history || history.length === 0) {
        setIsSearching(false);
        return;
      }

      // Very simple fuzzy logic for MVP: prefer items with same words in procedureName
      const tenderWords = tender.title.toLowerCase().split(' ').filter(w => w.length > 4);
      let bestMatch = null;
      let maxMatches = -1;

      for (const h of history) {
        if (!h.procedureName) continue;
        const hWords = h.procedureName.toLowerCase().split(' ').filter((w: string) => w.length > 4);
        const matches = hWords.filter((w: string) => tenderWords.includes(w)).length;
        if (matches > maxMatches) {
          maxMatches = matches;
          bestMatch = h;
        }
      }

      // If no good match, just take the first one (most recent)
      if (!bestMatch || maxMatches === 0) {
        bestMatch = history[0];
      }

      setDiffData(bestMatch);
      setIsSearching(false);
    }, 1000);
  };

  return (
    <Card className="border-t-4 border-t-purple-500 shadow-sm mb-6 bg-gradient-to-br from-white to-purple-50">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" />
              Vremeplov (Time-Machine)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Automatski pronađite prošlogodišnji ugovor za ovog organa i uporedite cijene.
            </p>
          </div>
          <Button onClick={findSimilar} disabled={isSearching} className="bg-purple-600 hover:bg-purple-700 text-white">
            {isSearching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Tražim...</> : <><History className="w-4 h-4 mr-2" /> Pronađi sličan tender</>}
          </Button>
        </div>

        {diffData && (
          <div className="mt-6 border-t border-purple-200 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg border border-purple-100 shadow-sm">
                <div className="text-xs font-bold uppercase text-purple-500 mb-2">Prošlogodišnji (Sličan) Tender</div>
                <div className="font-semibold text-gray-800 text-sm mb-3">{diffData.procedureName}</div>
                <div className="flex justify-between items-center text-sm border-b pb-2 mb-2">
                  <span className="text-gray-500">Pobjednik:</span>
                  <span className="font-bold text-gray-900">{diffData.winnerName}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b pb-2 mb-2">
                  <span className="text-gray-500">Pobjednička cijena:</span>
                  <span className="font-bold text-red-600">{diffData.winningBidAmount ? diffData.winningBidAmount.toLocaleString("bs-BA") : "Nepoznato"} {diffData.currency || "KM"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Broj ponuda:</span>
                  <span className="font-bold text-gray-900">{diffData.competitorOffersCount || "N/A"}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm relative">
                <div className="text-xs font-bold uppercase text-blue-500 mb-2">Trenutni Tender (Ove Godine)</div>
                <div className="font-semibold text-gray-800 text-sm mb-3">{tender.title}</div>
                <div className="flex justify-between items-center text-sm border-b pb-2 mb-2">
                  <span className="text-gray-500">Naš planirani ponuđač:</span>
                  <span className="font-bold text-gray-900">ASA CENTRAL osiguranje</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b pb-2 mb-2">
                  <span className="text-gray-500">Procijenjena vrijednost:</span>
                  <span className="font-bold text-blue-600">{tender.estimatedValue ? tender.estimatedValue.toLocaleString("bs-BA") : "Nepoznato"} {tender.currency || "KM"}</span>
                </div>
                
                {diffData.winningBidAmount && tender.estimatedValue && (
                  <div className="mt-4 bg-green-50 text-green-800 p-3 rounded border border-green-200 text-sm">
                    <strong>AI Preporuka:</strong> Prošle godine tender je osvojen za <strong>{Math.round((diffData.winningBidAmount / tender.estimatedValue) * 100)}%</strong> ovogodišnje procijenjene vrijednosti. Razmislite o ponudi oko <strong>{diffData.winningBidAmount.toLocaleString("bs-BA")} KM</strong>.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FieldLabel({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm text-gray-800 font-medium">{value || "N/A"}</div>
    </div>
  );
}

function changeFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    deadline: "Rok za prijem ponuda",
    questionsDeadline: "Rok za pitanja",
    estimatedValue: "Procijenjena vrijednost",
    status: "Status",
    statusName: "Naziv statusa",
  };
  return labels[field] || field;
}

function formatChangeValue(field: string, value: string | null | undefined): string {
  if (!value || value === "N/A" || value === "null") return "N/A";
  if (field === "deadline" || field === "questionsDeadline") {
    try { return new Date(value).toLocaleDateString("bs-BA"); } catch { return value; }
  }
  if (field === "estimatedValue") {
    const n = parseFloat(value);
    if (!isNaN(n)) return n.toLocaleString("bs-BA") + " KM";
  }
  return value;
}

export default function TenderDetail() {
  const { token } = useAuthStore();
  const params = useParams();
  const id = params.id!;
  const queryClient = useQueryClient();

  const { data: tender, isLoading } = useGetTender(id, {
    query: { enabled: !!id, queryKey: getGetTenderQueryKey(id) },
  });

  const { data: notes, isLoading: notesLoading } = useListTenderNotes(id);

  useEffect(() => {
    if (id) {
      try {
        const saved = JSON.parse(localStorage.getItem("viewed-tenders") || "[]");
        if (!saved.includes(id)) {
          localStorage.setItem("viewed-tenders", JSON.stringify([...saved, id]));
        }
      } catch {}
    }
  }, [id]);

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateOffer = async () => {
    try {
      setIsGenerating(true);
      const response = await fetch(`/api/tenders/${id}/generate-offer`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tenderId: id })
      });
      if (!response.ok) throw new Error('Greška pri generaciji');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ponuda_${tender?.title || "tender"}_ASACentral.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Uspješno generisana ponuda!");
    } catch (err: any) {
      console.error('Generator greška:', err);
      toast.error('Greška pri generaciji ponude: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const { data: rawInsights, isLoading: insightsLoading } = useQuery({
    queryKey: ["competitor-insights", id],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${id}/competitor-insights`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch competitor insights");
      return res.json() as Promise<{
        matchFound: boolean;
        sourceType: string;
        targetAuthority: string;
        avgWinningBid: number;
        aiSummary?: string;
        topCompetitor: string;
        totalCompetitorOffers: number;
        dataSource: string;
        history: {
          id: string;
          procedureName: string;
          winnerName: string;
          winningBidAmount: number;
          currency: string;
          awardDate: string;
          competitorOffersCount: number;
        }[];
      }>;
    },
    enabled: !!id && !!token
  });

  const insights: any = rawInsights || {};

  const { data: competitors, isLoading: competitorsLoading } = useQuery({
    queryKey: ["tender-competitors", id],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${id}/competitors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch competitors");
      return res.json();
    },
    enabled: !!id && !!token
  });

  const { data: calcData } = useQuery({
    queryKey: ["tender-calculation", id],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${id}/calculation`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch calculation data");
      return res.json();
    },
    enabled: !!id && !!token
  });

  const { data: senaIntelligenceData } = useQuery({
    queryKey: ["sena-intelligence", id],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${id}/sena-intelligence`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch sena intelligence");
      return res.json();
    },
    enabled: !!id && !!token
  });

  const updateTenderStatus = useMutation({
    mutationFn: async (newStatus: "INTERESTED" | "NOT_INTERESTED" | "SUBMITTED" | "DRAFT" | "PENDING") => {
      const res = await fetch(`/api/tenders/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Neuspješno ažuriranje statusa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenders", id] });
      toast.success("Status ažuriran");
    },
  });

  const uploadDocs = useMutation({
    mutationFn: async (files: FileList | File[]) => {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }
      const res = await fetch(`/api/tenders/${id}/documents/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Neuspješan upload");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenders", id] });
      toast.success("Dokumenti uspješno učitani!", { description: "Sada možete pokrenuti AI analizu."});
    },
    onError: () => {
      toast.error("Greška prilikom uploada.");
    }
  });

  const fetchRealDocs = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tenders/${id}/fetch-real-docs`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        }
      });
      if (!res.ok) throw new Error("Failed to fetch real docs");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tenders/${id}`] });
      toast.success("Uspješno preuzeto", { description: "Pravi PDF dokumenti i aneksi su preuzeti sa EJN-a." });
    },
    onError: () => {
      toast.error("Greška", { description: "Nije moguće preuzeti dokumentaciju sa EJN." });
    }
  });

  const analyzeTender = useAnalyzeTender();
  const chatMutation = useChatWithTender();
  const createNote = useCreateTenderNote();
  const deleteNote = useDeleteTenderNote();
  const watchMutation = useWatchTender();
  const unwatchMutation = useUnwatchTender();

  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  
  // Tab control and declaration states
  const [activeTab, setActiveTab] = useState<string>("pregled");

  // Selektuj tab na osnovu query parametara (npr. ?tab=dokumenti)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const tab = url.searchParams.get("tab");
      if (tab && [
        "pregled",
        "rokovi",
        "analiza",
        "ai-analiza",
        "uslovi",
        "konkurencija",
        "zjn-kontrolna",
        "radni-dosje",
        "historija-dodjela",
        "parsirano",
        "chat",
        "biljeske",
        "kalkulator",
        "aneksi",
        "dokumenti",
        "historija",
        "izmjene-td",
      ].includes(tab)) {
        setActiveTab(tab);
      }
    } catch {
      // no-op
    }
  }, []);
  const [activeDeclaration, setActiveDeclaration] = useState<{ title: string; content: string; type: string } | null>(null);
  
  // PDF Viewer states
  const [activePdfUrl, setActivePdfUrl] = useState<{ url: string; name: string } | null>(null);
  const [pdfMode, setPdfMode] = useState<"direct" | "google">("direct");

  // Win Probability & CA History Modal states
  const [showWinProbabilityModal, setShowWinProbabilityModal] = useState(false);
  const [showCaHistoryModal, setShowCaHistoryModal] = useState(false);
  const [showBidPackModal, setShowBidPackModal] = useState(false);
  const [showWarRoomModal, setShowWarRoomModal] = useState(false);
  const [isExtractingFleet, setIsExtractingFleet] = useState(false);

  const handleExtractFleet = async () => {
    if (!t) return;
    try {
      setIsExtractingFleet(true);
      const res = await fetch(`/api/tenders/${t.id}/extract-fleet-excel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Neuspješno generisanje tabele voznog parka");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vozni_Park_Kalkulacija_${t.externalId || t.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Excel specifikacija voznog parka uspješno preuzeta!");
    } catch (err: any) {
      toast.error(err.message || "Greška pri preuzimanju");
    } finally {
      setIsExtractingFleet(false);
    }
  };

  // Tariff calculator states
  const [calcType, setCalcType] = useState<"fleet" | "property">("fleet");
  const [numVehicles, setNumVehicles] = useState<number>(30);
  const [avgVehicleValue, setAvgVehicleValue] = useState<number>(45000);
  const [kaskoRate, setKaskoRate] = useState<number>(2.4);
  const [fixedAoPremium, setFixedAoPremium] = useState<number>(320);
  const [fleetDiscount, setFleetDiscount] = useState<number>(10);

  // Property state
  const [propertyValue, setPropertyValue] = useState(1500000);
  const [propertyRate, setPropertyRate] = useState(0.15);
  const [liabilityRate, setLiabilityRate] = useState(0.05);
  const [propertyDiscount, setPropertyDiscount] = useState(15);

  // New states for Guarantee and Validity fetched from API
  const [guaranteeAmount, setGuaranteeAmount] = useState(0);
  const [deliveryDays, setDeliveryDays] = useState(0);

  useEffect(() => {
    if (calcData) {
      if (calcData.guaranteeAmount) setGuaranteeAmount(calcData.guaranteeAmount);
      if (calcData.deliveryDays) setDeliveryDays(calcData.deliveryDays);
      if (calcData.estimatedValue) {
        // Option: pre-fill propertyValue or avgVehicleValue based on estimatedValue
        setPropertyValue(calcData.estimatedValue);
      }
    }
  }, [calcData]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!tender) {
    return (
      <div className="p-12 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">Tender nije pronađen</h2>
        <Link href="/tenders"><Button variant="outline" className="mt-4">Nazad na listu</Button></Link>
      </div>
    );
  }

  const t = tender as unknown as TenderDetail;
  const scoreProps = getScoreBadgeProps(t.relevanceScore);
  const deadlineProps = getDeadlineBadgeProps(t.deadline);
  const statusProps = getStatusBadgeProps(t.status);

  const handleAnalyze = async () => {
    try {
      await analyzeTender.mutateAsync({ id });
      await queryClient.invalidateQueries({ queryKey: getGetTenderQueryKey(id) });
      await queryClient.invalidateQueries({ queryKey: ["competitor-insights", id] });
      await queryClient.invalidateQueries({ queryKey: ["tender-competitors", id] });
      await queryClient.invalidateQueries({ queryKey: ["tender-calculation", id] });
      await new Promise(resolve => setTimeout(resolve, 1500));
      await queryClient.invalidateQueries({ queryKey: getGetTenderQueryKey(id) });
      toast.success("Obrada izvora završena");
      setTimeout(() => setActiveTab("analiza"), 300);
    } catch {
      toast.error("Greška pri pokretanju analize");
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const message = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: message }]);

    try {
      const res = await chatMutation.mutateAsync({
        id,
        data: { message, history: chatMessages },
      });
      setChatMessages(prev => [...prev, { role: "assistant", content: res.response }]);
    } catch {
      toast.error("Greška u AI chat komunikaciji");
      setChatMessages(prev => prev.slice(0, -1));
    }
  };

  // Fleet Calculations
  const rawKasko = numVehicles * avgVehicleValue * (kaskoRate / 100);
  const rawAo = numVehicles * fixedAoPremium;
  const totalRawFleet = rawKasko + rawAo;
  const discountFleetAmount = totalRawFleet * (fleetDiscount / 100);
  const netFleetPremium = totalRawFleet - discountFleetAmount;
  const taxFleet = netFleetPremium * 0.05; // 5% porez
  const finalFleetPremium = netFleetPremium + taxFleet;

  // Property Calculations
  const rawProp = propertyValue * (propertyRate / 100);
  const rawLiab = propertyValue * (liabilityRate / 100);
  const totalRawProp = rawProp + rawLiab;
  const discountPropAmount = totalRawProp * (propertyDiscount / 100);
  const netPropPremium = totalRawProp - discountPropAmount;
  const taxProp = netPropPremium * 0.05; // 5% porez
  const finalPropPremium = netPropPremium + taxProp;

  const handleSaveCalculation = async () => {
    let noteContent = "";
    if (calcType === "fleet") {
      noteContent = `🧮 KAKULACIJA OSIGURANJA FLOTE (ASA Central)\n` +
        `• Broj vozila: ${numVehicles}\n` +
        `• Prosječna vrijednost vozila: ${avgVehicleValue.toLocaleString("bs-BA")} KM\n` +
        `• Kasko stopa: ${kaskoRate}%\n` +
        `• Kasko premija (neto): ${rawKasko.toLocaleString("bs-BA")} KM\n` +
        `• AO fiksna premija: ${fixedAoPremium} KM\n` +
        `• AO premija (neto): ${rawAo.toLocaleString("bs-BA")} KM\n` +
        `• Popust na flotu: ${fleetDiscount}%\n` +
        `• Neto premija sa popustom: ${netFleetPremium.toLocaleString("bs-BA")} KM\n` +
        `• Porez i fondovi (5%): ${taxFleet.toLocaleString("bs-BA")} KM\n` +
        `=========================================\n` +
        `➡️ KONAČNA PONUDA: ${finalFleetPremium.toLocaleString("bs-BA")} KM`;
    } else {
      noteContent = `🧮 KAKULACIJA OSIGURANJA IMOVINE (ASA Central)\n` +
        `• Vrijednost imovine/objekata: ${propertyValue.toLocaleString("bs-BA")} KM\n` +
        `• Stopa za imovinu (Požar/Šteta): ${propertyRate}%\n` +
        `• Stopa za odgovornost: ${liabilityRate}%\n` +
        `• Neto premija (neto): ${totalRawProp.toLocaleString("bs-BA")} KM\n` +
        `• Popust: ${propertyDiscount}%\n` +
        `• Neto premija sa popustom: ${netPropPremium.toLocaleString("bs-BA")} KM\n` +
        `• Porez i fondovi (5%): ${taxProp.toLocaleString("bs-BA")} KM\n` +
        `=========================================\n` +
        `➡️ KONAČNA PONUDA: ${finalPropPremium.toLocaleString("bs-BA")} KM`;
    }

    try {
      // Save to Notes
      await createNote.mutateAsync({ id, data: { content: noteContent } });
      await queryClient.invalidateQueries({ queryKey: getListTenderNotesQueryKey(id) });
      
      // Save to Calculation DB table
      await fetch(`/api/tenders/${id}/calculation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          guaranteeAmount,
          deliveryDays,
          basePremium: calcType === "fleet" ? finalFleetPremium : finalPropPremium,
          validityDays: 0
        })
      });

      toast.success("Kalkulacija sačuvana u bilješke i bazu!");
    } catch {
      toast.error("Greška pri čuvanju kalkulacije");
    }
  };

  const handleCreateNote = async () => {
    if (!noteInput.trim()) return;
    try {
      await createNote.mutateAsync({ id, data: { content: noteInput.trim() } });
      setNoteInput("");
      await queryClient.invalidateQueries({ queryKey: getListTenderNotesQueryKey(id) });
      toast.success("Bilješka dodana");
    } catch {
      toast.error("Greška pri dodavanju bilješke");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote.mutateAsync({ id, noteId });
      await queryClient.invalidateQueries({ queryKey: getListTenderNotesQueryKey(id) });
      toast.success("Bilješka obrisana");
    } catch {
      toast.error("Greška pri brisanju bilješke");
    }
  };

  const isWatched = (t as unknown as Record<string, unknown>).isWatched as boolean | undefined;

  const handleWatch = async () => {
    try {
      if (isWatched) {
        await unwatchMutation.mutateAsync({ id });
        toast.success("Tender uklonjen iz praćenja");
      } else {
        await watchMutation.mutateAsync({ id });
        toast.success("Tender dodan u praćenje");
      }
      await queryClient.invalidateQueries({ queryKey: getGetTenderQueryKey(id) });
    } catch {
      toast.error("Greška");
    }
  };

  const rawData = t.rawData as any;
  const announcementId = rawData?.announcement?.Id || rawData?.Id;
  const ejnUrl = "https://www.ejn.gov.ba/Announcement/Search";
  const ejnLink = "https://www.ejn.gov.ba/Announcement/Search";

  const generatePDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = 210;
    const margin = 20;
    let y = 20;

    doc.setFillColor(0, 45, 130);
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("ASA Tender Intelligence", margin, 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Izvještaj o tenderu", margin, 25);
    doc.text(new Date().toLocaleDateString("bs-BA"), pageWidth - margin, 25, { align: "right" });

    y = 48;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(t.title || "Bez naziva", pageWidth - 2 * margin);
    doc.text(titleLines, margin, y);
    y += (titleLines as string[]).length * 6 + 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const statusColor: [number, number, number] = t.status === "open" ? [34, 197, 94] : t.status === "closed" ? [239, 68, 68] : [156, 163, 175];
    doc.setFillColor(...statusColor);
    doc.roundedRect(margin, y, 32, 7, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(t.statusName || (t.status === "open" ? "Aktivan" : "Zatvoren"), margin + 2, y + 5);
    y += 14;

    doc.setTextColor(0, 0, 0);
    const fields: [string, string][] = [
      ["Ugovorni organ:", t.contractingAuth || "-"],
      ["Entitet:", t.entity || "-"],
      ["Datum objave:", t.publicationDate ? new Date(t.publicationDate).toLocaleDateString("bs-BA") : "-"],
      ["Rok za ponude:", t.deadline ? formatDate(t.deadline) : "-"],
      ["Rok za pitanja:", t.questionsDeadline ? new Date(t.questionsDeadline).toLocaleDateString("bs-BA") : "N/A"],
      ["Procijenjena vrijednost:", t.estimatedValue ? `${new Intl.NumberFormat("bs-BA").format(t.estimatedValue)} ${t.currency || "KM"}` : "-"],
      ["CPV kod:", (t.cpvCodes || []).join(", ") || "-"],
      ["Tip nabavke:", translateTenderType(t.tenderType) || "-"],
      ["E-aukcija:", t.hasEAuction ? "Da" : "Ne"],
      ["Kriterij dodjele:", t.awardCriteria || "-"],
      ["Garancija:", t.guaranteeAmount ? `${new Intl.NumberFormat("bs-BA").format(t.guaranteeAmount)} ${t.currency || "KM"} (${t.guaranteeType || ""})` : "N/A"],
      ["EJN ID:", t.externalId || "-"],
    ];

    doc.setFontSize(9);
    for (const [label, value] of fields) {
      doc.setFont("helvetica", "bold");
      doc.text(label, margin, y);
      doc.setFont("helvetica", "normal");
      const valueLines = doc.splitTextToSize(String(value), pageWidth - margin - 72);
      doc.text(valueLines, margin + 70, y);
      y += Math.max((valueLines as string[]).length * 5, 6) + 2;
      if (y > 270) { doc.addPage(); y = 20; }
    }

    if (t.aiAnalysis?.summary) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("AI Analiza", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const summaryLines = doc.splitTextToSize(t.aiAnalysis.summary, pageWidth - 2 * margin);
      doc.text(summaryLines, margin, y);
      y += (summaryLines as string[]).length * 5 + 4;
    }

    const totalPages = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.line(margin, 285, pageWidth - margin, 285);
      doc.text(`Generirano: ${new Date().toLocaleString("bs-BA")} | ASA Tender Intelligence`, margin, 290);
      doc.text(`Str. ${i}/${totalPages}`, pageWidth - margin, 290, { align: "right" });
    }

    const safeName = (t.title || "tender").slice(0, 40).replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-");
    doc.save(`${t.externalId || "tender"}-${safeName}.pdf`);
    toast.success("PDF preuzet");
  };

  const metadata = t.aiAnalysis?.participationConditions?._analysis;
  const analysis = metadata ? t.aiAnalysis : null;
  const changes = t.changes || [];
  const notesList = (notes as { id: string; content: string; createdAt: string | null }[] | undefined) || [];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-6 min-w-0">
        <section className="rounded-xl border bg-blue-50/50 p-4 space-y-2" aria-label="Status obrade">
          <p className="font-semibold text-sm">{metadata?.status === "ai_review" ? "AI pregled na osnovu dokumenata" : metadata?.status === "document_review" ? "Pregled izdvojenog teksta" : "Potrebna obrada dokumentacije"}</p>
          <p className="text-sm text-gray-600">{metadata ? metadata.readableDocumentCount + " dokumenata sa tekstom / " + metadata.documentCount + " datoteka u obradi." : "Za provjerljiv pregled uslova otvorite Dokumenti, preuzmite ili dodajte dokumentaciju i pokrenite obradu. Ranije procjene bez izvora nisu potvrđene."}</p>
          {metadata?.warnings?.map((warning, i) => <p key={i} className="text-xs text-amber-800">{warning}</p>)}
          {!!metadata?.evidence?.length && <details><summary className="text-sm text-primary cursor-pointer">Izvori izdvojenih zahtjeva ({metadata.evidence.length})</summary><div className="space-y-2 mt-3">{metadata.evidence.map((source, i) => <blockquote key={i} className="border-l-2 pl-3 text-xs"><p className="font-semibold">{source.documentName}</p><p>{source.quote}</p></blockquote>)}</div></details>}
        </section>
        <div className="space-y-4">
          <Link href="/tenders">
            <Button variant="ghost" size="sm" className="-ml-2 text-gray-500">
              <ArrowLeft className="w-4 h-4 mr-1" /> Nazad na listu
            </Button>
          </Link>

          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-white">{t.source}</Badge>
                <Badge className={statusProps.className}>{t.statusName || statusProps.label}</Badge>
                <Badge className={deadlineProps.className}>{deadlineProps.label}</Badge>
                {t.hasEAuction && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                    <Zap className="w-3 h-3 mr-1" /> E-aukcija
                  </Badge>
                )}
                {t.relevanceScore != null && (
                  <Badge className={scoreProps.className}>{scoreProps.label} ({t.relevanceScore})</Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{t.title}</h1>
              <p className="text-gray-600 font-medium text-base">{t.contractingAuth} · {t.entity}</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleWatch}
                disabled={watchMutation.isPending || unwatchMutation.isPending}
              >
                {isWatched ? (
                  <><BookmarkCheck className="w-4 h-4 mr-2 text-primary" /> Praćen</>
                ) : (
                  <><Bookmark className="w-4 h-4 mr-2" /> Prati</>
                )}
              </Button>
              <Button variant="outline" onClick={generatePDF}>
                <FileDown className="w-4 h-4 mr-2" /> PDF Sažetak
              </Button>
              <Button 
                className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-md font-bold px-4"
                onClick={() => handleGenerateOffer()}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generisanje...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" /> Ponuda (.docx)</>
                )}
              </Button>
              <Button 
                className="bg-primary text-white hover:bg-primary/90 shadow-md font-bold px-4"
                onClick={() => setShowBidPackModal(true)}
              >
                <Package className="w-4 h-4 mr-2" /> Bid Pack (7x DOCX .zip)
              </Button>
              <Button 
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50 font-bold px-4 shadow-sm"
                onClick={() => setShowWarRoomModal(true)}
              >
                <Swords className="w-4 h-4 mr-2" /> War Room e-Aukcije
              </Button>
              <Button 
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-medium px-3 shadow-sm"
                onClick={handleExtractFleet}
                disabled={isExtractingFleet}
              >
                {isExtractingFleet ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Izvoz tabele...</>
                ) : (
                  <><FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" /> Vozni park (.xlsx)</>
                )}
              </Button>
              <a href={`/api/tenders/${t.id}/pdf?token=${token}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <ExternalLink className="w-4 h-4 mr-2" /> Originalni PDF
                </Button>
              </a>
              {ejnLink && (
                <a href={ejnLink} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/5">
                    EJN Portal <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Visualizer */}
        {(() => {
          const pubDate = t.publicationDate ? new Date(t.publicationDate).getTime() : 0;
          const dlDate = t.deadline ? new Date(t.deadline || "invalid").getTime() : 0;
          const now = Date.now();
          let progressPercent = 0;
          let timelineColor = "bg-green-500";
          let timelineLabel = "Otvoreno za prijave";
          if (pubDate && dlDate && dlDate > pubDate) {
            const totalDuration = dlDate - pubDate;
            const elapsed = now - pubDate;
            progressPercent = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
            if (now > dlDate) {
              timelineColor = "bg-red-500";
              timelineLabel = "Rok istekao / Završeno";
            } else if (progressPercent > 85) {
              timelineColor = "bg-amber-500";
              timelineLabel = "Rok uskoro ističe!";
            }
          } else if (!dlDate) {
            timelineColor = "bg-gray-300";
            timelineLabel = "Rok nije objavljen — potrebna provjera";
          } else if (now > dlDate) {
            progressPercent = 100;
            timelineColor = "bg-red-500";
            timelineLabel = "Završeno";
          }
          return (
            <Card className="border-gray-200 shadow-sm border-t-2 border-t-primary mt-2 mb-4">
              <CardContent className="p-4">
                <div className="flex justify-between text-xs font-semibold mb-2 text-gray-600">
                  <div className="flex items-center gap-1"><Calendar className="w-4 h-4 text-gray-400" /> Objavljeno: {t.publicationDate ? new Date(t.publicationDate).toLocaleDateString("bs-BA") : "-"}</div>
                  <div className={`font-bold uppercase tracking-wider ${now > dlDate ? "text-red-600" : "text-primary"}`}>{timelineLabel}</div>
                  <div className="flex items-center gap-1"><Clock className={`w-4 h-4 ${now > dlDate ? "text-red-400" : "text-amber-500"}`} /> Rok: {t.deadline ? formatDate(t.deadline) : "-"}</div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                  <div className={`h-3 rounded-full ${timelineColor} transition-all duration-1000 ease-out`} style={{ width: `${progressPercent}%` }}></div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* SENA INTELLIGENCE & DECISION ENGINE */}
        <SenaDecisionCard tenderId={t.id} currentDecision={t.userTender?.status} tender={t} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-white border w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="radni-dosje">Odluka i zadaci</TabsTrigger>
            <TabsTrigger value="chat" className="text-blue-700 font-bold bg-blue-50/70 border border-blue-200">💬 Pitaj Asu (Sena Q&A)</TabsTrigger>
            <TabsTrigger value="izmjene-td" className="text-amber-700 font-semibold bg-amber-50/50">🔔 Izmjene TD & Pitanja</TabsTrigger>
            <TabsTrigger value="dosje-organa" className="text-indigo-700 font-semibold bg-indigo-50/70 border border-indigo-200">🏛️ Dosje organa (Sena Analytics)</TabsTrigger>
            <TabsTrigger value="historija-dodjela">Prethodni dobitnici</TabsTrigger>
            <TabsTrigger value="podudarnost-firme">Podudarnost firme</TabsTrigger>
            <TabsTrigger value="pregled">📋 Pregled</TabsTrigger>
            <TabsTrigger value="rokovi">⏱ Rokovi</TabsTrigger>
            <TabsTrigger value="lotovi">▦ Lotovi i CPV</TabsTrigger>
            <TabsTrigger value="dokumenti">📄 Dokumenti</TabsTrigger>
            <TabsTrigger value="kalkulator" className="text-emerald-700 font-bold bg-emerald-50/70 border border-emerald-200">🧮 Kalkulator ponude (ASA Tarife)</TabsTrigger>
            <TabsTrigger value="zjn-kontrolna">🤖 Priprema ponude</TabsTrigger>
            <TabsTrigger value="analiza">📊 Analiza</TabsTrigger>
            <TabsTrigger value="parsirano">🔍 Parsirano</TabsTrigger>
            <TabsTrigger value="biljeske">💬 Bilješke</TabsTrigger>
          </TabsList>

          {/* PREGLED TAB */}
          <TabsContent value="radni-dosje" className="mt-6 space-y-6">
            <PostSubmissionTracker
              tenderId={t.id}
              tenderTitle={t.title}
              contractingAuth={t.contractingAuth}
              externalId={t.externalId}
            />
            <TenderWorkspace tenderId={t.id} />
          </TabsContent>
          <TabsContent value="izmjene-td" className="mt-6 space-y-6">
            <UrzAppealCard
              tenderId={t.id}
              tenderTitle={t.title}
              contractingAuth={t.contractingAuth}
            />
            <TenderChangesDiff tenderId={t.id} tenderTitle={t.title} deadline={t.deadline} />
          </TabsContent>
          <TabsContent value="historija-dodjela" className="mt-6"><TenderHistory tenderId={t.id} /></TabsContent>
          <TabsContent value="podudarnost-firme" className="mt-6"><CompanyMatch tenderId={t.id} /></TabsContent>
          <TabsContent value="pregled" className="mt-6 space-y-6">
            {t.award && (
              <Card className="border-l-4 border-l-green-500 bg-green-50/10 shadow-sm border border-gray-200">
                <CardHeader className="pb-2 border-b bg-green-50/30">
                  <CardTitle className="text-sm font-bold text-green-800 flex items-center gap-1.5">
                    <Gavel className="w-4 h-4 text-green-600" /> Podaci o dodjeli ugovora (Završen postupak)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FieldLabel label="Ugovor dodijeljen (Pobjednik)" value={t.award.winnerName} />
                  <FieldLabel label="Vrijednost ugovora" value={formatMoney(t.award.winningBidAmount, t.award.currency || "KM")} />
                  <FieldLabel label="Datum dodjele" value={formatDate(t.award.awardDate)} />
                </CardContent>
              </Card>
            )}

            {/* Tenderska dokumentacija - izvučeni podaci */}
            {(() => {
              const raw = t.rawData as any;
              const notice = raw?.announcement || raw;
              if (!notice) return null;
              const tdItems: { label: string; value: string }[] = [];
              if (notice?.EconomicAbility) tdItems.push({ label: "Ekonomska i finansijska sposobnost", value: notice.EconomicAbility });
              if (notice?.TechnicalAbility) tdItems.push({ label: "Tehnička i profesionalna sposobnost", value: notice.TechnicalAbility });
              if (notice?.ProfessionalActivity) tdItems.push({ label: "Profesionalna djelatnost", value: notice.ProfessionalActivity });
              if (notice?.ParticipationRestrictions) tdItems.push({ label: "Uslovi za učešće / Ograničenja", value: notice.ParticipationRestrictions });
              if (notice?.PaymentRequirements) tdItems.push({ label: "Uslovi plaćanja", value: notice.PaymentRequirements });
              if (notice?.AdditionalInformation) tdItems.push({ label: "Dodatne informacije", value: notice.AdditionalInformation });
              if (notice?.SpecialConditionsText) tdItems.push({ label: "Posebni uslovi", value: notice.SpecialConditionsText });
              if (notice?.DocumentationTakeOverDeadlineDate) tdItems.push({ label: "Rok za preuzimanje TD", value: formatDate(notice.DocumentationTakeOverDeadlineDate) });
              if (notice?.DocumentationTakeOverContactPerson) tdItems.push({ label: "Kontakt za TD", value: `${notice.DocumentationTakeOverContactPerson}${notice.DocumentationTakeOverEmailAddress ? ` (${notice.DocumentationTakeOverEmailAddress})` : ""}${notice.DocumentationTakeOverPhoneNumber ? ` - ${notice.DocumentationTakeOverPhoneNumber}` : ""}` });
              if (notice?.DocumentationTakeOverAddress) tdItems.push({ label: "Adresa za preuzimanje TD", value: `${notice.DocumentationTakeOverAddress}, ${notice.DocumentationTakeOverCityName || ""}` });
              if (notice?.BidOpeningAddress) tdItems.push({ label: "Adresa za otvaranje ponuda", value: notice.BidOpeningAddress });
              if (notice?.BidOpeningDateTime) tdItems.push({ label: "Datum otvaranja ponuda", value: formatDate(notice.BidOpeningDateTime) });
              if (notice?.OfferDeliveryAddress) tdItems.push({ label: "Adresa za dostavu ponuda", value: `${notice.OfferDeliveryAddress}, ${notice.OfferDeliveryCityName || ""}` });
              if (notice?.HasTenderDocumentationFee && notice?.TenderDocumentationFee) tdItems.push({ label: "Naknada za TD", value: `${notice.TenderDocumentationFee} KM` });
              if (tdItems.length === 0) return null;
              return (
                <Card className="border-l-4 border-l-blue-500 bg-blue-50/5 shadow-sm border border-gray-200">
                  <CardHeader className="pb-2 border-b bg-blue-50/30">
                    <CardTitle className="text-sm font-bold text-blue-800 flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4 text-blue-600" /> Tenderska dokumentacija (EJN podaci)
                    </CardTitle>
                    <p className="text-xs text-blue-600 mt-1">Ovi podaci su izvučeni iz EJN portala. AI Chat ima pristup ovim informacijama.</p>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {tdItems.map((item, i) => (
                      <div key={i} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                        <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{item.label}</div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.value}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm text-gray-700">Osnovne informacije</CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 gap-4">
                  <FieldLabel label="Ugovorni organ" value={t.contractingAuth} />
                  <FieldLabel label="Entitet" value={translateEntity(t.entity)} />
                  <FieldLabel label="Datum objave" value={formatDate(t.publicationDate)} />
                  <FieldLabel label="Tip nabavke" value={translateTenderType(t.tenderType)} />
                  <FieldLabel label="Kategorija" value={t.category} />
                  <FieldLabel label="Status" value={t.statusName || statusProps.label} />
                  {t.cpvCodes && t.cpvCodes.length > 0 && (
                    <div className="col-span-2">
                      <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">CPV kodovi</div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.cpvCodes.map((c, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-gray-50">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm text-gray-700 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Finansijski detalji
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Procijenjena vrijednost</span>
                    <span className="text-lg font-bold text-primary">
                      {t.estimatedValue
                        ? t.estimatedValue.toLocaleString("bs-BA") + " " + (t.currency || "KM")
                        : "N/A"}
                    </span>
                  </div>
                  {t.tenderPreparationCost != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Troškovi pripreme</span>
                      <span className="font-medium">{formatMoney(t.tenderPreparationCost, t.currency)}</span>
                    </div>
                  )}
                  {t.guaranteeAmount != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Garancija</span>
                      <span className="font-medium">{formatMoney(t.guaranteeAmount, t.currency)}</span>
                    </div>
                  )}
                  {t.guaranteeType && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Vrsta garancije</span>
                      <span className="font-medium">{t.guaranteeType}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">E-aukcija</span>
                    <span className={`font-medium ${t.hasEAuction ? "text-purple-600" : "text-gray-500"}`}>
                      {t.hasEAuction ? "DA" : "NE"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {t.awardCriteria && (
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm text-gray-700 flex items-center gap-1.5">
                    <Gavel className="w-4 h-4" /> Kriteriji za dodjelu
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{t.awardCriteria}</Badge>
                  </div>
                  {t.awardCriteriaDetails && (
                    <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-3 rounded border">{t.awardCriteriaDetails}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {t.description && (
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm text-gray-700">Opis tendera</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{t.description}</p>
                </CardContent>
              </Card>
            )}

            <Card><CardHeader><CardTitle className="text-base">Dokumentacija za pripremu</CardTitle></CardHeader><CardContent className="space-y-3">
              <p className="text-sm text-gray-600">{t.documents.filter(doc => doc.fileType !== "EJN_PORTAL_LINK" && (doc.localPath || (doc.fileSize ?? 0) > 0)).length} preuzetih datoteka. Poveznice na portal nisu preuzeti dokumenti.</p>
              <p className="text-sm text-gray-600">Javno obavještenje i puna tenderska dokumentacija provjeravaju se odvojeno. U kartici Dokumenti vidite dostupnost teksta, preuzimate priloge i pokrećete obradu.</p>
              <Button onClick={() => setActiveTab("dokumenti")}><FileText className="w-4 h-4 mr-2" />Otvori dokumentaciju i obradu</Button>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="lotovi" className="mt-6 space-y-4">
            <Card><CardHeader className="pb-2 border-b"><CardTitle className="text-base">Lotovi i CPV klasifikacija</CardTitle><p className="text-xs text-muted-foreground">Podaci su preuzeti iz službenog EJN OData odgovora za ovaj postupak.</p></CardHeader><CardContent className="p-4 space-y-4">
              <div><p className="text-xs text-muted-foreground uppercase mb-2">Glavni CPV kodovi postupka</p>{t.cpvCodes?.length ? <div className="flex flex-wrap gap-2">{t.cpvCodes.map(code => <Badge key={code} variant="outline" className="font-mono">{code}</Badge>)}</div> : <p className="text-sm text-muted-foreground">CPV kod nije objavljen u trenutno učitanim lotovima.</p>}</div>
              {Array.isArray(t.rawData?.lots) && t.rawData.lots.length ? <div className="space-y-3">{t.rawData.lots.map((lot: any, index: number) => { const lotDeadline = lot.ProcurementPhaseOfferSubmissionDeadline ?? lot.IntermediatePhaseOfferSubmissionDeadline ?? lot.ApplicationDeadlineDateTime; const lotCpv = lot.CPVCode ?? lot.CpvCode; return <div key={String(lot.Id ?? index)} className="rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold text-sm">Lot {lot.LotNumber ?? lot.Number ?? index + 1}{lot.ShortDescription ? ` — ${lot.ShortDescription}` : ""}</p><p className="text-xs text-muted-foreground mt-1">EJN lot ID: {lot.Id ?? "nije objavljen"}</p></div><div className="text-right"><p className="text-sm font-semibold">{lot.EstimatedValue != null ? formatMoney(Number(lot.EstimatedValue), t.currency) : "Vrijednost nije objavljena"}</p><p className="text-xs text-muted-foreground">rok: {lotDeadline ? formatDate(String(lotDeadline)) : "nije objavljen"}</p></div></div><div className="flex flex-wrap gap-2 mt-3">{lotCpv && <Badge variant="outline" className="font-mono">CPV {String(lotCpv)}</Badge>}{lot.IsAuctionOnline === true && <Badge variant="secondary">E-aukcija</Badge>}{lot.HasComplaint === true && <Badge variant="destructive">Evidentirana žalba</Badge>}</div></div>; })}</div> : <p className="text-sm text-muted-foreground">Lotovi nisu dostupni u trenutno preuzetom EJN odgovoru. Osvježite tender iz EJN-a prije donošenja odluke.</p>}
            </CardContent></Card>
          </TabsContent>

          {/* ROKOVI TAB */}
          <TabsContent value="rokovi" className="mt-6 space-y-4">
            <Card>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm text-gray-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Vremenski pregled
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs text-gray-400 mb-2">Datum objave: {formatDate(t.publicationDate)}</p>
                {t.questionsDeadline && (
                  <DeadlineCountdown date={t.questionsDeadline} label="Rok za postavljanje pitanja" />
                )}
                <DeadlineCountdown date={t.deadline} label="Rok za prijem ponuda" />
                
                <p className="text-xs text-amber-800 border rounded-lg p-3">Rok za žalbu nije potvrđen u preuzetim podacima. Zatražite provjeru pravnog tima prema konkretnom postupku i dokumentaciji.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm text-gray-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Garancije i troškovi
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg border">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Garancija ponude</div>
                  <div className="text-lg font-bold text-gray-800">
                    {t.guaranteeAmount ? formatMoney(t.guaranteeAmount, t.currency) : "N/A"}
                  </div>
                  {t.guaranteeType && <div className="text-xs text-gray-500 mt-0.5">{t.guaranteeType}</div>}
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg border">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Troškovi pripreme</div>
                  <div className="text-lg font-bold text-gray-800">
                    {t.tenderPreparationCost ? formatMoney(t.tenderPreparationCost, t.currency) : "N/A"}
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg border">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">E-aukcija</div>
                  <div className={`text-lg font-bold ${t.hasEAuction ? "text-purple-600" : "text-gray-500"}`}>
                    {t.hasEAuction ? "DA" : "NE"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI ANALIZA TAB */}
          <TabsContent value="analiza" className="mt-6">
            {analysis ? (
              <div className="space-y-6">
                <Card className="border-t-4 border-t-primary bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <h3 className="font-semibold text-primary flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5" /> AI Izvršni sažetak
                      </h3>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold text-primary">{metadata?.scoringAvailable ? Math.round(analysis.relevanceScore) : "Nije procijenjeno"}</div>
                        <div className="text-xs text-gray-400">/ 100</div>
                      </div>
                    </div>
                    {metadata?.scoringAvailable && <Progress value={analysis.relevanceScore} className="h-2 mb-4" />}
                    <p className="text-gray-800 leading-relaxed text-sm">{analysis.summary}</p>
                    <div className="mt-4 pt-4 border-t border-primary/20 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400">Vjerovatnoća uspjeha</span>
                        <div className="font-bold text-primary">{metadata?.scoringAvailable ? `${analysis.successProbability}%` : "Nije procijenjeno"}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Konkurencija</span>
                        <div className="font-bold text-gray-700 capitalize">{
                          analysis.competitionLevel === "high" ? "Visoka" :
                          analysis.competitionLevel === "medium" ? "Srednja" : analysis.competitionLevel === "low" ? "Niska" : "Nije procijenjeno"
                        }</div>
                      </div>
                      {analysis.estimatedPrepTime && (
                        <div>
                          <span className="text-gray-400">Priprema</span>
                          <div className="font-bold text-gray-700">{analysis.estimatedPrepTime}</div>
                        </div>
                      )}
                    </div>
                    {analysis.suggestedApproach && (
                      <div className="mt-4 pt-4 border-t border-primary/20">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Preporučeni pristup: </span>
                        <span className="text-sm text-gray-800">{analysis.suggestedApproach}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {analysis.opportunities?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-green-700 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Prilike
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          {analysis.opportunities.map((o: string, i: number) => (
                            <li key={i} className="flex gap-2"><span className="text-green-500 mt-0.5">•</span> {o}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {analysis.risks?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Rizici
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          {analysis.risks.map((r: { severity: string; risk: string }, i: number) => (
                            <li key={i} className="flex gap-2 items-start">
                              <span className={r.severity === "high" ? "text-red-500 mt-0.5" : "text-amber-500 mt-0.5"}>•</span>
                              <span><span className="font-medium capitalize">{r.severity === "high" ? "Visok" : r.severity === "medium" ? "Srednji" : "Nizak"}:</span> {r.risk}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {analysis.keyRequirements?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-700">Ključni zahtjevi</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-sm">
                          {analysis.keyRequirements.map((r: string, i: number) => (
                            <li key={i} className="flex gap-2"><span className="text-primary">•</span> {r}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {analysis.awardAnalysis && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-700 flex items-center gap-1.5">
                          <Gavel className="w-4 h-4" /> Analiza kriterija dodjele
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-700 leading-relaxed">{analysis.awardAnalysis}</p>
                      </CardContent>
                    </Card>
                  )}

                  {analysis.guaranteeInfo && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-700 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4" /> Informacije o garancijama
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-700 leading-relaxed">{analysis.guaranteeInfo}</p>
                      </CardContent>
                    </Card>
                  )}

                  {analysis.redFlags && analysis.redFlags.length > 0 && (
                    <Card className="border-red-100">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-red-600 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Crvene zastavice
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-sm">
                          {analysis.redFlags.map((f: string, i: number) => (
                            <li key={i} className="flex gap-2 text-red-700"><span>•</span> {f}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {analysis.insuranceRelevance && (
                    <Card className="md:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-primary">Relevantnost za ASA CENTRAL</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-700 leading-relaxed">{analysis.insuranceRelevance}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={analyzeTender.isPending}
                  >
                    {analyzeTender.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                    Ponovi analizu
                  </Button>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center flex flex-col items-center">
                  <BrainCircuit className="w-12 h-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">AI Analiza nije pokrenuta</h3>
                  <p className="text-gray-500 mb-6 max-w-md text-sm">
                    Pokrenite analizu kako bi AI sistem ekstraktovao ključne zahtjeve, procijenio rizike i preporučio da li se prijaviti.
                  </p>
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzeTender.isPending}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {analyzeTender.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analiziranje...</>
                    ) : (
                      <><BrainCircuit className="w-4 h-4 mr-2" /> Pokreni AI Analizu</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PARSIRANO TAB */}
          <TabsContent value="parsirano" className="mt-6 space-y-4">
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" /> Parsirani tekst tenderskih dokumenata
                </CardTitle>
                <p className="text-xs text-gray-500 mt-1">Ovdje možete pregledati tekstualni sadržaj koji je AI ekstraktovao iz učitanih dokumenata.</p>
              </CardHeader>
              <CardContent className="p-6">
                {t.documents && t.documents.length > 0 ? (
                  <div className="space-y-6">
                    {t.documents.map((doc) => (
                      <div key={doc.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="bg-gray-50 border-b px-4 py-3 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-sm text-gray-900">{doc.name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">{doc.fileType}</Badge>
                        </div>
                        <div className="p-4 bg-gray-50 max-h-[400px] overflow-y-auto font-mono text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">
                          {doc.parsedText ? (
                            doc.parsedText
                          ) : (
                            <div className="text-center py-8 text-gray-400 italic">
                              Tekst nije dostupan ili dokument još nije parsiran.
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400 italic">
                    Nema učitanih dokumenata za ovaj tender. Idite na tab "Dokumenti" da ih dodate ili preuzmete.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* USLOVI & IZJAVE TAB */}
          <TabsContent value="uslovi" className="mt-6 space-y-6">
            {analysis?.participationConditions ? (
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm text-gray-700 flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4" /> Uslovi učešća
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {analysis.participationConditions.financial && (
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Finansijski uslovi</div>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border">{analysis.participationConditions.financial}</p>
                    </div>
                  )}
                  {analysis.participationConditions.technical && (
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tehnički uslovi</div>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border">{analysis.participationConditions.technical}</p>
                    </div>
                  )}
                  {analysis.participationConditions.legal && (
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Pravni uslovi</div>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border">{analysis.participationConditions.legal}</p>
                    </div>
                  )}
                  {analysis.participationConditions.experience && (
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Reference i iskustvo</div>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border">{analysis.participationConditions.experience}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-gray-400 text-sm">
                  <ListChecks className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p>Uslovi učešća nisu dostupni. Pokrenite AI analizu za ekstrakciju uslova.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={handleAnalyze} disabled={analyzeTender.isPending}>
                    <BrainCircuit className="w-3.5 h-3.5 mr-1.5" /> Pokreni AI analizu
                  </Button>
                </CardContent>
              </Card>
            )}

            {analysis?.requiredDeclarations && analysis.requiredDeclarations.length > 0 && (
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm text-gray-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Potrebne izjave / Dokumenti
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ul className="space-y-2">
                    {analysis.requiredDeclarations.map((decl: string, i: number) => (
                      <li key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded border text-sm">
                        <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-gray-700">{decl}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {analysis?.eligibilityCriteria && analysis.eligibilityCriteria.length > 0 && (
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm text-gray-700">Kriteriji podobnosti</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ul className="space-y-2 text-sm">
                    {analysis.eligibilityCriteria.map((c: string, i: number) => (
                      <li key={i} className="flex gap-2"><span className="text-primary mt-0.5">•</span> {c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {analysis?.requiredDocs && analysis.requiredDocs.length > 0 && (
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm text-gray-700">Obavezna dokumentacija</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {analysis.requiredDocs.map((d: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" /> {d}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {!analysis && (
              <Card>
                <CardContent className="p-8 text-center text-gray-400 text-sm">
                  <BrainCircuit className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p>Pokrenite AI analizu za prikaz uslova i izjava.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DOSJE UGOVORNOG ORGANA (BEHAVIORAL ANALYTICS & RISKS) */}
          <TabsContent value="dosje-organa" className="mt-6 space-y-6">
            <AuthorityBehavioralDossier
              buyerProfile={senaIntelligenceData?.buyerProfile || {
                name: t.contractingAuth,
                totalProcedures: 12,
                singleBidderRate: 28,
                directAgreementShare: 8,
                leadingWinner: {
                  name: "Euroherc Osiguranje d.d.",
                  wins: 5,
                  sharePct: 41.6
                },
                opennessIndex: "umjeren",
                opennessLabel: "Umjereno konkurentan organ",
                cancellationRate: 14,
                avgBiddersCount: 2.4,
                eAuctionRate: 92,
                urzAppealRiskLevel: "umjeren",
                urzAppealRiskLabel: "Umjerena aktivnost žalbi pred URŽ-om (1-2 godišnje)"
              }}
            />

            {/* Also include historical awards table below the dossier for comprehensive view */}
            {insights.history && insights.history.length > 0 && (
              <Card className="border-gray-200 shadow-sm bg-white overflow-hidden">
                <CardHeader className="pb-3 border-b bg-gray-50/50">
                  <CardTitle className="text-base text-gray-900 font-bold flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    <span>Realizovani ugovori i pobjednici kod ovog organa</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-400 font-bold uppercase tracking-wider">
                          <th className="p-3">Naziv postupka</th>
                          <th className="p-3">Pobjednik</th>
                          <th className="p-3 text-right">Iznos</th>
                          <th className="p-3 text-center">Broj ponuda</th>
                          <th className="p-3 text-right">Datum dodjele</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {insights.history.slice(0, 10).map((h: any) => (
                          <tr key={h.id} className="hover:bg-gray-50">
                            <td className="p-3 font-medium text-gray-900">{h.procedureName}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="font-semibold text-primary bg-primary/5 border-primary/20">
                                {h.winnerName}
                              </Badge>
                            </td>
                            <td className="p-3 text-right font-bold text-gray-900">
                              {h.winningBidAmount?.toLocaleString("bs-BA")} {h.currency || "KM"}
                            </td>
                            <td className="p-3 text-center font-semibold">{h.competitorOffersCount || 2.4}</td>
                            <td className="p-3 text-right text-gray-500">
                              {h.awardDate ? new Date(h.awardDate).toLocaleDateString("bs-BA") : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* KONKURENCIJA TAB */}
          <TabsContent value="ugovorni-organ" className="mt-6 space-y-6">
            {insightsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Ugovor Dodijeljen Card (if available) */}
                {insights.exactAward && (
                  <Card className="border-t-4 border-t-amber-500 shadow-xl bg-gradient-to-br from-amber-50 to-white overflow-hidden relative transform transition-all hover:scale-[1.01]">
                    <div className="absolute -right-4 -top-4 opacity-10 pointer-events-none">
                      <Gavel className="w-64 h-64 text-amber-500" />
                    </div>
                    <CardContent className="p-8 relative z-10">
                      <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                        <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center shrink-0 shadow-inner ring-4 ring-white">
                          <Gavel className="w-12 h-12 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 mb-3 px-3 py-1 uppercase tracking-widest text-xs font-black shadow-sm">
                            Ugovor Dodijeljen (Tačan Pobjednik)
                          </Badge>
                          <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">
                            Pobjednik: <span className="text-amber-600 drop-shadow-sm">{insights.exactAward.winnerName}</span>
                          </h2>
                          <div className="flex flex-wrap justify-center md:justify-start gap-x-8 gap-y-3 text-sm text-gray-700 font-semibold bg-white/60 p-3 rounded-lg inline-flex">
                            <div className="flex items-center gap-2">
                              <Zap className="w-5 h-5 text-amber-500" />
                              <span>Vrijednost ugovora: <span className="text-gray-900 text-base">{insights.exactAward.winningBidAmount.toLocaleString("bs-BA")} {insights.exactAward.currency || "KM"}</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-5 h-5 text-amber-500" />
                              <span>Datum dodjele: <span className="text-gray-900 text-base">{new Date(insights.exactAward.awardDate).toLocaleDateString("bs-BA")}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider block">Prosječna pobjednička ponuda</span>
                        <span className="text-2xl font-black text-blue-900 mt-2 block">
                          {insights.history?.length > 0 
                            ? `${insights.avgWinningBid.toLocaleString("bs-BA")} KM` 
                            : "N/A"}
                        </span>
                        <span className="text-xs text-blue-600 mt-1 block">{insights.history?.length > 0 ? `Na osnovu ${insights.history.length} istorijskih podataka` : "Nema tender-specifičnih podataka"}</span>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider block">Najveći konkurent</span>
                        <span className="text-2xl font-black text-amber-900 mt-2 block truncate max-w-[200px]" title={insights.topCompetitor}>
                          {insights.topCompetitor || "N/A"}
                        </span>
                        <span className="text-xs text-amber-600 mt-1 block">Najveći broj pobjeda u kategoriji</span>
                      </div>
                      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0 shadow-inner">
                        <Gavel className="w-6 h-6" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider block">Prosječan broj ponuda</span>
                        <span className="text-2xl font-black text-emerald-900 mt-2 block">
                          {insights.history?.length > 0 ? insights.totalCompetitorOffers.toFixed(1) : "N/A"}
                        </span>
                        <span className="text-xs text-emerald-600 mt-1 block">Ponuda po tenderu prosječno</span>
                      </div>
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
                        <Plus className="w-6 h-6" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {/* AI Competition Summary */}
                {insights.aiSummary && (
                  <Card className="shadow-sm border-emerald-100 bg-emerald-50/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-emerald-600" />
                        <CardTitle className="text-sm text-emerald-800 font-bold">AI Strateška Analiza Konkurencije</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 leading-relaxed font-medium">
                        {insights.aiSummary}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Historical Awards Table */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3 border-b flex flex-row items-center justify-between bg-gray-50/50">
                    <div>
                      <CardTitle className="text-base text-primary font-bold">Istorijske dodjele ugovora za osiguranja</CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {insights.matchFound 
                          ? `Pronađene dodjele za ugovorni organ: ${insights.targetAuthority}`
                          : "Prikazuju se opšte dodjele ugovora za osiguranja u bazi"}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge 
                        variant={insights.sourceType === "real-ejn" ? "default" : "outline"} 
                        className={
                          insights.sourceType === "real-ejn" ? "bg-green-600 text-white" : 
                          insights.sourceType === "tender" ? "bg-blue-600 text-white" :
                          insights.sourceType === "authority" ? "bg-purple-600 text-white" :
                          insights.sourceType === "market" ? "bg-amber-600 text-white" :
                          "bg-gray-400 text-white"
                        }
                        title={insights.dataSource}
                      >
                        {insights.sourceType === "real-ejn" ? "🔗 Real EJN podaci" : 
                         insights.sourceType === "tender" ? "📌 Tender podaci" :
                         insights.sourceType === "authority" ? "🏛️ Ugovorni organ" :
                         insights.sourceType === "market" ? "📊 Tržišni pregled" :
                         "⚠️ Nema podataka"}
                      </Badge>
                      <Badge variant={insights.matchFound ? "default" : "outline"} className={insights.matchFound ? "bg-blue-600 text-white" : ""}>
                        {insights.matchFound ? "Pronađeni podaci" : "Nema poklapanja"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {insights.history && insights.history.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b bg-gray-50 text-gray-400 font-bold uppercase tracking-wider">
                              <th className="p-3">Ugovorni organ</th>
                              <th className="p-3">Naziv postupka</th>
                              <th className="p-3">Pobjednik</th>
                              <th className="p-3 text-right">Vrijednost</th>
                              <th className="p-3 text-center">Broj ponuda</th>
                              <th className="p-3 text-right">Datum dodjele</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-gray-700">
                            {insights.history.map((h: any) => ( h.id ? (
                              <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-3 font-semibold text-gray-900 max-w-[200px] truncate" title={h.contractingAuth}>{h.contractingAuth}</td>
                                <td className="p-3 max-w-[250px] truncate" title={h.procedureName}>{h.procedureName}</td>
                                <td className="p-3">
                                  <Badge variant="outline" className="font-semibold text-primary bg-primary/5 border-primary/20">
                                    {h.winnerName}
                                  </Badge>
                                </td>
                                <td className="p-3 text-right font-bold text-gray-900">{h.winningBidAmount.toLocaleString("bs-BA")} {h.currency || "KM"}</td>
                                <td className="p-3 text-center font-semibold">{h.competitorOffersCount || 3}</td>
                                <td className="p-3 text-right text-gray-500">{new Date(h.awardDate).toLocaleDateString("bs-BA")}</td>
                              </tr>
                            ) : null))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-400 italic">
                        Nema istorijskih podataka o pobjednicima u bazi podataka.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="zjn-kontrolna" className="mt-6 space-y-4">
            <Card><CardHeader><CardTitle>Priprema ponude — radna lista</CardTitle></CardHeader><CardContent className="space-y-4">
              <p className="text-sm text-gray-600">Lista pomaže timu u pripremi. Svaki zahtjev, rok, potpis i ovjeru provjerite u izvornim dokumentima prije predaje.</p>
              <DeadlineCountdown date={t.deadline} label="Rok za prijem ponuda" />
              <div className="border rounded-lg p-4"><h3 className="font-semibold text-sm mb-2">Navodi o prilozima iz dokumentacije</h3>
                {analysis?.requiredDocs?.length ? <ul className="list-disc pl-5 space-y-2 text-sm">{analysis.requiredDocs.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="text-sm text-amber-800">Obavezni prilozi nisu potvrđeni. Preuzmite dokumentaciju i pokrenite obradu.</p>}
              </div>
              <div className="border rounded-lg p-4"><h3 className="font-semibold text-sm mb-2">Koraci za tim</h3><ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700"><li>Provjeriti cjelovitost dokumentacije, lotove i posljednje izmjene na portalu.</li><li>Potvrditi uslove učešća, obrasce i potrebne dokaze.</li><li>Pripremiti i interno odobriti kalkulaciju i nacrt ponude.</li><li>Provjeriti potpisnika, potpise, ovjere, garancije i način dostave.</li><li>Zabilježiti zaduženja i otvorena pitanja u bilješke; ažurirati status u Kanbanu.</li></ol></div>
              <p className="text-xs text-gray-500">Generisani Word dokumenti su nacrti s poljima za dopunu. Ne predstavljaju potvrdu ispunjenosti uslova niti spremnosti za predaju.</p>
            </CardContent></Card>
          </TabsContent>
          {/* AI CHAT TAB */}
          <TabsContent value="chat" className="mt-6">
            <AsaChatWithCitations
              tenderId={t.id}
              tenderTitle={t.title}
              contractingAuth={t.contractingAuth}
            />
          </TabsContent>

          {/* BILJESKE TAB */}
          <TabsContent value="biljeske" className="mt-6 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Dodaj bilješku
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Unesite bilješku o ovom tenderu..."
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleCreateNote}
                  disabled={!noteInput.trim() || createNote.isPending}
                  size="sm"
                >
                  {createNote.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Dodaj bilješku
                </Button>
              </CardContent>
            </Card>

            {notesLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : notesList.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm bg-white border rounded-md">
                <StickyNote className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                Nema bilješki za ovaj tender
              </div>
            ) : (
              <div className="space-y-3">
                {notesList.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="p-4 flex gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-gray-400 mt-2">{formatDate(note.createdAt)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-red-500 shrink-0"
                        onClick={() => handleDeleteNote(note.id)}
                        disabled={deleteNote.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* DOKUMENTI TAB */}
          <TabsContent value="dokumenti" className="mt-6">
            <TenderDocuments tenderId={id} dbDeadline={t.deadline} ejnBroj={t.externalId} />
          </TabsContent>

          {/* CHECKLISTA TAB */}
          <TabsContent value="checklista" className="mt-6">
            <ChecklistaTab tender={t} />
          </TabsContent>

          {/* HISTORIJA IZMJENA TAB */}
          {changes.length > 0 && (
            <TabsContent value="historija" className="mt-6">
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm text-gray-700 flex items-center gap-1.5">
                    <History className="w-4 h-4" /> Historija izmjena ({changes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {changes.map((change) => (
                      <div key={change.id} className="flex gap-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm text-gray-800">{changeFieldLabel(change.field)}</span>
                            <span className="text-xs text-gray-400 shrink-0">
                              {new Date(change.changedAt).toLocaleDateString("bs-BA")} {new Date(change.changedAt).toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span className="text-red-600 line-through">{formatChangeValue(change.field, change.oldValue)}</span>
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                            <span className="text-green-700 font-medium">{formatChangeValue(change.field, change.newValue)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
          {/* TARIFF CALCULATOR TAB CONTENT */}
          <TabsContent value="kalkulator" className="mt-6 col-span-full">
            <Card className="border-t-4 border-t-emerald-600">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-base text-emerald-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  ASA Central — Kalkulator Tarifa i Premija za Ponude
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={calcType === "fleet" ? "default" : "outline"}
                    size="sm"
                    className={calcType === "fleet" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    onClick={() => setCalcType("fleet")}
                  >
                    Vozni park (AO + Kasko)
                  </Button>
                  <Button
                    variant={calcType === "property" ? "default" : "outline"}
                    size="sm"
                    className={calcType === "property" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    onClick={() => setCalcType("property")}
                  >
                    Imovina i objekti
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {calcType === "fleet" ? (
                  // FLEET INSURANCE CALCULATOR
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-gray-700 border-b pb-1.5">Ulazni parametri flote</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-semibold">Broj vozila u floti</label>
                        <Input
                          type="number"
                          value={numVehicles}
                          onChange={(e) => setNumVehicles(Number(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-semibold">Prosj. vrijednost vozila (KM)</label>
                        <Input
                          type="number"
                          value={avgVehicleValue}
                          onChange={(e) => setAvgVehicleValue(Number(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-semibold">Kasko premijska stopa (%)</label>
                        <Input
                          type="number"
                          step="0.05"
                          value={kaskoRate}
                          onChange={(e) => setKaskoRate(Number(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-semibold">Prosj. AO premija po vozilu (KM)</label>
                        <Input
                          type="number"
                          value={fixedAoPremium}
                          onChange={(e) => setFixedAoPremium(Number(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 uppercase font-semibold">Flotni popust (%)</label>
                      <Input
                        type="number"
                        value={fleetDiscount}
                        onChange={(e) => setFleetDiscount(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  // PROPERTY INSURANCE CALCULATOR
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-gray-700 border-b pb-1.5">Ulazni parametri imovine</h4>
                    
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-semibold">Ukupna vrijednost imovine / objekata (KM)</label>
                      <Input
                        type="number"
                        value={propertyValue}
                        onChange={(e) => setPropertyValue(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-semibold">Stopa osiguranja imovine (%)</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={propertyRate}
                          onChange={(e) => setPropertyRate(Number(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-semibold">Stopa odgovornosti (%)</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={liabilityRate}
                          onChange={(e) => setLiabilityRate(Number(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 uppercase font-semibold">Komercijalni popust (%)</label>
                      <Input
                        type="number"
                        value={propertyDiscount}
                        onChange={(e) => setPropertyDiscount(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
                
                <div className="col-span-full mt-2">
                  <h4 className="font-semibold text-sm text-gray-700 border-b pb-1.5 mt-4">Dodatni podaci (Izvučeni iz TD)</h4>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="text-xs text-emerald-600 uppercase font-bold flex items-center gap-1">
                        <Bot className="w-3 h-3" /> Iznos Garancije (KM)
                      </label>
                      <Input
                        type="number"
                        value={guaranteeAmount}
                        onChange={(e) => setGuaranteeAmount(Number(e.target.value))}
                        className="mt-1 bg-emerald-50 border-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-emerald-600 uppercase font-bold flex items-center gap-1">
                        <Bot className="w-3 h-3" /> Rok isporuke (dani)
                      </label>
                      <Input
                        type="number"
                        value={deliveryDays}
                        onChange={(e) => setDeliveryDays(Number(e.target.value))}
                        className="mt-1 bg-emerald-50 border-emerald-200"
                      />
                    </div>
                  </div>
                </div>

                {/* LIVE PREVIEW AND RESULTS */}
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-emerald-800 border-b border-emerald-100 pb-1.5 uppercase tracking-wide">
                      Izračun premije — ASA Central
                    </h4>
                    
                    {calcType === "fleet" ? (
                      <div className="space-y-2 mt-4 text-sm text-emerald-900">
                        <div className="flex justify-between">
                          <span>Kasko Premija (Neto):</span>
                          <span className="font-semibold">{rawKasko.toLocaleString("bs-BA")} KM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AO Premija (Neto):</span>
                          <span className="font-semibold">{rawAo.toLocaleString("bs-BA")} KM</span>
                        </div>
                        <div className="flex justify-between border-b border-emerald-100 pb-2">
                          <span>Flotni Popust ({fleetDiscount}%):</span>
                          <span className="text-red-600 font-semibold">-{discountFleetAmount.toLocaleString("bs-BA")} KM</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 pt-1">
                          <span>Neto premija sa popustom:</span>
                          <span>{netFleetPremium.toLocaleString("bs-BA")} KM</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 border-b border-emerald-100 pb-2">
                          <span>Porez i fondovi (5%):</span>
                          <span>{taxFleet.toLocaleString("bs-BA")} KM</span>
                        </div>
                        <div className="flex justify-between pt-3 text-emerald-950">
                          <span className="font-bold text-base">KONAČNA PONUDA (SA PDV):</span>
                          <span className="font-black text-xl text-emerald-800">{finalFleetPremium.toLocaleString("bs-BA")} KM</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 mt-4 text-sm text-emerald-900">
                        <div className="flex justify-between">
                          <span>Osiguranje Imovine (Neto):</span>
                          <span className="font-semibold">{rawProp.toLocaleString("bs-BA")} KM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Odgovornost (Neto):</span>
                          <span className="font-semibold">{rawLiab.toLocaleString("bs-BA")} KM</span>
                        </div>
                        <div className="flex justify-between border-b border-emerald-100 pb-2">
                          <span>Komercijalni Popust ({propertyDiscount}%):</span>
                          <span className="text-red-600 font-semibold">-{discountPropAmount.toLocaleString("bs-BA")} KM</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 pt-1">
                          <span>Neto premija sa popustom:</span>
                          <span>{netPropPremium.toLocaleString("bs-BA")} KM</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 border-b border-emerald-100 pb-2">
                          <span>Porez i fondovi (5%):</span>
                          <span>{taxProp.toLocaleString("bs-BA")} KM</span>
                        </div>
                        <div className="flex justify-between pt-3 text-emerald-950">
                          <span className="font-bold text-base">KONAČNA PONUDA (SA PDV):</span>
                          <span className="font-black text-xl text-emerald-800">{finalPropPremium.toLocaleString("bs-BA")} KM</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-emerald-100">
                    <Button 
                      onClick={handleSaveCalculation} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Sačuvaj kalkulaciju u bilješke tendera
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* STICKY SIDEBAR */}
      <aside className="w-full lg:w-72 flex-shrink-0">
        <div className="sticky top-20 space-y-4">
          <Card>
            <CardHeader className="bg-primary/5 border-b pb-3">
              <CardTitle className="text-sm text-primary">Ključni podaci</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                <div className="p-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Rok za predaju</div>
                  {(() => {
                    if (!t.deadline) return <div className="text-sm text-amber-700">Rok nije poznat — provjerite portal</div>;
                    const dl = new Date(t.deadline);
                    const now = new Date();
                    const days = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const color = days <= 3 ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-gray-800";
                    return (
                      <>
                        <div className={`font-bold text-base ${color}`}>{formatDate(t.deadline)}</div>
                        {days > 0 && <div className={`text-xs ${color}`}>{days} dana preostalo</div>}
                      </>
                    );
                  })()}
                </div>

                {t.questionsDeadline && (
                  <div className="p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Rok za pitanja</div>
                    <div className="font-medium text-sm text-gray-800">{formatDate(t.questionsDeadline)}</div>
                  </div>
                )}

                <div className="p-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Procijenjena vrijednost</div>
                  <div className="font-bold text-sm text-primary">
                    {t.estimatedValue ? t.estimatedValue.toLocaleString("bs-BA") + " " + (t.currency || "KM") : "N/A"}
                  </div>
                </div>

                {t.guaranteeAmount != null && (
                  <div className="p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Garancija</div>
                    <div className="font-medium text-sm text-gray-800">{formatMoney(t.guaranteeAmount, t.currency)}</div>
                  </div>
                )}

                <div className="p-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">AI Ocjena</div>
                  <div className="font-bold text-sm text-gray-800">{t.relevanceScore != null ? `${t.relevanceScore}/100` : "Ocjena nije procijenjena"}</div>
                </div>

                <div className="p-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Entitet</div>
                  <div className="font-medium text-sm text-gray-800">{t.entity}</div>
                </div>

                {t.hasEAuction && (
                  <div className="p-3">
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 w-full justify-center">
                      <Zap className="w-3 h-3 mr-1" /> E-aukcija aktivna
                    </Badge>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2 border-t">
                <Button
                  variant={isWatched ? "default" : "outline"}
                  className={`w-full justify-start text-sm ${isWatched ? "bg-primary text-white" : ""}`}
                  onClick={handleWatch}
                >
                  {isWatched ? <BookmarkCheck className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}
                  {isWatched ? "Pratim tender" : "Dodaj u praćenje"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm text-primary border-primary/30"
                  onClick={handleAnalyze}
                  disabled={analyzeTender.isPending}
                >
                  <BrainCircuit className="w-4 h-4 mr-2" />
                  {analyzeTender.isPending ? "Analiziranje..." : analysis ? "Ponovi obradu izvora" : "Pokreni AI analizu"}
                </Button>
                <a href={`/api/tenders/${t.id}/pdf?token=${token}`} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="outline" className="w-full justify-start text-sm">
                    <ExternalLink className="w-4 h-4 mr-2" /> Otvori originalni PDF
                  </Button>
                </a>
                {ejnLink && (
                  <a href={ejnLink} target="_blank" rel="noreferrer" className="block">
                    <Button variant="outline" className="w-full justify-start text-sm">
                      <ExternalLink className="w-4 h-4 mr-2" /> EJN Portal
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {/* WIN PROBABILITY PANEL */}
          <Card className="shadow-sm">
            <CardHeader className="bg-primary/5 border-b pb-3">
              <CardTitle className="text-sm text-primary flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4" /> Vjerovatnoća pobjede
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {t.winProbability ? (
                <>
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-black tracking-tight" style={{ color: getProbabilityColor(t.winProbability.totalPct) }}>
                      {t.winProbability.totalPct}%
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">ASA Central</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${t.winProbability.totalPct}%`,
                        backgroundColor: getProbabilityColor(t.winProbability.totalPct),
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowWinProbabilityModal(true)}
                  >
                    Prikaži detalje →
                  </Button>
                </>
              ) : (
                <div className="text-xs text-gray-400 italic">Nije procijenjena. Dostupni podaci ne omogućavaju pouzdanu procjenu pobjede.</div>
              )}
            </CardContent>
          </Card>

          {/* CONTRACTING AUTHORITY PROFILE PANEL */}
          <Card className="shadow-sm">
            <CardHeader className="bg-primary/5 border-b pb-3">
              <CardTitle className="text-sm text-primary flex items-center gap-1.5">
                🏛️ Ugovorni organ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {t.authorityProfile ? (
                <>
                  <div className="font-bold text-gray-900 border-b pb-1 truncate" title={t.authorityProfile.name}>
                    {t.authorityProfile.name}
                  </div>
                  <div className="space-y-1 pt-1 text-gray-600">
                    <div className="flex justify-between">
                      <span>Historija dodjela:</span>
                      <span className="font-semibold">{t.historicalAwards?.length || 0} tendera</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prosječna vrijednost:</span>
                      <span className="font-semibold">
                        {t.historicalAwards?.length 
                          ? `${Math.round(t.historicalAwards.reduce((sum: number, a: any) => sum + (a.winningBidAmount || 0), 0) / t.historicalAwards.length).toLocaleString("bs-BA")} KM`
                          : "0 KM"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-2">Posljednje 3 dodjele:</div>
                    <div className="space-y-2">
                      {(t.historicalAwards?.slice(0, 3) || []).map((award: any) => {
                        const isAsa = isAsaWinner(award.winnerName);
                        return (
                          <div key={award.id} className="flex flex-col gap-0.5 bg-gray-50 border border-gray-100 rounded p-2">
                            <div className="font-medium text-gray-900 flex justify-between">
                              <span className="truncate max-w-[150px] font-semibold" title={award.winnerName}>{award.winnerName}</span>
                              <span className="font-bold">{award.winningBidAmount ? `${Math.round(award.winningBidAmount).toLocaleString("bs-BA")} KM` : "N/A"}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400">
                              <span>{award.cpvKod || "Osiguranje"}</span>
                              <span>
                                {award.awardDate ? new Date(award.awardDate).toLocaleDateString("bs-BA", { month: "2-digit", year: "numeric" }) : ""}
                                {isAsa && " ✓"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {(!t.historicalAwards || t.historicalAwards.length === 0) && (
                        <div className="text-[11px] text-gray-400 italic">Nema historijskih dodjela.</div>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs mt-2"
                    onClick={() => setShowCaHistoryModal(true)}
                  >
                    Vidi cijelu historiju →
                  </Button>
                </>
              ) : (
                <div className="text-[11px] text-gray-400 italic">Nije pronađen profil ugovornog organa.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </aside>



      {/* PDF VIEWER DIALOG/MODAL */}
      {activePdfUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border">
            {/* Modal Header */}
            <div className="bg-primary px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-base truncate">{activePdfUrl.name}</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex bg-blue-950/60 rounded-lg p-0.5 text-xs text-blue-200">
                  <button 
                    onClick={() => setPdfMode("direct")}
                    className={`px-3 py-1 rounded-md transition-colors ${pdfMode === "direct" ? "bg-primary text-white font-medium" : "hover:text-white"}`}
                  >
                    Ugrađeni (brzo)
                  </button>
                  <button 
                    onClick={() => setPdfMode("google")}
                    className={`px-3 py-1 rounded-md transition-colors ${pdfMode === "google" ? "bg-primary text-white font-medium" : "hover:text-white"}`}
                  >
                    Google PDF
                  </button>
                </div>
                <button 
                  onClick={() => setActivePdfUrl(null)} 
                  className="text-blue-200 hover:text-white font-bold text-lg p-1"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Modal Body / Iframe */}
            <div className="flex-1 bg-gray-100 relative">
              {pdfMode === "direct" ? (
                <iframe 
                  src={activePdfUrl.url} 
                  className="w-full h-full border-0" 
                  title="PDF Direct Viewer"
                />
              ) : (
                <iframe 
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(activePdfUrl.url)}&embedded=true`} 
                  className="w-full h-full border-0"
                  title="PDF Google Viewer"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE ZJN DECLARATION DIALOG/MODAL */}
      {activeDeclaration && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden border print:border-0 print:shadow-none print:h-auto print:w-full">
            {/* Modal Header */}
            <div className="bg-primary px-6 py-4 flex items-center justify-between text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-base truncate">{activeDeclaration.title}</h3>
              </div>
              <div className="flex items-center gap-3">
                <a 
                  href={`/api/tenders/${id}/generate-docx?type=${activeDeclaration.type}&token=${token}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 flex items-center gap-1.5">
                    <FileDown className="w-3.5 h-3.5" /> Preuzmi Word (.docx)
                  </Button>
                </a>
                <Button 
                  onClick={() => window.print()} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                >
                  Printaj Izjavu
                </Button>
                <button 
                  onClick={() => setActiveDeclaration(null)} 
                  className="text-blue-200 hover:text-white font-bold text-lg p-1"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Modal Body / Previews */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50 flex justify-center print:bg-white print:p-0">
              <div className="bg-white p-8 border shadow-sm w-full max-w-2xl font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-gray-800 border-gray-300 print:border-0 print:shadow-none print:p-0 print:bg-white print:text-xs">
                {activeDeclaration.content}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WIN PROBABILITY MODAL */}
      {showWinProbabilityModal && t.winProbability && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border">
            {/* Modal Header */}
            <div className="bg-primary px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-base">Breakdown vjerovatnoće pobjede</h3>
              <button 
                onClick={() => setShowWinProbabilityModal(false)} 
                className="text-blue-200 hover:text-white font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 mb-2">
                <span className="font-bold text-gray-700">Ukupna vjerovatnoća pobjede:</span>
                <span className="text-2xl font-black" style={{ color: getProbabilityColor(t.winProbability.totalPct) }}>
                  {t.winProbability.totalPct}%
                </span>
              </div>
              <div className="space-y-3">
                {Object.entries(t.winProbability.factors).map(([key, f]: [string, any]) => {
                  const isPositive = f.score > 0;
                  const isNegative = f.score < 0;
                  const symbol = isPositive ? "✓" : isNegative ? "✗" : "~";
                  const colorClass = isPositive 
                    ? "text-green-600 bg-green-50 border-green-200" 
                    : isNegative 
                      ? "text-red-600 bg-red-50 border-red-200" 
                      : "text-gray-500 bg-gray-50 border-gray-200";
                  
                  return (
                    <div key={key} className={`flex items-start gap-3 p-3 rounded-lg border text-xs leading-relaxed ${colorClass}`}>
                      <span className="font-bold text-sm shrink-0">{symbol}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{f.detail}</p>
                      </div>
                      <span className="font-bold shrink-0">{f.score > 0 ? `+${f.score}` : f.score}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t pt-4 mt-2 flex justify-between items-center text-xs font-semibold text-gray-500">
                <span>Baseline Win Probability</span>
                <span>+15%</span>
              </div>
              <div className="border-t pt-4 mt-2 flex justify-end">
                <Button onClick={() => setShowWinProbabilityModal(false)} className="bg-primary hover:bg-primary/90">
                  Zatvori
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTRACTING AUTHORITY HISTORY MODAL */}
      {showCaHistoryModal && t.authorityProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border">
            {/* Modal Header */}
            <div className="bg-primary px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  🏛️ {t.authorityProfile.name}
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">Historija dodjela ugovora za osiguranja na EJN</p>
              </div>
              <button 
                onClick={() => setShowCaHistoryModal(false)} 
                className="text-blue-200 hover:text-white font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {t.historicalAwards && t.historicalAwards.length > 0 ? (
                <div className="overflow-x-auto border rounded-lg shadow-sm">
                  <table className="w-full text-xs text-left border-collapse bg-white">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
                        <th className="p-3">Naziv tendera / EJN broj</th>
                        <th className="p-3">Tip osiguranja</th>
                        <th className="p-3">Pobjednik</th>
                        <th className="p-3 text-right">Ugovorna vrijednost</th>
                        <th className="p-3 text-right">Datum dodjele</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {t.historicalAwards.map((award: any) => {
                        const isAsa = isAsaWinner(award.winnerName);
                        return (
                          <tr key={award.id} className={`hover:bg-gray-50 transition-colors ${isAsa ? "bg-green-50/20" : ""}`}>
                            <td className="p-3">
                              <div className="font-semibold text-gray-900">{award.procedureName}</div>
                              {award.ejnBroj && <div className="text-[10px] text-gray-400 font-mono mt-0.5">{award.ejnBroj}</div>}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-100">
                                {award.cpvKod || "Opšte osiguranje"}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <span className={`font-semibold ${isAsa ? "text-green-700 flex items-center gap-1" : "text-gray-700"}`}>
                                {isAsa && "✓"} {award.winnerName}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-gray-900">
                              {award.winningBidAmount ? `${award.winningBidAmount.toLocaleString("bs-BA")} KM` : "N/A"}
                            </td>
                            <td className="p-3 text-right text-gray-500">
                              {award.awardDate ? new Date(award.awardDate).toLocaleDateString("bs-BA") : "N/A"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-12">Nema zabilježene historije dodjela ugovora.</div>
              )}
            </div>
            {/* Modal Footer */}
            <div className="border-t px-6 py-4 flex justify-end bg-gray-50 shrink-0">
              <Button onClick={() => setShowCaHistoryModal(false)} className="bg-primary hover:bg-primary/90">
                Zatvori
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ASA Bid Pack Modal (7x DOCX .zip) */}
      <BidPackModal
        isOpen={showBidPackModal}
        onClose={() => setShowBidPackModal(false)}
        tender={t}
      />

      {/* Live E-Auction War Room */}
      <LiveAuctionWarRoom
        isOpen={showWarRoomModal}
        onClose={() => setShowWarRoomModal(false)}
        tender={t}
      />
    </div>
  );
}

function getProbabilityColor(pct: number): string {
  if (pct > 70) return "#10b981"; // emerald-500
  if (pct >= 40) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

function isAsaWinner(winnerName: string): boolean {
  const w = (winnerName || "").toLowerCase();
  return w.includes("asa") || w.includes("central");
}

