import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useAuthStore } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, getDeadlineBadgeProps, getRemainingDays } from "@/lib/format";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Search,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Copy,
  Check,
  ChevronRight,
  Gavel,
  Shield,
  Trash2,
  Sparkles,
  RefreshCw,
  FolderKanban,
  FileText,
  AlertTriangle,
  Building2,
} from "lucide-react";

export interface KanbanTender {
  id: string;
  externalId: string;
  title: string;
  contractingAuth: string;
  estimatedValue?: number | null;
  deadline?: string | null;
  category?: string | null;
  tenderType?: string | null;
  hasEAuction?: boolean | null;
  relevanceScore?: number | null;
  userStatus: "watching" | "preparing" | "submitted" | "won" | "lost";
  userPriority: "low" | "medium" | "high";
  assignedTo?: string | null;
  internalDeadline?: string | null;
  offerAmount?: number | null;
  outcomeNote?: string | null;
  outcomeRecordedAt?: string | null;
  workspaceDecision?: "go" | "no_go" | "pending" | null;
  workspaceOwnerId?: string | null;
}

const COLUMNS = [
  {
    id: "watching",
    title: "Pratim",
    description: "Evidentirani tenderi od interesa",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    headerBg: "bg-slate-100/70 border-slate-300 text-slate-800",
    columnBg: "bg-slate-50/50 border-slate-200",
    accentBorder: "border-t-slate-500",
  },
  {
    id: "preparing",
    title: "U pripremi",
    description: "Izrada dokumentacije i ponude",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-300",
    headerBg: "bg-blue-100/70 border-blue-300 text-blue-900",
    columnBg: "bg-blue-50/30 border-blue-200",
    accentBorder: "border-t-blue-600",
  },
  {
    id: "submitted",
    title: "Predato / Čeka",
    description: "Ponuda poslana, čeka se ishod ili e-Aukcija",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    headerBg: "bg-amber-100/70 border-amber-300 text-amber-900",
    columnBg: "bg-amber-50/30 border-amber-200",
    accentBorder: "border-t-amber-500",
  },
  {
    id: "won",
    title: "Pobjeda",
    description: "Osvojen tender / dodijeljen ugovor",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    headerBg: "bg-emerald-100/70 border-emerald-300 text-emerald-900",
    columnBg: "bg-emerald-50/30 border-emerald-200",
    accentBorder: "border-t-emerald-600",
  },
  {
    id: "lost",
    title: "Gubitak",
    description: "Propušten tender ili odustajanje",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
    headerBg: "bg-rose-100/70 border-rose-300 text-rose-900",
    columnBg: "bg-rose-50/30 border-rose-200",
    accentBorder: "border-t-rose-500",
  },
];

