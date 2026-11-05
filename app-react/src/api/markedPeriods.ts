import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { failedWithoutData } from './queryState'

export interface MarkedPeriod {
  id: string
  name: string
  start_date: string
  /** null while the period is ongoing. */
  end_date: string | null
  exclude_from_usual: boolean
}

export type MarkedPeriodForm = Omit<MarkedPeriod, 'id'>

export const markedPeriodsApi = {
  async list(): Promise<MarkedPeriod[]> {
    const res = await apiClient.get<{ periods: MarkedPeriod[] }>('/marked-periods')
    return res.data.periods
  },
  async create(form: MarkedPeriodForm): Promise<string> {
    const res = await apiClient.post<{ id: string }>('/marked-periods', form)
    return res.data.id
  },
  async update(id: string, form: MarkedPeriodForm): Promise<void> {
    await apiClient.put(`/marked-period/${id}`, form)
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/marked-period/${id}`)
  },
}

export const MARKED_PERIODS_KEY = ['marked-periods'] as const

const NONE: MarkedPeriod[] = []

/** `isError`: the fetch failed (or waits for the network) and there is no cached list to show. */
export function useMarkedPeriods(): { periods: MarkedPeriod[]; isLoading: boolean; isError: boolean } {
  const q = useQuery({ queryKey: MARKED_PERIODS_KEY, queryFn: markedPeriodsApi.list })
  return { periods: q.data ?? NONE, isLoading: q.isLoading, isError: failedWithoutData(q) }
}

/** Creates a period, or updates the one with `id`. Errors (a 422 for a bad form) surface through the mutation. */
export function useSavePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, form }: { id?: string; form: MarkedPeriodForm }) =>
      id ? markedPeriodsApi.update(id, form) : markedPeriodsApi.create(form).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: MARKED_PERIODS_KEY }),
  })
}

export function useDeletePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markedPeriodsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: MARKED_PERIODS_KEY }),
  })
}
