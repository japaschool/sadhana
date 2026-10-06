import { motion } from 'framer-motion'
import PhoneFrame from './PhoneFrame'

interface TriplePhonesProps {
  eyebrow: string
  title: string
  description: string
  shots: [string, string, string]
  accent?: string
  id?: string
}

export default function TriplePhones({ eyebrow, title, description, shots, accent = '#3E8D6B', id }: TriplePhonesProps) {
  return (
    <section id={id} style={{ background: '#EDE8E3' }} className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: accent }}>
            {eyebrow}
          </p>
          <h2
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1E' }}
          >
            {title}
          </h2>
          <p className="text-base max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(28,28,28,0.52)' }}>
            {description}
          </p>
        </motion.div>

        {/* Three phones — exactly like Insight Timer */}
        <div className="flex items-end justify-center gap-4 md:gap-6">
          {/* Left phone — slightly smaller, offset down */}
          <motion.div
            className="flex-shrink-0"
            style={{ marginBottom: '-24px', opacity: 0.85, transform: 'scale(0.88)', transformOrigin: 'bottom center' }}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 0.85, x: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            viewport={{ once: true }}
          >
            <PhoneFrame src={shots[0]} alt={title} accentColor={accent} />
          </motion.div>

          {/* Center phone — full size, most prominent */}
          <motion.div
            className="flex-shrink-0 relative z-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.0 }}
            viewport={{ once: true }}
          >
            <PhoneFrame src={shots[1]} alt={title} accentColor={accent} />
          </motion.div>

          {/* Right phone — slightly smaller, offset down */}
          <motion.div
            className="flex-shrink-0"
            style={{ marginBottom: '-24px', opacity: 0.85, transform: 'scale(0.88)', transformOrigin: 'bottom center' }}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 0.85, x: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            viewport={{ once: true }}
          >
            <PhoneFrame src={shots[2]} alt={title} accentColor={accent} />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
