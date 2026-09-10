import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import { LayoutDashboard, FileText, History, BarChart3, Settings, ShieldAlert, KanbanSquare, LogOut, Building2, SlidersHorizontal, Landmark, Users, Scale, AlertCircle, Briefcase, Bookmark, Sparkles, Radar } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: any;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ]
  },
  {
    title: "NABAVKE",
    items: [
      { href: "/tenders", label: "Sve nabavke", icon: FileText },
      { href: "/renewal-radar", label: "Radar obnova", icon: Radar },
      { href: "/history", label: "Historija tendera", icon: History },
      { href: "/resolutions", label: "Rješenja URŽ", icon: Scale },
      { href: "/early-warning", label: "Rano upozorenje", icon: AlertCircle },
      { href: "/kanban", label: "Kanban", icon: KanbanSquare },
    ]
  },
  {
    title: "SUBJEKTI",
    items: [
      { href: "/authorities", label: "Ugovorni organi", icon: Landmark },
      { href: "/suppliers", label: "Dobavljači", icon: Users },
      { href: "/provjera-firme", label: "Provjera firme", icon: Sparkles },
    ]
  },
  {
    title: "MOJE AKTIVNOSTI",
    items: [
      { href: "/tender-projects", label: "Ponude", icon: Briefcase },
      { href: "/watchlists", label: "Praćenje", icon: Bookmark },
      { href: "/markets", label: "Moja tržišta", icon: SlidersHorizontal },
      { href: "/analytics", label: "Analitika", icon: BarChart3 },
      { href: "/company", label: "Profil firme", icon: Building2 },
    ]
  },
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
      </div>
      
      <nav className="flex-1 px-3 space-y-4 overflow-y-auto">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {section.title && (
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold text-white/40 tracking-wider uppercase">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href + "/"));
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
        ))}

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
