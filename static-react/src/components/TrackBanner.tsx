import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function TrackBanner() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <section style={{ background: '#EDE8E3' }} className="py-16 md:py-24 lg:py-28 px-6">
      <motion.div
        className="max-w-2xl mx-auto text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <h2
          className="text-2xl md:text-3xl font-medium mb-5 leading-tight"
          style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1E' }}
        >
          {t('trackAnything')}
        </h2>
        <p className="text-base md:text-lg leading-relaxed mb-9" style={{ color: 'rgba(28,28,28,0.52)' }}>
          {t('trackAnythingText')}
        </p>
        <motion.a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-lg w-full sm:w-auto px-12 font-semibold"
          style={{ background: 'rgba(28,28,28,0.12)', color: 'rgba(28,28,28,0.70)', border: '1px solid rgba(28,28,28,0.15)' }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          {t('cta.openNow')}
        </motion.a>
        <p className="mt-4 text-xs" style={{ color: 'rgba(28,28,28,0.30)' }}>
          {t('landing.freeForever')}
        </p>
      </motion.div>
    </section>
  )
}
