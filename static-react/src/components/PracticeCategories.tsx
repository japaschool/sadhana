import { motion } from 'framer-motion'

// Insight Timer-style: topic grid, dark cards with hover
const categories = [
  { label: 'Meditation',   emoji: '🧘', href: '#' },
  { label: 'Yoga',         emoji: '🌞', href: '#' },
  { label: 'Breathwork',   emoji: '💨', href: '#' },
  { label: 'Journaling',   emoji: '📔', href: '#' },
  { label: 'Chanting',     emoji: '🕉️', href: '#' },
  { label: 'Reading',      emoji: '📖', href: '#' },
  { label: 'Prayer',       emoji: '🙏', href: '#' },
  { label: 'Fasting',      emoji: '🌿', href: '#' },
  { label: 'Sleep',        emoji: '🌙', href: '#' },
  { label: 'Exercise',     emoji: '⚡', href: '#' },
  { label: 'Cold Shower',  emoji: '❄️', href: '#' },
  { label: 'Any Habit',    emoji: '✨', href: '#' },
]

export default function PracticeCategories() {
  return (
    <section id="features" style={{ background: '#0B0D14' }} className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#2AC394' }}>
            What you can track
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-white"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Any Practice. Any Tradition.
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
        >
          {categories.map((c, i) => (
            <motion.a
              key={i}
              href={c.href}
              className="flex flex-col items-center gap-2 py-5 px-2 rounded-2xl cursor-pointer select-none transition-colors duration-200"
              style={{ background: '#131620', border: '1px solid rgba(255,255,255,0.07)' }}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
              }}
              whileHover={{ background: '#1A1E2E', borderColor: 'rgba(42,195,148,0.35)', scale: 1.04 } as never}
            >
              <span className="text-2xl leading-none">{c.emoji}</span>
              <span className="text-xs font-medium text-center leading-tight" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {c.label}
              </span>
            </motion.a>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
