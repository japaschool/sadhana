import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
}

export default function Hero() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-base-100 pt-16">
      {/* Amber glow blob */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
      </div>

      {/* Slowly rotating mandala */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, ease: 'linear', repeat: Infinity }}
      >
        <svg
          viewBox="0 0 200 200"
          className="w-[720px] h-[720px] text-primary opacity-[0.06]"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="24" fill="none" stroke="currentColor" strokeWidth="0.5" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => (
            <ellipse key={angle} cx="100" cy="60" rx="7" ry="22" opacity="0.7" transform={`rotate(${angle} 100 100)`} />
          ))}
          {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
            <ellipse key={`inner-${angle}`} cx="100" cy="76" rx="5" ry="14" opacity="0.5" transform={`rotate(${angle} 100 100)`} />
          ))}
        </svg>
      </motion.div>

      <motion.div
        className="relative z-10 text-center px-6 md:px-12 flex flex-col items-center gap-6 max-w-3xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Badge */}
        <motion.div variants={itemVariants}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium tracking-wide border border-primary/20">
            ✦ Spiritual Practice Tracker
          </span>
        </motion.div>

        <motion.h1
          className="text-5xl md:text-7xl font-bold text-base-content leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
          variants={itemVariants}
        >
          {t('landing.title')}
        </motion.h1>

        <motion.p className="text-xl md:text-2xl text-base-content/60 font-light" variants={itemVariants}>
          {t('landing.subtitle')}
        </motion.p>

        <motion.p className="text-base md:text-lg text-base-content/50 leading-relaxed max-w-2xl" variants={itemVariants}>
          {t('landing.description')}
        </motion.p>

        <motion.a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-lg rounded-full px-12 mt-2 shadow-lg shadow-primary/30"
          variants={itemVariants}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          {t('cta.openNow')}
        </motion.a>
      </motion.div>
    </section>
  )
}
