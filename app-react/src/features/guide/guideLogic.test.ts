import { describe, expect, it } from 'vitest'
import type { Report, ReportDefinition } from '../../api/charts'
import type { PracticeGroup, UserPractice } from '../../types/api'
import { DAYS_SLOT, DURATION_SLOT, JAPA_SLOTS, SLEEP_SLOTS } from '../insights/panels/templates'
import { buildPlan, hasReport, nameProblem, runPlan, uniqueName } from './guideLogic'
import type { Choices, GuideApi, GuideKind, PlannedPractice } from './guideLogic'

const sleep = { bedtime: 'Bedtime', wake: 'Wake-up', nap: 'Nap', min: 360, max: 540 }
const count = { count: 'Pages read', target: 20, early: 'Early' }
const none: Choices = { sleep: null, count: null, time: null, days: null }
const all: Choices = { sleep, count, time: { names: ['Reading', 'Study'], goal: 90 }, days: { names: ['Walk'] } }
const names = (s: string) => `${s} report`
let n = 0
const prac = (practice: string, data_type: UserPractice['data_type'], over: Partial<UserPractice> = {}): UserPractice =>
  ({ id: `p${++n}`, practice, data_type, is_active: true, ...over })
const report = (name: string): Report => ({ id: `r-${name}`, name, definition: { Panels: { version: 1, template: null, required: [], panels: [] } } })
const plan = (c: Choices, ps: UserPractice[] = [], rs: Report[] = []) => buildPlan(c, ps, rs, names)

/** A server in memory. `lose` makes the call at that number land and then fail, as a lost response would. */
function fakeApi(practices: UserPractice[] = [], reports: Report[] = [], groups: PracticeGroup[] = [{ id: null, name: '', is_default: true }]) {
  const log: string[] = []
  const defs: Record<string, ReportDefinition> = {}
  let calls = 0
  const state = { failAt: 0, lose: false }
  const tick = (what: string) => { log.push(what); calls++; return calls === state.failAt }
  const api: GuideApi = {
    getPractices: async () => [...practices],
    getReports: async () => [...reports],
    getGroups: async () => [...groups],
    createGroup: async (name) => {
      const fail = tick(`group:${name}`)
      if (!fail || state.lose) groups.push({ id: `g-${name}`, name, is_default: false })
      if (fail) throw new Error('network')
      return `g-${name}`
    },
    createPractice: async (p: PlannedPractice, groupId) => {
      const fail = tick(`practice:${p.name}`)
      if (!fail || state.lose) practices.push(prac(p.name, p.data_type, { group_id: groupId }))
      if (fail) throw new Error('network')
    },
    createReport: async (name, d) => {
      defs[name] = d
      const fail = tick(`report:${name}`)
      if (!fail || state.lose) reports.push(report(name))
      if (fail) throw new Error('network')
      return `r-${name}`
    },
  }
  return { api, log, state, practices, reports, defs }
}

describe('buildPlan', () => {
  it('orders practices by report, Sleep first, no duplicates between reports', () => {
    const p = plan({ ...all, time: { names: ['Nap', 'Reading'], goal: null }, days: { names: ['Walk', 'Journaling'] } })
    expect(p.practices.map((x) => x.name)).toEqual(['Bedtime', 'Wake-up', 'Nap', 'Pages read', 'Early', 'Reading', 'Walk', 'Journaling'])
    expect(p.reports.map((r) => r.kind)).toEqual(['sleep', 'count', 'time', 'days'])
  })

  it('refuses one name asked for with two types', () => {
    expect(() => plan({ ...none, time: { names: ['Walk'], goal: null }, days: { names: ['Walk'] } })).toThrow()
  })

  it('plans no practice for an active compatible name', () => {
    const p = plan({ ...none, time: { names: ['Reading'], goal: null } }, [prac('Reading', 'Duration')])
    expect(p.practices).toEqual([])
    expect(p.reports).toHaveLength(1)
  })

  it('leaves out unticked optionals', () => {
    const p = plan({ ...none, sleep: { ...sleep, nap: null }, count: { ...count, early: null } })
    expect(p.practices.map((x) => x.name)).toEqual(['Bedtime', 'Wake-up', 'Pages read'])
  })

  it('numbers a report name that is taken', () => {
    expect(uniqueName('Sleep', [])).toBe('Sleep')
    expect(uniqueName('Sleep', [report('Sleep')])).toBe('Sleep 2')
    expect(uniqueName('Sleep', [report('Sleep'), report('Sleep 2')])).toBe('Sleep 3')
    expect(plan({ ...none, days: { names: ['Walk'] } }, [], [report('days report')]).reports[0].name).toBe('days report 2')
  })
})