export default function KanbanPage() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [outcomeModalTender, setOutcomeModalTender] = useState<KanbanTender | null>(null);
  const [targetStatus, setTargetStatus] = useState<"won" | "lost" | null>(null);
  const [offerAmountInput, setOfferAmountInput] = useState("");
  const [outcomeReason, setOutcomeReason] = useState("cijena");
  const [outcomeNoteInput, setOutcomeNoteInput] = useState("");

  // 1. Fetch Kanban board tenders
  const { data: tenders, isLoading, refetch, isFetching } = useQuery<KanbanTender[]>({
    queryKey: ["kanbanBoard"],
    queryFn: async () => {
      const res = await fetch("/api/tenders/kanban/board", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Neuspješno učitavanje Kanban ploče");
      return res.json();
    },
  });

  // 2. Update user status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      priority,
      offerAmount,
      outcomeNote,
    }: {
      id: string;
      status?: string;
      priority?: string;
      offerAmount?: number;
      outcomeNote?: string;
    }) => {
      const payload: Record<string, unknown> = {};
      if (status !== undefined) payload.status = status;
      if (priority !== undefined) payload.priority = priority;
      if (offerAmount !== undefined) payload.offerAmount = offerAmount;
      if (outcomeNote !== undefined) payload.outcomeNote = outcomeNote;

      const res = await fetch(`/api/tenders/${id}/user-status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Greška pri ažuriranju statusa");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanbanBoard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Greška pri spremanju izmjene");
    },
  });

  // 3. Remove tender from board (unwatch)
  const removeTenderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tenders/${id}/watch`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Greška pri uklanjanju tendera sa ploče");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Tender uklonjen sa Kanban ploče");
      queryClient.invalidateQueries({ queryKey: ["kanbanBoard"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  // Filtered tenders
  const filteredTenders = useMemo(() => {
    if (!tenders) return [];
    return tenders.filter((t) => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesAuth = t.contractingAuth?.toLowerCase().includes(q);
        const matchesExt = t.externalId?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesAuth && !matchesExt) return false;
      }
      // Category filter
      if (categoryFilter !== "all") {
        if (categoryFilter === "osiguranje") {
          const isIns =
            t.category === "Osiguranje" ||
            /(osigur|kasko|ao\b|polisa)/i.test(`${t.title} ${t.category}`);
          if (!isIns) return false;
        } else if (categoryFilter === "tehnicki") {
          const isTeh =
            t.category === "Tehnički pregled" ||
            /tehni[čc]k/i.test(`${t.title} ${t.category}`);
          if (!isTeh) return false;
        } else if (categoryFilter === "drugo") {
          if (t.category === "Osiguranje" || t.category === "Tehnički pregled")
            return false;
        }
      }
      // Priority filter
      if (priorityFilter !== "all") {
        if (priorityFilter === "high" && t.userPriority !== "high") return false;
        if (priorityFilter === "urgent") {
          const remaining = getRemainingDays(t.deadline);
          if (!remaining.isUrgent) return false;
        }
      }
      return true;
    });
  }, [tenders, searchQuery, categoryFilter, priorityFilter]);

  // Grouped by columns
  const groupedTenders = useMemo(() => {
    const map: Record<string, KanbanTender[]> = {
      watching: [],
      preparing: [],
      submitted: [],
      won: [],
      lost: [],
    };
    filteredTenders.forEach((t) => {
      const st = t.userStatus || "watching";
      if (map[st]) {
        map[st].push(t);
      } else {
        map.watching.push(t);
      }
    });
    return map;
  }, [filteredTenders]);

  // Sum metrics
  const metrics = useMemo(() => {
    const list = tenders || [];
    const activeList = list.filter(
      (t) => t.userStatus === "watching" || t.userStatus === "preparing" || t.userStatus === "submitted"
    );
    const inPrepValue = list
      .filter((t) => t.userStatus === "preparing" || t.userStatus === "submitted")
      .reduce((sum, t) => sum + (Number(t.estimatedValue) || 0), 0);

    const urgentCount = activeList.filter((t) => {
      const r = getRemainingDays(t.deadline);
      return r.isUrgent;
    }).length;

    const wonList = list.filter((t) => t.userStatus === "won");
    const lostList = list.filter((t) => t.userStatus === "lost");
    const totalOutcomes = wonList.length + lostList.length;
    const winRate = totalOutcomes > 0 ? Math.round((wonList.length / totalOutcomes) * 100) : null;
    const wonValue = wonList.reduce(
      (sum, t) => sum + (Number(t.offerAmount) || Number(t.estimatedValue) || 0),
      0
    );

    return {
      totalActive: activeList.length,
      inPrepValue,
      urgentCount,
      winRate,
      wonCount: wonList.length,
      wonValue,
    };
  }, [tenders]);

  // Column value sums
  const columnSums = useMemo(() => {
    const res: Record<string, number> = {
      watching: 0,
      preparing: 0,
      submitted: 0,
      won: 0,
      lost: 0,
    };
    Object.entries(groupedTenders).forEach(([colId, items]) => {
      res[colId] = items.reduce((sum, t) => {
        const val = colId === "won" && t.offerAmount ? Number(t.offerAmount) : Number(t.estimatedValue) || 0;
        return sum + val;
      }, 0);
    });
    return res;
  }, [groupedTenders]);

  // Handle Drag and drop
  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId as "watching" | "preparing" | "submitted" | "won" | "lost";
    const tender = tenders?.find((t) => t.id === draggableId);

    if (newStatus === "won" || newStatus === "lost") {
      // Open outcome dialog
      if (tender) {
        setOutcomeModalTender(tender);
        setTargetStatus(newStatus);
        setOfferAmountInput(tender.offerAmount ? String(tender.offerAmount) : tender.estimatedValue ? String(tender.estimatedValue) : "");
        setOutcomeNoteInput(tender.outcomeNote || "");
        setOutcomeReason("cijena");
      }
      return;
    }

    // Direct transition for other columns
    updateStatusMutation.mutate(
      { id: draggableId, status: newStatus },
      {
        onSuccess: () => {
          const colName = COLUMNS.find((c) => c.id === newStatus)?.title || newStatus;
          toast.success(`Tender prebačen u kolonu "${colName}"`);
        },
      }
    );
  };

  // Direct move from dropdown menu
  const handleDirectMove = (tender: KanbanTender, newStatus: "watching" | "preparing" | "submitted" | "won" | "lost") => {
    if (tender.userStatus === newStatus) return;

    if (newStatus === "won" || newStatus === "lost") {
      setOutcomeModalTender(tender);
      setTargetStatus(newStatus);
      setOfferAmountInput(tender.offerAmount ? String(tender.offerAmount) : tender.estimatedValue ? String(tender.estimatedValue) : "");
      setOutcomeNoteInput(tender.outcomeNote || "");
      setOutcomeReason("cijena");
      return;
    }

    updateStatusMutation.mutate(
      { id: tender.id, status: newStatus },
      {
        onSuccess: () => {
          const colName = COLUMNS.find((c) => c.id === newStatus)?.title || newStatus;
          toast.success(`Tender prebačen u kolonu "${colName}"`);
        },
      }
    );
  };

  // Save outcome
  const handleSaveOutcome = () => {
    if (!outcomeModalTender || !targetStatus) return;

    const amount = offerAmountInput ? parseFloat(offerAmountInput.replace(/\./g, "").replace(",", ".")) : undefined;
    const finalNote = targetStatus === "lost"
      ? `Razlog: ${outcomeReason.toUpperCase()} | ${outcomeNoteInput.trim()}`
      : outcomeNoteInput.trim();

    updateStatusMutation.mutate(
      {
        id: outcomeModalTender.id,
        status: targetStatus,
        offerAmount: Number.isFinite(amount) ? amount : undefined,
        outcomeNote: finalNote,
      },
      {
        onSuccess: () => {
          toast.success(
            targetStatus === "won"
              ? "Pobjeda uspješno zabilježena!"
              : "Ishod tendera evidentiran"
          );
          setOutcomeModalTender(null);
          setTargetStatus(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-5rem)]">
      {/* 1. Header & Main Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                Kanban ploča ponuda
                {isFetching && <RefreshCw className="w-4 h-4 text-primary animate-spin" />}
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm">
                Upravljanje fazama pripreme ponuda, praćenje rokova i evidentiranje ugovora
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-primary text-white hover:bg-primary/90 font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Dodaj tender na ploču
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
            Osvježi
          </Button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="border-l-4 border-l-primary shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktivno na tabli</p>
              <h3 className="text-xl font-bold text-gray-900 mt-0.5">{metrics.totalActive}</h3>
              <p className="text-[11px] text-gray-500">Pratim i U pripremi</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-600 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vrijednost u obradi</p>
              <h3 className="text-xl font-bold text-blue-900 mt-0.5">
                {formatMoney(metrics.inPrepValue)}
              </h3>
              <p className="text-[11px] text-blue-700">Ukupan potencijal u toku</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hitni rokovi</p>
              <h3 className="text-xl font-bold text-rose-700 mt-0.5">{metrics.urgentCount}</h3>
              <p className="text-[11px] text-rose-600">Ističu u roku od 3 dana</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stopa pobjeda (Win)</p>
              <h3 className="text-xl font-bold text-emerald-800 mt-0.5">
                {metrics.winRate !== null ? `${metrics.winRate}%` : "—"}
              </h3>
              <p className="text-[11px] text-emerald-700">
                {metrics.wonCount} pobjeda · {formatMoney(metrics.wonValue)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Search & Filter Toolbar */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] max-w-md relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Pretraži po nazivu tendera, naručiocu ili broju..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm bg-gray-50/50"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <span>Kategorija:</span>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sve kategorije</SelectItem>
                <SelectItem value="osiguranje">Osiguranje</SelectItem>
                <SelectItem value="tehnicki">Tehnički pregled</SelectItem>
                <SelectItem value="drugo">Ostale nabavke</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <span>Prioritet:</span>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-8 text-xs w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi prioriteti</SelectItem>
                <SelectItem value="high">Visok prioritet</SelectItem>
                <SelectItem value="urgent">Hitni rokovi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(searchQuery || categoryFilter !== "all" || priorityFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("all");
                setPriorityFilter("all");
              }}
              className="text-xs text-gray-500 hover:text-gray-800 h-8 px-2"
            >
              Poništi filtere
            </Button>
          )}
        </div>
      </div>

      {/* 4. Kanban Columns & Board */}
      <div className="flex-1 overflow-x-auto pb-6">
        {isLoading ? (
          <div className="flex gap-4">
            {COLUMNS.map((c) => (
              <div key={c.id} className="w-80 flex-shrink-0 space-y-3 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200">
                <Skeleton className="h-7 w-36 rounded-md mb-2" />
                <Skeleton className="h-36 w-full rounded-lg" />
                <Skeleton className="h-36 w-full rounded-lg" />
                <Skeleton className="h-36 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 items-start min-h-[550px]">
              {COLUMNS.map((col) => {
                const items = groupedTenders[col.id] || [];
                const sumKm = columnSums[col.id] || 0;

                return (
                  <div
                    key={col.id}
                    className={`w-80 flex-shrink-0 flex flex-col rounded-xl border-t-4 border ${col.accentBorder} ${col.columnBg} shadow-xs`}
                  >
                    {/* Column Header */}
                    <div className={`p-3 border-b flex flex-col gap-1 rounded-t-lg ${col.headerBg}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm uppercase tracking-wider">{col.title}</span>
                        <Badge variant="outline" className={`font-bold px-2 py-0.5 text-xs shadow-xs ${col.badgeClass}`}>
                          {items.length}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] opacity-85">
                        <span>{col.description}</span>
                        {sumKm > 0 && <span className="font-semibold">{formatMoney(sumKm)}</span>}
                      </div>
                    </div>

                    {/* Droppable Area */}
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={`p-2.5 flex-1 min-h-[460px] space-y-3 transition-colors ${
                            snapshot.isDraggingOver ? "bg-primary/5 ring-2 ring-primary/20 rounded-b-xl" : ""
                          }`}
                        >
                          {items.length === 0 && !snapshot.isDraggingOver && (
                            <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-300 rounded-lg text-gray-400">
                              <p className="text-xs">Nema tendera u ovoj fazi</p>
                              {col.id === "watching" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setIsAddModalOpen(true)}
                                  className="mt-2 text-xs text-primary hover:bg-primary/10 h-7"
                                >
                                  + Dodaj tender
                                </Button>
                              )}
                            </div>
                          )}

                          {items.map((tender, index) => (
                            <Draggable key={tender.id} draggableId={tender.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  style={{
                                    ...dragProvided.draggableProps.style,
                                    opacity: dragSnapshot.isDragging ? 0.95 : 1,
                                  }}
                                >
                                  <KanbanCardItem
                                    tender={tender}
                                    onMove={(target) => handleDirectMove(tender, target)}
                                    onPriorityChange={(p) =>
                                      updateStatusMutation.mutate({ id: tender.id, priority: p })
                                    }
                                    onRemove={() => removeTenderMutation.mutate(tender.id)}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* 5. Outcome Modal (Won / Lost) */}
      <Dialog
        open={Boolean(outcomeModalTender)}
        onOpenChange={(open) => {
          if (!open) {
            setOutcomeModalTender(null);
            setTargetStatus(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              {targetStatus === "won" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Evidentiraj ugovorenu pobjedu
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-600" />
                  Evidentiraj ishod — propušten tender
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600">
              {outcomeModalTender?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                {targetStatus === "won" ? "Naša ugovorena cijena ponude (KM sa PDV):" : "Naša konačna ponuda (KM):"}
              </label>
              <Input
                placeholder="npr. 45000"
                type="number"
                value={offerAmountInput}
                onChange={(e) => setOfferAmountInput(e.target.value)}
              />
            </div>

            {targetStatus === "lost" && (
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Glavni razlog gubitka:
                </label>
                <Select value={outcomeReason} onValueChange={setOutcomeReason}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cijena">Cijena (Konkurent ponudio nižu cijenu)</SelectItem>
                    <SelectItem value="diskvalifikacija">Tehnička diskvalifikacija (Formalni uslovi TD)</SelectItem>
                    <SelectItem value="ponisten">Postupak poništen od strane naručioca</SelectItem>
                    <SelectItem value="zalba">Usvojena žalba / Odluka URŽ-a</SelectItem>
                    <SelectItem value="odustali">Interno odustajanje tima</SelectItem>
                    <SelectItem value="drugo">Ostali razlozi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Interna bilješka za analizu i tim:
              </label>
              <Textarea
                rows={3}
                placeholder={
                  targetStatus === "won"
                    ? "npr. Pobjeda na e-Aukciji nakon 4 kruga snižavanja, ugovor stupa na snagu..."
                    : "npr. Euroherc ponudio 3% niže, provjeriti njihove reference za narednu godinu..."
                }
                value={outcomeNoteInput}
                onChange={(e) => setOutcomeNoteInput(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOutcomeModalTender(null);
                setTargetStatus(null);
              }}
            >
              Odustani
            </Button>
            <Button
              size="sm"
              onClick={handleSaveOutcome}
              className={
                targetStatus === "won"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  : "bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              }
            >
              Sačuvaj ishod
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Add Tender to Board Modal */}
      <AddTenderToBoardModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdded={() => {
          refetch();
          toast.success("Tender uspješno dodat na Kanban ploču!");
        }}
      />
    </div>
  );
}

// -------------------------------------------------------------
// Component: KanbanCardItem
// -------------------------------------------------------------
function KanbanCardItem({
  tender,
  onMove,
  onPriorityChange,
  onRemove,
}: {
  tender: KanbanTender;
  onMove: (status: "watching" | "preparing" | "submitted" | "won" | "lost") => void;
  onPriorityChange: (p: "low" | "medium" | "high") => void;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const deadlineProps = getDeadlineBadgeProps(tender.deadline);
  const remainingDays = getRemainingDays(tender.deadline);

  const copyExternalId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tender.externalId) {
      navigator.clipboard.writeText(tender.externalId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Broj obavještenja kopiran!");
    }
  };

  const priorityColor =
    tender.userPriority === "high"
      ? "bg-rose-500 text-white"
      : tender.userPriority === "medium"
      ? "bg-amber-500 text-white"
      : "bg-slate-400 text-white";

  return (
    <Card className="group cursor-grab active:cursor-grabbing hover:shadow-md transition-all hover:border-primary/40 bg-white border border-gray-200/90 rounded-lg overflow-hidden">
      <CardContent className="p-3.5 space-y-2.5">
        {/* Top bar: External ID, Category, Priority & Menu */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={copyExternalId}
              title="Kopiraj broj obavještenja"
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 font-mono transition-colors border border-gray-200"
            >
              {tender.externalId?.substring(0, 11) || "N/A"}
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
            </button>

            {tender.category && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4.5 bg-primary/5 text-primary border-primary/20">
                {tender.category}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Priority selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={`Prioritet: ${tender.userPriority || "srednji"}`}
                  className={`w-2.5 h-2.5 rounded-full ${priorityColor} ring-2 ring-white hover:scale-125 transition-transform`}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={() => onPriorityChange("high")}>
                  <div className="w-2 h-2 rounded-full bg-rose-500 mr-2" /> Visok prioritet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPriorityChange("medium")}>
                  <div className="w-2 h-2 rounded-full bg-amber-500 mr-2" /> Srednji prioritet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPriorityChange("low")}>
                  <div className="w-2 h-2 rounded-full bg-slate-400 mr-2" /> Nizak prioritet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Context menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-700 p-0">
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 text-xs">
                <div className="px-2 py-1 text-[10px] font-bold uppercase text-gray-400">Premjesti u fazu:</div>
                <DropdownMenuItem onClick={() => onMove("watching")}>Pratim</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove("preparing")}>U pripremi</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove("submitted")}>Predato / Čeka</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove("won")}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1.5" /> Pobjeda
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove("lost")}>
                  <XCircle className="w-3.5 h-3.5 text-rose-600 mr-1.5" /> Gubitak
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/tenders/${tender.id}`}>
                    <FolderKanban className="w-3.5 h-3.5 mr-1.5 text-primary" /> Otvori dosje tendera
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRemove} className="text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Ukloni sa ploče
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-sm leading-snug text-gray-900 line-clamp-2 hover:text-primary transition-colors">
          <Link href={`/tenders/${tender.id}`}>
            {tender.title}
          </Link>
        </h4>

        {/* Contracting Authority */}
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="truncate" title={tender.contractingAuth}>
            {tender.contractingAuth}
          </span>
        </div>

        {/* Estimated Value & e-Auction badge */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div>
            <span className="text-[10px] text-gray-400 block uppercase font-medium">Proc. vrijednost</span>
            <span className="font-bold text-xs text-gray-900">
              {formatMoney(tender.estimatedValue)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {tender.hasEAuction && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4.5 bg-amber-50 text-amber-800 border-amber-300 font-medium">
                <Gavel className="w-3 h-3 mr-0.5 text-amber-600" /> e-Aukcija
              </Badge>
            )}

            {tender.workspaceDecision === "go" && (
              <Badge className="text-[10px] px-1.5 py-0 h-4.5 bg-emerald-600 text-white border-0">
                Idemo
              </Badge>
            )}
            {tender.workspaceDecision === "no_go" && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4.5">
                Ne idemo
              </Badge>
            )}
          </div>
        </div>

        {/* Outcome banner if won/lost */}
        {(tender.userStatus === "won" || tender.userStatus === "lost") && (
          <div
            className={`text-[11px] rounded-md p-1.5 border ${
              tender.userStatus === "won"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            }`}
          >
            {tender.offerAmount != null && (
              <div className="font-semibold">
                Naša ponuda: {formatMoney(tender.offerAmount)}
              </div>
            )}
            {tender.outcomeNote && (
              <div className="text-[10px] text-gray-600 truncate mt-0.5" title={tender.outcomeNote}>
                {tender.outcomeNote}
              </div>
            )}
          </div>
        )}

        {/* Bottom bar: Deadline countdown & Dosje link */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className={`text-xs ${remainingDays.colorClass}`}>
              {remainingDays.text}
            </span>
          </div>

          <Link href={`/tenders/${tender.id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10 font-medium"
            >
              Dosje <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// Component: AddTenderToBoardModal
// -------------------------------------------------------------
function AddTenderToBoardModal({
  isOpen,
  onClose,
  onAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { token } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: availableTenders, isLoading } = useQuery<KanbanTender[]>({
    queryKey: ["kanbanAvailable", searchTerm],
    queryFn: async () => {
      const url = searchTerm
        ? `/api/tenders/kanban/available?q=${encodeURIComponent(searchTerm)}`
        : "/api/tenders/kanban/available";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Neuspješno preuzimanje tendera");
      return res.json();
    },
    enabled: isOpen,
  });

  const addTenderMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "watching" | "preparing" }) => {
      const res = await fetch(`/api/tenders/${id}/user-status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Greška pri dodavanju na ploču");
      return res.json();
    },
    onSuccess: () => {
      onAdded();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Plus className="w-5 h-5 text-primary" />
            Dodaj otvoreni tender na Kanban ploču
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Izaberite tender iz kataloga javnih nabavki za praćenje ili izradu ponude
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative my-2">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <Input
            placeholder="Pretraži otvorene tendere po nazivu ili ugovornom organu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        {/* List of available tenders */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[380px]">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 border rounded-lg space-y-2 bg-gray-50/50">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : availableTenders?.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Nema pronađenih tendera za dodavanje
            </div>
          ) : (
            availableTenders?.map((t) => (
              <div
                key={t.id}
                className="p-3 border rounded-lg hover:border-primary/40 hover:bg-gray-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-500">{t.externalId}</span>
                    {t.category && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {t.category}
                      </Badge>
                    )}
                  </div>
                  <h5 className="font-semibold text-sm text-gray-900 leading-snug line-clamp-1">{t.title}</h5>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="truncate max-w-[220px]">{t.contractingAuth}</span>
                    <span>·</span>
                    <span className="font-medium text-gray-900">{formatMoney(t.estimatedValue)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => addTenderMutation.mutate({ id: t.id, status: "watching" })}
                    disabled={addTenderMutation.isPending}
                  >
                    Prati
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-8 bg-primary text-white hover:bg-primary/90"
                    onClick={() => addTenderMutation.mutate({ id: t.id, status: "preparing" })}
                    disabled={addTenderMutation.isPending}
                  >
                    U pripremu
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="border-t pt-3 mt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Zatvori
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
