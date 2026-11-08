import { useTranslation } from 'react-i18next'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import PhoneCarousel from './components/PhoneCarousel'
import FeaturesGrid from './components/FeaturesGrid'
import PracticeCategories from './components/PracticeCategories'
import TrackBanner from './components/TrackBanner'
import Footer from './components/Footer'
import DevicesSection from './components/DevicesSection'
import { shot } from './shots'

export default function App() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language || 'en'

  const slides = ['today', 'overview', 'sleep', 'japa', 'table', 'year', 'group', 'practices']
    .map((name) => ({ src: shot(name, lang), caption: t(`preview.${name}`) }))

  return (
    <div data-theme="sadhana" className="font-sans">
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navbar />
      </div>
      <Hero />
      <PhoneCarousel
        id="preview"
        slides={slides}
        title={t('preview.carouselTitle')}
        description={t('preview.carouselDescription')}
        accent="#3A7D5C"
      />
      <DevicesSection />
      <FeaturesGrid />
      <PracticeCategories />
      <TrackBanner />
      <Footer />
    </div>
  )
}