describe('buildPlan groups', () => {
  const group = (p: ReturnType<typeof plan>, kind: GuideKind) => p.reports.find((r) => r.kind === kind)!.group
  it('groups a report of several new practices, under the report’s base name', () => {
    const p = plan({ ...all, time: { names: ['Reading', 'Study'], goal: null } }, [], [report('sleep report')])
    expect(group(p, 'sleep')).toBe('sleep report')
    expect(p.reports[0].name).toBe('sleep report 2')
    expect(group(p, 'time')).toBe('duration report')
  })
  it('names a Daily count report and its group after the count', () => {
    const p = plan({ ...none, count: { ...count, count: ' Pages read ', early: 'Done in the morning' } }, [], [report('Pages read')])
    expect(group(p, 'count')).toBe('Pages read')
    expect(p.reports[0].name).toBe('Pages read 2')
    expect(plan({ ...none, count: { ...count, count: 'Pages read', early: null } }).reports[0].name).toBe('Pages read')
  })
  it('leaves a single practice alone', () => {
    expect(group(plan({ ...none, days: { names: ['Walk'] } }), 'days')).toBeNull()
    expect(group(plan({ ...none, count: { ...count, early: null } }), 'count')).toBeNull()
  })
  it('skips the group when any practice is reused, from before or from an earlier report here', () => {
    expect(group(plan({ ...none, time: { names: ['Reading', 'Study'], goal: null } }, [prac('Reading', 'Duration')]), 'time')).toBeNull()
    const p = plan({ ...none, sleep, time: { names: ['Nap', 'Study'], goal: null } })
    expect(group(p, 'sleep')).not.toBeNull()
    expect(group(p, 'time')).toBeNull()
  })
  it('a rebuild after a partial attempt decides as the first one did', () => {
    const c = { ...none, time: { names: ['Reading', 'Study'], goal: null } }
    expect(buildPlan(c, [prac('Reading', 'Duration')], [], names, new Set())).toMatchObject({ reports: [{ group: 'duration report' }] })
  })
})

describe('nameProblem', () => {
  const existing = [prac('Hidden', 'Duration', { is_active: false }), prac('Pages read', 'Int'), prac('Reading', 'Duration')]
  it('flags a hidden practice, another type, an empty name, and the same name used twice with two types', () => {
    expect(nameProblem('  ', DURATION_SLOT, existing, [])).toBe('empty')
    expect(nameProblem('Hidden', DURATION_SLOT, existing, [])).toBe('inUseHidden')
    expect(nameProblem('Pages read', DAYS_SLOT, existing, [])).toBe('inUseOtherType')
    expect(nameProblem('Reading', DURATION_SLOT, existing, [])).toBeNull()
    expect(nameProblem('Walk', DAYS_SLOT, existing, [{ name: 'Walk', data_type: 'Duration' }])).toBe('twice')
    expect(nameProblem('Walk', DAYS_SLOT, existing, [{ name: 'Walk', data_type: 'Bool' }])).toBeNull()
    expect(nameProblem('Bedtime', SLEEP_SLOTS[0], existing, [])).toBeNull()
    expect(nameProblem('Total', JAPA_SLOTS[0], existing, [])).toBeNull()
  })
})

