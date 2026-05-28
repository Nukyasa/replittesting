import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import { LayoutDashboard, FileText, BarChart3, Settings, ShieldAlert, KanbanSquare, LogOut } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tenders", label: "Tenderi", icon: FileText },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/analytics", label: "Analitika", icon: BarChart3 },
];

const ADMIN_ITEMS = [
  { href: "/settings", label: "Postavke", icon: Settings },
  { href: "/admin", label: "Admin", icon: ShieldAlert },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, clearAuth } = useAuthStore();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        clearAuth();
      }
    });
  };

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen border-r border-sidebar-border hidden md:flex">
      <div className="p-6">
        <img src="https://asacentral.ba/logo.webp" alt="ASA Central Osiguranje" className="h-10 object-contain mb-2 brightness-0 invert" />
        <h1 className="text-sm font-bold uppercase tracking-wider text-sidebar-foreground/90">Tender Intelligence</h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                isActive ? "bg-white/15 text-white border-l-4 border-white font-medium" : "text-white/70 hover:bg-white/5 hover:text-white"
              )}>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}

        {(user?.role === "admin") && (
          <>
            <div className="mt-8 mb-2 px-3 text-xs font-semibold text-white/50 uppercase tracking-wider">
              Administracija
            </div>
            {ADMIN_ITEMS.map((item) => {
              const isActive = location === item.href || location.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                    isActive ? "bg-white/15 text-white border-l-4 border-white font-medium" : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}>
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </>
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
