import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardPanel } from './DashboardPanel'
import { DeferUntilVisible } from '../../components/util/DeferUntilVisible'
import { Spinner } from '../../components/ui/Spinner'

const YatrasPage = lazy(() =>
  import('../yatras/YatrasPage').then((m) => ({ default: m.YatrasPage })),
)

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <p className="text-xs font-semibold uppercase tracking-widest flex-shrink-0"
         style={{ color: '#fbbf24' }}>
        {label}
      </p>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.20)' }} />
    </div>
  )
}

export function DateContextLabel({ dateStr }: { dateStr: string }) {
  const todayStr = toDateStr(new Date())
  const yesterday = toDateStr(new Date(Date.now() - 86_400_000))
  const tomorrow  = toDateStr(new Date(Date.now() + 86_400_000))
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'

  let label: string
  if (dateStr === todayStr)        label = t('home.today')
  else if (dateStr === yesterday)  label = t('home.yesterday')
  else if (dateStr === tomorrow)   label = t('home.tomorrow')
  else {
    const d = new Date(dateStr + 'T00:00:00')
    label = d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <p className="text-[11px] font-semibold font-serif uppercase tracking-widest px-1"
       style={{ color: '#fbbf24' }}>
      {label}
    </p>
  )
}

export function HomePage() {
  return (
    <>
      <DashboardPanel />
      <section
        id="home-yatras"
        className="hidden lg:block px-4 pb-16 pt-10 lg:pt-16 lg:px-6 max-w-lg lg:max-w-[1400px] mx-auto w-full min-h-screen"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <DeferUntilVisible>
          <Suspense fallback={<Spinner />}>
            <YatrasPage embedded />
          </Suspense>
        </DeferUntilVisible>
      </section>
    </>
  )
}
