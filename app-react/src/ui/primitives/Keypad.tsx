import { useTranslation } from 'react-i18next'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const
export type KeypadKey = (typeof KEYS)[number]

export function Keypad({ onKey }: { onKey: (k: KeypadKey) => void }) {
  const { t } = useTranslation()
  const label = (k: KeypadKey) => (k === '⌫' ? t('today.keyBackspace') : k === 'C' ? t('today.keyReset') : undefined)
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={label(k)}
          onClick={() => onKey(k)}
          className="h-[50px] rounded-xl bg-ui-chip font-ui-mono text-xl font-medium"
        >
          {k}
        </button>
      ))}
    </div>
  )
}
