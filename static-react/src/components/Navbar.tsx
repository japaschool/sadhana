import { useEffect, useState } from 'react'
import { FaTelegramPlane, FaYoutube } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import logo from '../assets/logo.png'

export default function Navbar() {
  const { i18n, t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)

  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const current = lang.toUpperCase()
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function changeLang(l: 'en' | 'ru' | 'uk') {
    void i18n.changeLanguage(l)
    window.history.pushState({}, '', l === 'en' ? '/' : `/${l}`)
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-400"
      style={scrolled
        ? { background: 'rgba(11,13,20,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }
        : { background: 'transparent' }
      }
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img src={logo} alt="Sadhana Pro" className="h-8 w-8 rounded-lg" />
          <span
            className="text-base font-semibold text-white tracking-wide"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Sadhana Pro
          </span>
        </a>

        {/* Center nav links */}
        <div className="hidden md:flex items-center gap-7 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#preview" className="hover:text-white transition-colors">Preview</a>
          <a href="https://t.me/sadhanapro" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Community</a>
          <a href="https://www.youtube.com/@SadhanaPro" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Learn</a>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <a
            href="https://t.me/sadhanapro"
            target="_blank"
            rel="noreferrer"
            title="Telegram"
            className="hidden sm:flex btn btn-ghost btn-circle btn-sm hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            <FaTelegramPlane className="w-4 h-4" />
          </a>
          <a
            href="https://www.youtube.com/@SadhanaPro"
            target="_blank"
            rel="noreferrer"
            title="YouTube"
            className="hidden sm:flex btn btn-ghost btn-circle btn-sm hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            <FaYoutube className="w-4 h-4" />
          </a>

          <div className="dropdown dropdown-end">
            <button
              tabIndex={0}
              className="btn btn-ghost btn-sm px-2 hover:bg-white/10 font-medium text-xs"
              style={{ color: 'rgba(255,255,255,0.55)' }}
              title="Change language"
            >
              {current}
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu rounded-xl shadow-2xl w-44 p-2 z-[60]"
              style={{ background: '#1A1E2E', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {(['en','ru','uk'] as const).map((l, i) => (
                <li key={l}>
                  <button onClick={() => changeLang(l)} className="w-full text-left text-sm py-2 rounded-lg hover:bg-white/10"
                    style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {['🇬🇧 English','🇷🇺 Русский','🇺🇦 Українська'][i]}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm px-5 ml-1 font-semibold text-sm"
          >
            {t('cta.openNow')}
          </a>
        </div>
      </div>
    </nav>
  )
}
