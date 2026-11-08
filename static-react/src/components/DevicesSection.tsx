import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { shot } from '../shots'

// Laptop, tablet and phone drawn in CSS over one box that keeps its aspect ratio, so the group scales as one picture.
// Padding percentages are of the box's width; border-radius percentages are of each device's own size.
const bezel = '#0A0A0A'
const shadow = '0 30px 70px rgba(0,0,0,0.22), 0 10px 25px rgba(0,0,0,0.12)'

export default function DevicesSection() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language || 'en'

  return (
    <section style={{ background: '#E8E3DE' }} className="py-14 md:py-20 lg:py-24 px-4 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-10 md:mb-14"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl md:text-3xl font-medium mb-4" style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1E' }}>
            {t('devices.title')}
          </h2>
          <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(28,28,28,0.50)' }}>
            {t('devices.description')}
          </p>
        </motion.div>

        <motion.div
          className="relative w-full"
          style={{ aspectRatio: '16 / 10.4' }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          {/* Laptop */}
          <div className="absolute" style={{ left: '3%', top: 0, width: '74%' }}>
            <div style={{ background: bezel, padding: '1.3%', borderRadius: '2.2% / 3.4%', boxShadow: shadow }}>
              <img src={shot('overview-desktop', lang)} alt={t('devices.desktop')} loading="lazy" draggable={false}
                className="block w-full" style={{ aspectRatio: '1440 / 900', borderRadius: '0.6% / 1%' }} />
            </div>
            <div style={{ margin: '0 -7%', height: 0, paddingTop: '2.6%', background: 'linear-gradient(#d4d0cb, #9d9893)', borderRadius: '0 0 40% 40% / 0 0 100% 100%', boxShadow: shadow }} />
          </div>

          {/* Tablet */}
          <div className="absolute" style={{ right: '3%', bottom: '2%', width: '27%', background: bezel, padding: '0.9%', borderRadius: '7% / 5%', boxShadow: shadow }}>
            <img src={shot('overview-tablet', lang)} alt={t('devices.tablet')} loading="lazy" draggable={false}
              className="block w-full" style={{ aspectRatio: '820 / 1180', borderRadius: '4% / 2.8%' }} />
          </div>

          {/* Phone */}
          <div className="absolute" style={{ right: '25%', bottom: 0, width: '13.5%', background: bezel, padding: '0.55%', borderRadius: '17% / 8%', boxShadow: shadow }}>
            <img src={shot('overview', lang)} alt={t('devices.phone')} loading="lazy" draggable={false}
              className="block w-full" style={{ aspectRatio: '390 / 792', borderRadius: '13% / 6%' }} />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
