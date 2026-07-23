import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import heroBg from '../assets/crowded-scene-indian-city.jpg'
import shot1 from '../assets/shot-home.jpg'
import PhoneFrame from './PhoneFrame'

export default function Hero() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <section className="relative min-h-screen flex items-start md:items-center justify-center overflow-hidden pt-[120px] md:pt-0">
      {/* Background */}
      <img
        src={heroBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover select-none"
        draggable={false}
        style={{
          objectPosition: 'center 65%',
          animation: 'kenburns 20s ease-out forwards',
          transformOrigin: 'center 65%',
        }}
      />
      <style>{`
        @keyframes kenburns {
          0%   { transform: scale(1.18) translate(-15px, -25px); }
          100% { transform: scale(1.0) translate(0px, 0px); }
        }
      `}</style>

      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.18) 60%, rgba(237,232,227,1) 100%)' }}
        aria-hidden="true"
      />

      {/* Frosted glass card */}
      <motion.div
        className="relative z-10 mx-6 w-full max-w-3xl mb-8 md:mt-16 md:mb-0"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div
          className="rounded-3xl p-6 sm:p-10 md:p-14 lg:p-20 flex flex-col md:flex-row items-start gap-6 md:gap-10"
          style={{
            background: 'rgba(255,255,255,0.16)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.28)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}
        >
          <div className="hidden md:flex flex-shrink-0">
            <PhoneFrame src={shot1} alt="App preview" accentColor="#3E8D6B" size="sm" />
          </div>

          {/* Text */}
          <div className="flex-1 text-white flex flex-col gap-5 md:gap-0 md:justify-between md:min-h-[484px]">
            <motion.h1
              className="text-4xl md:text-5xl font-medium leading-none"
              style={{ fontFamily: "'Playfair Display', serif", color: '#fff' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.7 }}
            >
              Sadhana Pro
            </motion.h1>
            <motion.p
              className="font-medium leading-snug"
              style={{ color: 'rgba(255,255,255,0.70)', fontFamily: "'Inter', sans-serif", fontSize: '16.8px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              Sadhana tracker and chart — a tracker for spiritual practice, meditation, and habits
            </motion.p>
            <motion.p
              className="leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.60)', fontSize: '15.4px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              Sadhana Pro is a powerful and flexible sadhana (daily spiritual practice) diary that helps you track your daily practices, habits, and meditation. You can track your activities in convenient tables or monitor your progress on visual graphs. The app is ideal for both regular spiritual practice and systematically tracking your daily tasks and habits. With Sadhana Pro, you can consciously develop your spiritual discipline.
            </motion.p>
            <motion.a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block self-start px-7 py-2.5 rounded-full font-semibold text-sm"
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '1.5px solid rgba(255,255,255,0.45)',
                color: '#fff',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              whileHover={{ background: 'rgba(255,255,255,0.28)' } as never}
              whileTap={{ scale: 0.97 }}
            >
              {t('cta.openNow', 'Open Now')}
            </motion.a>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
