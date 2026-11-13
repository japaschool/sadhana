import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const CHEVRON = 'mr-[5px] h-[7px] w-[7px] shrink-0 rotate-45 border-t-2 border-r-2 border-ui-faint2'

/** Links to the Year map, Rhythm fingerprint and (with enough history) Usual over time screens. */
export function OverviewLinks({ usual }: { usual: boolean }) {
  const { t } = useTranslation()
  const links = [
    { to: '/insights/year', title: t('insights.overview.yearMap'), text: t('insights.overview.yearMapText') },
    { to: '/insights/rhythm', title: t('insights.overview.rhythm'), text: t('insights.overview.rhythmText') },
    ...(usual ? [{ to: '/insights/usual', title: t('insights.overview.usualOverTime'), text: t('insights.overview.usualOverTimeText') }] : []),
  ]
  return (
    <nav aria-label={t('insights.overview.more')} className="grid grid-cols-2 gap-3">
      {links.map((l) => (
        <Link key={l.to} to={l.to} className="flex min-w-0 items-end justify-between gap-2 rounded-[18px] border border-ui-hairline bg-ui-surface p-3.5">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] leading-[1.3] font-extrabold text-ui-ink">{l.title}</span>
            <span className="text-xs leading-[1.4] text-ui-muted">{l.text}</span>
          </span>
          <span aria-hidden className={CHEVRON} />
        </Link>
      ))}
    </nav>
  )
}
