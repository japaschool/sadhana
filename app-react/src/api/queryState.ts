/** Nothing to show, and the fetch failed or is waiting for the network. With data, a failed refetch
 *  keeps showing the last-known data (TanStack v5 sets status 'error' but keeps `data`). */
export const failedWithoutData = (q: { data: unknown; isError: boolean; isPaused: boolean }) =>
  q.data === undefined && (q.isError || q.isPaused)
