import { describe, it, expect } from 'vitest'

type Dict = { settings: Record<string, string> }
const files = import.meta.glob<Dict>('../../../public/locales/*/translation.json', { eager: true, import: 'default' })

const KEYS = [
  'userDetails', 'preferences', 'theme', 'themeAuto', 'themeLight', 'themeDark', 'previewChannel', 'previewHint',
  'accountData', 'importCsv', 'support', 'helpSupport', 'aboutShort', 'updateAvailable', 'logout',
]

describe('settings.* translations', () => {
  it('has every new key in en, ru and uk', () => {
    const langs = Object.keys(files).map((p) => /locales\/(\w+)\//.exec(p)![1]).sort()
    expect(langs).toEqual(['en', 'ru', 'uk'])
    for (const [path, dict] of Object.entries(files)) {
      for (const k of KEYS) expect(dict.settings[k], `${path} settings.${k}`).toBeTruthy()
    }
  })
})

/** Every key of a namespace, nested ones dotted, plural forms folded into their base key. */
const keysOf = (o: object, prefix = ''): string[] => [...new Set(Object.entries(o).flatMap(([k, v]) =>
  typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k.replace(/_(one|few|many|other)$/, '')}`]))].sort()

describe('settings sub-page translations', () => {
  it('has the same keys in en, ru and uk', () => {
    const dicts = Object.values(files) as unknown as Record<string, object>[]
    for (const ns of ['userDetails', 'password', 'help', 'support', 'import', 'auth', 'shared', 'yatraJoin', 'notFound']) {
      const [en, ...rest] = dicts.map((d) => keysOf(d[ns]))
      expect(en.length, ns).toBeGreaterThan(0)
      for (const other of rest) expect(other, ns).toEqual(en)
    }
  })
})
