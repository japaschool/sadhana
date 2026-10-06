import { motion } from 'framer-motion'

const stats = [
  { value: '10 000+', label: 'Active Users' },
  { value: '50+', label: 'Practice Types' },
  { value: '100%', label: 'Free to Use' },
  { value: '3', label: 'Languages' },
]

export default function StatsStrip() {
  return (
    <section
      className="py-14 px-6"
      style={{ background: 'oklch(16% 0.08 165)' }}
    >
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s, i) => (
          <motion.div
            key={i}
            className="text-center"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            viewport={{ once: true }}
          >
            <div
              className="text-3xl md:text-4xl font-bold mb-1"
              style={{
                fontFamily: "'Playfair Display', serif",
                background: 'linear-gradient(135deg, #ffffff 0%, oklch(82% 0.18 155) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {s.value}
            </div>
            <div className="text-white/50 text-xs tracking-widest uppercase">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
