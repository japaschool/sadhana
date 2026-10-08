import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../../api/practices'
import { yatrasApi } from '../../../api/yatras'
import { useToast } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { UserPractice, YatraUserPracticeItem } from '../../../types/api'
import { withLink, withLinks } from './linking'

/** The member's links for one yatra. Each change is shown at once and saved in order; Undo resends the snapshot from before it. */
export function useLinkPractices(yatraId: string) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const userId = useAuthStore((s) => s.user?.id)
  const key = ['yatra-user-practices', yatraId]
  const queue = useRef<Promise<void>>(Promise.resolve())

  const yatrasQ = useQuery({ queryKey: ['yatras'], queryFn: yatrasApi.getYatras })
  const itemsQ = useQuery({ queryKey: key, queryFn: () => yatrasApi.getYatraUserPractices(yatraId) })
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const usersQ = useQuery({ queryKey: ['yatra-users', yatraId], queryFn: () => yatrasApi.getYatraUsers(yatraId) })

  function save(next: YatraUserPracticeItem[], message: string, undoable: boolean) {
    const prev = qc.getQueryData<YatraUserPracticeItem[]>(key) ?? []
    qc.setQueryData(key, next)
    queue.current = queue.current
      .then(() => yatrasApi.updateYatraUserPractices(yatraId, next))
      .then(
        () => {
          showToast({
            message, variant: 'success',
            action: undoable ? { label: t('common.undo'), onClick: () => save(prev, t('yatraSettings.undone'), false) } : undefined,
          })
          void qc.invalidateQueries({ queryKey: ['yatra-data', yatraId] })
        },
        () => {
          showToast({ message: t('common.error'), variant: 'error' })
          void qc.invalidateQueries({ queryKey: key })
        },
      )
  }

  const current = () => qc.getQueryData<YatraUserPracticeItem[]>(key) ?? []

  function link(yatraPracticeId: string, name: string | null) {
    const items = current()
    const row = items.find((i) => i.yatra_practice.id === yatraPracticeId)!
    const message = name
      ? t('yatraSettings.linked', { mine: name, yatra: row.yatra_practice.practice })
      : t('yatraSettings.unlinkedToast', { yatra: row.yatra_practice.practice })
    save(withLink(items, yatraPracticeId, name), message, true)
  }

  function linkAll(links: Map<string, UserPractice>) {
    save(withLinks(current(), links), t('yatraSettings.linkedMany', { count: links.size }), true)
  }

  const leave = useMutation({
    mutationFn: () => yatrasApi.leaveYatra(yatraId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['yatras'] }) },
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
  })

  const users = usersQ.data ?? []
  return {
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
