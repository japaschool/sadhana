import { apiClient } from './client'
import type { InsightPrefs } from '../features/insights/overview/prefs'

export const insightPrefsApi = {
  /** null when the user never saved prefs (or the answer isn't the expected shape). */
  async get(): Promise<unknown | null> {
    const res = await apiClient.get<{ prefs: unknown } | undefined>('/user/insight-prefs')
    return res.data?.prefs ?? null
  },
  async save(prefs: InsightPrefs): Promise<void> {
    await apiClient.put('/user/insight-prefs', { prefs })
  },
}

export const INSIGHT_PREFS_KEY = ['insight-prefs'] as const
