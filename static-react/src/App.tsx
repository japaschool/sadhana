import LandingView from './components/LandingView'
import ParallaxSection from './components/ParallaxSection'
import FloatingCTA from './components/FloatingCTA'
import Footer from './components/Footer'
import FloatingHeaderButtons from './components/FloatingHeaderButtons'
import mountain from './assets/2.jpg'
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
import { FaSeedling, FaChartBar, FaWifi,  FaMobileAlt, FaShareAlt, FaUsers, FaFileCsv } from "react-icons/fa"
import { useTranslation } from 'react-i18next'
import ParallaxCarouselSection from './components/ParallaxCarouselSection'

export default function App() {
  const { t } = useTranslation()
  return (
    <div className="relative font-sans bg-neutral-100 text-gray-900">
      <FloatingHeaderButtons />
      <LandingView />
      <ParallaxSection
        image={mountain}
        title={t('keyFeatures.title')}
        text={
          <ul className="w-full max-w-4xl mx-auto mt-8 space-y-4 text-left">
            {[
              { icon: <FaSeedling />, title: t('keyFeatures.customisableTitle'), desc: t('keyFeatures.customisableDescription'), color: 'text-green-500' },
              { icon: <FaChartBar />, title: t('keyFeatures.reportsTitle'), desc: t('keyFeatures.reportsDescription'), color: 'text-blue-500' },
              { icon: <FaWifi />, title: t('keyFeatures.offlineTitle'), desc: t('keyFeatures.offlineDescription'), color: 'text-yellow-500' },
              { icon: <FaMobileAlt />, title: t('keyFeatures.installTitle'), desc: t('keyFeatures.installDescription'), color: 'text-pink-500' },
              { icon: <FaShareAlt />, title: t('keyFeatures.shareTitle'), desc: t('keyFeatures.shareDescription'), color: 'text-purple-500' },
              { icon: <FaUsers />, title: t('keyFeatures.groupTitle'), desc: t('keyFeatures.groupDescription'), color: 'text-indigo-500' },
              { icon: <FaFileCsv />, title: t('keyFeatures.dataTitle'), desc: t('keyFeatures.dataDescription'), color: 'text-teal-500' },
            ].map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div className={`mt-1 ${feature.color} w-6 h-6 md:w-7 md:h-7 shrink-0`}>
                  {feature.icon}
                </div>
                <div>
                  <p className="text-base md:text-xl font-semibold">{feature.title}</p>
                  <p className="text-sm md:text-lg font-light leading-relaxed">{feature.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        }
      />
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