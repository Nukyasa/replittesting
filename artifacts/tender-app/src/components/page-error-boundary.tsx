import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Greška pri prikazu stranice", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Tender se trenutno ne može prikazati</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Osvježite stranicu i pokušajte ponovo. Ako je tender uklonjen, vratite se na listu tendera.
          </p>
          {this.state.error?.message && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100 text-left text-xs font-mono text-red-700 max-h-32 overflow-auto">
              {this.state.error.message}
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Nazad
            </Button>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Osvježi stranicu
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
