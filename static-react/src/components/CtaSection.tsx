import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Pill } from './Pill'

const APP_URL = '/'

export function CtaSection() {
  const { t } = useTranslation()

  return (
    <section className="relative py-28 text-center overflow-hidden bg-[#0b0b0d]">
      {/* Faint oversized wordmark watermark */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center font-serif text-[22vw] text-white/[0.04] select-none pointer-events-none leading-none"
        style={{ fontFamily: 'Playfair Display, serif' }}
      >
        Sadhana
      </span>

      {/* Foreground content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center gap-6 px-6 max-w-2xl mx-auto"
      >
        <h2 className="font-serif text-3xl md:text-5xl text-white leading-tight">
          {t('landing.cta.title')}
        </h2>
        <p className="text-white/60 text-lg">
          {t('landing.cta.subtitle')}
        </p>
        <Pill href={APP_URL} variant="solid">
          {t('landing.cta.button')}
        </Pill>
      </motion.div>
    </section>
  )
}
