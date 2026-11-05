import { useTranslation } from 'react-i18next'
import { PeriodSheet } from './PeriodSheet'
import { SleepSetupSheet } from './SleepSetupSheet'
import type { useOverview } from './useOverview'
import type { useOverviewActions } from './useOverviewActions'

type Ov = ReturnType<typeof useOverview>

/** The loading spinner or load error, or null once there is data. */
export function OverviewStatus({ ov }: { ov: Ov }) {
  const { t } = useTranslation()
  if (ov.isLoading) {
    return (
      <div className="flex h-[170px] items-center justify-center">
        <span role="status" aria-label={t('common.loading')} className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
      </div>
    )
  }
  if (ov.isError) return <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('insights.loadFailed')}</p>
  return null
}

/** The period and sleep-setup sheets that Overview cards open. */
export function OverviewSheets({ ov, actions }: { ov: Ov; actions: ReturnType<typeof useOverviewActions> }) {
  const { sheet, setSheet, sleepClosed, setSleepClosed, markAsked } = actions
  return (
    <>
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
