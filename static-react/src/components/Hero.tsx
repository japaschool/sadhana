import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Pill } from './Pill'
import heroBg from '../assets/1.jpg'

const APP_URL = 'https://app.sadhana.pro/'

export default function Hero() {
  const { t } = useTranslation()

  return (
    <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden">
      {/* Background with slow zoom */}
      <motion.div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 10, ease: 'easeOut' }}
        aria-hidden="true"
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 bg-linear-to-b from-black/70 via-black/40 to-black/85"
        aria-hidden="true"
      />

      {/* Content */}
      <motion.div
        className="relative z-10 text-center px-6 flex flex-col items-center gap-6 max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        {/* Badge */}
        <span className="inline-flex items-center rounded-full border border-white/20 text-white/80 text-xs px-3 py-1">
          {t('landing.hero.badge')}
        </span>

        {/* Headline */}
        <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl leading-[1.05] text-white">
          <span className="block">{t('landing.hero.title1')}</span>
          <span className="block">{t('landing.hero.title2')}</span>
        </h1>

        {/* Subtitle */}
        <p className="text-white/70 max-w-xl text-base md:text-lg leading-relaxed">
          {t('landing.hero.subtitle')}
        </p>

        {/* CTA */}
        <Pill href={APP_URL}>{t('landing.hero.cta')}</Pill>
      </motion.div>
    </section>
  )
}
