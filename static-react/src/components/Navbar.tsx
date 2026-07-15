import { useEffect, useRef, useState } from 'react'
import { FaTelegramPlane, FaYoutube } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

export default function Navbar() {
  const { i18n, t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const current = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2).toUpperCase()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function changeLang(l: 'en' | 'ru' | 'uk') {
    void i18n.changeLanguage(l)
    window.history.pushState({}, '', l === 'en' ? '/' : `/${l}`)
    setLangOpen(false)
  }

  return (
    <div
      className={`navbar fixed top-0 left-0 right-0 z-50 px-6 transition-all duration-300 ${
        scrolled ? 'bg-base-100/90 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="navbar-start">
        <span
          className="text-xl font-bold text-base-content select-none"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Sadhana Pro
        </span>
      </div>

      <div className="navbar-end gap-1">
        <a
          href="https://t.me/sadhanapro"
          target="_blank"
          rel="noreferrer"
          title="Telegram"
          className="btn btn-ghost btn-circle text-base-content"
        >
          <FaTelegramPlane className="w-5 h-5" />
        </a>

        <a
          href="https://www.youtube.com/@SadhanaPro"
          target="_blank"
          rel="noreferrer"
          title="YouTube"
          className="btn btn-ghost btn-circle text-base-content"
        >
          <FaYoutube className="w-5 h-5" />
        </a>

        <div ref={dropRef} className="relative">
          <button
            onClick={() => setLangOpen(v => !v)}
            className="btn btn-ghost btn-circle text-base-content font-semibold text-sm"
            aria-haspopup="menu"
            aria-expanded={langOpen}
            title="Change language"
          >
            {current}
          </button>
          {langOpen && (
            <ul className="absolute top-14 right-0 menu bg-base-100 rounded-box shadow-lg w-44 p-2 border border-base-300 z-60">
              <li><button onClick={() => changeLang('en')} className="w-full text-left">🇬🇧 English</button></li>
              <li><button onClick={() => changeLang('ru')} className="w-full text-left">🇷🇺 Русский</button></li>
              <li><button onClick={() => changeLang('uk')} className="w-full text-left">🇺🇦 Українська</button></li>
            </ul>
          )}
        </div>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm rounded-full px-5 ml-1"
        >
          {t('cta.openNow')}
        </a>
      </div>
    </div>
  )
}
