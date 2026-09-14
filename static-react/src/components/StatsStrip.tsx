import { useTranslation } from 'react-i18next'

export default function StatsStrip() {
  const { t } = useTranslation()

  const stats = [
    { value: '5', label: t('landing.stats.typesLabel') },
    { value: '3', label: t('landing.stats.langLabel') },
    { value: '100%', label: t('landing.stats.offlineLabel') },
  ]

  return (
    <section className="py-16 px-6 bg-[#0b0b0d]">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <p className="text-white/70 max-w-sm">{t('landing.stats.intro')}</p>
        <div className="grid grid-cols-3 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="font-serif text-4xl text-white">{s.value}</span>
              <span className="text-[11px] uppercase tracking-wide text-white/50">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
