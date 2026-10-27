import { describe, expect, it } from 'vitest'

type Dict = { yatraSettings: Record<string, string>; common: Record<string, string> }
const files = import.meta.glob<Dict>('../../../../public/locales/*/translation.json', { eager: true, import: 'default' })

const base = (k: string) => k.replace(/_(one|few|many|other)$/, '')

describe('yatraSettings.* translations', () => {
  it('has the same keys, all non-empty, in en, ru and uk', () => {
    const sets = Object.entries(files).map(([path, d]) => {
      for (const [k, v] of Object.entries(d.yatraSettings)) expect(v, `${path} yatraSettings.${k}`).toBeTruthy()
      expect(d.common.undo, `${path} common.undo`).toBeTruthy()
      return [...new Set(Object.keys(d.yatraSettings).map(base))].sort()
    })
    expect(sets).toHaveLength(3)
    expect(sets[1]).toEqual(sets[0])
    expect(sets[2]).toEqual(sets[0])
  })
})
