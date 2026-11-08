// Captures the landing page's app screenshots from a local server seeded by seed-demo.ts.
// Run: node scripts/capture-shots.mjs [lang...]   (ONLY=today,year to redo some)   (needs `npx playwright install chromium` and `cwebp`)
// Output: src/assets/shots/<shot>.<lang>.webp
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.APP ?? 'http://localhost:8080'
const OUT = new URL('../src/assets/shots/', import.meta.url).pathname
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'ru', 'uk']
const REPORTS = { sleep: ['Sleep', 'Сон'], japa: ['Japa', 'Джапа'], table: ['Sadhana chart', 'Таблица садханы', 'Таблиця садгани'] }

const DEVICES = {
  phone: { viewport: { width: 390, height: 792 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}

const charts = (report) => async (page, ids) => {
  await page.evaluate((id) => localStorage.setItem('insights-report', id), ids[report])
  await page.goto(`${BASE}/charts`)
  await page.getByRole('radiogroup').first().getByRole('radio').nth(1).click()
}
const go = (path) => (page) => page.goto(BASE + path)
const BREATHWORK = { en: 'Breathwork', ru: 'Дыхательные практики', uk: 'Дихальні практики' }
const newPractice = async (page, _ids, lang) => {
  await page.goto(`${BASE}/settings/practices/new`)
  await page.getByRole('textbox').first().fill(BREATHWORK[lang])
  await page.getByRole('radio').nth(2).click() // Duration
}

const SHOTS = [
  ['today', 'phone', go('/')],
  ['overview', 'phone', go('/charts')],
  ['sleep', 'phone', charts('sleep')],
  ['japa', 'phone', charts('japa')],
  ['table', 'phone', charts('table')],
  ['year', 'phone', go('/insights/year')],
  ['group', 'phone', go('/yatras')],
  ['practices', 'phone', newPractice],
  ['overview-tablet', 'tablet', go('/charts')],
  ['overview-desktop', 'desktop', go('/charts')],
]

async function api(path, body, token) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Token ${token}` } : {}) },
    body: body && JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

const tmp = mkdtempSync(join(tmpdir(), 'shots-'))
const browser = await chromium.launch()
try {
  for (const lang of LANGS) {
    const { user } = await api('/users/login', { user: { email: `demo-${lang}@demo.sadhana.pro`, password: 'demo-password' } })
    const { reports } = await api('/reports?panels=4', null, user.token)
    const ids = Object.fromEntries(Object.entries(REPORTS).map(([k, names]) => [k, reports.find((r) => names.includes(r.name)).id]))
    for (const [name, device, open] of SHOTS) {
      if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue
      const ctx = await browser.newContext({ ...DEVICES[device], serviceWorkers: 'block', colorScheme: 'light', locale: lang })
      await ctx.addInitScript(([t, l]) => {
        localStorage.setItem('yew.token', JSON.stringify(t))
        localStorage.setItem('i18nextLng', l)
      }, [user.token, lang])
      const page = await ctx.newPage()
      await page.goto(BASE + '/settings') // a first load, so open() can touch localStorage before the real one
      await open(page, ids, lang)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1500) // chart and font transitions
      const png = join(tmp, `${name}.png`)
      await page.screenshot({ path: png })
      execFileSync('cwebp', ['-quiet', '-q', '82', png, '-o', join(OUT, `${name}.${lang}.webp`)])
      await ctx.close()
      console.log(`${lang} ${name}`)
    }
  }
} finally {
  await browser.close()
  rmSync(tmp, { recursive: true })
}
