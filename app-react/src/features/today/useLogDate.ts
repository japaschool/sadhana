import { create } from 'zustand'
import { isSameDay } from './date'

// null means "today", so a log left open overnight moves on to the new day.
const useStore = create<{ picked: Date | null }>(() => ({ picked: null }))

/** The log's selected day, shared by every screen and layout for the session. */
export function useLogDate(): [Date, (d: Date) => void] {
  const picked = useStore((s) => s.picked)
  return [picked ?? new Date(), (d) => useStore.setState({ picked: isSameDay(d, new Date()) ? null : d })]
}
