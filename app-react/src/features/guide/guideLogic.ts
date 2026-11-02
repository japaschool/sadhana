import type { Report, ReportDefinition } from '../../api/charts'
import type { PracticeDataType, PracticeGroup, UserPractice } from '../../types/api'
import { draftToDefinition } from '../insights/panels/TemplateForm'
import type { TemplateDraft } from '../insights/panels/TemplateForm'
import { DAYS_SLOT, DURATION_SLOT, fits, JAPA_SLOTS, SLEEP_SLOTS, templateSlug } from '../insights/panels/templates'
import type { Slot } from '../insights/panels/templates'

export type GuideKind = 'sleep' | 'count' | 'time' | 'days'
export interface Choices {
  sleep: { bedtime: string; wake: string; nap: string | null; min: number | null; max: number | null } | null
  count: { count: string; target: number | null; early: string | null; how: string | null; scaleFrom: number | null; scaleTo: number | null } | null
  time: { names: string[]; goal: number | null } | null
  days: { names: string[] } | null
}
export interface PlannedPractice { name: string; data_type: PracticeDataType; dropdown_variants?: string }
export interface GuidePlan { practices: PlannedPractice[]; reports: { kind: GuideKind; name: string; slug: string; group: string | null; choices: Choices[GuideKind] }[] }
export type NameProblem = 'empty' | 'inUseHidden' | 'inUseOtherType' | 'twice'

export const KINDS: GuideKind[] = ['sleep', 'count', 'time', 'days']
const SLUGS: Record<GuideKind, string> = { sleep: 'sleep', count: 'japa', time: 'duration', days: 'days' }
/** Enough for 0 to 10, and short enough to pick from. */
const MAX_SCALE = 11

/** The whole numbers from `from` to `to`, as a dropdown's options. Undefined unless they make a scale of 2 to MAX_SCALE options. */
export function scaleVariants(from: number | null, to: number | null): string | undefined {
  if (from === null || to === null || to <= from || to - from >= MAX_SCALE) return undefined
  return Array.from({ length: to - from + 1 }, (_, i) => from + i).join(',')
}

export interface Item { name: string; slot: Slot; planned: PlannedPractice }
/** `type` is what gets created, which is the slot's first type unless said: How it went is Text, with a dropdown of numbers. */
const item = (name: string, slot: Slot, type: PracticeDataType = slot.types[0], dropdown_variants?: string): Item =>
  ({ name: name.trim(), slot, planned: { name: name.trim(), data_type: type, ...(dropdown_variants && { dropdown_variants }) } })

/** The practices a report needs, in order. A ticked optional one is there even while its name is blank, so the screens can flag it. */
export function itemsOf(kind: GuideKind, c: NonNullable<Choices[GuideKind]>): Item[] {
  if (kind === 'sleep') {
    const s = c as NonNullable<Choices['sleep']>
    return [item(s.bedtime, SLEEP_SLOTS[0]), item(s.wake, SLEEP_SLOTS[1]), ...(s.nap !== null ? [item(s.nap, SLEEP_SLOTS[2])] : [])]
  }
  if (kind === 'count') {
    const k = c as NonNullable<Choices['count']>
    return [item(k.count, JAPA_SLOTS[0]), ...(k.early !== null ? [item(k.early, JAPA_SLOTS[1])] : []), ...(k.how !== null ? [item(k.how, JAPA_SLOTS[2], 'Text', scaleVariants(k.scaleFrom, k.scaleTo))] : [])]
  }
  const { names } = c as { names: string[] }
  return names.map((n) => item(n, kind === 'time' ? DURATION_SLOT : DAYS_SLOT))
}

export function nameProblem(name: string, slot: Slot, practices: UserPractice[], others: PlannedPractice[]): NameProblem | null {
  const n = name.trim()
  if (!n) return 'empty'
  const have = practices.find((p) => p.practice === n)
  if (have) return !have.is_active ? 'inUseHidden' : fits(slot, have) ? null : 'inUseOtherType'
  return others.some((o) => o.name === n && !slot.types.includes(o.data_type)) ? 'twice' : null
}

/** The person already has a report made from this kind's template. Reports built by hand have none. */
export const hasReport = (kind: GuideKind, reports: Report[]) =>
  reports.some((r) => 'Panels' in r.definition && !!r.definition.Panels.template && templateSlug(r.definition.Panels) === SLUGS[kind])

/** "Sleep", then "Sleep 2" when taken. */
export function uniqueName(base: string, reports: Report[]): string {
  const taken = new Set(reports.map((r) => r.name))
  let name = base
  for (let i = 2; taken.has(name); i++) name = `${base} ${i}`
  return name
}

