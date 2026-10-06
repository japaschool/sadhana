import { describe, it, expect } from 'vitest'

type Dict = { today?: Record<string, string> }
const files = import.meta.glob<Dict>('../../../public/locales/*/translation.json', { eager: true, import: 'default' })
const byLang = Object.fromEntries(
  Object.entries(files).map(([path, dict]) => [/locales\/(\w+)\//.exec(path)![1], dict.today ?? {}]),
)
const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '')

describe('today.* translations', () => {
  it('exist in en, ru and uk with the same base keys', () => {
    const en = new Set(Object.keys(byLang.en).map(base))
    expect(en.size).toBeGreaterThan(20)
    for (const lang of ['ru', 'uk']) {
      expect(new Set(Object.keys(byLang[lang]).map(base))).toEqual(en)
    }
  })

  it('ru and uk have one/few/many plural forms for requiredLeft', () => {
    for (const lang of ['ru', 'uk']) {
      for (const form of ['one', 'few', 'many']) {
        expect(byLang[lang][`requiredLeft_${form}`]).toBeTruthy()
      }
    }
  })
})
