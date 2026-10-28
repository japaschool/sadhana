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
    if (p) next[at].practices.push({ ...p, group_id: next[at].group.id })
  }
  return next
}

export function dropGroup(sections: Section[], activeGroupKey: string, overGroupKey: string): Section[] {
  const keys = sections.map((s) => headerId(s.group))
  const from = keys.indexOf(activeGroupKey)
  const to = keys.indexOf(overGroupKey)
  return from < 0 || to < 0 ? sections : arrayMove(sections, from, to)
}
