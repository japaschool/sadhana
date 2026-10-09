import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLayout } from './useLayout'

interface ByLayoutProps {
  mobile: ReactNode
  tablet: ReactNode
  desktop: ReactNode
}

/** While a screen's code loads. */
export function UiLoading() {
  const { t } = useTranslation()
  return (
    <div className="ui-root flex min-h-dvh items-center justify-center bg-ui-bg">
      <span role="status" aria-label={t('common.loading')}
        className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
    </div>
  )
}

/** Renders the current layout's element. */
export function ByLayout(layouts: ByLayoutProps) {
  return <Suspense fallback={<UiLoading />}>{layouts[useLayout()]}</Suspense>
}
