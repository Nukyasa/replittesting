import { Bell, Menu, User } from "lucide-react";
import { useAuthStore } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function TopBar() {
  const { user } = useAuthStore();

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5 text-gray-700" />
        </Button>
        <div className="md:hidden font-semibold text-primary">ASA Tender Intelligence</div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></span>
        </Button>
        
        <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
          <div className="hidden sm:block text-right">
            <div className="text-sm font-medium text-gray-900">{user?.name || "Korisnik"}</div>
            <div className="text-xs text-gray-500">{user?.role || "Gost"}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {user?.name?.charAt(0) || <User className="w-5 h-5" />}
          </div>
        </div>
      </div>
    </header>
  );
}
