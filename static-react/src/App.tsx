import { useTranslation } from 'react-i18next'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import PhoneCarousel from './components/PhoneCarousel'
import FeaturesGrid from './components/FeaturesGrid'
import PracticeCategories from './components/PracticeCategories'
import TrackBanner from './components/TrackBanner'
import Footer from './components/Footer'
import DevicesSection from './components/DevicesSection'
import { shot, walkthrough } from './shots'
import { GuidePage, HelpIndex } from './components/HelpPages'
import { type Lang, type Page } from './pages'

export default function App({ page = 'home' }: { page?: Page }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language || 'en'

  if (page !== 'home') return (
    <div data-theme="sadhana" className="min-h-screen font-sans" style={{ background: '#EDE8E3' }}>
      <div className="fixed top-0 left-0 right-0 z-50"><Navbar page={page} /></div>
      {page === 'help' ? <HelpIndex lang={lang as Lang} /> : <GuidePage lang={lang as Lang} guide={page} />}
      <Footer />
    </div>
  )

  const slides = [
    { src: shot('today', lang), video: walkthrough(lang), caption: t('preview.walkthrough') },
    ...['today', 'overview', 'sleep', 'japa', 'table', 'year', 'group', 'practices']
      .map((name) => ({ src: shot(name, lang), caption: t(`preview.${name}`) })),
  ]

  return (
    <div data-theme="sadhana" className="font-sans">
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navbar page="home" />
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
