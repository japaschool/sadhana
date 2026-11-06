import { useTranslation } from 'react-i18next'
import { KindGlyph } from '../insights/ReportGlyph'
import { useReports } from '../insights/useReports'
import { hasReport } from './guideLogic'
import type { GuideKind } from './guideLogic'

const GLYPH = { sleep: 'sleep', count: 'japa', time: 'duration', days: 'days', gaps: 'gaps', goals: 'goals' } as const

/** A card's head, as in the mockup: tile, name, one line on what it shows. */
export function KindHead({ kind }: { kind: GuideKind }) {
  const { t } = useTranslation()
  const have = hasReport(kind, useReports().data ?? [])
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-ui-accent-soft text-ui-accent"><KindGlyph kind={GLYPH[kind]} className="scale-[1.15] text-ui-accent" /></span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base leading-tight font-extrabold">{t(`guide.kinds.${kind}.name`)}</span>
        <span className="text-xs leading-snug text-ui-muted text-pretty">{t(`guide.kinds.${kind}.desc`)}</span>
        {have && <span className="text-xs leading-snug font-bold text-ui-accent">{t('guide.haveReport')}</span>}
      </div>
    </div>
  )
}
