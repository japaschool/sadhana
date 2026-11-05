import { useTranslation } from 'react-i18next'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { formatDay } from '../insightsLogic'
import { PROMPT_BTN, PromptCard } from './SuggestionCard'
import { daysBetween } from './usual'

/** "Is {name} still going?", every 30 days of an ongoing period. */
export function OpenPeriodCard({ period, todayCob, onYes, onEnded }: {
  period: MarkedPeriod; todayCob: string; onYes: () => void; onEnded: () => void
}) {
  const { t, i18n } = useTranslation()
  return (
    <PromptCard title={t('insights.overview.stillGoing', { name: period.name })}
      text={t('insights.overview.startedAgo', { date: formatDay(period.start_date, i18n.language || 'en'), count: daysBetween(period.start_date, todayCob) })}>
      <button type="button" onClick={onYes} className={`${PROMPT_BTN} bg-ui-accent-fill`}>{t('insights.overview.yes')}</button>
      <button type="button" onClick={onEnded} className={`${PROMPT_BTN} bg-ui-surface`}>{t('insights.overview.endedOn')}</button>
    </PromptCard>
  )
}
