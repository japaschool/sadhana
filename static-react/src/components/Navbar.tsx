import { useState } from 'react'
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
  const logoColor = '#fff'

  return (
    <nav
      className="relative z-50 w-full"
      style={{ background: 'transparent' }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img src={logo} alt="Sadhana Pro" className="h-8 w-8 rounded-lg" />
          <span className="text-base font-semibold tracking-wide" style={{ fontFamily: "'Playfair Display', serif", color: logoColor }}>
            Sadhana Pro
          </span>
        </a>

        {/* Right actions only */}
        <div className="flex items-center gap-1">
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

          <div className="dropdown dropdown-end">
            <button tabIndex={0}
              className="btn btn-ghost btn-sm px-2 font-medium text-xs"
              style={{ color: textColor }}
              title="Change language">
              {current}
            </button>
            <ul tabIndex={0}
              className="dropdown-content menu rounded-xl shadow-xl w-44 p-2 z-[60]"
              style={{ background: '#EDE8E3', border: '1px solid rgba(0,0,0,0.08)' }}>
              {(['en','ru','uk'] as const).map((l, i) => (
                <li key={l}>
                  <button onClick={() => changeLang(l)}
                    className="w-full text-left text-sm py-2 rounded-lg hover:bg-black/5"
                    style={{ color: 'rgba(28,28,28,0.75)' }}>
                    {['🇬🇧 English','🇷🇺 Русский','🇺🇦 Українська'][i]}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Grey CTA — Insight Timer style */}
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="btn btn-sm px-5 ml-2 font-semibold text-sm text-white rounded-full"
            style={{ background: 'rgba(255,255,255,0.20)', border: '1px solid rgba(255,255,255,0.30)', backdropFilter: 'blur(8px)' }}>
            {t('cta.openNow')}
          </a>
        </div>
      </div>
    </nav>
  )
}
