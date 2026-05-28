import { useState } from "react";
import { useListTenders, useUpdateTenderUserStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getDeadlineBadgeProps } from "@/lib/format";
import { Link } from "wouter";

const COLUMNS = [
  { id: "pratim", title: "Pratim", color: "bg-gray-100" },
  { id: "obrada", title: "U obradi", color: "bg-blue-50" },
  { id: "prijavljeno", title: "Prijavljeno", color: "bg-amber-50" },
  { id: "pobjeda", title: "Pobjeda / Gubitak", color: "bg-green-50" },
];

export default function KanbanPage() {
  const { data, isLoading } = useListTenders({ limit: 50 });
  const updateStatus = useUpdateTenderUserStatus();
  
  // For a real kanban we would group by userTender.status
  // Here we just simulate grouping for UI demonstration
  const getGroupedTenders = () => {
    if (!data?.tenders) return { pratim: [], obrada: [], prijavljeno: [], pobjeda: [] };
    
    // Distribute randomly for visual purposes if no actual status
    return {
      pratim: data.tenders.slice(0, 4),
      obrada: data.tenders.slice(4, 7),
      prijavljeno: data.tenders.slice(7, 9),
      pobjeda: data.tenders.slice(9, 11),
    };
  };

  const grouped = getGroupedTenders();

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Kanban ploča</h1>
        <p className="text-gray-500 text-sm mt-1">Praćenje statusa tendera u obradi</p>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-80 flex-shrink-0 space-y-4 bg-gray-50 p-4 rounded-lg">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))
        ) : (
          COLUMNS.map(col => (
            <div key={col.id} className={`w-80 flex-shrink-0 flex flex-col rounded-lg border ${col.color}`}>
              <div className="p-3 border-b font-medium text-sm flex items-center justify-between bg-white/50 rounded-t-lg">
                <span className="uppercase tracking-wide text-gray-700">{col.title}</span>
                <span className="bg-white text-gray-500 px-2 py-0.5 rounded-full text-xs font-bold border">
                  {(grouped as any)[col.id]?.length || 0}
                </span>
              </div>
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {(grouped as any)[col.id]?.map((t: any) => (
                  <KanbanCard key={t.id} tender={t} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({ tender }: { tender: any }) {
  const deadlineProps = getDeadlineBadgeProps(tender.deadline);
  
  return (
    <Link href={`/tenders/${tender.id}`}>
      <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/50 bg-white">
        <CardContent className="p-3 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-gray-50">ID: {tender.externalId?.substring(0, 8)}</Badge>
            {tender.relevanceScore >= 80 && (
              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Visok prioritet" />
            )}
          </div>
          <h4 className="font-semibold text-sm leading-tight text-gray-900 line-clamp-2" title={tender.title}>{tender.title}</h4>
          <p className="text-xs text-gray-500 line-clamp-1">{tender.contractingAuth}</p>
          <div className="flex items-center justify-between pt-2 border-t mt-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">MA</div>
            <Badge className={`text-[10px] px-1.5 h-5 ${deadlineProps.className}`}>{deadlineProps.label}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
