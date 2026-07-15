import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function Hero() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-base-100 pt-16">
      {/* Mandala watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <svg
          viewBox="0 0 200 200"
          className="w-[700px] h-[700px] text-primary opacity-[0.04]"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="24" fill="none" stroke="currentColor" strokeWidth="0.5" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => (
            <ellipse
              key={angle}
              cx="100"
              cy="60"
              rx="7"
              ry="22"
              opacity="0.7"
              transform={`rotate(${angle} 100 100)`}
            />
          ))}
          {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
            <ellipse
              key={`inner-${angle}`}
              cx="100"
              cy="76"
              rx="5"
              ry="14"
              opacity="0.5"
              transform={`rotate(${angle} 100 100)`}
            />
          ))}
        </svg>
      </div>

      <motion.div
        className="relative z-10 text-center px-6 md:px-12 flex flex-col items-center gap-6 max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <h1
          className="text-5xl md:text-7xl font-bold text-base-content leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {t('landing.title')}
        </h1>
        <p className="text-xl md:text-2xl text-base-content/60 font-light">
          {t('landing.subtitle')}
        </p>
        <p className="text-base md:text-lg text-base-content/50 leading-relaxed max-w-2xl">
          {t('landing.description')}
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-lg rounded-full px-12 mt-2 shadow-lg"
        >
          {t('cta.openNow')}
        </a>
      </motion.div>
    </section>
  )
}
