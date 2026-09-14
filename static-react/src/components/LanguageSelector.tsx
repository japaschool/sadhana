import { useTranslation } from 'react-i18next'

const LANGS = [
  { code: 'en', label: 'EN', aria: 'English' },
  { code: 'ru', label: 'RU', aria: 'Русский' },
  { code: 'uk', label: 'UK', aria: 'Українська' },
] as const

type LangCode = (typeof LANGS)[number]['code']

export default function LanguageSelector({ compact }: { compact?: boolean }) {
  const { i18n } = useTranslation()
  const current = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)

  function change(lang: LangCode) {
    void i18n.changeLanguage(lang)
    // Keep the URL path in sync so /, /ru and /uk map to languages.
    const newPath = lang === 'en' ? '/' : `/${lang}`
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', newPath)
    }
  }

  return (
    <div
      className={`flex items-center rounded-full border border-white/15 ${compact ? 'p-0.5' : 'p-0.5'}`}
    >
      {LANGS.map(({ code, label, aria }) => {
        const active = current === code
        return (
          <button
            key={code}
            onClick={() => change(code)}
            aria-label={aria}
            aria-current={active ? 'true' : undefined}
            className={[
              'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
              active
                ? 'bg-white/15 text-white'
                : 'text-white/50 hover:text-white/80',
            ].join(' ')}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
