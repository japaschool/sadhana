import { motion } from 'framer-motion'

const categories = [
  { label: 'Meditation',   emoji: '🧘' },
  { label: 'Yoga',         emoji: '🌞' },
  { label: 'Breathwork',   emoji: '💨' },
  { label: 'Journaling',   emoji: '📔' },
  { label: 'Chanting',     emoji: '🕉️' },
  { label: 'Reading',      emoji: '📖' },
  { label: 'Prayer',       emoji: '🙏' },
  { label: 'Fasting',      emoji: '🌿' },
  { label: 'Sleep',        emoji: '🌙' },
  { label: 'Exercise',     emoji: '⚡' },
  { label: 'Cold Shower',  emoji: '❄️' },
  { label: 'Any Habit',    emoji: '✨' },
]

export default function PracticeCategories() {
  return (
    <section id="track" style={{ background: '#E8E3DE' }} className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2
            className="text-xl md:text-2xl font-medium"
            style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1E' }}
          >
            Track any practice, any tradition
          </h2>
        </motion.div>

        <motion.div
          className="flex flex-wrap justify-center gap-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
        >
          {categories.map((c, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium cursor-default select-none transition-colors duration-150"
              style={{ background: 'rgba(255,255,255,0.60)', border: '1px solid rgba(0,0,0,0.09)', color: 'rgba(28,28,28,0.70)' }}
              variants={{ hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } } }}
              whileHover={{ background: 'rgba(62,141,107,0.12)', borderColor: 'rgba(62,141,107,0.35)', color: '#2d7a5a' } as never}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
