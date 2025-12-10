import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const FloatingCTA = () => {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50">
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={
          `bg-white/25 backdrop-blur-lg border border-white/20
          text-white font-semibold text-lg md:text-xl
          px-6 md:px-8 py-3 md:py-4
          rounded-full shadow-xl hover:bg-white/40
          transition-all duration-300 flex items-center justify-center`
        }
      >
        {t('cta.openNow')}
      </motion.a>
    </div>
  )
}

export default FloatingCTA
