import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetTender, useAnalyzeTender, useChatWithTender,
  useListTenderNotes, useCreateTenderNote, useDeleteTenderNote,
  useWatchTender, useUnwatchTender,
  getGetTenderQueryKey, getListTenderNotesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatMoney, formatDate, getScoreBadgeProps, getDeadlineBadgeProps, getStatusBadgeProps } from "@/lib/format";
import {
  ArrowLeft, BrainCircuit, ExternalLink, FileText, CheckCircle2, AlertTriangle,
  Send, Trash2, Plus, Bookmark, BookmarkCheck, Loader2, MessageSquare, StickyNote,
  FileDown, Clock, ShieldCheck, Gavel, ListChecks, History, Zap, ChevronRight,
  TrendingUp, Calendar,
} from "lucide-react";
import { toast } from "sonner";

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
  deadline: string;
  questionsDeadline?: string | null;
  tenderType: string;
  entity: string;
  status: string;
  statusName?: string | null;
  sourceUrl: string;
  hasEAuction: boolean;
  awardCriteria?: string | null;
  awardCriteriaDetails?: string | null;
  guaranteeAmount?: number | null;
  guaranteeType?: string | null;
  tenderPreparationCost?: number | null;
  relevanceScore?: number | null;
  createdAt: string;
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
};

