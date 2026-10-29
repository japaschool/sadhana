import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { practicesApi } from '../../api/practices'
import { useToast } from '../../hooks/useToast'
import type { PracticeDataType, PracticeGroup, UserPractice } from '../../types/api'
import { groupPractices, layoutOf, moveToGroupEnd } from './groups'
import type { Layout } from './groups'

export const NAME_MAX = 64
export const LIST_MAX = 1024

export interface PracticeDraft { practice: string; data_type: PracticeDataType; is_active: boolean; is_required: boolean; dropdown_variants: string | null; group_id: string | null }

/** The server replaces every field on update, so each write sends the whole practice. */
const fields = (p: UserPractice) => ({
  practice: p.practice, data_type: p.data_type, is_active: p.is_active,
  is_required: p.is_required || undefined, dropdown_variants: p.dropdown_variants || undefined,
})

/** The server answers 422 when the name is taken (unique per user). */
export const isDuplicate = (e: unknown) => isAxiosError(e) && e.response?.status === 422

/** Your practices in Today's order, with the writes the Practices screen makes. */
export function usePractices() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const q = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  // Shared with Today. Failed: no groups, which gives the single default section.
  const groupsQ = useQuery({ queryKey: ['practice-groups'], queryFn: practicesApi.getGroups })
  const practices = q.data ?? []
  const groups = groupsQ.data ?? []
  const sections = groupPractices(groups, practices)
  const refresh = () => qc.invalidateQueries({ queryKey: ['practices'] })
  const refreshGroups = () => qc.invalidateQueries({ queryKey: ['practice-groups'] })
  const failed = () => showToast({ message: t('common.error'), variant: 'error' })
  // A taken name shows under the field instead.
  const failedUnlessTaken = (e: unknown) => { if (!isDuplicate(e)) failed() }

  const create = useMutation({
    mutationFn: ({ group_id, ...d }: PracticeDraft) => practicesApi.createUserPractice({
      practice: d.practice, data_type: d.data_type, is_required: d.is_required || undefined, dropdown_variants: d.dropdown_variants ?? undefined,
      ...(group_id && { group_id }),
    }),
    onSuccess: refresh,
    onError: failedUnlessTaken,
  })

  const update = useMutation({
    mutationFn: (p: UserPractice) => practicesApi.updateUserPractice(p.id, fields(p)),
    onSuccess: refresh,
    onError: failedUnlessTaken,
  })

  /** Hide and Show save straight away. */
  const setActive = useMutation({
    mutationFn: ({ p, active }: { p: UserPractice; active: boolean }) => practicesApi.updateUserPractice(p.id, { ...fields(p), is_active: active }),
    onSuccess: (_, { p, active }) => {
      showToast({ message: t(active ? 'practices.shown' : 'practices.hiddenToast', { name: p.practice }), variant: 'success' })
      return refresh()
    },
    onError: failed,
  })

  const remove = useMutation({
    mutationFn: (p: UserPractice) => practicesApi.deleteUserPractice(p.id),
    onSuccess: (_, p) => {
      qc.setQueryData<UserPractice[]>(['practices'], (list) => list?.filter((x) => x.id !== p.id))
      showToast({ message: t('practices.deleted', { name: p.practice }), variant: 'success' })
      return refresh()
    },
    onError: failed,
  })

  /** Resolves with the new group's id; it's added at the end, empty. */
  const createGroup = useMutation({
    mutationFn: (name: string) => practicesApi.createGroup(name),
    onSuccess: refreshGroups,
  })

  const renameGroup = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => practicesApi.renameGroup(id, name),
    onSuccess: refreshGroups,
  })

  /** Its practices move to the end of the default group. */
  const deleteGroup = useMutation({
    mutationFn: (g: PracticeGroup) => practicesApi.deleteGroup(g.id!),
    onSuccess: (_, g) => {
      showToast({ message: t('practices.deleted', { name: g.name }), variant: 'success' })
      return Promise.all([refresh(), refreshGroups()])
    },
    onError: failed,
  })

  /** Group order and each practice's group and place, shown at once; a failed save puts the cache back.
   *  Built from the cache, not this render: it may run right after an edit refetched, before a re-render. */
  const saveLayout = useMutation({
    mutationFn: (layout: Layout) => practicesApi.saveLayout(layout),
    onMutate: async (layout) => {
      await Promise.all([qc.cancelQueries({ queryKey: ['practices'] }), qc.cancelQueries({ queryKey: ['practice-groups'] })])
      const before = { practices: qc.getQueryData<UserPractice[]>(['practices']), groups: qc.getQueryData<PracticeGroup[]>(['practice-groups']) }
      const byId = new Map((before.practices ?? []).map((p) => [p.id, p]))
      qc.setQueryData<UserPractice[]>(['practices'], layout.practices.flatMap(({ id, group_id }) => {
        const p = byId.get(id)
        return p ? [{ ...p, group_id }] : []
      }))
      // A group made a moment ago may not be loaded yet: it shows once the groups refetch.
      const byGroup = new Map(groupPractices(before.groups ?? [], []).map((s) => [s.group.id, s.group]))
      qc.setQueryData<PracticeGroup[]>(['practice-groups'], layout.groups.flatMap((id) => byGroup.get(id) ?? []))
      return before
    },
    onSuccess: () => showToast({ message: t('practices.orderSaved'), variant: 'success' }),
    onError: (_, __, before) => {
      failed()
      qc.setQueryData(['practices'], before?.practices)
      qc.setQueryData(['practice-groups'], before?.groups)
    },
    onSettled: () => Promise.all([refresh(), refreshGroups()]),
  })

  return {
    ...q, isLoading: q.isLoading || groupsQ.isLoading, groupsLoaded: groupsQ.isSuccess,
    practices, groups, sections, create, update, setActive, remove, createGroup, renameGroup, deleteGroup, saveLayout,
  }
}

/** A group with a route: any but the default one. */
export const findGroup = (s: ReturnType<typeof usePractices>, gid?: string) => (gid ? s.groups.find((g) => !g.is_default && g.id === gid) : undefined)
export const sectionOf = (s: ReturnType<typeof usePractices>, g: PracticeGroup) => s.sections.find((x) => x.group.id === g.id)!

export const saveGroup = (s: ReturnType<typeof usePractices>, g: PracticeGroup | undefined, name: string): Promise<unknown> =>
  g ? s.renameGroup.mutateAsync({ id: g.id!, name }) : s.createGroup.mutateAsync(name)

/** Moves a saved practice to the end of its new group; a group made a moment ago may not be in `s.sections` yet. */
export function saveGroupMove(s: ReturnType<typeof usePractices>, practiceId: string, groupId: string | null) {
  const sections = s.sections.some((x) => x.group.id === groupId) ? s.sections : [...s.sections, { group: { id: groupId, name: '', is_default: false }, practices: [] }]
  return s.saveLayout.mutateAsync(layoutOf(moveToGroupEnd(sections, practiceId, groupId)))
}
