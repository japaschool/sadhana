import type { TFunction } from 'i18next'
import type { PracticeGroup, UserPractice, Layout } from '../../types/api'

export type { Layout }

export interface Section { group: PracticeGroup; practices: UserPractice[] }

const DEFAULT_GROUP: PracticeGroup = { id: null, name: '', is_default: true }

/** One section per group, in order (empty ones too); practices keep input order. */
export function groupPractices(groups: PracticeGroup[], practices: UserPractice[]): Section[] {
  const all = groups.some((g) => g.is_default) ? groups : [DEFAULT_GROUP, ...groups]
  const sections: Section[] = all.map((group) => ({ group, practices: [] }))
  const byId = new Map(sections.map((s) => [s.group.id, s]))
  const fallback = sections.find((s) => s.group.is_default)!
  for (const p of practices) (byId.get(p.group_id ?? null) ?? fallback).practices.push(p)
  return sections
}

export function todaySections(groups: PracticeGroup[], practices: UserPractice[]): Section[] {
  return groupPractices(groups, practices.filter((p) => p.is_active)).filter((s) => s.practices.length > 0)
}

export function layoutOf(sections: Section[]): Layout {
  return {
    groups: sections.map((s) => s.group.id),
    practices: sections.flatMap((s) => s.practices.map((p) => ({ id: p.id, group_id: s.group.id }))),
  }
}

export function moveToGroupEnd(sections: Section[], practiceId: string, groupId: string | null): Section[] {
  const moved = sections.flatMap((s) => s.practices).find((p) => p.id === practiceId)
  if (!moved) return sections
  return sections.map((s) => {
    const rest = s.practices.filter((p) => p.id !== practiceId)
    return s.group.id === groupId ? { ...s, practices: [...rest, { ...moved, group_id: groupId }] } : { ...s, practices: rest }
  })
}

export const groupName = (g: PracticeGroup, t: TFunction): string => (g.is_default ? t('today.group') : g.name)
