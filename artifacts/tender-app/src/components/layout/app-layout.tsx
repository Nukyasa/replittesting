import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
