import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import crowdedScene from '../assets/crowded-scene-indian-city.jpg'

export function TestimonialSpotlight() {
  const { t } = useTranslation()

  return (
    <section className="bg-[#f5f3ee] text-[#1c1c1e] py-24 px-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="font-serif text-3xl md:text-4xl leading-tight"
        >
          {t('landing.testimonial.heading')}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-2 rounded-2xl overflow-hidden border border-black/5 bg-white"
        >
          {/* Image column */}
          <div className="relative min-h-64 md:min-h-0">
            <img
              src={crowdedScene}
              alt=""
              className="w-full h-full object-cover block"
            />
            {/* Corner stat chip */}
            <span className="absolute bottom-4 left-4 inline-flex items-center justify-center rounded-full px-3 h-7 text-xs font-medium bg-white/90 text-[#1c1c1e] shadow-sm">
              {t('landing.testimonial.stat')}
            </span>
          </div>

          {/* Quote column */}
          <div className="flex flex-col justify-center gap-4 p-6 md:p-8">
            <p className="text-lg leading-relaxed text-[#1c1c1e]">
              &ldquo;{t('landing.testimonial.quote')}&rdquo;
            </p>
            <p className="text-sm text-[#6b6862]">
              {t('landing.testimonial.author')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
