import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MarkedPeriod, MarkedPeriodForm } from '../../../api/markedPeriods'
import { rowName } from './format'
import type { useOverview } from './useOverview'

export interface SheetState { period?: MarkedPeriod; prefill?: Partial<MarkedPeriodForm>; focusEnd?: boolean }

type Ov = ReturnType<typeof useOverview>

/** Sheet state and card handlers shared by every layout's Overview, and by Settings → Marked periods. */
export function useOverviewActions(ov: Pick<Ov, 'suggestion' | 'openPeriod' | 'rows' | 'practices' | 'prefs' | 'setPrefs' | 'todayCob'>) {
  const { t } = useTranslation()
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [sleepClosed, setSleepClosed] = useState(false)
  const { suggestion, openPeriod } = ov
  const name = (key: string) => {
    const row = ov.rows.find((r) => r.key === key)
    return row ? rowName(row, ov.practices, t) : ''
  }
  const markAsked = (id: string) => ov.setPrefs({ openAsked: { ...ov.prefs.openAsked, [id]: ov.todayCob } })
  // Saved from "It ended on…" with End still empty: as good as Yes, so it doesn't ask again at once.
  const onSheetSaved = (form: MarkedPeriodForm) => { if (sheet?.focusEnd && sheet.period && form.end_date === null) markAsked(sheet.period.id) }
  return {
    sheet, setSheet, sleepClosed, setSleepClosed, name, markAsked, onSheetSaved,
    suggestionProps: suggestion && {
      suggestion, names: suggestion.rows.map(name),
      onMark: () => setSheet({ prefill: { start_date: suggestion.start, end_date: null } }),
      onNotNow: () => ov.setPrefs({ dismissed: [...ov.prefs.dismissed, suggestion.start] }),
    },
    openPeriodProps: openPeriod && {
      period: openPeriod, todayCob: ov.todayCob,
      onYes: () => markAsked(openPeriod.id),
      onEnded: () => setSheet({ period: openPeriod, focusEnd: true }),
    },
  }
}