describe('runPlan groups', () => {
  const c = { ...none, time: { names: ['Reading', 'Study'], goal: null } }
  it('creates the group once and puts each new practice in it', async () => {
    const f = fakeApi()
    await runPlan(plan(c), f.api, () => {})
    expect(f.log.slice(0, 3)).toEqual(['group:duration report', 'practice:Reading', 'practice:Study'])
    expect(f.practices.map((p) => p.group_id)).toEqual(['g-duration report', 'g-duration report'])
  })
  it('joins a group of that name, and a retry finds one whose response was lost', async () => {
    const own = fakeApi([], [], [{ id: 'mine', name: 'duration report', is_default: false }])
    await runPlan(plan(c), own.api, () => {})
    expect(own.log).not.toContain('group:duration report')
    expect(own.practices[0].group_id).toBe('mine')
    const f = fakeApi()
    const p = plan(c)
    f.state.failAt = 1
    f.state.lose = true
    await expect(runPlan(p, f.api, () => {})).rejects.toThrow()
    await runPlan(p, f.api, () => {})
    expect(f.log.filter((l) => l.startsWith('group:'))).toHaveLength(1)
    expect(f.practices.every((x) => x.group_id === 'g-duration report')).toBe(true)
  })
  it('creates a name two reports share only once', async () => {
    const f = fakeApi()
    await runPlan(plan({ ...none, sleep, count: { ...count, count: 'sleep report', early: 'Done in the morning' } }), f.api, () => {})
    expect(f.log.filter((l) => l.startsWith('group:'))).toEqual(['group:sleep report'])
    expect(new Set(f.practices.map((p) => p.group_id))).toEqual(new Set(['g-sleep report']))
  })
  it('creates no group for a plain report', async () => {
    const f = fakeApi()
    await runPlan(plan({ ...none, days: { names: ['Walk'] } }), f.api, () => {})
    expect(f.log).toEqual(['practice:Walk', 'report:days report'])
    expect(f.practices[0].group_id).toBeNull()
  })
})

