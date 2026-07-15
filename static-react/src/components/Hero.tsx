import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function Hero() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#0B0D14' }}
    >
      {/* Radial glow — Insight Timer style: one large centered glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 55% at 50% 40%, rgba(42,195,148,0.14) 0%, rgba(42,195,148,0.04) 45%, transparent 70%)',
        }}
        aria-hidden="true"
      />
      {/* Subtle top-left purple haze */}
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(88,60,180,0.18) 0%, transparent 65%)', filter: 'blur(60px)' }}
        aria-hidden="true"
      />
      {/* Subtle bottom-right warm haze */}
      <div
        className="absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(42,195,148,0.10) 0%, transparent 65%)', filter: 'blur(80px)' }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto pt-24 pb-20 gap-8">
        {/* Social proof pill */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full"
            style={{ background: 'rgba(42,195,148,0.12)', border: '1px solid rgba(42,195,148,0.30)', color: '#2AC394' }}
          >
            ✦ &nbsp;Trusted by 10 000+ practitioners worldwide
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.08] tracking-tight text-white"
          style={{ fontFamily: "'Playfair Display', serif" }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          The free spiritual<br />
          <span style={{ color: '#2AC394' }}>practice tracker</span><br />
          for everyday growth
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          className="text-lg md:text-xl max-w-2xl leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.58)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          {t('landing.subtitle')}
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-4 mt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-lg px-10 font-semibold text-base"
            style={{ boxShadow: '0 0 32px rgba(42,195,148,0.40)' }}
          >
            Get Started — it's free
          </a>
          <a
            href="#features"
            className="btn btn-ghost btn-lg px-8 text-base font-medium"
            style={{ color: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            See how it works
          </a>
        </motion.div>

        <motion.p
          className="text-xs"
          style={{ color: 'rgba(255,255,255,0.28)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          No subscription · Works on iOS, Android & Web
        </motion.p>

        {/* Stats row — Insight Timer "Join 30M" style */}
        <motion.div
          className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-px w-full max-w-2xl rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.07)', boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
        >
          {[
            { n: '10 000+', l: 'Practitioners' },
            { n: '50+',     l: 'Practice types' },
            { n: '3',       l: 'Languages' },
            { n: '100%',    l: 'Free forever' },
          ].map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center py-5 px-3"
              style={{ background: 'rgba(11,13,20,0.70)' }}
            >
              <span className="text-xl md:text-2xl font-bold text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}>
                {s.n}
              </span>
              <span className="text-[11px] mt-1 tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.36)' }}>
                {s.l}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #0B0D14)' }}
        aria-hidden="true"
      />
    </section>
  )
}
