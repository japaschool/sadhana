import { useTranslation } from 'react-i18next'
import { SplitSection } from './SplitSection'
import shotAddPractice from '../assets/shot-add-practice.jpg'
import shotCharts from '../assets/shot-charts.jpg'
import shotGroup from '../assets/shot-group.jpg'

const APP_URL = '/'

const mockup = (src: string) => (
  <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/40">
    <img src={src} alt="" className="w-full h-auto block" />
  </div>
)

const photoWithPill = (src: string, pillText: string) => (
  <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
    <img src={src} alt="" className="w-full h-auto block" />
    <span className="absolute top-4 left-4 inline-flex items-center justify-center rounded-full px-4 h-8 text-xs font-medium bg-white/15 text-white border border-white/25 backdrop-blur-sm">
      {pillText}
    </span>
  </div>
)

export function FeatureSplits() {
  const { t } = useTranslation()

  const splitASteps = [
    t('landing.splitA.step1'),
    t('landing.splitA.step2'),
    t('landing.splitA.step3'),
    t('landing.splitA.step4'),
  ]

  const splitBSteps = [
    t('landing.splitB.step1'),
    t('landing.splitB.step2'),
    t('landing.splitB.step3'),
    t('landing.splitB.step4'),
  ]

  return (
    <>
      <SplitSection
        id="practices"
        label={t('landing.splitA.label')}
        title={t('landing.splitA.title')}
        description={t('landing.splitA.description')}
        ctaLabel={t('landing.splitA.cta')}
        ctaHref={APP_URL}
        steps={splitASteps}
        media={mockup(shotAddPractice)}
        reverse={false}
      />
      <SplitSection
        id="charts"
        label={t('landing.splitB.label')}
        title={t('landing.splitB.title')}
        description={t('landing.splitB.description')}
        ctaLabel={t('landing.splitB.cta')}
        ctaHref={APP_URL}
        steps={splitBSteps}
        media={mockup(shotCharts)}
        reverse={true}
      />
      <SplitSection
        id="yatras"
        label={t('landing.splitC.label')}
        title={t('landing.splitC.title')}
        description={t('landing.splitC.description')}
        ctaLabel={t('landing.splitC.cta')}
        ctaHref={APP_URL}
        steps={[]}
        media={photoWithPill(shotGroup, 'Yatra')}
        reverse={false}
      />
    </>
  )
}
