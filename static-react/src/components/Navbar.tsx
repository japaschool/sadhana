
import { useState, useEffect } from 'react'
import { FaTelegramPlane } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import logo from '../assets/logo.png'
import { type Lang, type Page, appUrl, pagePath } from '../pages'

export default function Navbar({ page }: { page: Page }) {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2) as Lang
  const current = lang.toUpperCase()
  const href = appUrl(lang)
  const [scrolledDown, setScrolled] = useState(false)
  const scrolled = scrolledDown || page !== 'home' // no hero behind it elsewhere

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function changeLang(l: Lang) {
    // Other pages are prerendered per language: load the real one
    if (page !== 'home') return void (window.location.href = pagePath(l, page))
    void i18n.changeLanguage(l)
    window.history.pushState({}, '', l === 'en' ? '/' : `/${l}/`)
    // GA4 sees pushState itself; Metrika needs the hit (counter in index.html)
    ;(window as { ym?: (...a: unknown[]) => void }).ym?.(113886867, 'hit', location.href)
  }

  const textColor = scrolled ? 'rgba(28,28,28,0.70)' : 'rgba(255,255,255,0.80)'
  const logoColor = scrolled ? 'rgba(28,28,28,0.85)' : '#fff'
  const menuBg = '#EDE8E3'
  const menuText = 'rgba(28,28,28,0.75)'

  return (
    <nav
      className="w-full transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(237,232,227,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-[10%] h-16 flex items-center justify-between">
        {/* Logo */}
        <a href={pagePath(lang, 'home')} className="flex items-center gap-2.5 flex-shrink-0">
          <img
            src={logo}
            alt="Sadhana Pro"
            className="rounded-lg transition-all duration-300"
            style={{
              height: '35px',
              width: '35px',
              filter: scrolled ? 'invert(0.75)' : 'none',
            }}
          />
          <span className="hidden sm:inline font-semibold tracking-wide transition-colors duration-300" style={{ fontFamily: "'Playfair Display', serif", color: logoColor, fontSize: '17.6px' }}>
            Sadhana Pro
          </span>
        </a>

        <div className="flex items-center gap-0">
          {/* Desktop only: Guides + Telegram + language dropdown */}
          <a href={pagePath(lang, 'help')}
            className="hidden sm:flex btn btn-ghost btn-sm px-3 font-medium text-sm transition-colors duration-300"
            style={{ color: textColor }}>
            {t('help.title')}
          </a>
          <a href="https://t.me/sadhanapro" target="_blank" rel="noreferrer" title="Telegram"
            className="hidden sm:flex btn btn-ghost btn-circle btn-sm transition-colors duration-300"
            style={{ color: textColor }}>
            <FaTelegramPlane className="w-4 h-4" />
          </a>
          <div className="dropdown dropdown-end hidden sm:block">
            <button tabIndex={0}
              className="btn btn-ghost btn-sm px-2 font-medium text-xs transition-colors duration-300"
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
            className="btn btn-sm px-5 ml-1 font-semibold text-sm rounded-full transition-all duration-300"
            style={scrolled
              ? { background: '#3E8D6B', color: '#fff', border: 'none' }
              : { background: 'rgba(255,255,255,0.20)', border: '1px solid rgba(255,255,255,0.30)', backdropFilter: 'blur(8px)', color: '#fff' }
            }>
            {t('cta.openNow', 'Open Now')}
          </a>

          {/* Mobile only: combined dropdown — right of CTA */}
          <div className="dropdown dropdown-end sm:hidden">
            <button tabIndex={0}
              className="btn btn-ghost btn-sm btn-circle transition-colors duration-300"
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
                <a href={pagePath(lang, 'help')}
                  className="text-sm py-2 rounded-lg hover:bg-black/5"
                  style={{ color: menuText }}>
                  {t('help.title')}
                </a>
              </li>
              <li>
                <a href="https://t.me/sadhanapro" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2.5 text-sm py-2 rounded-lg hover:bg-black/5"
                  style={{ color: menuText }}>
                  <FaTelegramPlane className="w-4 h-4" /> Telegram
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
