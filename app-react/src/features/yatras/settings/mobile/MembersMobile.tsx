import { useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLayout } from '../../../../layouts/useLayout'
import type { YatraUser } from '../../../../types/api'
import { initials } from '../../../../ui/initials'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import { Toggle } from '../../../../ui/primitives/Toggle'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, BTN, CARD, HINT, LIST } from './AdminPage'
import { ConfirmSheet, SheetHeader } from './fields'
import { membersLine } from './summaries'

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ui-accent-pill text-sm font-extrabold text-ui-accent">
      {initials(name)}
    </span>
  )
}

function Badge({ accent, children }: { accent?: boolean; children: ReactNode }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${accent ? 'bg-ui-accent-pill text-ui-accent' : 'bg-ui-chip text-ui-ink2'}`}>
      {children}
    </span>
  )
}

export function MembersMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const a = useYatraAdmin(id)
  const desktop = useLayout() === 'desktop'
  const [openId, setOpenId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [dropping, setDropping] = useState(false)
  const close = () => { setOpenId(null); setRemoving(false); setDropping(false) }
  return (
    <AdminPage admin={a} title={t('yatraSettings.membersTitle')} wide>
      {() => {
        const member = a.users.find((u) => u.user_id === openId)
        const admins = a.users.filter((u) => u.is_admin).length
        const lastAdmin = !!member?.is_admin && admins === 1
        const isMe = !!member && member.user_id === a.me?.user_id
        // Your own role can't be undone (only an admin may toggle it back): that asks first.
        const toggle = (u: YatraUser) => {
          if (u.user_id === a.me?.user_id && u.is_admin) { setOpenId(u.user_id); setDropping(true) } else a.toggleAdmin(u)
        }
        return (
          <>
            <p className={`${HINT} px-1.5`}>{`${membersLine(t, a.users)}. ${t('yatraSettings.oneAdminRule')}`}</p>
            {desktop ? (
              // Desktop: each row has its own Admin toggle and Remove; no member sheet.
              <ul className={LIST}>
                {a.users.map((u) => {
                  const me = u.user_id === a.me?.user_id
                  const last = u.is_admin && admins === 1
                  return (
                    <li key={u.user_id} className="flex min-h-[60px] items-center gap-3 bg-ui-surface px-4 py-2">
                      <Avatar name={u.user_name} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[15px] font-semibold text-ui-ink">{u.user_name}</span>
                          {me && <Badge>{t('yatraSettings.you')}</Badge>}
                          {u.is_admin && <Badge accent>{t('yatraSettings.admin')}</Badge>}
                        </span>
                        {last && <span id={`last-${u.user_id}`} className="text-xs text-ui-muted">{t('yatraSettings.lastAdminToggle')}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[13px] font-semibold text-ui-muted">
                        <span aria-hidden>{t('yatraSettings.admin')}</span>
                        <Toggle checked={u.is_admin} disabled={last} label={`${t('yatraSettings.admin')}: ${u.user_name}`}
                          describedBy={last ? `last-${u.user_id}` : undefined} onChange={() => toggle(u)} />
                      </span>
                      <span aria-hidden className="h-7 w-px shrink-0 bg-ui-hairline" />
                      <span className="flex w-[76px] shrink-0 justify-end">
                        {me ? <span aria-hidden className="text-ui-faint2">—</span> : (
                          <button type="button" onClick={() => { setOpenId(u.user_id); setRemoving(true) }}
                            aria-label={t('yatraSettings.removeTitle', { name: u.user_name })} className="min-h-9 px-1 text-[13px] font-bold text-ui-danger">
                            {t('yatraSettings.remove')}
                          </button>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
            <ul className={LIST}>
              {a.users.map((u) => (
                <li key={u.user_id}>
                  <button type="button" onClick={() => setOpenId(u.user_id)} className="flex min-h-[60px] w-full items-center gap-3 bg-ui-surface px-4 py-2 text-left">
                    <Avatar name={u.user_name} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ui-ink">{u.user_name}</span>
                    {u.user_id === a.me?.user_id && <Badge>{t('yatraSettings.you')}</Badge>}
                    {u.is_admin && <Badge accent>{t('yatraSettings.admin')}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
            )}
            {member && !removing && !dropping && (
              <BottomSheet label={member.user_name} onClose={close}>
                <SheetHeader title={member.user_name} onClose={close}><Avatar name={member.user_name} /></SheetHeader>
                <div className={`${CARD} flex items-start gap-3 p-4`}>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[15px] font-bold text-ui-ink">{t('yatraSettings.admin')}</span>
                    <span id="admin-hint" className={HINT}>{lastAdmin ? t('yatraSettings.lastAdminToggle') : t('yatraSettings.adminHint')}</span>
                  </div>
                  <Toggle checked={member.is_admin} disabled={lastAdmin} label={t('yatraSettings.admin')} describedBy="admin-hint"
                    onChange={() => toggle(member)} />
                </div>
                {!isMe && (
                  <button type="button" onClick={() => setRemoving(true)} className={`${BTN} border border-ui-control text-ui-danger`}>
                    {t('yatraSettings.removeMember')}
                  </button>
                )}
              </BottomSheet>
            )}
            {member && dropping && (
              <ConfirmSheet title={t('yatraSettings.dropAdminTitle')} text={t('yatraSettings.dropAdminText')}
                confirm={t('yatraSettings.dropAdminConfirm')} busy={a.dropOwnAdmin.isPending} onClose={close}
                onConfirm={() => a.dropOwnAdmin.mutate(undefined, { onSettled: close })} />
            )}
            {member && removing && (
              <ConfirmSheet title={t('yatraSettings.removeTitle', { name: member.user_name })} text={t('yatraSettings.removeText')}
                confirm={t('yatraSettings.remove')} busy={a.removeMember.isPending} onClose={close}
                onConfirm={() => a.removeMember.mutate(member, { onSettled: close })} />
            )}
          </>
        )
      }}
    </AdminPage>
  )
}
