import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../api/charts'
import type { PanelsReport, Report } from '../../api/charts'

/** Not ['reports']: an older build reads that key from the shared IndexedDB cache, and its tracesFor throws on a Panels row. */
export const REPORTS_KEY = ['reports', 'panels'] as const

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

export const isPanels = (r: Report | null): r is Report & { definition: { Panels: PanelsReport } } =>
  !!r && 'Panels' in r.definition
