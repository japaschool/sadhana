import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../../api/practices'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { useReports } from '../../insights/useReports'
import { DAYS_SLOT, DURATION_SLOT, fits, GAPS_EVENT_SLOT, GAPS_ROWS_SLOT, GOAL_SLOT, JAPA_SLOTS, pickerGroups, SLEEP_DEFAULTS, SLEEP_SLOTS, sleepRowsFor } from '../../insights/panels/templates'
import type { Slot } from '../../insights/panels/templates'
import { buildPlan, itemsOf, KINDS, nameProblem } from '../guideLogic'
import type { Choices, GuideKind, NameProblem, PlannedPractice } from '../guideLogic'
import type { Guide } from '../useGuide'

type Value<K extends GuideKind> = NonNullable<Choices[K]>

/** What a screen shows before anything is chosen. Optional practices that need a name of their own start unticked; Nap starts ticked, as in the mockup. */
function defaults(kind: GuideKind, t: TFunction): Value<GuideKind> {
  if (kind === 'sleep') return { bedtime: t('reportPanels.bedtime'), wake: t('reportPanels.wakeUp'), nap: t('reportPanels.nap'), ...SLEEP_DEFAULTS }
  if (kind === 'count') return { count: '', target: null, early: null }
  if (kind === 'gaps') return { event: '', rows: [], sleep: false }
  if (kind === 'goals') return { goals: [] }
  return kind === 'time' ? { names: [], goal: null } : { names: [] }
}

/** `have` is the practice with this name, if any; `existing` is that practice when it can be used as it is. */
export interface NameCheck { problem: NameProblem | null; have: UserPractice | undefined; existing: UserPractice | undefined }

/**
 * One set up screen's state. Edits go straight to the guide's choices (so leaving asks first), names are stored trimmed,
 * and `hint` says what is in the way of Next: this screen is the only gate before the plan is built.
 */
export function useSetup<K extends GuideKind>(guide: Guide, kind: K) {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const practices = q.data ?? []
  const value = (guide.choices[kind] ?? defaults(kind, t)) as Value<K>

  // The practices the reports before this one will create, from the ones still chosen. Two types for one name would throw in buildPlan.
  const earlier = Object.fromEntries(KINDS.map((k) => [k, KINDS.indexOf(k) < KINDS.indexOf(kind) ? guide.chosen[k] : null])) as unknown as Choices
  let others: PlannedPractice[] | null = []
  try { others = buildPlan(earlier, practices, [], () => '').practices } catch { others = null }

  const items = itemsOf(kind, value)
  /** A name is a problem if it is taken in a way that can't be used, or used twice on this screen. */
  function check(name: string, slot: Slot): NameCheck {
    const n = name.trim()
    const have = practices.find((p) => p.practice === n)
    const problem = nameProblem(n, slot, practices, others ?? []) ?? (n && items.filter((it) => it.name === n).length > 1 ? 'twice' : null)
    return { problem, have, existing: have && fits(slot, have) ? have : undefined }
  }

  /** A name's type: the person's practice, else one planned earlier here, else a new yes/no practice. */
  const typeOf = (name: string): PracticeDataType =>
    practices.find((p) => p.practice === name.trim())?.data_type ?? others?.find((o) => o.name === name.trim())?.data_type ?? 'Bool'
  /** Practices the person has or the guide plans before this one that this slot can use, by name. */
  const usable = (slot: Slot) => [...new Set([
    ...pickerGroups(slot, practices).compatible.map((p) => p.practice),
    ...(others ?? []).filter((o) => slot.types.includes(o.data_type)).map((o) => o.name),
  ])]
  // Calculated Sleep needs a bedtime and a wake-up: from Sleep chosen here, or a report or practices the person has.
  const reports = useReports().data ?? []
  const canSleep = !!guide.chosen.sleep || !!sleepRowsFor(reports, practices)

  const named = items.filter((it) => it.name)
  // Paused is offline before a first load: nothing will come until the connection does.
  const loadFailed = (q.isError || q.isPaused) && !q.data
  const hint = ((): string | null => {
    if (loadFailed) return t('common.error')
    if (kind === 'count' && !(value as Value<'count'>).count.trim()) return t('guide.setup.needCount')
    if (kind === 'gaps' && !(value as Value<'gaps'>).event.trim()) return t('guide.setup.needEvent')
    if ((kind === 'time' || kind === 'days' || kind === 'goals') && !items.length) return t('guide.setup.needOne')
    if (named.length < items.length) return t('guide.setup.needName')
    if (others === null || items.some((it) => check(it.name, it.slot).problem)) return t('guide.setup.fixNames')
    if (kind === 'count' && (value as Value<'count'>).target === null) return t('guide.setup.needTarget')
    if (kind === 'goals' && (value as Value<'goals'>).goals.some((g) => g.amount === null || (g.direction === 'AtLeast' && g.amount < 1))) return t('guide.setup.needAmount')
    const s = value as Value<'sleep'>
    if (kind === 'sleep' && s.min !== null && s.max !== null && s.min > s.max) return t('guide.setup.fixRange')
    return null
  })()

  const slots = kind === 'sleep' ? SLEEP_SLOTS : kind === 'count' ? JAPA_SLOTS : kind === 'gaps' ? [GAPS_EVENT_SLOT, GAPS_ROWS_SLOT]
    : [kind === 'time' ? DURATION_SLOT : kind === 'goals' ? GOAL_SLOT : DAYS_SLOT]
  const hasMine = slots.some((s) => pickerGroups(s, practices).compatible.length)
  const at = guide.tracked.indexOf(kind)
  const after = guide.tracked[at + 1]
  return {
    kind, value, practices, check, hint, typeOf, usable, canSleep,
    /** The person's active practices this slot can use as they are. */
    fitting: (slot: Slot) => pickerGroups(slot, practices).compatible,
    /** Without the person's practices names can't be checked, so Next waits; this tries again. */
    retry: loadFailed ? () => { void q.refetch() } : null,
    ready: q.isSuccess && !hint,
    position: t('guide.setup.label', { a: at + 1, b: guide.tracked.length }),
    /** What the person is told under the title: from Add practice, with practices of theirs to use, say so. */
    lead: t(!guide.firstRun && hasMine && kind !== 'sleep' ? 'guide.setup.lead.mine' : `guide.setup.lead.${kind}`),
    /** From Add practice there is no sharing step, so the last button is the one that creates. */
    nextLabel: !after && !guide.firstRun ? t('templateForm.create') : t('guide.setup.next', { what: after ? t(`guide.kinds.${after}.name`) : t(guide.firstRun ? 'guide.steps.sharing' : 'guide.steps.finish') }),
    /** Callers pass names already trimmed, so a name made of spaces is the empty one. */
    set: (patch: Partial<Value<K>>) => guide.setChoice(kind, { ...value, ...patch } as Choices[K]),
    /** Next also records an untouched screen, so its defaults are what gets built. */
    next: () => { guide.setChoice(kind, value as Choices[K]); guide.next() },
  }
}
export type Setup<K extends GuideKind> = ReturnType<typeof useSetup<K>>
