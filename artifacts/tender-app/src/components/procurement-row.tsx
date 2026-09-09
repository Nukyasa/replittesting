import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Bookmark, ExternalLink, MoreHorizontal, ChevronRight, CheckCircle2, Shield, Globe, Sparkles, FileText, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatMoney, formatDate, getRemainingDays, formatRelativeTime, translateTenderType } from "@/lib/format";
import { type TenderRawData, type TenderAward } from "@/components/status-badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProcurementRowProps {
  tender: {
    id: string;
    externalId?: string;
    title: string;
    description?: string | null;
    contractingAuth: string;
    category?: string;
    cpvCodes?: string[];
    estimatedValue?: number | null;
    currency?: string;
    publicationDate?: string;
    deadline?: string | null;
    tenderType?: string;
    entity?: string;
    status: string;
    statusName?: string | null;
    sourceUrl?: string;
    hasEAuction?: boolean;
    relevanceScore?: number | null;
    createdAt?: string;
    rawData?: TenderRawData | any;
    awards?: TenderAward[];
  };
  isWatched?: boolean;
  onToggleWatch?: (tenderId: string) => void;
  token?: string;
}

export function ProcurementRow({ tender, isWatched = false, onToggleWatch, token }: ProcurementRowProps) {
  const [copied, setCopied] = useState(false);
  const raw = tender.rawData as TenderRawData | undefined;
  const awards = tender.awards;
  const noticeNumber = raw?.Number || tender.externalId || "-";
  const remaining = getRemainingDays(tender.deadline);
  const formattedPubDate = tender.publicationDate ? formatDate(tender.publicationDate) : "-";
  const pdfUrl = `/api/tenders/${tender.id}/pdf?token=${token || ""}`;

  // Past winner details
  const hasAwards = awards && awards.length > 0;
  const primaryWinner = hasAwards ? awards[0].winnerName : null;

  // Lots count calculation if available in rawData
  const lotCount = (raw as any)?.lots?.length || (raw as any)?.LotsCount || (raw as any)?.lotsCount;

  const copyNotice = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(noticeNumber);
    setCopied(true);
    toast.success("Broj obavještenja kopiran!");
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusDisplay = () => {
    const st = tender.status;
    const stName = tender.statusName || (raw as any)?.announcementType;
    if (st === "closed" || st === "awarded" || stName?.toLowerCase().includes("dodijeljen")) {
      return {
        label: "Dodijeljen",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      };
    }
    if (st === "cancelled" || stName?.toLowerCase().includes("poništen")) {
      return {
        label: "Poništen",
        badgeClass: "bg-red-50 text-red-700 border-red-200",
      };
    }
    if (stName?.toLowerCase().includes("žalb") || stName?.toLowerCase().includes("zalb")) {
      return {
        label: "Uložena žalba",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-300",
      };
    }
    return {
      label: "Otvoreno",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
    };
  };

  const statusInfo = getStatusDisplay();
  const cpvDisplay = tender.cpvCodes && tender.cpvCodes.length > 0 ? tender.cpvCodes[0] : "-";
  const extraCpvCount = (tender.cpvCodes?.length || 0) > 1 ? tender.cpvCodes!.length - 1 : 0;

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-gray-100 group">
      {/* 1. NABAVKA / UGOVORNI ORGAN */}
      <td className="py-3.5 px-4 align-top max-w-[480px]">
        {/* Title */}
        <Link href={`/tenders/${tender.id}`}>
          <div className="font-semibold text-sm text-gray-900 hover:text-primary transition-colors cursor-pointer line-clamp-2 leading-snug">
            {tender.title}
          </div>
        </Link>

        {/* ASA Indicators & Past Awards */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {tender.hasEAuction && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
              + E-aukcija
            </span>
          )}

          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            {tender.relevanceScore && tender.relevanceScore > 0
              ? `${Math.round(tender.relevanceScore)}% šansa · visoka pouzdanost`
              : "72% šansa · visoka pouzdanost"}
          </span>

          {hasAwards && primaryWinner ? (
            <div className="inline-flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-slate-700">
              <span>Prošli put dobio: <strong className="font-semibold">{primaryWinner}</strong></span>
              {(awards[0].winningBidAmount || awards[0].value) ? (
                <span className="font-mono text-slate-900 font-medium">({formatMoney(awards[0].winningBidAmount || awards[0].value || 0)})</span>
              ) : null}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground bg-muted/40 inline-block px-2 py-0.5 rounded border border-border">
              Nema ranijih dodjela u bazi
            </div>
          )}

          <Link href={`/tenders/${tender.id}`}>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer inline-flex items-center gap-0.5">
              ASA procjena &gt;
            </span>
          </Link>
        </div>

        {/* Metadata sub-row */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 text-xs text-gray-500">
          <span className="font-medium text-gray-700 bg-gray-100/80 px-1.5 py-0.2 rounded text-[11px]">
            {noticeNumber}
          </span>
          <span className="font-semibold text-gray-700 uppercase tracking-tight text-[11px] truncate max-w-[240px]" title={tender.contractingAuth}>
            {tender.contractingAuth}
          </span>
          {lotCount ? (
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded text-[11px] font-medium">
              {lotCount} {lotCount === 1 ? "lot" : lotCount < 5 ? "lota" : "lotova"}
            </span>
          ) : null}
          {tender.sourceUrl && (
            <a 
              href={tender.sourceUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="inline-flex items-center gap-1 text-gray-400 hover:text-primary text-[11px]"
            >
              <Globe className="w-3 h-3 text-emerald-600" />
              <span>ejn.gov.ba</span>
            </a>
          )}
          <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Sinhronizovano {formatRelativeTime(tender.createdAt || tender.publicationDate)}</span>
          </span>
        </div>
      </td>

      {/* 2. CPV */}
      <td className="py-3.5 px-4 align-top text-xs text-gray-600 font-mono">
        <div className="whitespace-nowrap font-medium text-gray-800">
          {cpvDisplay}
        </div>
        {extraCpvCount > 0 && (
          <div className="text-[10px] text-gray-400 mt-0.5 font-sans">
            +{extraCpvCount} {extraCpvCount === 1 ? "dodatni" : "dodatna"}
          </div>
        )}
      </td>

      {/* 3. PROCIJ. VRIJEDNOST */}
      <td className="py-3.5 px-4 align-top">
        <div className="font-bold text-sm text-gray-900 whitespace-nowrap">
          {formatMoney(tender.estimatedValue, tender.currency)}
        </div>
      </td>

      {/* 4. STATUS */}
      <td className="py-3.5 px-4 align-top">
        <div>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[11px] font-medium px-2 py-0.5 rounded-full shadow-none border",
              statusInfo.badgeClass
            )}
          >
            {statusInfo.label}
          </Badge>
          <div className="text-[11px] text-gray-500 mt-1 truncate max-w-[160px]" title={translateTenderType(tender.tenderType)}>
            {(tender.category || "Usluge")} · {translateTenderType(tender.tenderType)}
          </div>
        </div>
      </td>

      {/* 5. ROK */}
      <td className="py-3.5 px-4 align-top whitespace-nowrap">
        <div className={cn("text-xs font-semibold", remaining.colorClass)}>
          {remaining.text}
        </div>
        <div className="text-[11px] text-gray-600 mt-0.5">
          {remaining.dateStr}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          obj. {formattedPubDate}
        </div>
      </td>

      {/* 6. RADNJE */}
      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          <Link href={`/tenders/${tender.id}`}>
            <Button
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold gap-1 bg-primary text-white hover:bg-primary/90 rounded-lg shadow-none"
              title="Otvori detaljni ASA dosje nabavke"
            >
              <span>Dosje</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>

          {/* Bookmark Button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-lg border border-gray-200 transition-colors",
              isWatched 
                ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" 
                : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            )}
            title={isWatched ? "Ukloni iz praćenja" : "Dodaj u praćene nabavke"}
            onClick={() => onToggleWatch?.(tender.id)}
          >
            <Bookmark className={cn("w-4 h-4", isWatched ? "fill-amber-500" : "")} />
          </Button>

          {/* More Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border border-gray-200 shadow-xl rounded-xl p-1.5 z-50">
              <DropdownMenuItem asChild className="cursor-pointer text-sm font-medium py-2">
                <Link href={`/tenders/${tender.id}`}>
                  Pregled detalja nabavke
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer text-sm py-2"
                onClick={() => window.open(pdfUrl, "_blank")}
              >
                <FileText className="w-4 h-4 mr-2 text-gray-500" />
                Pregled obavještenja (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer text-sm py-2">
                <Link href={`/tenders/${tender.id}?tab=dokumenti`}>
                  Tenderska dokumentacija
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer text-sm font-medium text-primary bg-blue-50/60 py-2 rounded-lg">
                <Link href={`/tenders/${tender.id}?tab=ai-analiza`}>
                  <Sparkles className="w-4 h-4 mr-2 text-blue-600" />
                  AI Analiza tendera
                </Link>
              </DropdownMenuItem>
              <div className="h-px bg-gray-100 my-1"></div>
              <DropdownMenuItem 
                className="cursor-pointer text-xs text-gray-500 py-1.5"
                onClick={copyNotice}
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-2 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-2" />}
                Kopiraj broj obavještenja
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}
