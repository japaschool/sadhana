import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function NoPractices({ onSeed, seeding }: { onSeed: () => void; seeding: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <p className="text-sm text-ui-muted">{t('home.noPractices')}</p>
      <button type="button" onClick={onSeed} disabled={seeding}
        className="h-11 rounded-full bg-ui-primary px-6 text-sm font-semibold text-ui-on-primary disabled:opacity-60">
        {t('home.addStarters')}
      </button>
      <Link to="/settings/practices/new" className="text-sm font-semibold text-ui-accent">{t('home.addCustom')}</Link>
      <Link to="/guide" state={{ back: '/' }} className="flex flex-col gap-0.5 text-sm">
        <span className="font-extrabold text-ui-accent">{t('home.helpChoose')}</span>
        <span className="text-ui-muted">{t('home.helpChooseSub')}</span>
      </Link>
    </div>
  )
}
