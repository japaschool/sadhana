import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../../api/practices'
import { yatrasApi } from '../../../api/yatras'
import { useToast } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { UserPractice, YatraUserPracticeItem } from '../../../types/api'
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
  function save(change: (items: YatraUserPracticeItem[]) => YatraUserPracticeItem[], message: string) {
    const before = current()
    const after = change(before)
    const was = new Map(before.filter((r, i) => r !== after[i]).map((r) => [r.yatra_practice.id, r.user_practice]))
    const revert = (items: YatraUserPracticeItem[]) =>
      items.map((r) => (was.has(r.yatra_practice.id) ? { ...r, user_practice: was.get(r.yatra_practice.id)! } : r))
    void saveQueued({ apply: change, revert }, send, message)
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
    link, linkAll, leave,
  }
}
