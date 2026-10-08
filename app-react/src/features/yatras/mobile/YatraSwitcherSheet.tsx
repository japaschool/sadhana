import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../../api/yatras'
import { useAuthStore } from '../../../store/authStore'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import type { Yatra } from '../../../types/api'

export function YatraSwitcherSheet({ yatras, currentId, onSelect, create, pending, onClose }: {
  yatras: Yatra[]; currentId?: string; onSelect: (id: string) => void
  create: (name: string) => void; pending: boolean; onClose: () => void
}) {
  const { t } = useTranslation()
  const userId = useAuthStore((s) => s.user?.id)
  const [name, setName] = useState('')
  // ponytail: one users call per yatra, only while the sheet is open; add counts to GET /yatras if lists get long.
  const users = useQueries({
    queries: yatras.map((y) => ({ queryKey: ['yatra-users', y.id], queryFn: () => yatrasApi.getYatraUsers(y.id) })),
  })
  const submit = () => { if (name.trim()) create(name.trim()) }

  return (
    <BottomSheet label={t('yatraSettings.yourYatras')} onClose={onClose}>
      <h2 className="text-xl font-extrabold text-ui-ink">{t('yatraSettings.yourYatras')}</h2>
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-ui-hairline bg-ui-hairline">
        {yatras.map((y, i) => {
          const list = users[i]?.data
          const admin = list?.find((u) => u.user_id === userId)?.is_admin
          return (
            <button key={y.id} type="button" onClick={() => { onSelect(y.id); onClose() }}
              className="flex min-h-[58px] items-center gap-3 bg-ui-surface px-4 py-2 text-left">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-bold text-ui-ink">{y.name}</span>
                {list && (
                  <span className="text-xs text-ui-muted">
                    {t(admin ? 'yatraSettings.roleAdmin' : 'yatraSettings.roleMember')} · {t('yatraSettings.members', { count: list.length })}
                  </span>
                )}
              </span>
              {y.id === currentId && <span aria-hidden className="font-extrabold text-ui-accent">✓</span>}
            </button>
          )
        })}
      </div>
      <section className="flex flex-col gap-2.5 rounded-2xl border border-ui-hairline bg-ui-surface p-4">
        <h3 className="text-[15px] font-extrabold text-ui-ink">{t('yatraSettings.newYatra')}</h3>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ui-muted">{t('yatraSettings.newName')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            className="h-[50px] rounded-[14px] border border-ui-control bg-ui-field px-4 font-semibold text-ui-ink outline-none" />
        </label>
        <p className="text-xs text-ui-muted">{t('yatraSettings.newHint')}</p>
        <button type="button" disabled={!name.trim() || pending} onClick={submit}
          className="h-[50px] rounded-[14px] bg-ui-primary text-[15px] font-bold text-ui-on-primary disabled:opacity-60">
          {t('yatraSettings.createYatra')}
        </button>
      </section>
    </BottomSheet>
  )
}
