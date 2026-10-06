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
