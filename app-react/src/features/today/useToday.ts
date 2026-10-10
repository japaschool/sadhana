import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../api/practices'
import { failedWithoutData } from '../../api/queryState'
import { useToast } from '../../hooks/useToast'
import type { DiaryEntry, PracticeDataType, PracticeValue, UserPractice } from '../../types/api'
import { fromDateStr, nineDayWindow, toDateStr } from './date'
import { sameValue } from './values'

export interface TodaySummary { filled: number; total: number; requiredLeft: number }

/** Names are translation keys under home.starters. */
const STARTERS: { key: string; data_type: PracticeDataType }[] = [
  { key: 'wakeUp',     data_type: 'Time'     },
  { key: 'sleep',      data_type: 'Time'     },
  { key: 'reading',    data_type: 'Bool'     },
  { key: 'meditation', data_type: 'Duration' },
  { key: 'yoga',       data_type: 'Duration' },
]

const FAIL_FLASH_MS = 600

interface SaveVars { date: string; practice: UserPractice; value: PracticeValue | null }

export function useToday(date: Date) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const dateStr = toDateStr(date)
  const window9 = nineDayWindow(date)
  const from = toDateStr(window9[0])
  const to = toDateStr(window9[8])

  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const diaryQ = useQuery({ queryKey: ['diary', dateStr], queryFn: () => practicesApi.getDiaryEntries(dateStr) })
  const incompleteQ = useQuery({
    queryKey: ['incomplete-days', from, to],
    queryFn: () => practicesApi.getIncompleteDays(from, to),
  })

  const practices = (practicesQ.data ?? []).filter((p) => p.is_active)
  const values: Record<string, PracticeValue> = {}
  for (const e of diaryQ.data ?? []) if (e.value != null) values[e.practice] = e.value
  const isSet = (p: UserPractice) => values[p.practice] !== undefined
  const summary: TodaySummary = {
    filled: practices.filter(isSet).length,
    total: practices.length,
    requiredLeft: practices.filter((p) => p.is_required && !isSet(p)).length,
  }

  const [failed, setFailed] = useState<string | null>(null)
  const failTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(failTimer.current), [])

  // The date travels in the mutation variables so callbacks always target the
  // day the value was entered on, even if the user has moved to another day.
  // Without the worker, one scope runs saves one at a time, in order: values saved while typing ("4" then "45")
  // would otherwise race, and the server could keep the older one. With the worker, each save goes straight to it:
  // it orders them by arrival and keeps one value per practice, and a save held back here (up to 10 s each behind
  // the one before) would live only in page memory and be lost if the app were killed.
  const mutation = useMutation({
    scope: navigator.serviceWorker?.controller ? undefined : { id: 'diary-save' },
    mutationFn: ({ date, practice, value }: SaveVars) => practicesApi.saveDiaryEntry(date, practice.practice, value),
    onMutate: async ({ date, practice, value }) => {
      await qc.cancelQueries({ queryKey: ['diary', date] })
      const prev = qc.getQueryData<DiaryEntry[]>(['diary', date])
      qc.setQueryData<DiaryEntry[]>(['diary', date], (old = []) => [
        ...old.filter((e) => e.practice !== practice.practice),
        { practice: practice.practice, data_type: practice.data_type, value: value ?? undefined },
      ])
      return { prev }
    },
    onError: (_err, { date, practice }, ctx) => {
      if (ctx) qc.setQueryData(['diary', date], ctx.prev)
      showToast({ message: t('home.saveFailed'), variant: 'error' })
      setFailed(practice.practice)
      clearTimeout(failTimer.current)
      failTimer.current = setTimeout(() => setFailed(null), FAIL_FLASH_MS)
    },
    onSettled: (_data, _err, { date }) => {
      qc.invalidateQueries({ queryKey: ['diary', date] })
      qc.invalidateQueries({ queryKey: ['incomplete-days'] })
      qc.invalidateQueries({ queryKey: ['report-data'] })
    },
  })

  const save = (practice: UserPractice, value: PracticeValue | null) => {
    if (sameValue(values[practice.practice], value)) return
    mutation.mutate({ date: dateStr, practice, value })
  }

  const seed = useMutation({
    mutationFn: async () => {
      for (const { key, data_type } of STARTERS) await practicesApi.createUserPractice({ practice: t(`home.starters.${key}`), data_type }).catch(() => {})
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practices'] }),
  })

  // Refetch the open day when the app returns to the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') qc.invalidateQueries({ queryKey: ['diary', dateStr] })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [qc, dateStr])

  // Prefetch the rest of the visible window so tapping a day is instant.
  useEffect(() => {
    for (const d of nineDayWindow(fromDateStr(dateStr))) {
      const ds = toDateStr(d)
      if (ds === dateStr) continue
      qc.prefetchQuery({ queryKey: ['diary', ds], queryFn: () => practicesApi.getDiaryEntries(ds), staleTime: 60_000 })
    }
  }, [qc, dateStr])

  return {
    practices,
    values,
    summary,
    incomplete: new Set(incompleteQ.data ?? []),
    save,
    failed,
    // The day never blocks the screen: rows render from the practices; an unloaded day is blank and still editable
    // (each PUT sets one practice, so entering a value never touches the others on the server).
    isLoading: practicesQ.isLoading,
    isError: failedWithoutData(practicesQ),
    dayLoading: diaryQ.isLoading,
    dayFailed: failedWithoutData(diaryQ),
    seedStarters: () => seed.mutate(),
    isSeeding: seed.isPending,
  }
}
