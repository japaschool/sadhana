import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../../api/practices'
import { yatrasApi } from '../../../api/yatras'
import { useToast } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { UserPractice, YatraPractice, YatraUserPracticeItem } from '../../../types/api'
import { withLink, withLinks } from './linking'
import { useQueuedSave } from './useQueuedSave'

/** The member's links for one yatra. Each change is shown at once and saved in order; Undo puts back only the rows it changed. */
export function useLinkPractices(yatraId: string) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const userId = useAuthStore((s) => s.user?.id)
  const key = ['yatra-user-practices', yatraId]

  const yatrasQ = useQuery({ queryKey: ['yatras'], queryFn: yatrasApi.getYatras })
  const itemsQ = useQuery({ queryKey: key, queryFn: () => yatrasApi.getYatraUserPractices(yatraId) })
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const usersQ = useQuery({ queryKey: ['yatra-users', yatraId], queryFn: () => yatrasApi.getYatraUsers(yatraId) })

  const saveQueued = useQueuedSave<YatraUserPracticeItem[]>(key, () => { void qc.invalidateQueries({ queryKey: ['yatra-data', yatraId] }) })
  const send = (next: YatraUserPracticeItem[]) => yatrasApi.updateYatraUserPractices(yatraId, next)

  /** Undo puts back only the rows this change touched. */
  function save(change: (items: YatraUserPracticeItem[]) => YatraUserPracticeItem[], message?: string) {
    const before = current()
    const after = change(before)
    const was = new Map(before.filter((r, i) => r !== after[i]).map((r) => [r.yatra_practice.id, r.user_practice]))
    const revert = (items: YatraUserPracticeItem[]) =>
      items.map((r) => (was.has(r.yatra_practice.id) ? { ...r, user_practice: was.get(r.yatra_practice.id)! } : r))
    return saveQueued({ apply: change, revert }, send, message)
  }

  const current = () => qc.getQueryData<YatraUserPracticeItem[]>(key) ?? []

  function link(yatraPracticeId: string, name: string | null) {
    const items = current()
    const row = items.find((i) => i.yatra_practice.id === yatraPracticeId)!
    const message = name
      ? t('yatraSettings.linked', { mine: name, yatra: row.yatra_practice.practice })
      : t('yatraSettings.unlinkedToast', { yatra: row.yatra_practice.practice })
    save((list) => withLink(list, yatraPracticeId, name), message)
  }

  function linkAll(links: Map<string, UserPractice>) {
    save((list) => withLinks(list, links), t('yatraSettings.linkedMany', { count: links.size }))
  }

  /** Why a row was not created: a hidden practice of that name, an active one of another type, or the request failing. */
  const [notes, setNotes] = useState<Map<string, 'hidden' | 'type' | 'failed'>>(new Map())
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(0)
  // The offer stays up once made, so creating one row doesn't take the buttons off the others.
  const offered = useRef<boolean | null>(null)
  if (offered.current === null && practicesQ.data) offered.current = !practicesQ.data.some((p) => p.is_active)

  /** One practice per row with the yatra's name and type, then all of them linked. Never touches an existing practice. */
  async function createAndLink(rows: YatraPractice[]) {
    setCreating(true)
    setNotes(new Map())
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
    const found = (r: YatraPractice) => (qc.getQueryData<UserPractice[]>(['practices']) ?? []).find((p) => same(p.practice, r.practice))
    const stopped = new Map<string, 'hidden' | 'type' | 'failed'>()
    let made = 0
    try {
      for (const r of rows) {
        const have = found(r)
        if (have && !have.is_active) { stopped.set(r.id, 'hidden'); continue }
        if (have && have.data_type !== r.data_type) { stopped.set(r.id, 'type'); continue }
        if (have) continue
        try {
          await practicesApi.createUserPractice({ practice: r.practice.trim(), data_type: r.data_type })
          made++
          // The create route returns no id: read the list back before linking.
          await qc.invalidateQueries({ queryKey: ['practices'] })
        } catch { stopped.set(r.id, 'failed') }
      }
      await qc.invalidateQueries({ queryKey: ['practices'] })
      const links = new Map(rows.flatMap((r) => {
        const p = found(r)
        return !stopped.has(r.id) && p?.is_active && p.data_type === r.data_type ? [[r.id, p] as const] : []
      }))
      if (links.size) {
        // Quietly: no undo for creation, everything can be changed in My practices.
        if (!(await save((list) => withLinks(list, links)))) showToast({ message: t('common.error'), variant: 'error' })
        else setCreated((n) => n + made)
      }
      setNotes(stopped)
    } finally { setCreating(false) }
  }

  const leave = useMutation({
    mutationFn: () => yatrasApi.leaveYatra(yatraId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['yatras'] }) },
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
  })

  const users = usersQ.data ?? []
  return {
    yatras: yatrasQ.data ?? [],
    yatra: yatrasQ.data?.find((y) => y.id === yatraId),
    items: itemsQ.data ?? [],
    practices: practicesQ.data ?? [],
    users,
    me: users.find((u) => u.user_id === userId),
    isLoading: yatrasQ.isLoading || itemsQ.isLoading || practicesQ.isLoading || usersQ.isLoading,
    isError: yatrasQ.isError || itemsQ.isError || practicesQ.isError || usersQ.isError,
    link, linkAll, leave, createAndLink, creating, created, notes, canCreate: offered.current === true,
  }
}
