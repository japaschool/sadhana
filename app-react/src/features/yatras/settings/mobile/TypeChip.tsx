import { useTranslation } from 'react-i18next'
import type { PracticeDataType } from '../../../../types/api'

export const typeLabelKey = (type: PracticeDataType) => `yatraSettings.type${type}`

export function TypeIcon({ type }: { type: PracticeDataType }) {
  const box = 'inline-flex h-4 w-4 shrink-0 items-center justify-center'
  if (type === 'Int') return <span aria-hidden className={`${box} font-ui-mono text-sm font-bold`}>#</span>
  if (type === 'Text') return <span aria-hidden className={`${box} font-ui-mono text-[13px] font-bold`}>Aa</span>
  if (type === 'Bool') return <span aria-hidden className={`${box} text-sm font-bold`}>✓</span>
  if (type === 'Time') return (
    <span aria-hidden className={box}>
      <span className="relative block h-3.5 w-3.5 rounded-full border-[1.7px] border-current">
        <span className="absolute top-[1.6px] left-[4.6px] h-[4.4px] w-[1.7px] rounded-[1px] bg-current" />
        <span className="absolute top-[4.6px] left-[4.6px] h-[1.7px] w-1 rounded-[1px] bg-current" />
      </span>
    </span>
  )
  return (
    <span aria-hidden className={box}>
      <span className="flex h-2.5 w-3.5 items-center border-x-[1.8px] border-current px-px"><span className="h-[1.8px] flex-1 bg-current" /></span>
    </span>
  )
}

/** Data type as a pill: icon + label. */
export function TypeChip({ type }: { type: PracticeDataType }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ui-chip py-1 pr-2.5 pl-1.5 text-xs font-bold whitespace-nowrap text-ui-ink2">
      <TypeIcon type={type} />{t(typeLabelKey(type))}
    </span>
  )
}
