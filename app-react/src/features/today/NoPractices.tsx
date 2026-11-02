import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TypeIcon } from '../yatras/settings/mobile/TypeChip'
import type { PracticeDataType } from '../../types/api'

const TYPES: PracticeDataType[] = ['Int', 'Time', 'Duration', 'Bool', 'Text']

export function NoPractices({ onSeed, seeding }: { onSeed: () => void; seeding: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] border border-ui-hairline bg-ui-surface px-[18px] pt-[22px] pb-3.5">
      <div aria-hidden className="flex justify-center gap-1.5">
        {TYPES.map((ty) => <span key={ty} className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ui-chip text-ui-ink2"><TypeIcon type={ty} /></span>)}
      </div>
      <div className="flex flex-col gap-1.5 text-center">
        <h2 className="text-xl font-extrabold text-ui-ink">{t('home.noPractices')}</h2>
        <p className="text-sm leading-normal text-ui-ink2">{t('home.emptyText')}</p>
      </div>
      <button type="button" onClick={onSeed} disabled={seeding}
        className="min-h-12 rounded-full bg-ui-primary px-6 text-sm font-semibold text-ui-on-primary disabled:opacity-60">
        {t('home.addStarters')}
      </button>
      <Link to="/settings/practices/new" className="flex min-h-12 items-center justify-center rounded-full border border-ui-control text-sm font-semibold text-ui-ink">{t('home.addCustom')}</Link>
      <Link to="/guide" state={{ back: '/' }} className="flex min-h-14 flex-col justify-center gap-0.5 border-t border-ui-hairline pt-1.5 text-sm">
        <span className="font-extrabold text-ui-accent">{t('home.helpChoose')}</span>
        <span className="text-ui-muted">{t('home.helpChooseSub')}</span>
      </Link>
    </div>
  )
}
