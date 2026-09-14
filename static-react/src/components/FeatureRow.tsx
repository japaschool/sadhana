import { useTranslation } from 'react-i18next'
import { FaSeedling, FaWifi, FaUsers, FaChartBar } from 'react-icons/fa'
import { SectionLabel } from './SectionLabel'

type FeatureItem = {
  icon: React.ReactNode
  titleKey: string
  descKey: string
}

const features: FeatureItem[] = [
  {
    icon: <FaSeedling size={28} style={{ color: '#c8724a' }} />,
    titleKey: 'landing.features.items.custom.title',
    descKey: 'landing.features.items.custom.desc',
  },
  {
    icon: <FaWifi size={28} style={{ color: '#c8724a' }} />,
    titleKey: 'landing.features.items.offline.title',
    descKey: 'landing.features.items.offline.desc',
  },
  {
    icon: <FaUsers size={28} style={{ color: '#c8724a' }} />,
    titleKey: 'landing.features.items.yatras.title',
    descKey: 'landing.features.items.yatras.desc',
  },
  {
    icon: <FaChartBar size={28} style={{ color: '#c8724a' }} />,
    titleKey: 'landing.features.items.charts.title',
    descKey: 'landing.features.items.charts.desc',
  },
]

export function FeatureRow() {
  const { t } = useTranslation()

  return (
    <section id="features" className="bg-[#0b0b0d] py-24 px-6 md:px-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 mb-14">
          <SectionLabel>{t('landing.features.label')}</SectionLabel>
          <h2 className="font-serif text-3xl md:text-5xl text-white leading-tight">
            {t('landing.features.title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div key={feature.titleKey} className="flex flex-col gap-4">
              <div>{feature.icon}</div>
              <h3 className="font-semibold text-white text-lg leading-snug">
                {t(feature.titleKey)}
              </h3>
              <p className="text-white/60 text-sm leading-relaxed">
                {t(feature.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