/**
 * Built once and kept: report names are fixed here, against the reports the person had, so a retry never renames.
 * A practice the person already has and can use as it is gets no entry.
 * A Daily count report is named after its count, as "Daily count" says little once there's a report for it.
 * A report of several practices, all new, gets a group for them on Today, under that same name. One that reuses any, from `before` or an
 * earlier report here, gets none, so nothing already placed is split from its report's other practices or moved.
 * `before` is the names there before the guide created anything, so a rebuild after a partial attempt decides the same.
 */
export function buildPlan(choices: Choices, practices: UserPractice[], reports: Report[], reportName: (slug: string) => string, before: Set<string> = new Set(practices.map((p) => p.practice))): GuidePlan {
  const plan: GuidePlan = { practices: [], reports: [] }
  for (const kind of KINDS) {
    const c = choices[kind]
    if (!c) continue
    const items = itemsOf(kind, c)
    const allNew = items.every((it) => !before.has(it.name) && !plan.practices.some((p) => p.name === it.name))
    for (const it of items) {
      const same = plan.practices.find((p) => p.name === it.name)
      if (same && !it.slot.types.includes(same.data_type)) throw new Error(`${it.name} is asked for with two types`)
      if (!same && !practices.some((p) => p.practice === it.name && fits(it.slot, p))) plan.practices.push(it.planned)
    }
    const base = kind === 'count' ? items[0].name : reportName(SLUGS[kind])
    plan.reports.push({ kind, slug: SLUGS[kind], name: uniqueName(base, reports), group: items.length > 1 && allNew ? base : null, choices: c })
  }
  return plan
}

export interface GuideApi {
  getPractices(): Promise<UserPractice[]>
  createPractice(p: PlannedPractice, groupId: string | null): Promise<void>
  getGroups(): Promise<PracticeGroup[]>
  createGroup(name: string): Promise<string>
  getReports(): Promise<Report[]>
  createReport(name: string, d: ReportDefinition): Promise<string>
}

function draftOf(kind: GuideKind, c: NonNullable<Choices[GuideKind]>, id: (name: string) => string): TemplateDraft {
  if (kind === 'sleep') {
    const s = c as NonNullable<Choices['sleep']>
    return { kind: 'Sleep', bedtime: id(s.bedtime), wake: id(s.wake), nap: s.nap ? id(s.nap) : null, min: s.min, max: s.max }
  }
  if (kind === 'count') {
    const k = c as NonNullable<Choices['count']>
    return { kind: 'Japa', total: id(k.count), target: k.target, morning: k.early ? id(k.early) : null, quality: k.how ? id(k.how) : null, attunement: null }
  }
  if (kind === 'time') {
    const t = c as NonNullable<Choices['time']>
    return { kind: 'Duration', practices: t.names.map(id), goal: t.goal }
  }
  return { kind: 'Days', practices: (c as NonNullable<Choices['days']>).names.map(id) }
}

/**
 * Safe to call again after a failure: it reads what exists and creates only the rest, a report at a time, in order.
 * A request that landed but whose response was lost is found by name, so nothing is created twice.
 * That goes for groups too: a group of that name, the person's own or from an attempt, is joined.
 */
export async function runPlan(plan: GuidePlan, api: GuideApi, onStep: (kind: GuideKind, state: 'working' | 'done') => void): Promise<void> {
  let practices = await api.getPractices()
  const reports = await api.getReports()
  const groups = await api.getGroups()
  for (const r of plan.reports) {
    const kind = r.kind
    onStep(kind, 'working')
    if (!reports.some((x) => x.name === r.name)) {
      const c = r.choices!
      let created = false
      let groupId: string | null = null
      for (const it of itemsOf(kind, c)) {
        const planned = plan.practices.find((p) => p.name === it.name)
        if (planned && !practices.some((p) => p.practice === it.name)) {
          if (r.group && !groupId) {
            groupId = groups.find((g) => !g.is_default && g.name === r.group)?.id ?? await api.createGroup(r.group)
            groups.push({ id: groupId, name: r.group, is_default: false }) // a count named "Sleep" shares Sleep's group, and the server refuses a second one
          }
          await api.createPractice(planned, groupId)
          practices = [...practices, { id: '', practice: it.name, data_type: planned.data_type, is_active: true }]
          created = true
        }
      }
      if (created) practices = await api.getPractices()
      // Hidden ones come back too, and a name that exists is not created again, so check each can be used.
      for (const it of itemsOf(kind, c)) {
        const p = practices.find((x) => x.practice === it.name)
        if (!p?.id || !fits(it.slot, p)) throw new Error(`${it.name} can't be used for ${kind}`)
      }
      const id = (name: string) => practices.find((x) => x.practice === name.trim())!.id
      const def = draftToDefinition(draftOf(kind, c, id))
      if (!def) throw new Error(`incomplete ${kind} choices`)
      await api.createReport(r.name, def)
    }
    onStep(kind, 'done')
  }
}
