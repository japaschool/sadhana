import { motion } from 'framer-motion'
import heroBg from '../assets/ht-p3.jpg'
import shot1 from '../assets/shot-5.jpg'
import PhoneFrame from './PhoneFrame'

export default function Hero() {

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background photo with Ken Burns zoom-toward-temple effect */}
      <img
        src={heroBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-center select-none"
        draggable={false}
        style={{
          animation: 'kenburns 20s ease-in-out infinite alternate',
          transformOrigin: 'center center',
        }}
      />
      <style>{`
        @keyframes kenburns {
          0%   { transform: scale(1.0) translateY(0px); }
          100% { transform: scale(1.18) translateY(-30px); }
        }
      `}</style>

      {/* Dark gradient overlay — bottom is lighter so it blends into the cream sections */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.40) 60%, rgba(237,232,227,1) 100%)' }}
        aria-hidden="true"
      />

      {/* Frosted glass card — Insight Timer style */}
      <motion.div
        className="relative z-10 mx-6 w-full max-w-3xl mt-28 md:mt-32"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div
          className="rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-10"
          style={{
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.30)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}
        >
          {/* Phone preview */}
          <div className="flex-shrink-0" style={{ transform: 'scale(0.80)', transformOrigin: 'center center' }}>
            <PhoneFrame src={shot1} alt="App preview" accentColor="#3E8D6B" />
          </div>

          {/* Text content */}
          <div className="flex-1 text-white">
            <motion.h1
              className="text-3xl md:text-4xl font-bold leading-tight mb-5"
              style={{ fontFamily: "'Playfair Display', serif" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
            >
              Sadhana tracker and chart — a tracker for spiritual practice, meditation, and habits
            </motion.h1>
            <motion.p
              className="text-sm md:text-base leading-relaxed opacity-75"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.75 }}
              transition={{ delay: 0.35 }}
            >
              Sadhana Pro is a powerful and flexible sadhana diary that helps you track your daily practices, habits, and meditation. Track activities in convenient tables or monitor progress on visual graphs. Ideal for spiritual practice and systematically tracking daily tasks and habits.
            </motion.p>
          </div>
        </div>

      </motion.div>
    </section>
  )
}
