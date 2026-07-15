import Hero from './components/Hero'
import ParallaxSection from './components/ParallaxSection'
import FloatingCTA from './components/FloatingCTA'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import forest from './assets/4.jpg'
import showcaseBg from './assets/2-2.jpg'
import shot1 from './assets/shot-1.jpg'
import shot2 from './assets/shot-2.jpg'
import shot3 from './assets/shot-3.jpg'
import shot4 from './assets/shot-4.jpg'
import shot5 from './assets/shot-5.jpg'
import shot6 from './assets/shot-6.jpg'
import shot7 from './assets/shot-7.jpg'
import shot8 from './assets/shot-8.jpg'
import { useTranslation } from 'react-i18next'
import ParallaxCarouselSection from './components/ParallaxCarouselSection'
import FeaturesGrid from './components/FeaturesGrid'

export default function App() {
  const { t } = useTranslation()
  return (
    <div data-theme="spiritual" className="relative font-sans">
      <Navbar />
      <Hero />
      <FeaturesGrid />
      <ParallaxCarouselSection
        image={showcaseBg}
        title={t('preview.title')}
        slides={[
          { image: shot1, text: t('preview.slide1') },
          { image: shot2, text: t('preview.slide2') },
          { image: shot3, text: t('preview.slide3') },
          { image: shot4, text: t('preview.slide4') },
          { image: shot5, text: t('preview.slide5') },
          { image: shot6, text: t('preview.slide6') },
          { image: shot7, text: t('preview.slide7') },
          { image: shot8, text: t('preview.slide8') },
        ]}
      />
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