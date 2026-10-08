import { useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../../hooks/useToast'

/** One edit to the cached value, and how to take just that edit back. Return `cur` itself when there is nothing to change. */
export interface Change<T> { apply: (cur: T) => T; revert: (cur: T) => T }

/**
 * Shows a change at once and sends it after earlier saves from this hook. Each send carries what's on screen
 * when its turn comes, so a failed change (taken back out) is never sent by the saves behind it.
 * Undo takes back only its own change. With no `message` it saves quietly and the caller handles failure.
 * Resolves true when saved.
 */
export function useQueuedSave<T>(key: QueryKey, onSaved?: () => void) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(0)
  const failed = useRef(false)

  return function save(change: Change<T>, send: (v: T) => Promise<void>, message?: string, undoable = true): Promise<boolean> {
    const cur = qc.getQueryData<T>(key)
    const next = cur === undefined ? cur : change.apply(cur)
    if (next === cur) return Promise.resolve(true)
    // A refetch landing now would overwrite the change on screen.
    void qc.cancelQueries({ queryKey: key })
    qc.setQueryData<T>(key, next)
    pending.current++
    const run = queue.current.then(async () => {
      try {
        await send(qc.getQueryData<T>(key) as T)
      } catch {
        failed.current = true
        qc.setQueryData<T>(key, (c) => (c === undefined ? c : change.revert(c)))
        if (message) showToast({ message: t('common.error'), variant: 'error' })
        return false
      } finally {
        // After a failure, the server is the truth again once nothing is in flight.
        if (--pending.current === 0 && failed.current) {
          failed.current = false
          void qc.invalidateQueries({ queryKey: key })
        }
      }
      if (message) {
        showToast({
          message, variant: 'success',
          action: undoable
            ? { label: t('common.undo'), onClick: () => { void save({ apply: change.revert, revert: change.apply }, send, t('yatraSettings.undone'), false) } }
            : undefined,
        })
      }
      onSaved?.()
      return true
    })
    queue.current = run
    return run
  }
}
