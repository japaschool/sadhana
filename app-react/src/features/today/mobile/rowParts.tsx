import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

export function RequiredBadge() {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-ui-danger">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ui-danger" />
      {t('today.required')}
    </span>
  )
}

/** "+ Add", or "Required" for a required practice. Both open the row's editor. */
export function EmptyValue({ required, name, onClick }: { required: boolean; name: string; onClick: (e: MouseEvent<HTMLButtonElement>) => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" aria-label={t('today.editValue', { name })} onClick={onClick} className="pr-2">
      {required ? <RequiredBadge /> : <span className="text-[13px] font-bold text-ui-accent">{t('today.add')}</span>}
    </button>
  )
}

export function Chevron() {
  return <span aria-hidden className="-mt-[3px] h-1.5 w-1.5 rotate-45 border-r-[1.8px] border-b-[1.8px] border-ui-muted" />
}
