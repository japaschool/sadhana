import LandingView from './components/LandingView'
import ParallaxSection from './components/ParallaxSection'
import FloatingCTA from './components/FloatingCTA'
import Footer from './components/Footer'
import FloatingHeaderButtons from './components/FloatingHeaderButtons'
import mountain from './assets/2.jpg'
import forest from './assets/4.jpg'
import { FaSeedling, FaChartBar, FaWifi,  FaMobileAlt, FaShareAlt, FaUsers, FaFileCsv } from "react-icons/fa"
import { useTranslation } from 'react-i18next'



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
