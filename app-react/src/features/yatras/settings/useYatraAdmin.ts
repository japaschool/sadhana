import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../../api/yatras'
import { useToast } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { PracticeDataType, Yatra, YatraPractice, YatraUser } from '../../../types/api'
import { useQueuedSave } from './useQueuedSave'

type YatraFields = Pick<Yatra, 'name' | 'show_stability_metrics' | 'statistics'>

/** What the admin screens read and change for one yatra. */
export function useYatraAdmin(yatraId: string) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const userId = useAuthStore((s) => s.user?.id)
  const yatraKey = ['yatra', yatraId]
  const practicesKey = ['yatra-practices', yatraId]
  const usersKey = ['yatra-users', yatraId]

  const yatraQ = useQuery({ queryKey: yatraKey, queryFn: () => yatrasApi.getYatra(yatraId) })
  const practicesQ = useQuery({ queryKey: practicesKey, queryFn: () => yatrasApi.getYatraPractices(yatraId) })
  const usersQ = useQuery({ queryKey: usersKey, queryFn: () => yatrasApi.getYatraUsers(yatraId) })

  // The yatra screen and its switcher show names, columns and tiles from these.
  const refreshTable = () => {
    void qc.invalidateQueries({ queryKey: ['yatra-data', yatraId] })
    void qc.invalidateQueries({ queryKey: ['yatras'] })
  }
  const failed = () => showToast({ message: t('common.error'), variant: 'error' })

  const queueYatra = useQueuedSave<Yatra>(yatraKey, refreshTable)
  const queuePractices = useQueuedSave<YatraPractice[]>(practicesKey, refreshTable)
  const queueUsers = useQueuedSave<YatraUser[]>(usersKey)

  // PUT /yatra/:id replaces all three fields, so always send the statistics too.
  const sendYatra = (y: Yatra) =>
    yatrasApi.updateYatra(yatraId, { name: y.name, show_stability_metrics: y.show_stability_metrics, statistics: y.statistics ?? null })
  const practicesNow = () => qc.getQueryData<YatraPractice[]>(practicesKey) ?? []

  /** Builds on the cached yatra, so quick edits in a row keep each other. */
  function saveYatra(patch: Partial<YatraFields>, message: string, undoable = true) {
    const cur = qc.getQueryData<Yatra>(yatraKey)
    if (cur) queueYatra({ ...cur, ...patch }, sendYatra, message, undoable)
  }

  function savePractice(p: YatraPractice, message: string, undoable = true) {
    queuePractices(
      practicesNow().map((x) => (x.id === p.id ? p : x)),
      (list) => yatrasApi.updateYatraPractice(yatraId, list.find((x) => x.id === p.id)!),
      message, undoable,
    )
  }

  function reorder(ids: string[]) {
    const byId = new Map(practicesNow().map((p) => [p.id, p]))
    queuePractices(ids.map((id) => byId.get(id)!), (list) => yatrasApi.reorderPractices(yatraId, list.map((p) => p.id)), t('yatraSettings.reordered'))
  }

  function toggleAdmin(u: YatraUser) {
    const users = qc.getQueryData<YatraUser[]>(usersKey) ?? []
    // The toggle is its own inverse, so Undo sends the same request again.
    queueUsers(
      users.map((x) => (x.user_id === u.user_id ? { ...x, is_admin: !x.is_admin } : x)),
      () => yatrasApi.toggleAdmin(yatraId, u.user_id),
      t(u.is_admin ? 'yatraSettings.adminRemoved' : 'yatraSettings.adminAdded', { name: u.user_name }),
    )
  }

  const statCount = (practiceId: string) =>
    yatraQ.data?.statistics?.statistics.filter((s) => s.practice_id === practiceId).length ?? 0

  const createPractice = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: PracticeDataType }) => {
      const before = new Set(practicesNow().map((p) => p.id))
      await yatrasApi.createYatraPractice(yatraId, { practice: name, data_type: type })
      // The server doesn't return the new practice: find it in a fresh list.
      const list = await yatrasApi.getYatraPractices(yatraId)
      qc.setQueryData(practicesKey, list)
      return list.find((p) => !before.has(p.id))
    },
    onSuccess: (p) => {
      refreshTable()
      if (p) showToast({ message: t('yatraSettings.practiceAdded', { name: p.practice }), variant: 'success' })
    },
    onError: failed,
  })

  const deletePractice = useMutation({
    mutationFn: async (p: YatraPractice) => {
      const y = qc.getQueryData<Yatra>(yatraKey)
      const stats = y?.statistics
      // Statistics on this practice go first; if that fails, the practice stays.
      if (y && stats?.statistics.some((s) => s.practice_id === p.id)) {
        await sendYatra({ ...y, statistics: { ...stats, statistics: stats.statistics.filter((s) => s.practice_id !== p.id) } })
      }
      await yatrasApi.deleteYatraPractice(yatraId, p.id)
    },
    onSuccess: (_, p) => showToast({ message: t('yatraSettings.practiceDeleted', { name: p.practice }), variant: 'success' }),
    onError: failed,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: yatraKey })
      void qc.invalidateQueries({ queryKey: practicesKey })
      refreshTable()
    },
  })

  const removeMember = useMutation({
    mutationFn: (u: YatraUser) => yatrasApi.removeMember(yatraId, u.user_id),
    onSuccess: (_, u) => showToast({ message: t('yatraSettings.memberRemoved', { name: u.user_name }), variant: 'success' }),
    onError: failed,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: usersKey })
      refreshTable()
    },
  })

  const deleteYatra = useMutation({
    mutationFn: () => yatrasApi.deleteYatra(yatraId),
    onSuccess: () => {
      showToast({ message: t('yatraSettings.yatraDeleted', { name: yatraQ.data?.name }), variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['yatras'] })
    },
    onError: failed,
  })

  const users = usersQ.data ?? []
  const me = users.find((u) => u.user_id === userId)
  return {
    yatra: yatraQ.data,
    practices: practicesQ.data ?? [],
    users,
    me,
    isAdmin: !!me?.is_admin,
    isLoading: yatraQ.isLoading || practicesQ.isLoading || usersQ.isLoading,
    isError: yatraQ.isError || practicesQ.isError || usersQ.isError,
    saveYatra, savePractice, reorder, toggleAdmin, statCount,
    createPractice, deletePractice, removeMember, deleteYatra,
  }
}

export type YatraAdmin = ReturnType<typeof useYatraAdmin>
