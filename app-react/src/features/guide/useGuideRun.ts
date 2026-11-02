import { useCallback, useEffect, useMemo, useRef } from 'react'
import { guideApi } from '../../api/guide'
import type { GuideOutcome, GuideRunUpdate, GuideStart } from '../../api/guide'

/** Records how far people get. Fire-and-forget: a failure is ignored and never holds the guide up. */
export function useGuideRun(from: GuideStart) {
  const started = useRef<Promise<string | null> | undefined>(undefined)
  const id = useCallback(() => (started.current ??= Promise.resolve().then(() => guideApi.start(from)).catch(() => null)), [from])
  useEffect(() => { void id() }, [id]) // the first request, once per mount
  const send = useCallback((body: GuideRunUpdate) => {
    void id().then((runId) => { if (runId) return guideApi.update(runId, body) }).catch(() => {})
  }, [id])
  return useMemo(() => ({
    mark: (last_step: string) => send({ last_step }),
    end: (outcome: GuideOutcome, hasReader?: boolean) => send({ outcome, ...(hasReader !== undefined && { has_reader: hasReader }) }),
  }), [send])
}
