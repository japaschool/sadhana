import { Navigate, useParams } from 'react-router-dom'
import { SettingsFrame } from '../SettingsFrame'
import type { FrameProps } from '../SettingsFrame'
import type { YatraAdmin } from '../useYatraAdmin'

export const CARD = 'rounded-[18px] border border-ui-hairline bg-ui-surface'
export const LIST = 'flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline'
export const FIELD = 'min-h-12 w-full rounded-xl border border-ui-control bg-ui-surface px-3.5 text-base text-ui-ink outline-none focus:border-ui-accent aria-invalid:border-ui-danger'
export const BTN = 'flex min-h-[50px] items-center justify-center rounded-[14px] px-4 text-[15px] font-bold'
export const HINT = 'text-[13px] leading-normal text-ui-muted'
/** Tablet and desktop: an add button beside the page title. */
export const ADD = 'flex min-h-10 shrink-0 items-center rounded-xl bg-ui-accent-fill px-4 text-sm font-extrabold text-ui-ink'
export const SECTION_TITLE = 'text-[17px] font-extrabold text-ui-ink'

/** An admin page in the current layout's frame, once loaded. Members are sent to their own page. */
export function AdminPage({ admin, children, ...frame }: { admin: YatraAdmin } & Omit<FrameProps, 'loading' | 'error'>) {
  const { id = '' } = useParams()
  if (!admin.isLoading && !admin.isError && !admin.isAdmin) return <Navigate to={`/yatra/${id}/settings`} replace />
  return <SettingsFrame {...frame} loading={admin.isLoading} error={admin.isError}>{children}</SettingsFrame>
}
