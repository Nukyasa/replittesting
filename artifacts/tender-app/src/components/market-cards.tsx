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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
      {/* 1. Sva naša tržišta card */}
      <div
        onClick={() => onSelectMarket(null)}
        className={cn(
          "bg-white rounded-xl border p-3.5 cursor-pointer transition-all duration-150 flex flex-col justify-between select-none relative group",
          !selectedMarketId
            ? "border-primary ring-1 ring-primary/20 bg-blue-50/20 shadow-sm"
            : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-xs text-gray-900 truncate">Sva naša tržišta</h3>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
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
              "bg-white rounded-xl border p-4 cursor-pointer transition-all duration-150 flex flex-col justify-between select-none relative group",
              isSelected
                ? "border-primary ring-1 ring-primary/20 bg-blue-50/20 shadow-sm"
                : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                <h3 className="font-bold text-sm text-gray-900 truncate">{m.name}</h3>
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
          <span className="text-sm font-semibold">+ Novo tržište</span>
        </div>
      </Link>
    </div>
  );
}
