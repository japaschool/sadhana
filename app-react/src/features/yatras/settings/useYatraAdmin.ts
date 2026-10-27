import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../../api/yatras'
import { useToast } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { PracticeDataType, Yatra, YatraPractice, YatraStatisticConfig, YatraUser } from '../../../types/api'
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

  // PUT /yatra/:id replaces all three fields, so always send the statistics too. A statistic whose practice
  // is gone (an Undo from before a delete) would break the yatra's table, so it's never sent.
  function sendYatra(y: Yatra) {
    const known = qc.getQueryData<YatraPractice[]>(practicesKey)
    const stats = y.statistics && known
      ? { ...y.statistics, statistics: y.statistics.statistics.filter((s) => known.some((p) => p.id === s.practice_id)) }
      : y.statistics ?? null
    return yatrasApi.updateYatra(yatraId, { name: y.name, show_stability_metrics: y.show_stability_metrics, statistics: stats })
  }
  const practicesNow = () => qc.getQueryData<YatraPractice[]>(practicesKey) ?? []

  /** Only the patched fields change, and Undo puts back only those, so quick edits in a row keep each other. */
  function saveYatra(patch: Partial<YatraFields>, message: string, undoable = true) {
    const cur = qc.getQueryData<Yatra>(yatraKey)
    if (!cur) return
    const was = Object.fromEntries(Object.keys(patch).map((k) => [k, cur[k as keyof YatraFields]])) as Partial<YatraFields>
    void queueYatra({ apply: (c) => ({ ...c, ...patch }), revert: (c) => ({ ...c, ...was }) }, sendYatra, message, undoable)
  }

  /** Sets some fields of one practice; a practice that's gone is left alone. */
  const patchPractice = (id: string, fields: Partial<YatraPractice>) => (list: YatraPractice[]) =>
    list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? { ...x, ...fields } : x)) : list

  function savePractice(p: YatraPractice, message: string, undoable = true) {
    const was = practicesNow().find((x) => x.id === p.id)
    if (!was) return
    const keys = [...new Set([...Object.keys(p), ...Object.keys(was)])] as (keyof YatraPractice)[]
    const changed = keys.filter((k) => JSON.stringify(p[k] ?? null) !== JSON.stringify(was[k] ?? null))
    const pick = (x: YatraPractice) => Object.fromEntries(changed.map((k) => [k, x[k] ?? null])) as Partial<YatraPractice>
    void queuePractices(
      { apply: patchPractice(p.id, pick(p)), revert: patchPractice(p.id, pick(was)) },
      (list) => {
        const x = list.find((y) => y.id === p.id)
        return x ? yatrasApi.updateYatraPractice(yatraId, x) : Promise.resolve()
      },
      message, undoable,
    )
  }

  /** In the order of `ids`; practices not in it (added since) keep their place at the end. */
  const ordered = (ids: string[]) => (list: YatraPractice[]) => {
    const pos = new Map(ids.map((id, i) => [id, i]))
    return [...list].sort((x, y) => (pos.get(x.id) ?? ids.length) - (pos.get(y.id) ?? ids.length))
  }

  function reorder(ids: string[]) {
    const was = practicesNow().map((p) => p.id)
    void queuePractices({ apply: ordered(ids), revert: ordered(was) },
      (list) => yatrasApi.reorderPractices(yatraId, list.map((p) => p.id)), t('yatraSettings.reordered'))
  }

  function toggleAdmin(u: YatraUser) {
    // The toggle is its own inverse: Undo flips the same member back with the same request.
    const flip = (users: YatraUser[]) => users.map((x) => (x.user_id === u.user_id ? { ...x, is_admin: !x.is_admin } : x))
    void queueUsers({ apply: flip, revert: flip }, () => yatrasApi.toggleAdmin(yatraId, u.user_id),
      t(u.is_admin ? 'yatraSettings.adminRemoved' : 'yatraSettings.adminAdded', { name: u.user_name }))
  }

  // Dropping your own role can't be undone (only an admin may toggle), so it waits for the server.
  const dropOwnAdmin = useMutation({
    mutationFn: () => yatrasApi.toggleAdmin(yatraId, userId!),
    onSuccess: () => showToast({ message: t('yatraSettings.ownAdminDropped'), variant: 'success' }),
    onError: failed,
    onSettled: () => { void qc.invalidateQueries({ queryKey: usersKey }) },
  })

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
      const orig = qc.getQueryData<Yatra>(yatraKey)?.statistics?.statistics ?? []
      const uses = (s: YatraStatisticConfig) => s.practice_id === p.id
      const withStats = (f: (list: YatraStatisticConfig[]) => YatraStatisticConfig[]) => (y: Yatra) =>
        (y.statistics ? { ...y, statistics: { ...y.statistics, statistics: f(y.statistics.statistics) } } : y)
      const drop = withStats((list) => list.filter((s) => !uses(s)))
      // Back in their old places, around any edits made since.
      const restore = withStats((list) => [...orig.filter((s) => uses(s) || list.includes(s)), ...list.filter((s) => !orig.includes(s))])
      // Statistics on this practice go first, in line with other yatra saves; if that fails, the practice stays.
      const hasStats = orig.some(uses)
      if (hasStats && !(await queueYatra({ apply: drop, revert: restore }, sendYatra))) throw new Error('statistics')
      try {
        await yatrasApi.deleteYatraPractice(yatraId, p.id)
      } catch (e) {
        if (hasStats) await queueYatra({ apply: restore, revert: drop }, sendYatra)
        throw e
      }
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
    saveYatra, savePractice, reorder, toggleAdmin, dropOwnAdmin, statCount,
    createPractice, deletePractice, removeMember, deleteYatra,
  }
}

export type YatraAdmin = ReturnType<typeof useYatraAdmin>
