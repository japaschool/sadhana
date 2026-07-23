import { motion } from 'framer-motion'
import { FaSeedling, FaChartBar, FaWifi, FaMobileAlt, FaShareAlt, FaUsers, FaFileCsv } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

export default function FeaturesGrid() {
  const { t } = useTranslation()

  const features = [
    { icon: <FaSeedling />, title: t('keyFeatures.customisableTitle'), desc: t('keyFeatures.customisableDescription'), color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', glow: 'shadow-emerald-100' },
    { icon: <FaChartBar />, title: t('keyFeatures.reportsTitle'), desc: t('keyFeatures.reportsDescription'), color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100', glow: 'shadow-blue-100' },
    { icon: <FaWifi />, title: t('keyFeatures.offlineTitle'), desc: t('keyFeatures.offlineDescription'), color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', glow: 'shadow-amber-100' },
    { icon: <FaMobileAlt />, title: t('keyFeatures.installTitle'), desc: t('keyFeatures.installDescription'), color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-100', glow: 'shadow-pink-100' },
    { icon: <FaShareAlt />, title: t('keyFeatures.shareTitle'), desc: t('keyFeatures.shareDescription'), color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-violet-100', glow: 'shadow-violet-100' },
    { icon: <FaUsers />, title: t('keyFeatures.groupTitle'), desc: t('keyFeatures.groupDescription'), color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100', glow: 'shadow-indigo-100' },
    { icon: <FaFileCsv />, title: t('keyFeatures.dataTitle'), desc: t('keyFeatures.dataDescription'), color: 'text-teal-500', bg: 'bg-teal-50', border: 'border-teal-100', glow: 'shadow-teal-100' },
  ]

  return (
    <section style={{ background: '#E8E3DE' }} className="py-14 md:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2
            className="text-xl md:text-2xl font-medium"
            style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1E' }}
          >
            {t('keyFeatures.title')}
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              className={`flex items-start gap-4 ${i === features.length - 1 && features.length % 2 !== 0 ? 'md:col-span-2 md:max-w-sm md:mx-auto' : ''}`}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5 ${f.color} ${f.bg}`}>
                {f.icon}
              </div>
              <div>
                <p className="font-semibold text-sm mb-1" style={{ color: '#1C1C1E' }}>{f.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(28,28,28,0.55)' }}>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