function DeadlineCountdown({ date, label }: { date: string; label: string }) {
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
  const params = useParams();
  const id = params.id!;
  const queryClient = useQueryClient();

  const { data: tender, isLoading } = useGetTender(id, {
    query: { enabled: !!id, queryKey: getGetTenderQueryKey(id) },
  });

  const { data: notes, isLoading: notesLoading } = useListTenderNotes(id);
  const analyzeTender = useAnalyzeTender();
  const chatMutation = useChatWithTender();
  const createNote = useCreateTenderNote();
  const deleteNote = useDeleteTenderNote();
  const watchMutation = useWatchTender();
  const unwatchMutation = useUnwatchTender();

  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
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
      toast.success("AI analiza završena");
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

  const ejnLink = t.sourceUrl || (t.externalId?.startsWith("EJN-")
    ? `https://next.ejn.gov.ba/bs-latn-ba/procurements/announcement/${t.externalId.replace("EJN-", "")}`
    : null);

  const analysis = t.aiAnalysis;
  const changes = t.changes || [];
  const notesList = (notes as { id: string; content: string; createdAt: string | null }[] | undefined) || [];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-6 min-w-0">
        <div className="space-y-4">
          <Link href="/tenders">
            <Button variant="ghost" size="sm" className="-ml-2 text-gray-500">
              <ArrowLeft className="w-4 h-4 mr-1" /> Nazad na listu
            </Button>
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 flex-1 min-w-0">
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
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{t.title}</h1>
              <p className="text-gray-600 font-medium">{t.contractingAuth} · {t.entity}</p>
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
              {ejnLink && (
                <a href={ejnLink} target="_blank" rel="noreferrer">
                  <Button className="bg-primary hover:bg-primary/90">
                    EJN Portal <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="pregled" className="w-full">
          <TabsList className="bg-white border w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="pregled">Pregled</TabsTrigger>
            <TabsTrigger value="rokovi">
              <Clock className="w-3.5 h-3.5 mr-1" /> Rokovi
            </TabsTrigger>
            <TabsTrigger value="ai-analiza" className="text-primary font-medium">
              <BrainCircuit className="w-3.5 h-3.5 mr-1.5" /> AI Analiza
            </TabsTrigger>
            <TabsTrigger value="uslovi">
              <ListChecks className="w-3.5 h-3.5 mr-1" /> Uslovi &amp; Izjave
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> AI Chat
            </TabsTrigger>
            <TabsTrigger value="biljeske">
              <StickyNote className="w-3.5 h-3.5 mr-1.5" /> Bilješke ({notesList.length})
            </TabsTrigger>
            <TabsTrigger value="dokumenti">
              <FileDown className="w-3.5 h-3.5 mr-1.5" /> Dokumenti ({t.documents?.length ?? 0})
            </TabsTrigger>
            {changes.length > 0 && (
              <TabsTrigger value="historija">
                <History className="w-3.5 h-3.5 mr-1.5" /> Historija ({changes.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* PREGLED TAB */}
          <TabsContent value="pregled" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm text-gray-700">Osnovne informacije</CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 gap-4">
                  <FieldLabel label="Ugovorni organ" value={t.contractingAuth} />
                  <FieldLabel label="Entitet" value={t.entity} />
                  <FieldLabel label="Datum objave" value={formatDate(t.publicationDate)} />
                  <FieldLabel label="Tip nabavke" value={t.tenderType} />
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
          <TabsContent value="ai-analiza" className="mt-6">
            {analysis ? (
              <div className="space-y-6">
                <Card className="border-t-4 border-t-primary bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <h3 className="font-semibold text-primary flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5" /> AI Izvršni sažetak
                      </h3>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold text-primary">{Math.round(analysis.relevanceScore)}</div>
                        <div className="text-xs text-gray-400">/ 100</div>
                      </div>
                    </div>
                    <Progress value={analysis.relevanceScore} className="h-2 mb-4" />
                    <p className="text-gray-800 leading-relaxed text-sm">{analysis.summary}</p>
                    <div className="mt-4 pt-4 border-t border-primary/20 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400">Vjerovatnoća uspjeha</span>
                        <div className="font-bold text-primary">{analysis.successProbability}%</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Konkurencija</span>
                        <div className="font-bold text-gray-700 capitalize">{
                          analysis.competitionLevel === "high" ? "Visoka" :
                          analysis.competitionLevel === "medium" ? "Srednja" : "Niska"
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

          {/* AI CHAT TAB */}
          <TabsContent value="chat" className="mt-6">
            <Card className="flex flex-col h-[500px]">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  AI Chat — Pitajte o ovom tenderu
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p>Postavite pitanje o ovom tenderu</p>
                    <p className="text-xs mt-2 text-gray-300">Npr: "Koji su rokovi i zahtjevi za dokumentaciju?"</p>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm text-gray-500 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> AI razmišlja...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </CardContent>
              <div className="p-4 border-t flex gap-2">
                <Input
                  placeholder="Postavite pitanje o tenderu..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  disabled={chatMutation.isPending}
                />
                <Button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatMutation.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </Card>
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
            {t.documents && t.documents.length > 0 ? (
              <div className="space-y-3">
                {t.documents.map((doc) => {
                  const isAnnex = doc.name.toLowerCase().includes("annex") || doc.fileType === "ANNEX_I";
                  return (
                    <Card key={doc.id} className={isAnnex ? "border-primary/30 bg-primary/5" : ""}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${isAnnex ? "bg-primary/20" : "bg-gray-100"}`}>
                          <FileText className={`w-5 h-5 ${isAnnex ? "text-primary" : "text-gray-400"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm truncate ${isAnnex ? "text-primary" : "text-gray-900"}`}>{doc.name}</p>
                          <p className="text-xs text-gray-500">{doc.fileType}{isAnnex ? " — ANNEX I" : ""}</p>
                        </div>
                        {doc.originalUrl && (
                          <a href={doc.originalUrl} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="sm">
                              <FileDown className="w-4 h-4 mr-1.5" /> Preuzmi
                            </Button>
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center bg-white border rounded-md text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">Nema priloženih dokumenata za ovaj tender.</p>
                {ejnLink && (
                  <a href={ejnLink} target="_blank" rel="noreferrer" className="inline-block mt-3">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4 mr-1.5" /> Pogledajte dokumentaciju na EJN portalu
                    </Button>
                  </a>
                )}
              </div>
            )}
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
        </Tabs>
      </div>

      {/* STICKY SIDEBAR */}
      <aside className="w-full lg:w-72 flex-shrink-0 space-y-4">
        <Card className="sticky top-20">
          <CardHeader className="bg-primary/5 border-b pb-3">
            <CardTitle className="text-sm text-primary">Ključni podaci</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              <div className="p-3">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Rok za predaju</div>
                {(() => {
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
                <div className="font-bold text-sm text-gray-800">{t.relevanceScore != null ? `${t.relevanceScore}/100` : "Nije analiziran"}</div>
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
                {analyzeTender.isPending ? "Analiziranje..." : analysis ? "Ponovi AI analizu" : "Pokreni AI analizu"}
              </Button>
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
      </aside>
    </div>
  );
}
