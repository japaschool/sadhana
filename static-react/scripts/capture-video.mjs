// Records a short phone walk-through of the app per language, from a local server seeded by seed-demo.ts.
// Run: node scripts/capture-video.mjs [lang...]   (needs `npx playwright install chromium ffmpeg`; $FFMPEG overrides)
// Output: src/assets/demo/walkthrough.<lang>.webm (VP9, 780×1584). It clears and refills today's Lectures, so it can be rerun.
import { execFileSync } from 'node:child_process'
import { createWriteStream, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.APP ?? 'http://localhost:8080'
const OUT = new URL('../src/assets/demo/', import.meta.url).pathname
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'ru', 'uk']
const LECTURES = { en: 'Lectures', ru: 'Лекции', uk: 'Лекції' }
const SLEEP = ['Sleep', 'Сон']
const VIEWPORT = { width: 390, height: 792 }
const FPS = 25

// Playwright's video and Chrome's screencast are both 1×, so frames are 2× screenshots taken in a loop (~25 fps),
// and Playwright's ffmpeg encodes them.
function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG
  const cache = join(homedir(), process.platform === 'darwin' ? 'Library/Caches' : '.cache', 'ms-playwright')
  const dir = readdirSync(cache).filter((d) => d.startsWith('ffmpeg-')).sort().at(-1)
  if (!dir) throw new Error('no ffmpeg: run `npx playwright install ffmpeg` or set $FFMPEG')
  return join(cache, dir, readdirSync(join(cache, dir)).find((f) => f.startsWith('ffmpeg-')))
}

async function screencast(page) {
  const frames = []
  let on = true
  const loop = (async () => {
    while (on) {
      const jpeg = await page.screenshot({ type: 'jpeg', quality: 90, timeout: 2000 }).catch(() => null)
      if (jpeg) frames.push({ at: Date.now() / 1000, jpeg })
    }
  })()
  return async (out) => {
    on = false
    await loop
    // Frames arrive unevenly; hold each one until the next for a constant frame rate.
    // (Playwright's ffmpeg can't read stdin, so the frames go through a temp file.)
    const tmp = mkdtempSync(join(tmpdir(), 'video-')), mjpeg = join(tmp, 'frames.mjpeg')
    const file = createWriteStream(mjpeg)
    const end = frames.at(-1).at + 0.5
    for (let t = frames[0].at, i = 0; t < end; t += 1 / FPS) {
      while (i + 1 < frames.length && frames[i + 1].at <= t) i++
      if (!file.write(frames[i].jpeg)) await new Promise((ok) => file.once('drain', ok))
    }
    await new Promise((ok) => file.end(ok))
    try {
      execFileSync(ffmpeg(), ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', mjpeg,
        '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', out], { stdio: 'inherit' })
    } finally {
      rmSync(tmp, { recursive: true })
    }
  }
}

// Taps don't show up in a recording, so draw a ripple where each one lands.
const TAPS = () => addEventListener('pointerdown', (e) => {
  const d = document.createElement('div')
  Object.assign(d.style, {
    position: 'fixed', left: `${e.clientX - 22}px`, top: `${e.clientY - 22}px`, width: '44px', height: '44px',
    borderRadius: '50%', background: 'rgba(58,125,92,0.35)', pointerEvents: 'none', zIndex: 99999,
    transition: 'transform .5s, opacity .5s',
  })
  document.body.appendChild(d)
  requestAnimationFrame(() => { d.style.transform = 'scale(1.6)'; d.style.opacity = '0' })
  setTimeout(() => d.remove(), 600)
}, true)

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Token ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`)
  return res
}

async function login(lang) {
  const res = await api('POST', '/users/login', { user: { email: `demo-${lang}@demo.sadhana.pro`, password: 'demo-password' } })
  return (await res.json()).user.token
}

const pause = (page, ms) => page.waitForTimeout(ms)
const tap = async (page, locator) => { await locator.scrollIntoViewIfNeeded(); await pause(page, 400); await locator.tap(); await pause(page, 900) }
const scroll = async (page, dy, steps = 30) => { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await pause(page, 25) } await pause(page, 700) }

async function walk(page, lang) {
  const nav = (to) => page.locator(`nav a[href="${to}"]`)
  // Today: fill in a value.
  await page.goto(BASE + '/')
  await page.waitForLoadState('networkidle')
  await pause(page, 1000) // fonts settle before the recording starts
  const stop = await screencast(page)
  await pause(page, 2000)
  await tap(page, page.getByRole('button', { name: new RegExp(LECTURES[lang]) }).first())
  await page.keyboard.type('45', { delay: 180 })
  await page.keyboard.press('Enter')
  await pause(page, 1500)
  // Insights: the overview, its year map, then the Sleep chart.
  await tap(page, nav('/charts'))
  await page.waitForLoadState('networkidle')
  await pause(page, 1800)
  await scroll(page, 600)
  await tap(page, page.locator('a[href="/insights/year"]'))
  await page.waitForLoadState('networkidle')
  await pause(page, 2500)
  await tap(page, nav('/charts'))
  await scroll(page, -3000, 15)
  await tap(page, page.getByRole('radiogroup').first().getByRole('radio').nth(1)) // Overview → Charts
  await tap(page, page.locator('button[aria-haspopup="menu"]', { hasText: '▾' }))
  await tap(page, page.getByRole('menuitemradio', { name: new RegExp(SLEEP.join('|')) }).first())
  await pause(page, 2000)
  await scroll(page, 700)
  await pause(page, 1500)
  // Yatra: the group's day.
  await tap(page, nav('/yatras'))
  await page.waitForLoadState('networkidle')
  await pause(page, 3000)
  return stop
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
try {
  for (const lang of LANGS) {
    const token = await login(lang)
    const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await api('PUT', `/diary/${today}/entry`, { entry: { practice: LECTURES[lang], value: null } }, token)
    const ctx = await browser.newContext({
      viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      serviceWorkers: 'block', colorScheme: 'light', locale: lang,
    })
    await ctx.addInitScript(([t, l]) => {
      localStorage.setItem('yew.token', JSON.stringify(t))
      localStorage.setItem('i18nextLng', l)
    }, [token, lang])
    await ctx.addInitScript(TAPS)
    const page = await ctx.newPage()
    const stop = await walk(page, lang)
    await stop(join(OUT, `walkthrough.${lang}.webm`))
    await ctx.close()
    console.log(`${lang} done`)
  }
} finally {
  await browser.close()
}
