import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PhoneFrame from './PhoneFrame'

interface Slide {
  src: string
  caption: string
}

interface PhoneCarouselProps {
  slides: Slide[]
  eyebrow?: string
  title?: string
  description?: string
  accent?: string
  id?: string
}

export default function PhoneCarousel({
  slides,
  eyebrow = 'Inside the app',
  title = 'See it in action',
  description = 'Browse through the app and discover how Sadhana Pro makes daily practice effortless.',
  accent = '#3A7D5C',
  id,
}: PhoneCarouselProps) {
  const [index, setIndex] = useState(1)

  const prev = () => setIndex(i => Math.max(0, i - 1))
  const next = () => setIndex(i => Math.min(slides.length - 1, i + 1))

  // Show 3 phones at once — all same size, like Insight Timer
  const leftSlide   = index > 0                  ? slides[index - 1] : null
  const centerSlide = slides[index]
  const rightSlide  = index < slides.length - 1  ? slides[index + 1] : null

  return (
    <section id={id} style={{ background: '#EDE8E3' }} className="py-24 px-4 overflow-hidden">
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
          <p className="text-base max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(28,28,28,0.50)' }}>
            {description}
          </p>
        </motion.div>

        {/* 3 phones — all same size, Insight Timer layout */}
        <div className="relative flex items-center justify-center gap-5 md:gap-8">

          {/* Left arrow */}
          {index > 0 && (
            <button onClick={prev}
              className="absolute left-0 z-20 flex items-center justify-center w-10 h-10 rounded-full shadow-md transition-transform hover:scale-110 flex-shrink-0"
              style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.10)' }}
              aria-label="Previous">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {/* Left phone — same size, slightly dimmed */}
          <div style={{ width: 290, flexShrink: 0, opacity: leftSlide ? 0.70 : 0, transition: 'opacity 0.3s' }}>
            {leftSlide && (
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={`l-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="cursor-pointer"
                  onClick={prev}
                >
                  <PhoneFrame src={leftSlide.src} alt={leftSlide.caption} accentColor={accent} size="md" />
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Center phone — full opacity, slightly larger */}
          <div style={{ flexShrink: 0, zIndex: 10 }}>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`c-${index}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <PhoneFrame src={centerSlide.src} alt={centerSlide.caption} accentColor={accent} size="md" />
                <p className="text-center mt-4 text-sm" style={{ color: 'rgba(28,28,28,0.45)' }}>
                  {centerSlide.caption}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right phone — same size as left, slightly dimmed */}
          <div style={{ width: 280, flexShrink: 0, opacity: rightSlide ? 0.70 : 0, transition: 'opacity 0.3s' }}>
            {rightSlide && (
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={`r-${index}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="cursor-pointer"
                  onClick={next}
                >
                  <PhoneFrame src={rightSlide.src} alt={rightSlide.caption} accentColor={accent} size="md" />
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Right arrow */}
          {index < slides.length - 1 && (
            <button onClick={next}
              className="absolute right-0 z-20 flex items-center justify-center w-10 h-10 rounded-full shadow-md transition-transform hover:scale-110 flex-shrink-0"
              style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.10)' }}
              aria-label="Next">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-10">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === index ? 20 : 8,
                height: 8,
                background: i === index ? accent : 'rgba(28,28,28,0.18)',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
