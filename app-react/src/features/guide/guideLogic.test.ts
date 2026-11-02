import { describe, expect, it } from 'vitest'
import type { Report, ReportDefinition } from '../../api/charts'
import type { UserPractice } from '../../types/api'
import { DAYS_SLOT, DURATION_SLOT, JAPA_SLOTS, SLEEP_SLOTS } from '../insights/panels/templates'
import { buildPlan, hasReport, nameProblem, runPlan, uniqueName } from './guideLogic'
import type { Choices, GuideApi, GuideKind, PlannedPractice } from './guideLogic'

const sleep = { bedtime: 'Bedtime', wake: 'Wake-up', nap: 'Nap', min: 360, max: 540 }
const count = { count: 'Pages read', target: 20, early: 'Early', how: 'How it went' }
const none: Choices = { sleep: null, count: null, time: null, days: null }
const all: Choices = { sleep, count, time: { names: ['Reading', 'Study'], goal: 90 }, days: { names: ['Walk'] } }
const names = (s: string) => `${s} report`
let n = 0
const prac = (practice: string, data_type: UserPractice['data_type'], over: Partial<UserPractice> = {}): UserPractice =>
  ({ id: `p${++n}`, practice, data_type, is_active: true, ...over })
const report = (name: string): Report => ({ id: `r-${name}`, name, definition: { Panels: { version: 1, template: null, required: [], panels: [] } } })
const plan = (c: Choices, ps: UserPractice[] = [], rs: Report[] = []) => buildPlan(c, ps, rs, names)

/** A server in memory. `lose` makes the call at that number land and then fail, as a lost response would. */
function fakeApi(practices: UserPractice[] = [], reports: Report[] = []) {
  const log: string[] = []
  const defs: Record<string, ReportDefinition> = {}
  let calls = 0
  const state = { failAt: 0, lose: false }
  const tick = (what: string) => { log.push(what); calls++; return calls === state.failAt }
  const api: GuideApi = {
    getPractices: async () => [...practices],
    getReports: async () => [...reports],
    createPractice: async (p: PlannedPractice) => {
      const fail = tick(`practice:${p.name}`)
      if (!fail || state.lose) practices.push(prac(p.name, p.data_type, { dropdown_variants: p.dropdown_variants }))
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
    expect(p.practices.map((x) => x.name)).toEqual(['Bedtime', 'Wake-up', 'Nap', 'Pages read', 'Early', 'How it went', 'Reading', 'Walk', 'Journaling'])
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

  it('takes the dropdown 1 to 5 for How it went', () => {
    const p = plan({ ...none, count })
    expect(p.practices.find((x) => x.name === 'How it went')).toEqual({ name: 'How it went', data_type: 'Text', dropdown_variants: '1,2,3,4,5' })
    expect(p.practices.find((x) => x.name === 'Pages read')).toEqual({ name: 'Pages read', data_type: 'Int' })
  })

  it('leaves out unticked optionals', () => {
    const p = plan({ ...none, sleep: { ...sleep, nap: null }, count: { ...count, early: null, how: null } })
    expect(p.practices.map((x) => x.name)).toEqual(['Bedtime', 'Wake-up', 'Pages read'])
  })

  it('numbers a report name that is taken', () => {
    expect(uniqueName('Sleep', [])).toBe('Sleep')
    expect(uniqueName('Sleep', [report('Sleep')])).toBe('Sleep 2')
    expect(uniqueName('Sleep', [report('Sleep'), report('Sleep 2')])).toBe('Sleep 3')
    expect(plan({ ...none, days: { names: ['Walk'] } }, [], [report('days report')]).reports[0].name).toBe('days report 2')
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
    f.state.failAt = 2 // Study
    await expect(runPlan(p, f.api, () => {})).rejects.toThrow()
    f.log.length = 0
    await runPlan(p, f.api, () => {})
    expect(f.log).toEqual(['practice:Study', 'report:duration report', 'practice:Walk', 'report:days report'])
    expect(f.reports.map((r) => r.name)).toEqual(['duration report', 'days report'])
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

  it('reuses an active Int How it went as the plan does', async () => {
    const f = fakeApi([prac('How it went', 'Int')])
    const p = plan({ ...none, count }, f.practices)
    expect(p.practices.map((x) => x.name)).toEqual(['Pages read', 'Early'])
    await runPlan(p, f.api, () => {})
    expect(f.practices.filter((x) => x.practice === 'How it went')).toHaveLength(1)
  })

  it('puts the right practices and numbers in each definition', async () => {
    const reading = prac('Reading', 'Duration')
    const f = fakeApi([reading])
    await runPlan(plan(all, f.practices), f.api, () => {})
    const id = (name: string) => f.practices.find((x) => x.practice === name)!.id
    const tpl = (name: string) => (f.defs[name] as { Panels: { template: Record<string, unknown> } }).Panels.template
    expect(tpl('sleep report')).toEqual({ Sleep: { bedtime: id('Bedtime'), wake: id('Wake-up'), nap: id('Nap'), min: 360, max: 540 } })
    expect(tpl('japa report')).toEqual({ Japa: { total: id('Pages read'), target: 20, morning: id('Early'), quality: id('How it went'), attunement: null } })
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
