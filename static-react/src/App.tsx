import Hero from './components/Hero'
import ParallaxSection from './components/ParallaxSection'
import FloatingCTA from './components/FloatingCTA'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import forest from './assets/4.jpg'
import { useTranslation } from 'react-i18next'
import ScreenshotsCarousel from './components/ScreenshotsCarousel'
import FeaturesGrid from './components/FeaturesGrid'

export default function App() {
  const { t } = useTranslation()
  return (
    <div data-theme="spiritual" className="relative font-sans">
      <Navbar />
      <Hero />
      <FeaturesGrid />
      <ScreenshotsCarousel />
      <ParallaxSection
        image={forest}
        title={t('trackAnything')}
        text={t('trackAnythingText')}
      />
      <FloatingCTA />
      <Footer />
    </div>
  )
}