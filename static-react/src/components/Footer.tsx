import { FaTelegramPlane, FaYoutube } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import logo from '../assets/logo.png'

const columns = [
  {
    title: 'Practices',
    links: [
      { label: 'Meditation', href: '#' },
      { label: 'Yoga',       href: '#' },
      { label: 'Breathwork', href: '#' },
      { label: 'Journaling', href: '#' },
      { label: 'Chanting',   href: '#' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Web App',     href: 'https://app.sadhana.pro/' },
      { label: 'Mobile App',  href: 'https://mapp.sadhana.pro/' },
      { label: 'YouTube',     href: 'https://www.youtube.com/@SadhanaPro' },
      { label: 'Telegram',    href: 'https://t.me/sadhanapro' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Join Group',    href: 'https://t.me/sadhanapro' },
      { label: 'Video Guides',  href: 'https://www.youtube.com/@SadhanaPro' },
      { label: 'Support',       href: 'https://t.me/sadhanapro' },
    ],
  },
]

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer
      style={{ background: '#080A0F', borderTop: '1px solid rgba(255,255,255,0.05)' }}
      className="px-6 py-16"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <img src={logo} alt="Sadhana Pro" className="h-8 w-8 rounded-lg" />
              <span
                className="text-base font-semibold text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Sadhana Pro
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              A mindful space to track your daily spiritual practice and grow consistently.
            </p>
            <div className="flex gap-2">
              <a href="https://t.me/sadhanapro" target="_blank" rel="noreferrer"
                className="btn btn-ghost btn-circle btn-sm hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.40)' }} title="Telegram">
                <FaTelegramPlane className="w-4 h-4" />
              </a>
              <a href="https://www.youtube.com/@SadhanaPro" target="_blank" rel="noreferrer"
                className="btn btn-ghost btn-circle btn-sm hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.40)' }} title="YouTube">
                <FaYoutube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'rgba(255,255,255,0.30)' }}>
                {col.title}
              </p>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel="noreferrer"
                      className="text-sm transition-colors duration-150"
                      style={{ color: 'rgba(255,255,255,0.50)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#2AC394')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.50)')}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {t('footer.copyright')}
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Made with 🙏 for practitioners everywhere
          </p>
        </div>
      </div>
    </footer>
  )
}
