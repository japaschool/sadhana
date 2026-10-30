import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../ui/primitives/BottomSheet'

const KEY = 'sadhana.installPrompt' // 'never', or when "Not now" runs out (ms)
const NOT_NOW_MS = 7 * 24 * 60 * 60 * 1000

/** iPadOS Safari claims to be a Mac; only the touch points give it away. */
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

function wanted(): boolean {
  if (!isIos() || (navigator as Navigator & { standalone?: boolean }).standalone) return false
  try {
    const saved = localStorage.getItem(KEY)
    return saved !== 'never' && Date.now() >= Number(saved)
  } catch { return true }
}

function remember(value: string) {
  try { localStorage.setItem(KEY, value) } catch { /* private mode: the sheet just returns */ }
}

function Step({ n, children }: { n: number; children: string }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ui-accent-pill text-xs font-bold text-ui-accent">{n}</span>
      {children}
    </li>
  )
}

/** iOS has no install API, so Safari users get the steps by hand. Android's browsers offer their own prompt. */
export function InstallSheet({ ready }: { ready: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(wanted)
  if (!open || !ready) return null

  const close = (value: string) => { remember(value); setOpen(false) }
  const later = () => close(String(Date.now() + NOT_NOW_MS))

  return (
    <BottomSheet label={t('today.installTitle')} onClose={later}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold">{t('today.installTitle')}</h2>
        <p className="text-sm text-ui-muted">{t('today.installWhy')}</p>
      </div>
      <ol className="flex flex-col gap-3">
        <Step n={1}>{t('today.installStep1')}</Step>
        <Step n={2}>{t('today.installStep2')}</Step>
      </ol>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={later} className="h-[52px] rounded-2xl bg-ui-primary text-[15px] font-bold text-ui-on-primary">
          {t('today.installLater')}
        </button>
        <button type="button" onClick={() => close('never')} className="h-11 text-sm font-semibold text-ui-muted">
          {t('today.installNever')}
        </button>
      </div>
    </BottomSheet>
  )
}
