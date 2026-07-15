import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function TrackBanner() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <section className="bg-primary py-28 px-6">
      <motion.div
        className="max-w-3xl mx-auto text-center"
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
        <p className="text-primary-content/75 text-lg leading-relaxed mb-10">
          {t('trackAnythingText')}
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-lg rounded-full px-12 text-primary-content border-primary-content hover:bg-primary-content hover:text-primary"
        >
          {t('cta.openNow')}
        </a>
      </motion.div>
    </section>
  )
}
