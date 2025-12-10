import { useTranslation } from 'react-i18next'

export default function LanguageSelector({ compact }: { compact?: boolean }) {
  const { i18n } = useTranslation()

  function change(lang: 'en' | 'ru' | 'uk') {
    void i18n.changeLanguage(lang)
    // Update the URL path so that /, /ru and /uk map to languages
    const newPath = lang === 'en' ? '/' : `/${lang}`
    if (typeof window !== 'undefined') {
      // pushState without reloading
      window.history.pushState({}, '', newPath)
    }
  }

  const baseClass = compact ? 'px-2 py-1 text-sm' : 'px-3 py-2 text-sm'

  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex items-center gap-3'}>
      <button
        onClick={() => change('en')}
        className={`${baseClass} rounded bg-white/20 text-white`}
        aria-label="English"
      >
        EN
      </button>
      <button
        onClick={() => change('ru')}
        className={`${baseClass} rounded bg-white/20 text-white`}
        aria-label="Русский"
      >
        RU
      </button>
      <button
        onClick={() => change('uk')}
        className={`${baseClass} rounded bg-white/20 text-white`}
        aria-label="Українська"
      >
        UK
      </button>
    </div>
  )
}
