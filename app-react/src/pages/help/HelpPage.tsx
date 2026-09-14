import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LuCircleHelp, LuChevronDown, LuChevronUp, LuMessageSquare, LuX } from 'react-icons/lu'
import { ACCENT, ACCENT_GRADIENT, BORDER } from '../../theme/tokens'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

const FAQ_COUNT = 8

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden" style={glass}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-4 flex items-center gap-3 text-left"
        style={{ background: 'transparent', border: 'none' }}
      >
        <span className="flex-1 text-sm font-semibold text-base-content">{q}</span>
        {open
          ? <LuChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} />
          : <LuChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(242,244,246,0.7)' }} />
        }
      </button>
      {open && (
        <div
          className="px-4 pb-4 text-sm leading-relaxed"
          style={{ color: 'rgba(242,244,246,0.60)', borderTop: `1px solid ${BORDER}` }}
        >
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  )
}

export function HelpPage() {
  const { t } = useTranslation()

  const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({
    q: t(`help.faq${i + 1}q`),
    a: t(`help.faq${i + 1}a`),
  }))

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
          <LuCircleHelp className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-base-content">{t('help.title')}</h1>
          <p className="text-xs text-base-content/70 mt-0.5">{t('help.subtitle')}</p>
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

      {faqs.map((faq, i) => <FaqItem key={i} {...faq} />)}

      {/* Contact support */}
      <Link
        to="/help/support-form"
        className="rounded-2xl px-4 py-4 flex items-center gap-3 no-underline mt-2"
        style={glass}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.10)' }}
        >
          <LuMessageSquare className="w-4 h-4" style={{ color: '#f59e0b' }} />
        </div>
        <span className="flex-1 text-sm font-semibold text-base-content">{t('help.contactSupport')}</span>
      </Link>
    </div>
  )
}
