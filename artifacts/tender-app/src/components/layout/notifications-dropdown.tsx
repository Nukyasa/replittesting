import { useState, useRef, useEffect } from "react";
import { Bell, Check, Trash2, Loader2, FileText, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { bs } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { token } = useAuthStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch("/api/notifications", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10000, // Poll every 10s
  });

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/read-all", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark single as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read) {
      await markAsReadMutation.mutateAsync(notif.id);
    }
    setIsOpen(false);
    if (notif.tenderId) {
      setLocation(`/tenders/${notif.tenderId}`);
    }
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: bs });
    } catch {
      return "nedavno";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative hover:bg-gray-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-gray-100 bg-white shadow-2xl z-50 overflow-hidden transition-all duration-200 ease-out origin-top-right transform scale-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900">Obavještenja</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10 border-transparent text-[11px] px-1.5 py-0.5 animate-pulse">
                  {unreadCount} novo
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
                disabled={markAllAsReadMutation.isPending}
              >
                <Check className="w-3.5 h-3.5" />
                Označi sve pročitano
              </button>
            )}
          </div>

          {/* List */}
          <ScrollArea className="h-80">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs">Učitavanje obavještenja...</span>
              </div>
            ) : !notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                <Bell className="w-8 h-8 text-gray-200" />
                <span className="text-sm font-medium">Nema novih obavještenja</span>
                <span className="text-xs text-gray-400">Ovdje će se prikazati izmjene na tenderima</span>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notif: any) => {
                  const Icon = notif.type === "change" ? AlertTriangle : FileText;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`flex gap-3 px-4 py-3 hover:bg-gray-50/80 cursor-pointer transition-colors relative group ${
                        !notif.read ? "bg-primary/[0.02]" : ""
                      }`}
                    >
                      {/* Read status dot */}
                      {!notif.read && (
                        <span className="absolute left-1.5 top-4.5 w-1.5 h-1.5 bg-primary rounded-full" />
                      )}

                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        notif.type === "change" 
                          ? "bg-amber-50 text-amber-600" 
                          : "bg-blue-50 text-blue-600"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className={`text-xs font-semibold text-gray-900 leading-snug line-clamp-1`}>
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">
                            {getRelativeTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600 mt-0.5 leading-normal line-clamp-2">
                          {notif.message}
                        </p>
                      </div>

                      {/* Action buttons (Delete) */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shrink-0 self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          onClick={(e) => handleDelete(e, notif.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
