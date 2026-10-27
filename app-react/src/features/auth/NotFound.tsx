import { useTranslation } from 'react-i18next'
import { AuthFrame } from './AuthFrame'
import { PrimaryLink } from './kit'

/** 12a: any unknown route, signed in or not. */
export function NotFound() {
  const { t } = useTranslation()
  return (
    <AuthFrame>
      <div className="flex flex-1 flex-col gap-10 pb-10 sm:pb-0">
        <div className="flex flex-1 flex-col justify-center gap-5">
          <span className="font-ui-mono text-[64px] leading-none font-semibold tracking-[-0.04em] text-ui-accent">404</span>
          <div className="flex flex-col gap-2.5">
            <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.025em]">{t('notFound.title')}</h1>
            <p className="text-[15px] leading-normal text-ui-ink2">{t('notFound.message')}</p>
          </div>
        </div>
        <PrimaryLink to="/">{t('notFound.goHome')}</PrimaryLink>
      </div>
    </AuthFrame>
  )
}
