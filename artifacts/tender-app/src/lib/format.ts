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
  if (!dateString) return "N/A";
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
  if (!deadline) return { label: "N/A", className: "bg-gray-100 text-gray-700" };
  const d = new Date(deadline);
  if (isPast(d)) return { label: "Zatvoren", className: "bg-gray-200 text-gray-800 border-transparent" };
  
  const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) return { label: "HITNO!", className: "bg-[#991b1b] text-white border-transparent" };
  if (diffDays <= 7) return { label: `${diffDays} dana`, className: "bg-[#92400e] text-white border-transparent" };
  if (diffDays <= 30) return { label: `${diffDays} dana`, className: "bg-yellow-500 text-black border-transparent" };
  return { label: `${diffDays} dana`, className: "bg-gray-200 text-gray-800 border-transparent" };
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
