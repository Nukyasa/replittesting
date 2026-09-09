import { Badge } from "@/components/ui/badge";

export interface TenderAward {
  winnerName?: string;
  winnerId?: string;
  value?: number;
  winningBidAmount?: number;
  currency?: string;
}

export interface TenderRawData {
  announcementType?: string;
  Number?: string;
  legalEntity?: string;
  date?: string;
  isAuctionOnline?: boolean;
}

export interface TenderStatusInfo {
  status: string;
  statusName?: string | null;
  rawData?: TenderRawData;
  awards?: TenderAward[];
}

function getStatusBadgeClass(stName: string, status: string): string {
  if (
    stName === "Dodijeljen ugovor" ||
    stName === "Dodijeljen" ||
    status === "closed" ||
    status === "awarded"
  ) {
    return "bg-green-50 text-green-700 border-green-200";
  }
  if (stName === "Poništen" || status === "cancelled") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (stName === "Uložena žalba") {
    return "bg-orange-50 text-orange-700 border-orange-200 font-bold animate-pulse";
  }
  if (stName === "Aktivan" || status === "open") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  return "bg-gray-100 text-gray-800 border-gray-200";
}

export function getStatusDisplayName(info: TenderStatusInfo): string {
  if (info.statusName) return info.statusName;

  const raw = info.rawData;
  if (raw?.announcementType) return raw.announcementType;

  if (info.status === "awarded") {
    return "Dodijeljen ugovor";
  }
  if (info.status === "closed") return "Zatvoren";
  if (info.status === "cancelled") {
    return "Poništen";
  }
  if (info.status === "open") {
    return "Aktivan";
  }
  return "Obavještenje o nabavci";
}

interface StatusBadgeProps {
  tender: TenderStatusInfo;
  className?: string;
}

export function StatusBadge({ tender, className = "" }: StatusBadgeProps) {
  const stName = getStatusDisplayName(tender);
  const badgeClass = getStatusBadgeClass(stName, tender.status);

  return (
    <Badge
      variant="outline"
      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 whitespace-nowrap ${badgeClass} ${className}`}
    >
      {stName}
    </Badge>
  );
}

interface AwardWinnerProps {
  awards?: TenderAward[];
}

export function AwardWinner({ awards }: AwardWinnerProps) {
  if (!awards || awards.length === 0) return null;

  const winnerNames = [...new Set(awards
    .map((a) => a.winnerName)
    .filter((name): name is string => !!name))]
    .join(", ");

  if (!winnerNames) return null;

  return (
    <div className="text-[11px] text-green-700 mt-1 font-semibold flex items-center gap-1">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
      Ugovor dodijeljen: {winnerNames}
    </div>
  );
}
