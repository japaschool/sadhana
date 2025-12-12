import { motion } from 'framer-motion'
import heroBg from '../assets/1.jpg'
import { useTranslation } from 'react-i18next'

export default function LandingView() {
  const { t } = useTranslation()

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <motion.div
        style={{ backgroundImage: `url(${heroBg})` }}
        className="absolute inset-0 bg-cover bg-center"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 6, ease: 'easeOut' }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-linear-to-b from-black/80 via-black/40 to-black/80 z-0"></div>

      {/* Foreground Content */}
      <motion.div
        className="relative z-10 text-center text-white px-6 md:px-12 flex flex-col items-center gap-6 md:gap-8 max-w-4xl mx-auto"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif mb-0 leading-tight">
          {t('hero.title')}
        </h1>
        <p className="text-lg md:text-2xl font-light">
          {t('hero.subtitle')}
        </p>

        <p className="text-lg md:text-xl font-light leading-relaxed">
          {t('hero.description')}
        </p>
      </motion.div>

    </section >
  )
}
