import { motion } from 'framer-motion'
import { FaSeedling, FaChartBar, FaWifi, FaMobileAlt, FaShareAlt, FaUsers, FaFileCsv } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const iconBg: Record<string, string> = {
  'text-primary': 'bg-primary/10',
  'text-secondary': 'bg-secondary/10',
}

export default function FeaturesGrid() {
  const { t } = useTranslation()

  const features = [
    { icon: <FaSeedling />, title: t('keyFeatures.customisableTitle'), desc: t('keyFeatures.customisableDescription'), color: 'text-primary' },
    { icon: <FaChartBar />, title: t('keyFeatures.reportsTitle'), desc: t('keyFeatures.reportsDescription'), color: 'text-secondary' },
    { icon: <FaWifi />, title: t('keyFeatures.offlineTitle'), desc: t('keyFeatures.offlineDescription'), color: 'text-primary' },
    { icon: <FaMobileAlt />, title: t('keyFeatures.installTitle'), desc: t('keyFeatures.installDescription'), color: 'text-secondary' },
    { icon: <FaShareAlt />, title: t('keyFeatures.shareTitle'), desc: t('keyFeatures.shareDescription'), color: 'text-primary' },
    { icon: <FaUsers />, title: t('keyFeatures.groupTitle'), desc: t('keyFeatures.groupDescription'), color: 'text-secondary' },
    { icon: <FaFileCsv />, title: t('keyFeatures.dataTitle'), desc: t('keyFeatures.dataDescription'), color: 'text-primary' },
  ]

  return (
    <section className="bg-base-200 py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="text-4xl md:text-5xl font-bold text-center text-base-content mb-14"
          style={{ fontFamily: "'Playfair Display', serif" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          {t('keyFeatures.title')}
        </motion.h2>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="card bg-base-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-base-200"
              variants={cardVariants}
              whileHover={{ scale: 1.01 }}
            >
              <div className="card-body gap-4 p-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${f.color} ${iconBg[f.color]}`}>
                  {f.icon}
                </div>
                <h3 className="card-title text-base-content text-lg leading-snug">{f.title}</h3>
                <p className="text-base-content/55 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
