import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  BarChart3, 
  Settings, 
  ShieldAlert, 
  KanbanSquare, 
  LogOut, 
  Landmark, 
  Users, 
  Scale, 
  AlertCircle, 
  Sparkles, 
  Radar,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  badge?: string;
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Radni pregled", icon: LayoutDashboard },
  { href: "/tenders", label: "Aktivne nabavke", icon: FileText },
  { href: "/renewal-radar", label: "Radar obnova", icon: Radar },
  { href: "/kanban", label: "Moje ponude (Kanban)", icon: KanbanSquare },
  { href: "/history", label: "Arhiva ugovora", icon: History },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/analytics", label: "Tržišna analitika", icon: BarChart3 },
  { href: "/authorities", label: "Ugovorni organi", icon: Landmark },
  { href: "/suppliers", label: "Konkurencija (Dobavljači)", icon: Users },
  { href: "/resolutions", label: "Rješenja URŽ", icon: Scale },
  { href: "/provjera-firme", label: "Provjera firme", icon: Sparkles },
  { href: "/early-warning", label: "Rano upozorenje", icon: AlertCircle },
];

const ADMIN_ITEMS = [
  { href: "/settings", label: "Postavke", icon: Settings },
  { href: "/admin", label: "Admin", icon: ShieldAlert },
];

interface SidebarProps {
  className?: string;
  isMobile?: boolean;
  onClose?: () => void;
}

export function Sidebar({ className, isMobile, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user, clearAuth } = useAuthStore();
  const logout = useLogout();
  
  // Automatski otvori dodatne alate ako je korisnik na nekoj od tih ruta
  const isSecondaryActive = SECONDARY_NAV_ITEMS.some(item => 
    location === item.href || location.startsWith(item.href + "/")
  );
  const [showSecondary, setShowSecondary] = useState(isSecondaryActive);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        if (isMobile && onClose) onClose();
      }
    });
  };

  return (
    <div className={cn(
      "w-64 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen border-r border-sidebar-border",
      className
    )}>
      <div className="p-6">
        <img src="https://asacentral.ba/logo.webp" alt="ASA Central Osiguranje" className="h-10 object-contain mb-2 brightness-0 invert" />
        <h1 className="text-sm font-bold uppercase tracking-wider text-sidebar-foreground/90">Tender Intelligence</h1>
        <p className="text-[10px] text-white/50 font-medium tracking-wide uppercase mt-0.5">Osiguranja & Tehnički pregled</p>
      </div>
      
      <nav className="flex-1 px-3 space-y-4 overflow-y-auto">
        {/* GLAVNI RADNI TOK */}
        <div className="space-y-1">
          <div className="px-3 pt-1 pb-1.5 text-[11px] font-bold text-white/40 tracking-wider uppercase">
            Glavni radni prostor
          </div>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href + "/"));
            return (
              <Link key={item.href} href={item.href}>
                <div 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm",
                    isActive 
                      ? "bg-white/15 text-white font-semibold shadow-sm" 
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                  onClick={() => {
                    if (isMobile && onClose) onClose();
                  }}
                >
                  <item.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-white/70")} />
                  <span className="flex-1">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* DODATNI ALATI I ANALITIKA (SKLOPIVO) */}
        <div className="space-y-1 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setShowSecondary(!showSecondary)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-white/50 hover:text-white/80 tracking-wider uppercase transition-colors"
          >
            <span>Dodatni alati & Baza</span>
            {showSecondary ? (
              <ChevronDown className="w-3.5 h-3.5 text-white/50" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-white/50" />
            )}
          </button>
          
          {showSecondary && (
            <div className="space-y-1 pt-1">
              {SECONDARY_NAV_ITEMS.map((item) => {
                const isActive = location === item.href || location.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href}>
                    <div 
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs",
                        isActive 
                          ? "bg-white/15 text-white font-semibold shadow-sm" 
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      )}
                      onClick={() => {
                        if (isMobile && onClose) onClose();
                      }}
                    >
                      <item.icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-white/60")} />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {(user?.role === "admin") && (
          <div className="space-y-1 pt-2">
            <div className="px-3 pt-2 pb-1 text-[11px] font-bold text-white/40 tracking-wider uppercase">
              Administracija
            </div>
            {ADMIN_ITEMS.map((item) => {
              const isActive = location === item.href || location.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}>
                  <div 
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm",
                      isActive 
                        ? "bg-white/15 text-white font-semibold shadow-sm" 
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                    onClick={() => {
                      if (isMobile && onClose) onClose();
                    }}
                  >
                    <item.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-white/70")} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white cursor-pointer" onClick={handleLogout}>
          <LogOut className="w-5 h-5" />
          <span>Odjava</span>
        </div>
      </div>
    </div>
  );
}
