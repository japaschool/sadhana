import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../api/charts'
import type { PanelsReport, Report } from '../../api/charts'

/**
 * Older builds read ['reports'] (tracesFor throws on a Panels row) and ['reports', 'panels'] (a Gaps panel is drawn as a
 * chart and throws) from the shared IndexedDB cache, so the list asked for at panels level 4 (Goals panels, which level 3 builds can't draw) has its own key.
 */
export const REPORTS_KEY = ['reports', 'panels', 4] as const

export function sortReports(list: Report[], locale: string): Report[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' })
  return [...list].sort((a, b) => collator.compare(a.name, b.name))
}

/** A `select` that sorts by name in the current language; sorting here also covers setQueryData appends. */
export function useReportSort() {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'en'
  return useCallback((list: Report[]) => sortReports(list, locale), [locale])
}

export function useReports(): UseQueryResult<Report[]> {
  return useQuery({ queryKey: REPORTS_KEY, queryFn: chartsApi.getReports, select: useReportSort() })
}

/** Names are unique per user (exact match), so a taken one would come back as a 422. `exceptId`: the report being renamed. */
export const nameTaken = (reports: Report[], name: string, exceptId?: string) =>
  reports.some((r) => r.id !== exceptId && r.name === name.trim())

export const isPanels = (r: Report | null): r is Report & { definition: { Panels: PanelsReport } } =>
  !!r && 'Panels' in r.definition
