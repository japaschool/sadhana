import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The worker loads sw-lib.js with importScripts; run it the same way against a fake `self`.
// (import.meta.url is http:// under the jsdom environment, so resolve from the app root instead.)
const scope = {}
new Function('self', readFileSync(resolve(process.cwd(), 'public/sw-lib.js'), 'utf8'))(scope)
const { entryDate, dayDate, outboxKey, overlay, flushRecords, isUnchanged } = scope.swLib

const entry = (auth, date, practice, value, seq = 1) => {
  const url = `https://app.sadhana.pro/api/diary/${date}/entry`
  const body = JSON.stringify({ entry: { practice, value } })
  return { key: outboxKey(auth, url, body), url, auth, body, seq }
}

describe('paths', () => {
  it('reads the date of entry PUTs and day GETs only', () => {
    expect(entryDate('/api/diary/2026-10-09/entry')).toBe('2026-10-09')
    expect(entryDate('/api/diary/2026-10-09')).toBeNull()
    expect(dayDate('/api/diary/2026-10-09')).toBe('2026-10-09')
    expect(dayDate('/api/diary/incomplete-days')).toBeNull()
  })
})

describe('outboxKey', () => {
  it('is one key per account, date and practice', () => {
    expect(entry('Token a', '2026-10-09', 'Japa', { Int: 1 }).key).toBe('Token a|2026-10-09|Japa')
    expect(entry('Token a', '2026-10-09', 'Japa', { Int: 2 }).key).toBe(entry('Token a', '2026-10-09', 'Japa', null).key)
    expect(entry('Token b', '2026-10-09', 'Japa', null).key).not.toBe(entry('Token a', '2026-10-09', 'Japa', null).key)
  })

  it('falls back to the url for a body that is not an entry', () => {
    expect(outboxKey('Token a', '/api/x', 'not json')).toBe('Token a|/api/x')
  })
})

describe('overlay', () => {
  const day = { diary_day: [
    { practice: 'Japa', data_type: 'Int', value: { Int: 4 } },
    { practice: 'Reading', data_type: 'Bool' },
  ] }

  it('replaces and adds pending values for that date and account', () => {
    const out = overlay(day, [
      entry('Token a', '2026-10-09', 'Japa', { Int: 16 }),
      entry('Token a', '2026-10-09', 'Yoga', { Duration: 30 }),
    ], '2026-10-09', 'Token a')
    expect(out.diary_day).toEqual([
      { practice: 'Japa', data_type: 'Int', value: { Int: 16 } },
      { practice: 'Reading', data_type: 'Bool' },
      { practice: 'Yoga', value: { Duration: 30 } },
    ])
  })

  it('applies a pending clear (null)', () => {
    const out = overlay(day, [entry('Token a', '2026-10-09', 'Japa', null)], '2026-10-09', 'Token a')
    expect(out.diary_day[0].value).toBeNull()
  })

  it('ignores other dates and other accounts', () => {
    const out = overlay(day, [
      entry('Token a', '2026-10-08', 'Japa', { Int: 1 }),
      entry('Token b', '2026-10-09', 'Japa', { Int: 2 }),
    ], '2026-10-09', 'Token a')
    expect(out).toEqual(day)
  })
})

describe('flushRecords', () => {
  const ok = (status) => async () => new Response(null, { status })

  it('sends oldest first and settles 2xx and 4xx', async () => {
    const sent = [], settled = []
    const recs = [entry('a', '2026-10-09', 'B', null, 2), entry('a', '2026-10-09', 'A', null, 1)]
    const out = await flushRecords(recs, async (r) => { sent.push(r.seq); return new Response(null, { status: r.seq === 1 ? 200 : 400 }) },
      async (r) => { settled.push(r.seq) })
    expect(sent).toEqual([1, 2])
    expect(settled).toEqual([1, 2])
    expect(out.get(recs[1].key)).toMatchObject({ seq: 1 })
    expect(out.get(recs[0].key).res.status).toBe(400)
  })

  it('stops at a network error and keeps the rest', async () => {
    const settled = []
    const recs = [entry('a', '2026-10-09', 'A', null, 1), entry('a', '2026-10-09', 'B', null, 2)]
    const out = await flushRecords(recs, async () => { throw new TypeError('offline') }, async (r) => { settled.push(r) })
    expect(settled).toEqual([])
    expect(out.size).toBe(0)
  })

  it('stops at a 5xx without settling it', async () => {
    const settled = []
    const recs = [entry('a', '2026-10-09', 'A', null, 1), entry('a', '2026-10-09', 'B', null, 2)]
    const out = await flushRecords(recs, ok(503), async (r) => { settled.push(r) })
    expect(settled).toEqual([])
    expect(out.size).toBe(0)
  })
})

describe('isUnchanged', () => {
  it('is true only when the stored record is the one that was sent', () => {
    const sent = entry('a', '2026-10-09', 'A', { Int: 4 }, 1)
    expect(isUnchanged(sent, sent)).toBe(true)
    expect(isUnchanged({ ...sent, seq: 2 }, sent)).toBe(false)
    expect(isUnchanged(undefined, sent)).toBe(false)
  })
})
