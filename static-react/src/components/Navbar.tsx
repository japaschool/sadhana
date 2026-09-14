import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pill } from './Pill'
import LanguageSelector from './LanguageSelector'
import logo from '../assets/logo.png'

const APP_URL = 'https://app.sadhana.pro/'
const SIGNIN_URL = 'https://app.sadhana.pro/login'

export default function Navbar() {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={[
        'fixed top-0 inset-x-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-[#0b0b0d]/80 backdrop-blur border-b border-white/10'
          : 'bg-transparent',
      ].join(' ')}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img
            src={logo}
            alt="Sadhana Pro"
            className="rounded-lg"
            style={{ height: '32px', width: '32px' }}
          />
          <span
            className="hidden sm:inline font-semibold tracking-wide text-white"
            style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px' }}
          >
            Sadhana Pro
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors">
            {t('landing.nav.features')}
          </a>
          <a href="#practices" className="text-sm text-white/70 hover:text-white transition-colors">
            {t('landing.nav.practices')}
          </a>
          <a href="#charts" className="text-sm text-white/70 hover:text-white transition-colors">
            {t('landing.nav.charts')}
          </a>
          <a href={SIGNIN_URL} className="text-sm text-white/70 hover:text-white transition-colors">
            {t('landing.nav.signIn')}
          </a>
          <LanguageSelector />
          <Pill href={APP_URL}>{t('landing.nav.getStarted')}</Pill>
        </div>

        {/* Mobile: language switcher + pill */}
        <div className="flex md:hidden items-center gap-2">
          <LanguageSelector compact />
          <Pill href={APP_URL}>{t('landing.nav.getStarted')}</Pill>
        </div>
      </div>
    </nav>
  )
}
