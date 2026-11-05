import { useSyncExternalStore } from 'react'
import type { SleepRows } from '../../../api/charts'

export interface InsightPrefs {
  streaks: boolean
  suggest: boolean
  sleep: SleepRows | 'skip' | null
  dismissed: string[]
  openAsked: Record<string, string>
}

const KEY = 'sadhana.insights'
export const DEFAULT_PREFS: InsightPrefs = { streaks: false, suggest: true, sleep: null, dismissed: [], openAsked: {} }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function parse(raw: string): InsightPrefs {
  let v: unknown
  try { v = JSON.parse(raw) } catch { return DEFAULT_PREFS }
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
  }
}

let current = DEFAULT_PREFS
let lastRaw: string | null = null
const listeners = new Set<() => void>()

function snapshot(): InsightPrefs {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return current // Blocked storage: this visit keeps its in-memory state.
  }
  if (raw !== lastRaw) {
    lastRaw = raw
    current = raw === null ? DEFAULT_PREFS : parse(raw)
  }
  return current
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function update(patch: Partial<InsightPrefs>): void {
  current = { ...snapshot(), ...patch }
  const raw = JSON.stringify(current)
  try {
    localStorage.setItem(KEY, raw)
    lastRaw = raw
  } catch {
    // Blocked storage: the change lasts until reload.
  }
  listeners.forEach((fn) => fn())
}

export function useInsightPrefs(): [InsightPrefs, (patch: Partial<InsightPrefs>) => void] {
  return [useSyncExternalStore(subscribe, snapshot), update]
}
