import type { UserPractice, YatraPractice, YatraUserPracticeItem } from '../../../types/api'

const norm = (s: string) => s.trim().toLowerCase()
const words = (s: string) => (norm(s).match(/\p{L}+/gu) ?? []).filter((w) => w.length >= 4)

function nameScore(yatraName: string, mine: string): number {
  const a = norm(yatraName), b = norm(mine)
  if (a === b) return 2
  if (a.includes(b) || b.includes(a)) return 1
  // Words "match" when one starts the other, so plurals pair up: "lectures" ~ "lecture".
  const wa = [...words(a)]
  return [...words(b)].some((w) => wa.some((v) => v.startsWith(w) || w.startsWith(v))) ? 1 : 0
}

const linkedNames = (items: YatraUserPracticeItem[]) =>
  new Set(items.flatMap((i) => (i.user_practice ? [i.user_practice] : [])))

/** Yatra practice id → one matching, active, same-type practice not linked anywhere in this yatra. */
export function suggestions(items: YatraUserPracticeItem[], practices: UserPractice[]): Map<string, UserPractice> {
  const taken = linkedNames(items)
  const out = new Map<string, UserPractice>()
  for (const { yatra_practice: y, user_practice } of items) {
    if (user_practice) continue
    let best: UserPractice | undefined
    let bestScore = 0
    for (const p of practices) {
      if (!p.is_active || p.data_type !== y.data_type || taken.has(p.practice)) continue
      const s = nameScore(y.practice, p.practice)
      if (s > bestScore) { best = p; bestScore = s }
    }
    if (best) { out.set(y.id, best); taken.add(best.practice) }
  }
  return out
}

/** Links `name` to one yatra practice; any other row holding it is unlinked (a move). */
export function withLink(items: YatraUserPracticeItem[], yatraPracticeId: string, name: string | null): YatraUserPracticeItem[] {
  return items.map((i) =>
    i.yatra_practice.id === yatraPracticeId ? { ...i, user_practice: name }
    : name !== null && i.user_practice === name ? { ...i, user_practice: null }
    : i)
}

export function withLinks(items: YatraUserPracticeItem[], links: Map<string, UserPractice>): YatraUserPracticeItem[] {
  return items.map((i) => (links.has(i.yatra_practice.id) ? { ...i, user_practice: links.get(i.yatra_practice.id)!.practice } : i))
}

export const unlinked = (items: YatraUserPracticeItem[]): YatraPractice[] =>
  items.filter((i) => !i.user_practice).map((i) => i.yatra_practice)

export interface PickerGroups {
  suggested: UserPractice | null
  compatible: UserPractice[]
  current: UserPractice | null
  linkedElsewhere: { practice: UserPractice; linkedTo: YatraPractice }[]
  cantLink: { practice: UserPractice; reason: 'inactive' | 'type' }[]
}

/** Every user practice, grouped for the picker of one yatra practice. */
export function pickerGroups(items: YatraUserPracticeItem[], practices: UserPractice[], yatraPracticeId: string): PickerGroups {
  const row = items.find((i) => i.yatra_practice.id === yatraPracticeId)!
  const owner = new Map(items.flatMap((i) => (i.user_practice ? [[i.user_practice, i.yatra_practice] as const] : [])))
  const suggested = row.user_practice ? null : suggestions(items, practices).get(yatraPracticeId) ?? null
  const g: PickerGroups = { suggested, compatible: [], current: null, linkedElsewhere: [], cantLink: [] }
  for (const p of practices) {
    if (!p.is_active) { g.cantLink.push({ practice: p, reason: 'inactive' }); continue }
    if (p.data_type !== row.yatra_practice.data_type) { g.cantLink.push({ practice: p, reason: 'type' }); continue }
    if (p.practice === row.user_practice) { g.current = p; continue }
    const other = owner.get(p.practice)
    if (other) g.linkedElsewhere.push({ practice: p, linkedTo: other })
    else if (p !== suggested) g.compatible.push(p)
  }
  // Type mismatches first, then inactive, as in 12m5.
  g.cantLink.sort((a, b) => (a.reason === b.reason ? 0 : a.reason === 'type' ? -1 : 1))
  return g
}

const laterKey = (yatraId: string) => `yatra_link_later_${yatraId}`
const setKey = (ids: string[]) => [...ids].sort().join(',')

export function laterDismissed(yatraId: string, unlinkedIds: string[]): boolean {
  try { return localStorage.getItem(laterKey(yatraId)) === setKey(unlinkedIds) } catch { return false }
}

export function dismissLater(yatraId: string, unlinkedIds: string[]): void {
  try { localStorage.setItem(laterKey(yatraId), setKey(unlinkedIds)) } catch { /* private mode: banner just returns */ }
}
