import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { SleepRows } from '../../../api/charts'
import { INSIGHT_PREFS_KEY, insightPrefsApi } from '../../../api/insightPrefs'
import { useToast } from '../../../hooks/useToast'

export interface InsightPrefs {
  streaks: boolean
  suggest: boolean
  sleep: SleepRows | 'skip' | null
  dismissed: string[]
  openAsked: Record<string, string>
  /** Overview row overrides by row key; a row without one shows by its default. */
  visibility: Record<string, boolean>
}

/** Where prefs lived before the server kept them; older cached builds still use it. */
const KEY = 'sadhana.insights'
export const DEFAULT_PREFS: InsightPrefs = { streaks: false, suggest: true, sleep: null, dismissed: [], openAsked: {}, visibility: {} }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function parsePrefs(v: unknown): InsightPrefs {
  if (!isObj(v)) return DEFAULT_PREFS
  const sleep = v.sleep
  return {
    streaks: typeof v.streaks === 'boolean' ? v.streaks : DEFAULT_PREFS.streaks,
    suggest: typeof v.suggest === 'boolean' ? v.suggest : DEFAULT_PREFS.suggest,
    sleep: sleep === 'skip' ? 'skip'
      : isObj(sleep) && typeof sleep.bedtime === 'string' && typeof sleep.wake === 'string'
        ? { bedtime: sleep.bedtime, wake: sleep.wake, nap: typeof sleep.nap === 'string' ? sleep.nap : null }
        : null,
    dismissed: Array.isArray(v.dismissed) ? v.dismissed.filter((x): x is string => typeof x === 'string') : [],
    openAsked: isObj(v.openAsked)
      ? Object.fromEntries(Object.entries(v.openAsked).filter((e): e is [string, string] => typeof e[1] === 'string'))
      : {},
    visibility: isObj(v.visibility)
      ? Object.fromEntries(Object.entries(v.visibility).filter((e): e is [string, boolean] => typeof e[1] === 'boolean'))
      : {},
  }
}

/** The pre-server prefs, or null when there are none (or storage is blocked). */
function readLocal(): InsightPrefs | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    try { return parsePrefs(JSON.parse(raw)) } catch { return DEFAULT_PREFS }
  } catch {
    return null
  }
}

function removeLocal(): void {
  try { localStorage.removeItem(KEY) } catch { /* blocked storage: nothing to remove */ }
}

/** Loads the server's prefs, moving the local ones there the first time. A failed move fails the query and keeps the local key. */
async function load(): Promise<InsightPrefs> {
  const server = await insightPrefsApi.get()
  let local: InsightPrefs | null = null
  if (server === null) {
    local = readLocal()
    if (local) await insightPrefsApi.save(local)
  }
  removeLocal()
  return server === null ? (local ?? DEFAULT_PREFS) : parsePrefs(server)
}

/** `ready`: the server has answered. Until then prefs come from the local key (or defaults) and first-run prompts wait. */
export function useInsightPrefs(): [InsightPrefs, (patch: Partial<InsightPrefs>) => void, boolean] {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const q = useQuery({ queryKey: INSIGHT_PREFS_KEY, queryFn: load })
  const prefs = useMemo(() => q.data ?? readLocal() ?? DEFAULT_PREFS, [q.data])

  const save = useMutation({
    mutationFn: ({ next }: { next: InsightPrefs; prev: InsightPrefs | undefined }) => insightPrefsApi.save(next),
    onError: (_e, { prev }) => {
      if (prev) qc.setQueryData(INSIGHT_PREFS_KEY, prev)
      else void qc.resetQueries({ queryKey: INSIGHT_PREFS_KEY })
      showToast({ message: t('common.error'), variant: 'error' })
    },
  })

  // Optimistic, written before the mutation starts so every reader sees it in the same render.
  const setPrefs = (patch: Partial<InsightPrefs>) => {
    const prev = qc.getQueryData<InsightPrefs>(INSIGHT_PREFS_KEY)
    const next = { ...(prev ?? readLocal() ?? DEFAULT_PREFS), ...patch }
    void qc.cancelQueries({ queryKey: INSIGHT_PREFS_KEY })
    qc.setQueryData(INSIGHT_PREFS_KEY, next)
    save.mutate({ next, prev })
  }
  return [prefs, setPrefs, q.data !== undefined]
}
