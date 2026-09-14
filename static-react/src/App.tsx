import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import { SocialStrip } from './components/SocialStrip'
import StatsStrip from './components/StatsStrip'
import { FeatureRow } from './components/FeatureRow'
import { FeatureSplits } from './components/FeatureSplits'
import { TestimonialSpotlight } from './components/TestimonialSpotlight'
import { CtaSection } from './components/CtaSection'
import Footer from './components/Footer'

export default function App() {
  const { t, i18n } = useTranslation()

  useEffect(() => {
    document.title = t('meta.title')
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'))
    document.querySelector('meta[name="keywords"]')?.setAttribute('content', t('meta.keywords'))
  }, [t, i18n.resolvedLanguage])

  return (
    <div className="relative font-sans bg-[#0b0b0d] text-[#f5f4f2] overflow-x-hidden">
      <Navbar />
      <Hero />
      <SocialStrip />
      <StatsStrip />
      <FeatureRow />
      <FeatureSplits />
      <TestimonialSpotlight />
      <CtaSection />
      <Footer />
    </div>
  )
}
