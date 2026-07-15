import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function TrackBanner() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <section className="relative overflow-hidden py-28 px-6" style={{ background: 'linear-gradient(135deg, oklch(67.15% 0.131 55.73) 0%, oklch(62.11% 0.101 55.16) 100%)' }}>
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <motion.div
        className="relative z-10 max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <h2
          className="text-4xl md:text-5xl font-bold text-primary-content mb-6 leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {t('trackAnything')}
        </h2>
        <p className="text-primary-content/80 text-lg leading-relaxed mb-10">
          {t('trackAnythingText')}
        </p>
        <motion.a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-lg rounded-full px-12 text-primary-content border-primary-content hover:bg-primary-content hover:text-primary"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          {t('cta.openNow')}
        </motion.a>
      </motion.div>
    </section>
  )
}
