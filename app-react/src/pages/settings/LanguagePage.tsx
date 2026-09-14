import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LuGlobe, LuCheck, LuX } from 'react-icons/lu'
import { ACCENT, ACCENT_GRADIENT, TEXT, BORDER } from '../../theme/tokens'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

const LANGS = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ru', label: 'Russian', native: 'Русский' },
  { code: 'uk', label: 'Ukrainian', native: 'Українська' },
]

export function LanguagePage() {
  const { i18n } = useTranslation()
  const current = i18n.resolvedLanguage?.slice(0, 2) ?? 'en'

  return (
    <div className="px-4 py-6 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-3 pb-24 sm:pb-8">
      {/* Header */}
      <div className="rounded-2xl px-5 py-5 flex items-center gap-4" style={glass}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: ACCENT_GRADIENT,
            boxShadow: '0 4px 16px rgba(245,158,11,0.30)',
          }}
        >
          <LuGlobe className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-base-content">Language</h1>
          <p className="text-xs text-base-content/70 mt-0.5">Choose your preferred language</p>
        </div>
        <Link
          to="/settings"
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}
        >
          <LuX className="w-4 h-4" />
        </Link>
      </div>

      {/* Language options */}
      <div className="rounded-2xl overflow-hidden" style={glass}>
        {LANGS.map(({ code, label, native }, i) => {
          const active = current === code
          return (
            <button
              key={code}
              onClick={() => i18n.changeLanguage(code)}
              className="w-full flex items-center gap-4 px-4 py-4 text-left transition-colors"
              style={{
                background: active ? 'rgba(245,158,11,0.06)' : 'transparent',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: active ? ACCENT : TEXT }}>{native}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(242,244,246,0.7)' }}>{label}</p>
              </div>
              {active && <LuCheck className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
