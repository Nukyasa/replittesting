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
import { formatMoney, formatDate, getScoreBadgeProps, getDeadlineBadgeProps, getStatusBadgeProps } from "@/lib/format";
import {
  ArrowLeft, BrainCircuit, ExternalLink, FileText, CheckCircle2, AlertTriangle,
  Send, Trash2, Plus, Bookmark, BookmarkCheck, Loader2, MessageSquare, StickyNote, FileDown,
} from "lucide-react";
import { toast } from "sonner";

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
        <Skeleton className="h-40 w-full" />
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

  const scoreProps = getScoreBadgeProps(tender.relevanceScore);
  const deadlineProps = getDeadlineBadgeProps(tender.deadline);
  const statusProps = getStatusBadgeProps(tender.status);

  const handleAnalyze = async () => {
    try {
      await analyzeTender.mutateAsync({ id });
      await queryClient.invalidateQueries({ queryKey: getGetTenderQueryKey(id) });
      toast.success("AI analiza pokrenuta");
    } catch {
      toast.error("Greška pri pokretanju analize");
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const message = chatInput.trim();
    setChatInput("");
    const userMsg = { role: "user" as const, content: message };
    setChatMessages(prev => [...prev, userMsg]);

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

  const isWatched = (tender as unknown as Record<string, unknown>).isWatched as boolean | undefined;

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

  const ejnLink = tender.sourceUrl || (tender.externalId?.startsWith("EJN-")
    ? `https://next.ejn.gov.ba/bs-latn-ba/procurements/announcement/${tender.externalId.replace("EJN-", "")}`
    : null);

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
                <Badge variant="outline" className="bg-white">{tender.source}</Badge>
                <Badge className={statusProps.className}>{statusProps.label}</Badge>
                <Badge className={deadlineProps.className}>{deadlineProps.label}</Badge>
                {tender.relevanceScore != null && (
                  <Badge className={scoreProps.className}>{scoreProps.label} ({tender.relevanceScore})</Badge>
                )}
              </div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{tender.title}</h1>
              <p className="text-gray-600 font-medium">{tender.contractingAuth} • {tender.entity}</p>
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
          <TabsList className="bg-white border w-full justify-start overflow-x-auto">
            <TabsTrigger value="pregled">Pregled</TabsTrigger>
            <TabsTrigger value="ai-analiza" className="text-primary font-medium">
              <BrainCircuit className="w-4 h-4 mr-1.5" /> AI Analiza
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="w-4 h-4 mr-1.5" /> AI Chat
            </TabsTrigger>
            <TabsTrigger value="biljeske">
              <StickyNote className="w-4 h-4 mr-1.5" /> Bilješke ({(notes as { id: string }[] | undefined)?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="dokumenti">
              <FileDown className="w-4 h-4 mr-1.5" /> Dokumenti ({tender.documents?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pregled" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Osnovne informacije</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
                <InfoRow label="Ugovorni organ" value={tender.contractingAuth} />
                <InfoRow label="Entitet" value={tender.entity} />
                <InfoRow label="Procijenjena vrijednost" value={formatMoney(tender.estimatedValue, tender.currency)} bold />
                <InfoRow label="Rok za prijavu" value={formatDate(tender.deadline)} bold />
                <InfoRow label="Datum objave" value={formatDate(tender.publicationDate)} />
                <InfoRow label="Kategorija" value={tender.category ?? "N/A"} />
                <InfoRow label="Tip nabavke" value={tender.tenderType ?? "N/A"} />
                <InfoRow label="Status" value={statusProps.label} />
                {tender.cpvCodes && (tender.cpvCodes as string[]).length > 0 && (
                  <div className="md:col-span-2">
                    <div className="text-sm text-gray-500 mb-2">CPV kodovi</div>
                    <div className="flex flex-wrap gap-2">
                      {(tender.cpvCodes as string[]).map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-gray-50">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {tender.description && (
                  <div className="md:col-span-2">
                    <div className="text-sm text-gray-500 mb-2">Opis</div>
                    <p className="text-gray-800 text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-md border">{tender.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-analiza" className="mt-6">
            {tender.aiAnalysis ? (
              <div className="space-y-6">
                <Card className="border-t-4 border-t-primary bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
                      <BrainCircuit className="w-5 h-5" /> AI Izvršni sažetak
                    </h3>
                    <p className="text-gray-800 leading-relaxed text-sm">{tender.aiAnalysis.summary}</p>
                    {tender.aiAnalysis.suggestedApproach && (
                      <div className="mt-4 pt-4 border-t border-primary/20">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Preporučeni pristup: </span>
                        <span className="text-sm text-gray-800">{tender.aiAnalysis.suggestedApproach}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {tender.aiAnalysis.opportunities?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-green-700 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Prilike
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          {tender.aiAnalysis.opportunities.map((o: string, i: number) => (
                            <li key={i} className="flex gap-2"><span className="text-green-500 mt-0.5">•</span> {o}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {tender.aiAnalysis.risks?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Rizici
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          {tender.aiAnalysis.risks.map((r: { severity: string; risk: string }, i: number) => (
                            <li key={i} className="flex gap-2 items-start">
                              <span className={r.severity === "high" ? "text-red-500 mt-0.5" : "text-amber-500 mt-0.5"}>•</span>
                              <span><span className="font-medium capitalize">{r.severity}:</span> {r.risk}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {tender.aiAnalysis.keyRequirements?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-700">Ključni zahtjevi</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1 text-sm columns-2">
                        {tender.aiAnalysis.keyRequirements.map((r: string, i: number) => (
                          <li key={i} className="flex gap-2"><span className="text-primary">•</span> {r}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center flex flex-col items-center">
                  <BrainCircuit className="w-12 h-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">AI Analiza nije pokrenuta</h3>
                  <p className="text-gray-500 mb-6 max-w-md text-sm">
                    Pokrenite analizu kako bi AI sistem ekstraktovao ključne zahtjeve, procijenio rizike i preporučio da li se prijaviti na ovaj tender.
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
            ) : ((notes as { id: string; content: string; createdAt: string | null }[] | undefined)?.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm bg-white border rounded-md">
                <StickyNote className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                Nema bilješki za ovaj tender
              </div>
            ) : (
              <div className="space-y-3">
                {(notes as { id: string; content: string; createdAt: string | null }[]).map((note) => (
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

          <TabsContent value="dokumenti" className="mt-6">
            {tender.documents && tender.documents.length > 0 ? (
              <div className="space-y-3">
                {tender.documents.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.fileType}</p>
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
                ))}
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
        </Tabs>
      </div>

      <aside className="w-full lg:w-72 flex-shrink-0 space-y-4">
        <Card className="sticky top-20">
          <CardHeader className="bg-gray-50 border-b pb-3">
            <CardTitle className="text-sm">Upravljanje statusom</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Interni status</label>
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="justify-start border-l-4 border-l-gray-300 text-sm">U razmatranju</Button>
                <Button variant="outline" className="justify-start border-l-4 border-l-primary bg-primary/5 text-sm">U pripremi</Button>
                <Button variant="outline" className="justify-start border-l-4 border-l-green-500 text-sm">Prijavljeno</Button>
                <Button variant="outline" className="justify-start border-l-4 border-l-red-500 text-sm">Odbačeno</Button>
              </div>
            </div>

            <div className="pt-3 border-t space-y-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Brze akcije</label>
              <Button
                variant={isWatched ? "default" : "outline"}
                className={`w-full justify-start text-sm ${isWatched ? "bg-primary text-white" : ""}`}
                onClick={handleWatch}
              >
                {isWatched ? <BookmarkCheck className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}
                {isWatched ? "Pratim tender" : "Dodaj u praćenje"}
              </Button>
              {!tender.aiAnalysis && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm text-primary border-primary/30"
                  onClick={handleAnalyze}
                  disabled={analyzeTender.isPending}
                >
                  <BrainCircuit className="w-4 h-4 mr-2" />
                  {analyzeTender.isPending ? "Analiziranje..." : "Pokreni AI analizu"}
                </Button>
              )}
            </div>

            <div className="pt-3 border-t space-y-1 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Rok:</span><span className="font-semibold text-gray-800">{formatDate(tender.deadline)}</span>
              </div>
              <div className="flex justify-between">
                <span>Vrijednost:</span><span className="font-semibold text-gray-800">{formatMoney(tender.estimatedValue, tender.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>AI Ocjena:</span>
                <span className="font-semibold text-gray-800">{tender.relevanceScore != null ? `${tender.relevanceScore}/100` : "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span>Entitet:</span><span className="font-semibold text-gray-800">{tender.entity}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value?: string | null; bold?: boolean }) {
  return (
    <div>
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-sm ${bold ? "font-semibold text-gray-900 text-base" : "text-gray-800"}`}>{value || "N/A"}</div>
    </div>
  );
}
