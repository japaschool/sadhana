import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function TrackBanner() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <section
      className="relative overflow-hidden py-32 px-6"
      style={{ background: '#0B0D14' }}
    >
      {/* Insight Timer-style: single centered radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(42,195,148,0.15) 0%, rgba(42,195,148,0.04) 50%, transparent 75%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 20% 80%, rgba(88,60,180,0.12) 0%, transparent 65%)',
        }}
        aria-hidden="true"
      />

      <motion.div
        className="relative z-10 max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65 }}
        viewport={{ once: true }}
      >
        <h2
          className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Join 10 000+ people today<br />
          <span style={{ color: '#2AC394' }}>to deepen your practice</span>
        </h2>
        <p className="text-lg leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.48)' }}>
          {t('trackAnythingText')}
        </p>
        <motion.a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-lg px-14 font-semibold"
          style={{ boxShadow: '0 0 40px rgba(42,195,148,0.40)', fontSize: '1rem' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
        >
          Get Started — it's free
        </motion.a>
        <p className="mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          No credit card required
        </p>
      </motion.div>
    </section>
  )
}
