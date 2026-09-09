import { useMemo, useCallback } from "react";
import type { TenderRawData, TenderAward } from "@/components/status-badge";

export interface TenderTableFilters {
  search: string;
  status: string;
  entity: string;
  category: string;
  source: string;
  minScore: number;
  minValue: string;
  maxValue: string;
  hasEAuction: string;
  tenderType: string;
}

export interface UseTenderFiltersReturn {
  hasActiveFilters: boolean;
  buildExportUrl: (baseUrl: string, token?: string) => string;
  getFilterCount: () => number;
}

export function useTenderFilters(filters: TenderTableFilters): UseTenderFiltersReturn {
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.status ||
      filters.entity ||
      filters.source ||
      filters.minScore > 0 ||
      filters.minValue ||
      filters.maxValue ||
      filters.hasEAuction !== "all" ||
      filters.tenderType
    );
  }, [filters]);

  const getFilterCount = useCallback(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status) count++;
    if (filters.entity) count++;
    if (filters.source) count++;
    if (filters.minScore > 0) count++;
    if (filters.minValue || filters.maxValue) count++;
    if (filters.hasEAuction !== "all") count++;
    if (filters.tenderType) count++;
    return count;
  }, [filters]);

  const buildExportUrl = useCallback(
    (baseUrl: string, token?: string): string => {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.entity) params.set("entity", filters.entity);
      if (filters.category) params.set("category", filters.category);
      if (filters.source) params.set("source", filters.source);
      if (filters.minScore > 0) params.set("minScore", filters.minScore.toString());
      if (filters.minValue) params.set("minValue", filters.minValue);
      if (filters.maxValue) params.set("maxValue", filters.maxValue);
      if (filters.hasEAuction !== "all") params.set("hasEAuction", filters.hasEAuction);
      if (filters.tenderType) params.set("tenderType", filters.tenderType);
      if (token) params.set("token", token);

      const url = `${baseUrl}?${params.toString()}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = "tenders-export.csv";
      return url;
    },
    [filters]
  );

  return {
    hasActiveFilters,
    buildExportUrl,
    getFilterCount,
  };
}

export function extendTenderWithRawData<T extends { status: string; statusName?: string | null }>(
  tender: T,
  rawData?: TenderRawData,
  awards?: TenderAward[]
): T & { rawData: TenderRawData; awards: TenderAward[] } {
  return {
    ...tender,
    rawData: rawData || {},
    awards: awards || [],
  } as T & { rawData: TenderRawData; awards: TenderAward[] };
}
