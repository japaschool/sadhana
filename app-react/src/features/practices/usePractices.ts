import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { practicesApi } from '../../api/practices'
import { useToast } from '../../hooks/useToast'
import type { PracticeDataType, UserPractice } from '../../types/api'

export const NAME_MAX = 64
export const LIST_MAX = 1024

export interface PracticeDraft { practice: string; data_type: PracticeDataType; is_active: boolean; is_required: boolean; dropdown_variants: string | null }

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
  const practices = q.data ?? []
  const refresh = () => qc.invalidateQueries({ queryKey: ['practices'] })
  const failed = () => showToast({ message: t('common.error'), variant: 'error' })

  const create = useMutation({
    mutationFn: (d: PracticeDraft) => practicesApi.createUserPractice({
      practice: d.practice, data_type: d.data_type, is_required: d.is_required || undefined, dropdown_variants: d.dropdown_variants ?? undefined,
    }),
    onSuccess: refresh,
  })

  const update = useMutation({
    mutationFn: (p: UserPractice) => practicesApi.updateUserPractice(p.id, fields(p)),
    onSuccess: refresh,
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

  /** Moves the list at once; a failed save puts the server's order back. */
  const reorder = useMutation({
    mutationFn: (ids: string[]) => practicesApi.reorderUserPractices(ids),
    onMutate: (ids) => {
      const byId = new Map(practices.map((p) => [p.id, p]))
      qc.setQueryData<UserPractice[]>(['practices'], ids.map((id) => byId.get(id)!))
    },
    onSuccess: () => showToast({ message: t('practices.orderSaved'), variant: 'success' }),
    onError: () => { failed(); void refresh() },
  })

  return { ...q, practices, create, update, setActive, remove, reorder }
}
