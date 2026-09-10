import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { format, isSameDay, isBefore } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

export default function CalendarPage() {
  const { data: tenders, isLoading } = useQuery({
    queryKey: ["kanbanBoard"],
    queryFn: () => customFetch<any[]>("/api/tenders/kanban/board"),
  });

  const getGroupedByDate = () => {
    if (!tenders) return [];
    
    const grouped: Record<string, any[]> = {};
    tenders.forEach(t => {
      if (!t.deadline) return;
      const dateKey = format(new Date(t.deadline), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(t);
    });

    return Object.entries(grouped)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, items]) => ({ date, items }));
  };

  const timeline = getGroupedByDate();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl text-primary">
          <CalendarIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Kalendar Rokova</h1>
          <p className="text-gray-500 text-sm mt-1">Hronološki pregled nadolazećih rokova za predaju tendera</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-6">
              <Skeleton className="w-24 h-8" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : timeline.length === 0 ? (
        <div className="text-center py-24 bg-gray-50 rounded-2xl border border-dashed">
          <CalendarIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Nema nadolazećih rokova</h3>
          <p className="text-gray-500">Nemate tendera sa definiranim rokovima koje pratite.</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-primary/20 ml-4 md:ml-6 space-y-10 py-4">
          {timeline.map(({ date, items }) => {
            const dateObj = new Date(date);
            const isToday = isSameDay(dateObj, new Date());
            const isPast = isBefore(dateObj, new Date()) && !isToday;
            
            return (
              <div key={date} className="relative pl-8 md:pl-12">
                {/* Timeline dot */}
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ring-4 ring-white shadow-sm ${isToday ? 'bg-primary ring-primary/20' : isPast ? 'bg-gray-300' : 'bg-primary'}`} />
                
                <div className="mb-4 flex items-center gap-3">
                  <h3 className={`font-bold text-lg ${isToday ? 'text-primary' : isPast ? 'text-gray-500' : 'text-gray-900'}`}>
                    {format(dateObj, "dd.MM.yyyy")}
                  </h3>
                  {isToday && <Badge className="bg-primary/10 text-primary border-primary/20">Danas</Badge>}
                  {isPast && <Badge variant="outline" className="text-gray-500 bg-gray-50">Isteklo</Badge>}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map(tender => (
                    <Link key={tender.id} href={`/tenders/${encodeURIComponent(tender.id)}`}>
                      <Card className={`cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md border-gray-200 shadow-sm ${isPast ? 'opacity-70 grayscale' : 'hover:border-primary/50'}`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <Badge variant="outline" className="font-mono text-[10px] bg-gray-50 text-gray-600">
                              {tender.externalId?.substring(0, 8) || "N/A"}
                            </Badge>
                            {tender.userPriority === "high" && (
                              <Badge className="bg-red-50 text-red-600 border-red-200 hover:bg-red-50">Visok prioritet</Badge>
                            )}
                          </div>
                          
                          <h4 className="font-semibold text-gray-900 line-clamp-2" title={tender.title}>
                            {tender.title}
                          </h4>
                          <p className="text-sm text-gray-500 line-clamp-1">{tender.contractingAuth}</p>
                          
                          <div className="pt-3 border-t flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                              <Clock className="w-4 h-4" />
                              {format(new Date(tender.deadline), "HH:mm")}
                            </div>
                            
                            <Badge variant="secondary" className={`hover:opacity-80 ${
                              tender.userStatus === 'won' ? 'bg-green-100 text-green-700' :
                              tender.userStatus === 'submitted' ? 'bg-amber-100 text-amber-700' :
                              tender.userStatus === 'preparing' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {tender.userStatus === 'won' ? 'Pobjeda' :
                               tender.userStatus === 'submitted' ? 'Prijavljeno' :
                               tender.userStatus === 'preparing' ? 'U obradi' : 'Pratim'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
