import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Layers, Plus, Star } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export interface Market {
  id: string;
  name: string;
  cpvCodes: string[];
  keywords: string[];
  authorityNames: string[];
  minValue?: number | null;
  maxValue?: number | null;
  openOnly: boolean;
}

export const DEFAULT_ASA_MARKETS: Market[] = [
  {
    id: "preset-ao-kasko",
    name: "Osiguranje vozila (AO & Kasko)",
    cpvCodes: ["66514110-0"],
    keywords: ["kasko", "autoodgovornost", "vozil"],
    authorityNames: [],
    openOnly: true,
  },
  {
    id: "preset-tehnicki",
    name: "Tehnički pregled vozila",
    cpvCodes: ["71631200-2", "71630000-7"],
    keywords: ["tehnički pregled", "pregled vozila", "ispitivanj"],
    authorityNames: [],
    openOnly: true,
  },
  {
    id: "preset-imovina",
    name: "Osiguranje imovine & Odgovornost",
    cpvCodes: ["66515200-5", "66516000-0"],
    keywords: ["imovina", "odgovornost", "objekat"],
    authorityNames: [],
    openOnly: true,
  },
  {
    id: "preset-nezgoda-dzo",
    name: "Nezgoda & Zdravstveno (DZO)",
    cpvCodes: ["66512100-3", "66512220-0"],
    keywords: ["nezgoda", "dzo", "zdravstveno"],
    authorityNames: [],
    openOnly: true,
  },
];

interface MarketCardsProps {
  selectedMarketId?: string | null;
  onSelectMarket: (market: Market | null) => void;
}

export function MarketCards({ selectedMarketId, onSelectMarket }: MarketCardsProps) {
  const { data: markets, isLoading } = useQuery<Market[]>({
    queryKey: ["markets"],
    queryFn: ({ signal }) => customFetch<Market[]>("/api/markets", { signal }),
  });

  const marketList = (markets && markets.length > 0) ? markets : DEFAULT_ASA_MARKETS;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Praćena tržišta</h2>
          <p className="mt-0.5 text-sm text-slate-500">Brzo filtrirajte tendere prema vrsti usluge.</p>
        </div>
        <Link href="/markets" className="hidden text-sm font-medium text-blue-700 hover:text-blue-800 sm:block">Uredi tržišta</Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {/* 1. Sva naša tržišta card */}
      <div
        onClick={() => onSelectMarket(null)}
        className={cn(
          "relative flex min-h-[86px] cursor-pointer select-none flex-col justify-between rounded-xl border bg-white p-4 transition-all duration-150",
          !selectedMarketId
            ? "border-blue-300 bg-blue-50/40 shadow-sm ring-1 ring-blue-100"
            : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-slate-900">Sva tržišta</h3>
            <p className="mt-1 truncate text-xs text-slate-500">
              {isLoading
                ? "Učitavanje..."
                : "Osiguranje & Tehnički pregled"}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Individual Market cards */}
      {marketList.map((m) => {
        const isSelected = selectedMarketId === m.id;
        return (
          <div
            key={m.id}
            onClick={() => onSelectMarket(m)}
            className={cn(
              "relative flex min-h-[86px] cursor-pointer select-none flex-col justify-between rounded-xl border bg-white p-4 transition-all duration-150",
              isSelected
                ? "border-blue-300 bg-blue-50/40 shadow-sm ring-1 ring-blue-100"
                : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />
                <h3 className="truncate text-sm font-semibold text-slate-900">{m.name}</h3>
              </div>
              <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                {m.cpvCodes?.length || 0}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500 truncate">
                {m.cpvCodes?.length ? `${m.cpvCodes.length} CPV` : "Svi CPV"} · {m.openOnly ? "samo otvorene" : "svi statusi"}
              </span>
              <span className="bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                Aktivno
              </span>
            </div>
          </div>
        );
      })}

      {/* 3. + Novo tržište card */}
      <Link href="/markets">
        <div className="rounded-xl border border-dashed border-gray-300 hover:border-primary/50 hover:bg-gray-50/80 p-4 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer h-full min-h-[76px] text-gray-600 hover:text-primary">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-semibold">Novo tržište</span>
        </div>
      </Link>
      </div>
    </section>
  );
}
