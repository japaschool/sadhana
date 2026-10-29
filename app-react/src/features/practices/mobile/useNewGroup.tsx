import { useState } from 'react'
import { GroupSheet } from './GroupSheet'
import type { Practices } from './PracticesMobile'

/** The practice editor's "+ New group": `ask` opens the name sheet and resolves with the new id (null if closed); render `sheet`. */
export function useNewGroup(s: Practices) {
  const [resolve, setResolve] = useState<((id: string | null) => void) | null>(null)
  // A second ask settles the first, so no caller waits forever.
  const ask = () => { resolve?.(null); return new Promise<string | null>((r) => setResolve(() => r)) }
  const done = (id: string | null) => { resolve?.(id); setResolve(null) }
  const sheet = resolve && (
    <GroupSheet others={s.groups} busy={s.createGroup.isPending} onClose={() => done(null)}
      onSave={(name) => s.createGroup.mutateAsync(name).then(done)} />
  )
  return { ask, sheet }
}
