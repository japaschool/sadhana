import { useState } from 'react'
import { Link, Navigate, useMatch, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DesktopShell } from '../../../layouts/desktop/DesktopShell'
import { TabletShell } from '../../../layouts/tablet/TabletShell'
import { useLayout } from '../../../layouts/useLayout'
import { usePractices } from '../usePractices'
import { DeleteSheet, PracticeList } from '../mobile/PracticesMobile'
import { PracticeSheet } from '../mobile/PracticeSheet'

const LIST_PATH = '/settings/practices'

/**
 * Practices on tablet and desktop: the list in a column, Add and Edit in a panel beside it.
 * /settings/practices/new and /settings/practices/:id pick what the panel shows; with no practices it opens Add.
 */
export function PracticesWide() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const desktop = useLayout() === 'desktop'
  const s = usePractices()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const close = () => navigate(LIST_PATH, { replace: true })
  const find = (pid?: string | null) => s.practices.find((p) => p.id === pid)
  const editing = find(id)
  const deleting = find(deletingId)
  const adding = !!useMatch('/settings/practices/new') || (s.isSuccess && !s.practices.length)

  if (id && s.isSuccess && !editing) return <Navigate to={LIST_PATH} replace />

  const page = (
    <div className="flex min-h-dvh">
      <div className={`flex shrink-0 flex-col gap-3.5 border-r border-ui-control ${desktop ? 'w-[500px] px-7 pt-9' : 'w-[360px] px-4 pt-[calc(28px+env(safe-area-inset-top))]'} pb-7`}>
        <div className="flex flex-col gap-0.5">
          <Link to="/settings" className="flex min-h-11 items-center gap-1 self-start text-[15px] font-bold text-ui-accent">
            <span aria-hidden>‹</span>{t('nav.settings')}
          </Link>
          <div className="flex items-center justify-between gap-3 pl-1">
            <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">{t('practices.title')}</h1>
            <Link to="/settings/practices/new" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-ui-accent-fill pr-4 pl-3 text-sm font-extrabold text-ui-ink">
              <span aria-hidden className="text-[22px] leading-none font-semibold">+</span>{t('practices.add')}
            </Link>
          </div>
        </div>
        <PracticeList s={s} selected={editing?.id} onDelete={setDeletingId} />
      </div>
      <div className="sticky top-0 flex h-dvh min-w-0 flex-1 flex-col">
        {adding || editing ? (
          <PracticeSheet panel key={editing?.id ?? 'new'} practice={editing} others={s.practices.filter((p) => p.id !== editing?.id)}
            busy={s.create.isPending || s.update.isPending} onClose={close}
            onSave={async (d) => {
              if (editing) await s.update.mutateAsync({ ...editing, ...d, dropdown_variants: d.dropdown_variants ?? undefined })
              else await s.create.mutateAsync(d)
              close()
            }}
            onDelete={editing && (() => setDeletingId(editing.id))} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-10 text-center">
            <span aria-hidden className="h-14 w-14 rounded-2xl border-2 border-dashed border-ui-faint" />
            <p className="max-w-[260px] text-[15px] leading-normal text-ui-muted">{t('practices.selectPrompt')}</p>
          </div>
        )}
      </div>
      {deleting && <DeleteSheet s={s} p={deleting} onDeleted={() => { if (editing?.id === deleting.id) close() }} onClose={() => setDeletingId(null)} />}
    </div>
  )
  return desktop ? <DesktopShell log={false}>{() => page}</DesktopShell> : <TabletShell>{page}</TabletShell>
}
