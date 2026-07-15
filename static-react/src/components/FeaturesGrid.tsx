import { motion } from 'framer-motion'
import { FaSeedling, FaChartBar, FaWifi, FaMobileAlt, FaShareAlt, FaUsers, FaFileCsv } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

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
    <section className="bg-base-100 py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary mb-4 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            Everything you need
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mt-3"
            style={{
              fontFamily: "'Playfair Display', serif",
              background: 'linear-gradient(135deg, var(--color-base-content) 0%, var(--color-primary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('keyFeatures.title')}
          </h2>
        </motion.div>

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
              className={`card bg-base-100 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 border ${f.border} hover:${f.glow}`}
              style={{ boxShadow: '0 2px 12px oklch(0% 0 0 / 0.04)' }}
              variants={cardVariants}
              whileHover={{ scale: 1.01 }}
            >
              <div className="card-body gap-4 p-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${f.color} ${f.bg}`}>
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
