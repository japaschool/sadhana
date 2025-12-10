import { useEffect, useRef, useState } from 'react'
import { FaTelegramPlane, FaYoutube } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

export default function FloatingHeaderButtons() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function change(lang: 'en' | 'ru' | 'uk') {
    void i18n.changeLanguage(lang)
    const newPath = lang === 'en' ? '/' : `/${lang}`
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', newPath)
    }
    setOpen(false)
  }

  // derive 2-letter code for current language
  const current = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="fixed top-6 right-6 z-50 flex items-center gap-3">
      <a
        href="https://t.me/sadhanapro"
        target="_blank"
        rel="noreferrer"
        className="w-12 h-12 rounded-full bg-white/25 backdrop-blur-lg border border-white/20 text-white flex items-center justify-center shadow-lg hover:bg-white/30 transition-all"
        title="Contact on Telegram"
      >
        <span className="sr-only">Contact on Telegram</span>
        <FaTelegramPlane className="w-5 h-5" />
      </a>
      
      <a
        href="https://www.youtube.com/@SadhanaPro"
        target="_blank"
        rel="noreferrer"
        className="w-12 h-12 rounded-full bg-white/25 backdrop-blur-lg border border-white/20 text-white flex items-center justify-center shadow-lg hover:bg-white/30 transition-all"
        title="Follow us on YouTube"
      >
        <span className="sr-only">Follow us on YouTube</span>
        <FaYoutube className="w-5 h-5" />
      </a>

      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`w-12 h-12 rounded-full bg-white/25 backdrop-blur-lg border border-white/20 text-white flex items-center justify-center shadow-lg hover:bg-white/30 transition-all`}
          title="Change language"
        >
          <span className="sr-only">Change language</span>
          <span className="font-semibold text-sm">{current}</span>
        </button>

        {open && (
          <div className="absolute top-14 right-0 w-44 bg-black/40 backdrop-blur-md text-white rounded-lg shadow-lg border border-white/10 p-2 z-60">
            <ul className="flex flex-col">
              <li>
                <button onClick={() => change('en')} className="w-full text-left px-3 py-2 rounded hover:bg-white/10">🇬🇧 English</button>
              </li>
              <li>
                <button onClick={() => change('ru')} className="w-full text-left px-3 py-2 rounded hover:bg-white/10">🇷🇺 Русский</button>
              </li>
              <li>
                <button onClick={() => change('uk')} className="w-full text-left px-3 py-2 rounded hover:bg-white/10">🇺🇦 Українська</button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
