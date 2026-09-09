import { format, formatDistanceToNow, isPast } from "date-fns";
import { bs } from "date-fns/locale";

export function formatMoney(amount?: number | null, currency: string = "KM") {
  if (amount == null) return "N/A";
  return amount.toLocaleString("bs-BA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " " + currency;
}

export function formatDate(dateString?: string | null) {
  if (!dateString) return "Nije objavljeno";
  try {
    return format(new Date(dateString), "dd.MM.yyyy.");
  } catch (e) {
    return dateString;
  }
}

export function getScoreBadgeProps(score?: number | null) {
  if (score == null) return { label: "N/A", className: "bg-gray-100 text-gray-700" };
  if (score >= 80) return { label: "Odlično", className: "bg-[#002d82] text-white border-transparent" };
  if (score >= 60) return { label: "Dobro", className: "bg-[#166534] text-white border-transparent" };
  if (score >= 40) return { label: "Srednje", className: "bg-[#92400e] text-white border-transparent" };
  return { label: "Nisko", className: "bg-gray-200 text-gray-800 border-transparent" };
}

export function getDeadlineBadgeProps(deadline?: string | null) {
  if (!deadline || Number.isNaN(new Date(deadline).getTime())) return { label: "Rok nije poznat", className: "bg-gray-100 text-gray-700" };
  const d = new Date(deadline);
  if (isPast(d)) return { label: "Rok istekao", className: "bg-gray-200 text-gray-800 border-transparent" };
  
  const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) return { label: "HITNO!", className: "bg-[#991b1b] text-white border-transparent" };
  if (diffDays <= 7) return { label: `${diffDays} dana`, className: "bg-[#92400e] text-white border-transparent" };
  if (diffDays <= 30) return { label: `${diffDays} dana`, className: "bg-yellow-500 text-black border-transparent" };
  return { label: `${diffDays} dana`, className: "bg-gray-200 text-gray-800 border-transparent" };
}

export function getRemainingDays(deadline?: string | null) {
  if (!deadline || Number.isNaN(new Date(deadline).getTime())) {
    return { text: "Nepoznat rok", colorClass: "text-gray-400 font-medium", dateStr: "-", isUrgent: false };
  }
  const d = new Date(deadline);
  const dateStr = format(d, "dd.MM.");
  if (isPast(d)) {
    return { text: "Rok istekao", colorClass: "text-gray-400", dateStr, isUrgent: false };
  }
  const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return { text: "Danas ističe", colorClass: "text-red-600 font-bold", dateStr, isUrgent: true };
  }
  if (diffDays <= 3) {
    return { text: `Još ${diffDays} dana`, colorClass: "text-red-600 font-bold", dateStr, isUrgent: true };
  }
  if (diffDays <= 7) {
    return { text: `Još ${diffDays} dana`, colorClass: "text-amber-600 font-semibold", dateStr, isUrgent: false };
  }
  return { text: `Još ${diffDays} dana`, colorClass: "text-emerald-700 font-semibold", dateStr, isUrgent: false };
}

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "nedavno";
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "nedavno";
    return formatDistanceToNow(d, { addSuffix: true, locale: bs });
  } catch {
    return "nedavno";
  }
}

export function getStatusBadgeProps(status?: string | null) {
  switch (status) {
    case "open": return { label: "Otvoren", className: "bg-[#166534] text-white" };
    case "closed": return { label: "Zatvoren", className: "bg-gray-200 text-gray-800" };
    case "awarded": return { label: "Dodijeljen", className: "bg-[#002d82] text-white" };
    case "cancelled": return { label: "Poništen", className: "bg-[#991b1b] text-white" };
    default: return { label: status || "N/A", className: "bg-gray-100 text-gray-700" };
  }
}

export function translateTenderType(type?: string | null): string {
  if (!type) return "-";
  switch (type) {
    case "OpenProcedure":
    case "open":
      return "Otvoreni postupak";
    case "RestrictedProcedure":
    case "restricted":
      return "Ograničeni postupak";
    case "CompetitiveRequest":
    case "competitive":
      return "Konkurentski zahtjev";
    case "NegotiatedProcedure":
    case "negotiated":
      return "Pregovarački postupak";
    case "DirectAgreement":
    case "direct":
      return "Direktni sporazum";
    default:
      return type;
  }
}

export function translateEntity(entity?: string | null): string {
  if (!entity) return "-";
  switch (entity) {
    case "EJN":
      return "EJN Portal (Svi)";
    case "FBiH":
      return "Federacija BiH";
    case "RS":
      return "Republika Srpska";
    case "BD":
      return "Brčko Distrikt";
    default:
      return entity;
  }
}

export function translateSource(source?: string | null): string {
  if (!source) return "-";
  switch (source) {
    case "ejn_openapi":
      return "EJN OpenAPI";
    case "EJN-Usluge":
      return "EJN Usluge (Scraper)";
    case "EJN-Roba":
      return "EJN Roba (Scraper)";
    case "EJN-Radovi":
      return "EJN Radovi (Scraper)";
    case "EJN":
      return "EJN Portal";
    default:
      return source;
  }
}

