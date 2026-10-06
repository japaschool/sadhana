import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import PhoneFrame from './PhoneFrame'
import shot1 from '../assets/shot-1.jpg'
import shot2 from '../assets/shot-2.jpg'
import shot3 from '../assets/shot-3.jpg'
import shot4 from '../assets/shot-4.jpg'
import shot5 from '../assets/shot-5.jpg'
import shot6 from '../assets/shot-6.jpg'
import shot7 from '../assets/shot-7.jpg'
import shot8 from '../assets/shot-8.jpg'

const rows = [
  {
    img: shot1,
    accent: '#2AC394',
    eyebrow: 'Daily ritual',
    titleKey: 'keyFeatures.customisableTitle',
    desc: 'Build a complete record of your sadhana — meditation, mantras, asana, pranayama, journaling and more. Track duration, repetitions, or simple yes/no. Everything in one place.',
    bullets: ['Custom fields: numbers, text, duration', 'Yes/no habit tracking', 'Daily, weekly & monthly views'],
    flip: false,
    bg: '#0B0D14',
  },
  {
    img: shot2,
    accent: '#6B8FFF',
    eyebrow: 'Offline first',
    titleKey: 'keyFeatures.offlineTitle',
    desc: "Enter your practice even without an internet connection. Data syncs automatically when you're back online — so you never miss a day.",
    bullets: ['Works without internet', 'Auto-sync when reconnected', 'Install on home screen as a web app'],
    flip: true,
    bg: '#0E1018',
  },
  {
    img: shot4,
    accent: '#A78BFA',
    eyebrow: 'Progress & insight',
    titleKey: 'keyFeatures.reportsTitle',
    desc: 'Beautiful visual charts reveal patterns in your practice over days, weeks and months. Share your progress graphs with your teacher or sangha with a single link.',
    bullets: ['Multi-metric custom reports', 'Visual graphs over time', 'Shareable progress links'],
    flip: false,
    bg: '#0B0D14',
  },
  {
    img: shot5,
    accent: '#F59E0B',
    eyebrow: 'Deep analysis',
    titleKey: 'keyFeatures.reportsTitle',
    desc: 'Go beyond simple tracking — layer multiple metrics on a single graph and find the correlations that help you understand your practice on a deeper level.',
    bullets: ['Combined metric graphs', 'Historical trend analysis', 'CSV export for deep dives'],
    flip: true,
    bg: '#0E1018',
  },
  {
    img: shot6,
    accent: '#34D399',
    eyebrow: 'Clean data view',
    titleKey: 'keyFeatures.dataTitle',
    desc: 'View all your entries in a clean table format — perfect for spotting missing days and reviewing your full history at a glance.',
    bullets: ['Full table history view', 'CSV import & export', 'Easy edit and delete'],
    flip: false,
    bg: '#0B0D14',
  },
  {
    img: shot7,
    accent: '#F472B6',
    eyebrow: 'Community',
    titleKey: 'keyFeatures.groupTitle',
    desc: "Join or create practice groups. See each other's entries in a shared table, celebrate streaks together, and stay accountable on the days the practice gets hard.",
    bullets: ['Create or join groups', 'Shared group table view', 'Mutual accountability'],
    flip: true,
    bg: '#0E1018',
  },
  {
    img: shot3,
    accent: '#60A5FA',
    eyebrow: 'Share & inspire',
    titleKey: 'keyFeatures.shareTitle',
    desc: 'Share the link to your practice graphs with your mentor or community. One tap to generate a beautiful, readable progress report anyone can view.',
    bullets: ['One-tap share link', 'Mentor & teacher sharing', 'Public or private'],
    flip: false,
    bg: '#0B0D14',
  },
  {
    img: shot8,
    accent: '#FB923C',
    eyebrow: 'Support & guides',
    titleKey: 'keyFeatures.installTitle',
    desc: 'Install Sadhana Pro on any device for a native app-like experience — and access video guides, FAQ and developer support whenever you need help.',
    bullets: ['Install on iOS & Android', 'Video guides library', 'Direct developer support'],
    flip: true,
    bg: '#0E1018',
  },
]

export default function FeatureRows() {
  const { t } = useTranslation()

  return (
    <section id="preview">
      {rows.map((row, i) => (
        <div key={i} style={{ background: row.bg }}>
          <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
            <div className={`flex flex-col ${row.flip ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-16 md:gap-20`}>

              {/* Phone frame */}
              <motion.div
                className="flex-shrink-0 flex items-center justify-center"
                initial={{ opacity: 0, x: row.flip ? 50 : -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
                viewport={{ once: true, margin: '-80px' }}
              >
                <PhoneFrame src={row.img} alt={t(row.titleKey)} accentColor={row.accent} />
              </motion.div>

              {/* Text */}
              <motion.div
                className="flex-1 max-w-lg"
                initial={{ opacity: 0, x: row.flip ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.75, ease: 'easeOut', delay: 0.08 }}
                viewport={{ once: true, margin: '-80px' }}
              >
                <p
                  className="text-xs font-bold tracking-widest uppercase mb-4"
                  style={{ color: row.accent }}
                >
                  {row.eyebrow}
                </p>
                <h2
                  className="text-3xl md:text-4xl font-bold mb-5 leading-tight text-white"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {t(row.titleKey)}
                </h2>
                <p className="text-base leading-relaxed mb-7" style={{ color: 'rgba(255,255,255,0.52)' }}>
                  {row.desc}
                </p>

                {/* Bullet list */}
                <ul className="flex flex-col gap-3">
                  {row.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                        style={{ background: `${row.accent}22`, color: row.accent }}
                      >
                        ✓
                      </span>
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.60)' }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>

          {/* Thin separator */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />
        </div>
      ))}
    </section>
  )
}
