import type { ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MobileShell } from '../../../../layouts/mobile/MobileShell'
import type { YatraAdmin } from '../useYatraAdmin'

export const CARD = 'rounded-[18px] border border-ui-hairline bg-ui-surface'
export const LIST = 'flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline'
export const FIELD = 'min-h-12 w-full rounded-xl border border-ui-control bg-ui-surface px-3.5 text-base text-ui-ink outline-none focus:border-ui-accent aria-invalid:border-ui-danger'
export const BTN = 'flex min-h-[50px] items-center justify-center rounded-[14px] px-4 text-[15px] font-bold'
export const HINT = 'text-[13px] leading-normal text-ui-muted'
export const SECTION_TITLE = 'text-[17px] font-extrabold text-ui-ink'

/** An admin page: back link, title over the yatra name, and the content once loaded. Members are sent to their own page. */
export function AdminPage({ admin, title, back, children }: {
  admin: YatraAdmin; title: string; back?: { to: string; label: string }; children: () => ReactNode
}) {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  if (!admin.isLoading && !admin.isError && !admin.isAdmin) return <Navigate to={`/yatra/${id}/settings`} replace />
  const up = back ?? { to: `/yatra/${id}/admin/settings`, label: t('yatraSettings.manage') }
  return (
    <MobileShell>
      <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-11 items-center px-2">
          <Link to={up.to} className="flex min-h-11 items-center gap-1 px-2 text-[17px] font-semibold text-ui-accent">
            <span aria-hidden>‹</span>{up.label}
          </Link>
        </div>
      </header>
      <div className="flex flex-col gap-0.5 px-5 pb-4">
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.02em] break-words text-ui-ink">{title}</h1>
        {admin.yatra && <p className="text-sm text-ui-muted">{admin.yatra.name}</p>}
      </div>
      {admin.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <span role="status" aria-label={t('common.loading')} className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
        </div>
      ) : admin.isError ? (
        <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('common.error')}</p>
      ) : (
        <div className="flex flex-col gap-4 px-4 pb-8">{children()}</div>
      )}
    </MobileShell>
  )
}
