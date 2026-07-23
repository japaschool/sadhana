import { useTranslation } from 'react-i18next'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import PhoneCarousel from './components/PhoneCarousel'
import FeaturesGrid from './components/FeaturesGrid'
import PracticeCategories from './components/PracticeCategories'
import TrackBanner from './components/TrackBanner'
import Footer from './components/Footer'

import shotHome from './assets/shot-home.jpg'
import shotOffline from './assets/shot-offline.jpg'
import shotAddPractice from './assets/shot-add-practice.jpg'
import shotCharts from './assets/shot-charts.jpg'
import shotGroup from './assets/shot-group.jpg'
import shotFaq from './assets/shot-faq.jpg'

export default function App() {
  const { t } = useTranslation()

  const slides = [
    { src: shotHome,        caption: t('preview.slide1') },
    { src: shotOffline,     caption: t('preview.slide2') },
    { src: shotAddPractice, caption: t('preview.slide3') },
    { src: shotCharts,      caption: t('preview.slide4') },
    { src: shotGroup,       caption: t('preview.slide5') },
    { src: shotFaq,         caption: t('preview.slide6') },
  ]

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
      <FeaturesGrid />
      <PracticeCategories />
      <TrackBanner />
      <Footer />
    </div>
  )
}
