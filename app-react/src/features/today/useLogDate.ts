import { create } from 'zustand'
import { isSameDay, toDateStr } from './date'

// null means "today", so a log left open overnight moves on to the new day.
// `today` only exists to re-render the log when the app wakes up on a new day.
const useStore = create<{ picked: Date | null; today: string }>(() => ({ picked: null, today: toDateStr(new Date()) }))

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') useStore.setState({ today: toDateStr(new Date()) })
})

/** The log's selected day, shared by every screen and layout for the session. */
export function useLogDate(): [Date, (d: Date) => void] {
  const picked = useStore((s) => s.picked)
  useStore((s) => s.today)
  return [picked ?? new Date(), (d) => useStore.setState({ picked: isSameDay(d, new Date()) ? null : d })]
}
