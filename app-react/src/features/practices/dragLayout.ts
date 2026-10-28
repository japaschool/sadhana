import { arrayMove } from '@dnd-kit/sortable'
import type { PracticeGroup } from '../../types/api'
import type { Section } from './groups'

/** The list is one sortable sequence: a header per group, its practices, or a drop zone while it's empty. */
export const groupKey = (g: PracticeGroup) => g.id ?? 'default'
export const headerId = (g: PracticeGroup) => `hdr:${groupKey(g)}`
export const emptyId = (g: PracticeGroup) => `empty:${groupKey(g)}`
export const practiceId = (id: string) => `p:${id}`

/** Only the headers while a group is dragged. */
export function flatItems(sections: Section[], collapsed: boolean): string[] {
  return sections.flatMap((s) => [
    headerId(s.group),
    ...(collapsed ? [] : s.practices.length ? s.practices.map((p) => practiceId(p.id)) : [emptyId(s.group)]),
  ])
}

/** A practice belongs to the nearest header above where it's dropped; above the first one, to the first group. */
export function dropPractice(sections: Section[], activeId: string, overId: string): Section[] {
  const items = flatItems(sections, false)
  const from = items.indexOf(activeId)
  const to = items.indexOf(overId)
  if (from < 0 || to < 0) return sections
  const byId = new Map(sections.flatMap((s) => s.practices.map((p) => [practiceId(p.id), p])))
  const byHeader = new Map(sections.map((s) => [headerId(s.group), s.group]))
  const next: Section[] = sections.map((s) => ({ group: s.group, practices: [] }))
  let at = 0
  for (const item of arrayMove(items, from, to)) {
    const header = byHeader.get(item)
    if (header) at = sections.findIndex((s) => s.group === header)
    const p = byId.get(item)
    // Only the dropped one changes group; the rest keep theirs, which may be a group not known here.
    if (p) next[at].practices.push(item === activeId ? { ...p, group_id: next[at].group.id } : p)
  }
  return next
}

/** While a practice is dragged into another group it moves there at once, so that group's list makes room for it:
 *  before or after the row it's over, first in an empty group, and over a header first in that group, or last in the
 *  one above when `below` is false. Within its own group it doesn't move (the sortable shifts the rows instead). */
export function movePractice(sections: Section[], activeId: string, overId: string, below: boolean): Section[] {
  const from = sections.findIndex((s) => s.practices.some((p) => practiceId(p.id) === activeId))
  let to = sections.findIndex((s) => headerId(s.group) === overId || emptyId(s.group) === overId || s.practices.some((p) => practiceId(p.id) === overId))
  if (from < 0 || to < 0) return sections
  let at = 0
  if (overId.startsWith('hdr:')) {
    if (!below && to > 0) { to -= 1; at = sections[to].practices.length }
  } else if (overId.startsWith('p:')) at = sections[to].practices.findIndex((p) => practiceId(p.id) === overId) + (below ? 1 : 0)
  if (to === from) return sections
  const moved = sections[from].practices.find((p) => practiceId(p.id) === activeId)!
  return sections.map((s, i) => {
    if (i === from) return { ...s, practices: s.practices.filter((p) => p !== moved) }
    if (i === to) return { ...s, practices: s.practices.toSpliced(at, 0, { ...moved, group_id: s.group.id }) }
    return s
  })
}

export function dropGroup(sections: Section[], activeId: string, overId: string): Section[] {
  const keys = sections.map((s) => headerId(s.group))
  const from = keys.indexOf(activeId)
  const to = keys.indexOf(overId)
  return from < 0 || to < 0 ? sections : arrayMove(sections, from, to)
}
