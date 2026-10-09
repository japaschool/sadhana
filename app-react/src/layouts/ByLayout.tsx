import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLayout } from './useLayout'

interface ByLayoutProps {
  mobile?: ReactNode
  tablet?: ReactNode
  desktop?: ReactNode
  legacy: ReactNode
}

/** While a redesigned screen's code loads: the new palette, so there's no flash of the old dark theme. */
export function UiLoading() {
  const { t } = useTranslation()
  return (
    <div className="ui-root flex min-h-dvh items-center justify-center bg-ui-bg">
      <span role="status" aria-label={t('common.loading')}
        className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
    </div>
  )
}

/** Renders the current layout's element, or `legacy` until that layout is redesigned. */
export function ByLayout({ legacy, ...layouts }: ByLayoutProps) {
  const element = layouts[useLayout()]
  return element ? <Suspense fallback={<UiLoading />}>{element}</Suspense> : <>{legacy}</>
}
