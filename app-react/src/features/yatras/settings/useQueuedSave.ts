import { useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../../hooks/useToast'

/** Shows `next` at once and sends it after earlier saves from this hook. Undo resends the value from before. */
export function useQueuedSave<T>(key: QueryKey, onSaved?: () => void) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const queue = useRef<Promise<void>>(Promise.resolve())

  return function save(next: T, send: (v: T) => Promise<void>, message: string, undoable = true) {
    const prev = qc.getQueryData<T>(key) as T
    qc.setQueryData(key, next)
    queue.current = queue.current
      .then(() => send(next))
      .then(
        () => {
          showToast({
            message, variant: 'success',
            action: undoable ? { label: t('common.undo'), onClick: () => save(prev, send, t('yatraSettings.undone'), false) } : undefined,
          })
          onSaved?.()
        },
        () => {
          showToast({ message: t('common.error'), variant: 'error' })
          void qc.invalidateQueries({ queryKey: key })
        },
      )
  }
}
