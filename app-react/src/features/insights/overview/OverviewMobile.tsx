import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MarkedPeriod, MarkedPeriodForm } from '../../../api/markedPeriods'
import { rowName } from './format'
import { LessRegular } from './LessRegular'
import { MeVsNormal } from './MeVsNormal'
import { OpenPeriodCard } from './OpenPeriodCard'
import { OverviewLinks } from './OverviewLinks'
import { PeriodSheet } from './PeriodSheet'
import { SleepSetupSheet } from './SleepSetupSheet'
import { SuggestionCard } from './SuggestionCard'
import { useOverview } from './useOverview'
import { WelcomeBack } from './WelcomeBack'

interface SheetState { period?: MarkedPeriod; prefill?: Partial<MarkedPeriodForm>; focusEnd?: boolean }

/** The Overview segment on mobile: prompts, then Me vs my normal (regular) or days practised (less regular). */
export function OverviewMobile() {
  const { t } = useTranslation()
  const ov = useOverview()
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [sleepClosed, setSleepClosed] = useState(false)

  if (ov.isLoading) {
    return (
      <div className="flex h-[170px] items-center justify-center">
        <span role="status" aria-label={t('common.loading')} className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
      </div>
    )
  }
  if (ov.isError) return <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('insights.loadFailed')}</p>

  const name = (key: string) => {
    const row = ov.rows.find((r) => r.key === key)
    return row ? rowName(row, ov.practices, t) : ''
  }
  const { suggestion, openPeriod } = ov
  const markAsked = (id: string) => ov.setPrefs({ openAsked: { ...ov.prefs.openAsked, [id]: ov.todayCob } })

  return (
    <>
      {suggestion && (
        <SuggestionCard suggestion={suggestion} names={suggestion.rows.map(name)}
          onMark={() => setSheet({ prefill: { start_date: suggestion.start, end_date: null } })}
          onNotNow={() => ov.setPrefs({ dismissed: [...ov.prefs.dismissed, suggestion.start] })} />
      )}
      {openPeriod && (
        <OpenPeriodCard period={openPeriod} todayCob={ov.todayCob}
          onYes={() => markAsked(openPeriod.id)}
          onEnded={() => setSheet({ period: openPeriod, focusEnd: true })} />
      )}
      <WelcomeBack logged={ov.logged} todayCob={ov.todayCob} />
      {ov.regular ? (
        <>
          <MeVsNormal normal={ov.normal} practices={ov.practices} variant="stacked" />
          <OverviewLinks />
        </>
      ) : (
        <LessRegular logged={ov.logged} todayCob={ov.todayCob} streaks={ov.prefs.streaks} rows={ov.rows} series={ov.series} practices={ov.practices} periods={ov.periods} />
      )}
      {sheet && (
        <PeriodSheet {...sheet} onClose={() => setSheet(null)}
          // Saved from "It ended on…" with End still empty: as good as Yes, so it doesn't ask again at once.
          onSaved={(form) => { if (sheet.focusEnd && sheet.period && form.end_date === null) markAsked(sheet.period.id) }} />
      )}
      {ov.askSleep && !sleepClosed && !sheet && (
        <SleepSetupSheet practices={ov.timePractices} onClose={() => setSleepClosed(true)}
          onSave={(sleep) => ov.setPrefs({ sleep })} onSkip={() => ov.setPrefs({ sleep: 'skip' })} />
      )}
    </>
  )
}
