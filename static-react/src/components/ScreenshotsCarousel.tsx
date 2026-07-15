import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import shot1 from '../assets/shot-1.jpg'
import shot2 from '../assets/shot-2.jpg'
import shot3 from '../assets/shot-3.jpg'
import shot4 from '../assets/shot-4.jpg'
import shot5 from '../assets/shot-5.jpg'
import shot6 from '../assets/shot-6.jpg'
import shot7 from '../assets/shot-7.jpg'
import shot8 from '../assets/shot-8.jpg'

const shots = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8]
const slideKeys = [
  'preview.slide1', 'preview.slide2', 'preview.slide3', 'preview.slide4',
  'preview.slide5', 'preview.slide6', 'preview.slide7', 'preview.slide8',
] as const

export default function ScreenshotsCarousel() {
  const { t } = useTranslation()
  const slides = shots.map((img, i) => ({ image: img, caption: t(slideKeys[i]) }))

  return (
    <section
      id="preview"
      className="py-28 px-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, oklch(10% 0.05 295) 0%, oklch(12% 0.04 35) 50%, oklch(11% 0.03 35) 100%)',
      }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div
          className="w-[560px] h-[560px] rounded-full blur-[160px]"
          style={{ background: 'oklch(63% 0.20 52 / 0.18)' }}
        />
      </div>
      <div
        className="absolute top-0 right-0 w-[380px] h-[380px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'oklch(48% 0.24 295 / 0.16)' }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Heading */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'oklch(67% 0.18 52)' }}>
            Inside the app
          </p>
          <h2
            className="text-4xl md:text-5xl font-bold"
            style={{
              fontFamily: "'Playfair Display', serif",
              background: 'linear-gradient(135deg, #ffffff 0%, oklch(84% 0.14 65) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('preview.title')}
          </h2>
        </motion.div>

        {/* Phone carousel */}
        <motion.div
          className="max-w-xs mx-auto"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          viewport={{ once: true }}
        >
          <div
            className="carousel w-full rounded-[2.5rem] overflow-hidden"
            style={{ boxShadow: '0 48px 120px oklch(0% 0 0 / 0.65), 0 0 0 1px oklch(67% 0.18 52 / 0.20)' }}
          >
            {slides.map((slide, i) => (
              <div key={i} id={`sp-slide-${i}`} className="carousel-item relative w-full">
                <img
                  src={slide.image}
                  alt={slide.caption}
                  className="w-full h-[540px] object-cover select-none"
                  draggable={false}
                />
                <div
                  className="absolute bottom-0 left-0 right-0 backdrop-blur-sm text-center py-3 px-4 text-xs font-light"
                  style={{ background: 'oklch(0% 0 0 / 0.60)', color: 'oklch(92% 0.02 80 / 0.70)' }}
                >
                  {slide.caption}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 mt-5 flex-wrap">
            {slides.map((_, i) => (
              <a
                key={i}
                href={`#sp-slide-${i}`}
                className="w-2 h-2 rounded-full transition-colors duration-200 hover:opacity-100"
                style={{ background: 'oklch(67% 0.18 52 / 0.40)' }}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
