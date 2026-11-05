import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDay } from '../insightsLogic'
import { listText } from './format'
import type { Suggestion } from './suggest'

export const PROMPT_BTN = 'flex min-h-11 items-center justify-center rounded-[14px] px-[18px] text-center text-[15px] font-extrabold text-ui-ink'

/** A soft amber card: a question, a line under it, and two buttons. */
export function PromptCard({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-[20px] bg-ui-accent-soft p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-base leading-[1.35] font-extrabold text-ui-ink">{title}</h2>
        <p className="text-[13px] leading-[1.45] text-ui-ink2">{text}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

/** "Something changed around…" with Mark this period and Not now. */
export function SuggestionCard({ suggestion, names, onMark, onNotNow }: {
  suggestion: Suggestion; names: string[]; onMark: () => void; onNotNow: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  return (
    <PromptCard title={t('insights.overview.changedAround', { date: formatDay(suggestion.start, locale) })}
      text={t('insights.overview.rowsMoved', { rows: listText(names, locale) })}>
      <button type="button" onClick={onMark} className={`${PROMPT_BTN} bg-ui-accent-fill`}>{t('insights.overview.markPeriod')}</button>
      <button type="button" onClick={onNotNow} className={`${PROMPT_BTN} bg-ui-surface`}>{t('insights.overview.notNow')}</button>
    </PromptCard>
  )
}
