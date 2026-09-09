import { ReactNode, useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function AppLayout({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile Navigation Drawer */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border text-sidebar-foreground">
          <div className="sr-only">
            <SheetTitle>Navigacijski Meni</SheetTitle>
          </div>
          <Sidebar isMobile onClose={() => setIsMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