describe('runPlan', () => {
  it('creates practices then the report, reporting each kind', async () => {
    const f = fakeApi()
    const steps: string[] = []
    await runPlan(plan({ ...none, time: { names: ['Reading'], goal: 60 }, days: { names: ['Walk'] } }), f.api, (k, s) => steps.push(`${k}:${s}`))
    expect(f.log).toEqual(['practice:Reading', 'report:duration report', 'practice:Walk', 'report:days report'])
    expect(steps).toEqual(['time:working', 'time:done', 'days:working', 'days:done'])
  })

  it('resume: creates only what is missing after a failure', async () => {
    const f = fakeApi()
    const p = plan({ ...none, time: { names: ['Reading', 'Study'], goal: null }, days: { names: ['Walk'] } })
    f.state.failAt = 3 // Study, after the group and Reading
    await expect(runPlan(p, f.api, () => {})).rejects.toThrow()
    f.log.length = 0
    await runPlan(p, f.api, () => {})
    expect(f.log).toEqual(['practice:Study', 'report:duration report', 'practice:Walk', 'report:days report'])
    expect(f.reports.map((r) => r.name)).toEqual(['duration report', 'days report'])
    expect(f.practices.filter((x) => x.practice !== 'Walk').map((x) => x.group_id)).toEqual(['g-duration report', 'g-duration report'])
  })

  it('a practice POST that failed client-side but landed creates no duplicate', async () => {
    const f = fakeApi()
    const p = plan({ ...none, time: { names: ['Reading'], goal: null } })
    f.state.failAt = 1
    f.state.lose = true
    await expect(runPlan(p, f.api, () => {})).rejects.toThrow()
    await runPlan(p, f.api, () => {})
    expect(f.practices.map((x) => x.practice)).toEqual(['Reading'])
    expect(f.reports).toHaveLength(1)
  })

  it('a report POST that failed client-side but landed creates no duplicate', async () => {
    const f = fakeApi()
    const p = plan({ ...none, time: { names: ['Reading'], goal: null } })
    f.state.failAt = 2
    f.state.lose = true
    await expect(runPlan(p, f.api, () => {})).rejects.toThrow()
    const steps: string[] = []
    await runPlan(p, f.api, (k, s) => steps.push(`${k}:${s}`))
    expect(f.reports.map((r) => r.name)).toEqual(['duration report'])
    expect(steps).toEqual(['time:working', 'time:done'])
  })

  it('does not rename the plan when a retry finds the first report name', async () => {
    const f = fakeApi()
    const p = plan({ ...none, days: { names: ['Walk'] } })
    f.state.failAt = 2
    f.state.lose = true
    await expect(runPlan(p, f.api, () => {})).rejects.toThrow()
    await runPlan(p, f.api, () => {})
    expect(f.reports.map((r) => r.name)).toEqual(['days report'])
  })

  it('stops at the first failure, with later reports untouched', async () => {
    const f = fakeApi()
    const p = plan({ ...none, time: { names: ['Reading'], goal: null }, days: { names: ['Walk'] } })
    f.state.failAt = 2 // the duration report
    const steps: string[] = []
    await expect(runPlan(p, f.api, (k, s) => steps.push(`${k}:${s}`))).rejects.toThrow()
    expect(f.log).toEqual(['practice:Reading', 'report:duration report'])
    expect(steps).toEqual(['time:working'])
  })

  it.each([
    ['hidden', prac('Reading', 'Duration', { is_active: false })],
    ['of another type', prac('Reading', 'Bool')],
  ])('refuses to build a report on a practice that is %s', async (_, existing) => {
    const f = fakeApi([existing])
    await expect(runPlan(plan({ ...none, time: { names: ['Reading'], goal: null } }, f.practices), f.api, () => {})).rejects.toThrow()
    expect(f.log).toEqual([])
  })

  it('puts the right practices and numbers in each definition', async () => {
    const reading = prac('Reading', 'Duration')
    const f = fakeApi([reading])
    await runPlan(plan(all, f.practices), f.api, () => {})
    const id = (name: string) => f.practices.find((x) => x.practice === name)!.id
    const tpl = (name: string) => (f.defs[name] as { Panels: { template: Record<string, unknown> } }).Panels.template
    expect(tpl('sleep report')).toEqual({ Sleep: { bedtime: id('Bedtime'), wake: id('Wake-up'), nap: id('Nap'), min: 360, max: 540 } })
    expect(tpl('Pages read')).toEqual({ Japa: { total: id('Pages read'), target: 20, morning: id('Early'), quality: null, attunement: null } })
    expect(tpl('duration report')).toEqual({ Duration: { practices: [reading.id, id('Study')], goal: 90 } })
    expect(tpl('days report')).toEqual({ Days: { practices: [id('Walk')] } })
    expect(id('Bedtime')).not.toBe(id('Wake-up'))
  })

  it('links reports to existing practices and builds every kind', async () => {
    const f = fakeApi([prac('Reading', 'Duration')])
    const kinds: GuideKind[] = []
    await runPlan(plan(all, f.practices), f.api, (k, s) => { if (s === 'done') kinds.push(k) })
    expect(kinds).toEqual(['sleep', 'count', 'time', 'days'])
    expect(f.practices.filter((x) => x.practice === 'Reading')).toHaveLength(1)
  })
})

describe('on existing practices', () => {
  it('a report built on them holds their ids at once, and creates nothing else', async () => {
    const [a, b] = [prac('Book reading', 'Duration'), prac('Lecture listening', 'Duration')]
    const f = fakeApi([a, b])
    await runPlan(plan({ ...none, time: { names: ['Book reading', 'Lecture listening'], goal: null } }, f.practices), f.api, () => {})
    expect(f.log).toEqual(['report:duration report'])
    expect((f.defs['duration report'] as { Panels: { template: unknown } }).Panels.template).toEqual({ Duration: { practices: [a.id, b.id], goal: null } })
  })
})

describe('hasReport', () => {
  const made = (template: object | null): Report => ({ id: 'r', name: 'x', definition: { Panels: { version: 1, template, required: [], panels: [] } } as never })
  it('tells which template a report was made from, and ignores ones made by hand', () => {
    const rs = [made({ Duration: { practices: [], goal: null } }), made(null)]
    expect(hasReport('time', rs)).toBe(true)
    expect(hasReport('sleep', rs)).toBe(false)
    expect(hasReport('days', [])).toBe(false)
  })
})
