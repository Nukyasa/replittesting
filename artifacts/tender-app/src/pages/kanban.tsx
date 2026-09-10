import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUpdateTenderUserStatus, customFetch } from "@workspace/api-client-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getDeadlineBadgeProps } from "@/lib/format";
import { Link } from "wouter";
import { toast } from "sonner";

const COLUMNS = [
  { id: "watching", title: "Pratim", color: "bg-gray-100", borderColor: "border-gray-200" },
  { id: "preparing", title: "U obradi", color: "bg-blue-50", borderColor: "border-blue-200" },
  { id: "submitted", title: "Prijavljeno", color: "bg-amber-50", borderColor: "border-amber-200" },
  { id: "won", title: "Pobjeda", color: "bg-green-50", borderColor: "border-green-200" },
  { id: "lost", title: "Gubitak", color: "bg-red-50", borderColor: "border-red-200" },
];

export default function KanbanPage() {
  const { data: tenders, isLoading, refetch } = useQuery({
    queryKey: ["kanbanBoard"],
    queryFn: () => customFetch<any[]>("/api/tenders/kanban/board"),
  });

  const { mutate: updateStatus } = useUpdateTenderUserStatus();

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId !== destination.droppableId) {
      const newStatus = destination.droppableId;
      
      updateStatus(
        { id: draggableId, data: { status: newStatus as any } },
        {
          onSuccess: () => {
            toast.success(`Status tendera ažuriran`);
            refetch();
          },
          onError: () => toast.error("Greška pri ažuriranju statusa"),
        }
      );
    }
  };

  const getGroupedTenders = () => {
    const grouped: Record<string, any[]> = {
      watching: [], preparing: [], submitted: [], won: [], lost: []
    };
    if (tenders) {
      tenders.forEach(t => {
        const status = t.userStatus || "watching";
        if (grouped[status]) {
          grouped[status].push(t);
        } else {
          grouped["watching"].push(t);
        }
      });
    }
    return grouped;
  };

  const grouped = getGroupedTenders();

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Kanban ploča</h1>
        <p className="text-gray-500 text-sm mt-1">Praćenje statusa tendera i delegacija zadataka</p>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        {isLoading ? (
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-80 flex-shrink-0 space-y-4 bg-gray-50 p-4 rounded-lg">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full items-start">
              {COLUMNS.map(col => (
                <div key={col.id} className={`w-80 h-full max-h-full flex-shrink-0 flex flex-col rounded-lg border ${col.color} ${col.borderColor}`}>
                  <div className="p-3 border-b font-semibold text-sm flex items-center justify-between bg-white/60 rounded-t-lg shadow-sm">
                    <span className="uppercase tracking-wider text-gray-700">{col.title}</span>
                    <span className="bg-white text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-sm">
                      {grouped[col.id]?.length || 0}
                    </span>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`p-3 flex-1 overflow-y-auto space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-black/5' : ''}`}
                      >
                        {grouped[col.id]?.map((t: any, index: number) => (
                          <Draggable key={t.id} draggableId={t.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  opacity: snapshot.isDragging ? 0.9 : 1,
                                }}
                              >
                                <KanbanCard tender={t} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}

function KanbanCard({ tender }: { tender: any }) {
  const deadlineProps = getDeadlineBadgeProps(tender.deadline);
  
  return (
    <Card className="cursor-grab hover:shadow-md transition-all hover:border-primary/50 bg-white shadow-sm hover:-translate-y-0.5 border border-gray-200">
      <CardContent className="p-3.5 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-gray-50/50 text-gray-500 font-mono border-gray-200">
            {tender.externalId?.substring(0, 8) || "N/A"}
          </Badge>
          {tender.userPriority === "high" ? (
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 shadow-sm" title="Visok prioritet" />
          ) : tender.relevanceScore >= 80 ? (
            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Visoka relevantnost" />
          ) : null}
        </div>
        <h4 className="font-semibold text-sm leading-snug text-gray-900 line-clamp-2" title={tender.title}>
          <Link href={`/tenders/${encodeURIComponent(tender.id)}`} className="hover:text-primary hover:underline decoration-primary/30">
            {tender.title}
          </Link>
        </h4>
        <p className="text-xs text-gray-500 line-clamp-1" title={tender.contractingAuth}>{tender.contractingAuth}</p>
        {(tender.userStatus === "won" || tender.userStatus === "lost") && <div className={`text-xs rounded px-2 py-1 ${tender.userStatus === "won" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          Ishod evidentiran{tender.outcomeRecordedAt ? `: ${new Date(tender.outcomeRecordedAt).toLocaleDateString("bs-BA")}` : ""}{tender.offerAmount != null ? ` · naša ponuda ${Number(tender.offerAmount).toLocaleString("bs-BA")} KM` : ""}
        </div>}
        
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 mt-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shadow-inner">
            {tender.assignedTo ? tender.assignedTo.substring(0, 2).toUpperCase() : "MA"}
          </div>
          <Badge className={`text-[10px] px-2 h-5 shadow-sm border-0 ${deadlineProps.className}`}>
            {deadlineProps.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
