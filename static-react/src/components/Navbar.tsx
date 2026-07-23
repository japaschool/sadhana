
import { FaTelegramPlane, FaYoutube } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import logo from '../assets/logo.png'

export default function Navbar() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const current = lang.toUpperCase()
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  function changeLang(l: 'en' | 'ru' | 'uk') {
    void i18n.changeLanguage(l)
    window.history.pushState({}, '', l === 'en' ? '/' : `/${l}`)
  }

  const textColor = 'rgba(255,255,255,0.80)'
  const menuBg = '#EDE8E3'
  const menuText = 'rgba(28,28,28,0.75)'

  return (
    <nav className="relative z-50 w-full" style={{ background: 'transparent' }}>
      <div className="max-w-7xl mx-auto px-6 sm:px-[10%] h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img src={logo} alt="Sadhana Pro" style={{ height: '35px', width: '35px' }} className="rounded-lg" />
          <span className="hidden sm:inline font-semibold tracking-wide" style={{ fontFamily: "'Playfair Display', serif", color: '#fff', fontSize: '17.6px' }}>
            Sadhana Pro
          </span>
        </a>

        <div className="flex items-center gap-0">
          {/* Desktop only: Telegram + YouTube + language dropdown */}
          <a href="https://t.me/sadhanapro" target="_blank" rel="noreferrer" title="Telegram"
            className="hidden sm:flex btn btn-ghost btn-circle btn-sm"
            style={{ color: textColor }}>
            <FaTelegramPlane className="w-4 h-4" />
          </a>
          <a href="https://www.youtube.com/@SadhanaPro" target="_blank" rel="noreferrer" title="YouTube"
            className="hidden sm:flex btn btn-ghost btn-circle btn-sm"
            style={{ color: textColor }}>
            <FaYoutube className="w-4 h-4" />
          </a>
          <div className="dropdown dropdown-end hidden sm:block">
            <button tabIndex={0}
              className="btn btn-ghost btn-sm px-2 font-medium text-xs"
              style={{ color: textColor }}
              title="Change language">
              {current}
            </button>
            <ul tabIndex={0}
              className="dropdown-content menu rounded-xl shadow-xl w-44 p-2 z-[60]"
              style={{ background: menuBg, border: '1px solid rgba(0,0,0,0.08)' }}>
              {(['en', 'ru', 'uk'] as const).map((l, i) => (
                <li key={l}>
                  <button onClick={() => changeLang(l)}
                    className="w-full text-left text-sm py-2 rounded-lg hover:bg-black/5"
                    style={{ color: menuText }}>
                    {['🇬🇧 English', '🇷🇺 Русский', '🇺🇦 Українська'][i]}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="btn btn-sm px-5 ml-1 font-semibold text-sm text-white rounded-full"
            style={{ background: 'rgba(255,255,255,0.20)', border: '1px solid rgba(255,255,255,0.30)', backdropFilter: 'blur(8px)' }}>
            {t('cta.openNow', 'Open Now')}
          </a>

          {/* Mobile only: combined dropdown — right of CTA */}
          <div className="dropdown dropdown-end sm:hidden">
            <button tabIndex={0}
              className="btn btn-ghost btn-sm btn-circle"
              style={{ color: textColor }}
              aria-label="Menu">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <circle cx="9" cy="3" r="1.5" />
                <circle cx="9" cy="9" r="1.5" />
                <circle cx="9" cy="15" r="1.5" />
              </svg>
            </button>
            <ul tabIndex={0}
              className="dropdown-content menu rounded-xl shadow-xl w-48 p-2 z-[60]"
              style={{ background: menuBg, border: '1px solid rgba(0,0,0,0.08)' }}>
              <li>
                <a href="https://t.me/sadhanapro" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2.5 text-sm py-2 rounded-lg hover:bg-black/5"
                  style={{ color: menuText }}>
                  <FaTelegramPlane className="w-4 h-4" /> Telegram
                </a>
              </li>
              <li>
                <a href="https://www.youtube.com/@SadhanaPro" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2.5 text-sm py-2 rounded-lg hover:bg-black/5"
                  style={{ color: menuText }}>
                  <FaYoutube className="w-4 h-4" /> YouTube
                </a>
              </li>
              <li><div className="divider my-0.5" /></li>
              {(['en', 'ru', 'uk'] as const).map((l, i) => (
                <li key={l}>
                  <button onClick={() => changeLang(l)}
                    className="w-full text-left text-sm py-2 rounded-lg hover:bg-black/5"
                    style={{ color: menuText }}>
                    {['🇬🇧 English', '🇷🇺 Русский', '🇺🇦 Українська'][i]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </nav>
  )
}
