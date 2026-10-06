# Mobile Today Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the new mobile Today screen (design frames 3a–3d) on a new design system and a three-layout (mobile/tablet/desktop) architecture. Every screen and layout not yet redesigned falls back to the legacy dark shell.

**Architecture:**
- `useLayout()` picks `mobile | tablet | desktop` with `matchMedia`, and `ByLayout` renders that layout's element or the legacy page.
- The new UI lives under `src/ui` (tokens and primitives), `src/layouts` (shell and app bar) and `src/features/today` (hook, pure helpers, mobile components).
- Tokens are CSS variables scoped to `.ui-root` and exposed to Tailwind v4 as `ui-*` colours, so the legacy DaisyUI theme is unaffected.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind v4 (`@tailwindcss/vite`), TanStack Query 5, react-router 7, react-i18next, framer-motion 12, Vitest 4 + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-06-mobile-today-redesign-design.md`

## Global Constraints

- All commands run from `app-react/` on the host (Node is installed there). Tests: `npx vitest run <path>`. Types: `npx tsc -b`. Lint: `npm run lint`.
- **No new dependencies.**
- New code uses only the `ui-*` Tailwind colours from `src/ui/theme.css`. No DaisyUI classes (`btn`, `bg-base-*`, `text-base-content`, …) and no imports from `src/theme/tokens.ts`.
- Dark tokens use only colours from design frame 1a-dark, plus `#C2412D` for danger.
- Fonts: Manrope (UI) and IBM Plex Mono (numbers) via Google Fonts. Tailwind classes `font-ui` / `font-ui-mono`.
- Dates in new code use `toDateStr()` from `src/features/today/date.ts`. **Never `toISOString()` for a calendar date.**
- An empty input saves `null`; never `0` or `""`. Unchanged values are not saved.
- Every user-visible string goes through i18n with keys in `en`, `ru` and `uk` (`public/locales/*/translation.json`). English test strings also go in `src/test/setup.ts`.
- Anything rendered in a portal goes through `UiPortal`, so the theme tokens resolve.
- Legacy code stays untouched, with four exceptions: `src/router.tsx` (route wiring), `src/api/practices.ts` (`saveDiaryEntry` accepts `null`), `src/components/layout/HomeHeaderActions.tsx` (uses the extracted actions) and `src/test/mocks/framer-motion.tsx` (strips drag props).
- Commit after every task with a conventional message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Switching day while a save or text edit is in flight.** The value must land on the day it was typed on, and that day's cache must be refreshed. Tests: Task 4 (`invalidates the day the save was made on`) and Task 8 (`flushes a pending edit on unmount`).
2. **Menus and sheets in dark mode.** Portalled UI must sit inside `.ui-root`, otherwise it renders with no tokens (transparent and unreadable). Test: Task 5 (`renders inside a .ui-root portal`).
3. **Escape inside a menu that's inside the calendar sheet.** It must close only the menu, not the sheet. Test: Task 11 (`Escape in the month picker keeps the sheet open`).
4. **Russian and Ukrainian plurals.** "1 / 2 / 5 required left" must use the `_one/_few/_many` forms. Test: Task 3 (`ru and uk have one/few/many plural forms`).
5. **A choice value that isn't in the option list** (legacy data). It should still display, with no option marked selected. Test: Task 9 (`shows a value missing from the options without selecting one`).

---

### Task 1: Pure date and value helpers

**Files:**
- Create: `app-react/src/features/today/date.ts`
- Create: `app-react/src/features/today/values.ts`
- Test: `app-react/src/features/today/date.test.ts`, `app-react/src/features/today/values.test.ts`

**Interfaces:**
- Produces:
  - `toDateStr(d: Date): string`
  - `fromDateStr(s: string): Date`
  - `addDays(d: Date, n: number): Date`
  - `isSameDay(a: Date, b: Date): boolean`
  - `isFuture(d: Date, today?: Date): boolean`
  - `nineDayWindow(d: Date): Date[]`
  - `monthGrid(year: number, month: number): (Date | null)[]`
  - `parseOptions(raw?: string | null): string[]`
  - `formatDuration(total: number, units: DurationUnits): string`
  - `formatTime(t: { h: number; m: number }): string`
  - `sameValue(a?: PracticeValue | null, b?: PracticeValue | null): boolean`
  - `capitalize(s: string, locale: string): string`
  - `interface DurationUnits { h: string; min: string }`

- [ ] **Step 1: Write the failing tests**

`app-react/src/features/today/date.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { toDateStr, fromDateStr, nineDayWindow, monthGrid, isFuture, isSameDay } from './date'

describe('date helpers', () => {
  beforeAll(() => { vi.stubEnv('TZ', 'Europe/Kyiv') })
  afterAll(() => { vi.unstubAllEnvs() })

  it('formats the local calendar day, not the UTC one', () => {
    const justAfterMidnight = new Date(2026, 9, 6, 0, 30)
    // Guard: proves the TZ stub is active (UTC is still on the 5th).
    expect(justAfterMidnight.toISOString().startsWith('2026-10-05')).toBe(true)
    expect(toDateStr(justAfterMidnight)).toBe('2026-10-06')
  })

  it('round-trips through fromDateStr', () => {
    expect(toDateStr(fromDateStr('2026-02-28'))).toBe('2026-02-28')
  })

  it('builds Sun + Mon–Sun + Mon around any day of the week', () => {
    for (const day of [5, 6, 11]) { // Mon, Tue, Sun
      const w = nineDayWindow(new Date(2026, 9, day))
      expect(w).toHaveLength(9)
      expect(toDateStr(w[0])).toBe('2026-10-04')
      expect(toDateStr(w[8])).toBe('2026-10-12')
    }
  })

  it('builds a Monday-first month grid', () => {
    const oct = monthGrid(2026, 9) // 1 Oct 2026 is a Thursday
    expect(oct.slice(0, 3)).toEqual([null, null, null])
    expect(oct).toHaveLength(3 + 31)
    const feb = monthGrid(2027, 1) // 1 Feb 2027 is a Monday
    expect(feb[0]?.getDate()).toBe(1)
    expect(feb).toHaveLength(28)
  })

  it('compares days and future-ness by calendar day', () => {
    const today = new Date(2026, 9, 6, 23, 0)
    expect(isFuture(new Date(2026, 9, 6, 1, 0), today)).toBe(false)
    expect(isFuture(new Date(2026, 9, 7), today)).toBe(true)
    expect(isSameDay(new Date(2026, 9, 6, 1), new Date(2026, 9, 6, 22))).toBe(true)
  })
})
```

`app-react/src/features/today/values.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseOptions, formatDuration, formatTime, sameValue, capitalize } from './values'

const units = { h: 'h', min: 'min' }

describe('parseOptions', () => {
  it('splits on commas and newlines, trims, drops empties', () => {
    expect(parseOptions('1, 2,3')).toEqual(['1', '2', '3'])
    expect(parseOptions('Low\nCalm\n\nJoyful ')).toEqual(['Low', 'Calm', 'Joyful'])
    expect(parseOptions('a,\nb')).toEqual(['a', 'b'])
    expect(parseOptions(undefined)).toEqual([])
    expect(parseOptions(' , ')).toEqual([])
  })
})

describe('formatDuration', () => {
  it('formats minutes, hours, and both', () => {
    expect(formatDuration(0, units)).toBe('0 min')
    expect(formatDuration(30, units)).toBe('30 min')
    expect(formatDuration(60, units)).toBe('1 h')
    expect(formatDuration(75, units)).toBe('1 h 15 min')
  })
})

describe('formatTime', () => {
  it('zero-pads', () => { expect(formatTime({ h: 4, m: 5 })).toBe('04:05') })
})

describe('sameValue', () => {
  it('treats undefined and null as the same empty value', () => {
    expect(sameValue(undefined, null)).toBe(true)
    expect(sameValue({ Int: 1 }, { Int: 1 })).toBe(true)
    expect(sameValue({ Int: 1 }, { Int: 2 })).toBe(false)
    expect(sameValue({ Text: 'x' }, null)).toBe(false)
  })
})

describe('capitalize', () => {
  it('uppercases the first letter in the given locale', () => {
    expect(capitalize('вт, 6 октября', 'ru')).toBe('Вт, 6 октября')
    expect(capitalize('', 'en')).toBe('')
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/features/today/date.test.ts src/features/today/values.test.ts`
Expected: FAIL, because modules `./date` and `./values` can't be resolved.

- [ ] **Step 3: Implement**

`app-react/src/features/today/date.ts`:
```ts
/** Local-calendar yyyy-mm-dd. Never use toISOString() for this: it shifts the day in non-UTC zones. */
export function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateStr(a) === toDateStr(b)
}

export function isFuture(d: Date, today: Date = new Date()): boolean {
  return toDateStr(d) > toDateStr(today)
}

/** Sunday before d's Mon–Sun week, the week itself, and the Monday after. */
export function nineDayWindow(d: Date): Date[] {
  const monday = addDays(d, -((d.getDay() + 6) % 7))
  return Array.from({ length: 9 }, (_, i) => addDays(monday, i - 1))
}

/** Monday-first month grid: `null` for leading blanks, then each day of the month. */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  return [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
  ]
}
```

`app-react/src/features/today/values.ts`:
```ts
import type { PracticeValue } from '../../types/api'

export interface DurationUnits { h: string; min: string }

/** Dropdown options: main stores them comma-separated, the old React form newline-separated. */
export function parseOptions(raw?: string | null): string[] {
  return (raw ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
}

export function formatDuration(total: number, u: DurationUnits): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} ${u.min}`
  return m === 0 ? `${h} ${u.h}` : `${h} ${u.h} ${m} ${u.min}`
}

export function formatTime(t: { h: number; m: number }): string {
  return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`
}

/** undefined and null both mean "no value". */
export function sameValue(a?: PracticeValue | null, b?: PracticeValue | null): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function capitalize(s: string, locale: string): string {
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/features/today/date.test.ts src/features/today/values.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/today/date.ts src/features/today/values.ts src/features/today/date.test.ts src/features/today/values.test.ts
git commit -m "feat(today): local date and value helpers for the new Today screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Layout selection (`useLayout`, `ByLayout`)

**Files:**
- Create: `app-react/src/layouts/useLayout.ts`
- Create: `app-react/src/layouts/ByLayout.tsx`
- Create: `app-react/src/test/viewport.ts` (test helper that mocks `matchMedia`)
- Test: `app-react/src/layouts/ByLayout.test.tsx`

**Interfaces:**
- Produces:
  - `type Layout = 'mobile' | 'tablet' | 'desktop'`
  - `useLayout(): Layout`
  - `ByLayout(props: { mobile?: ReactNode; tablet?: ReactNode; desktop?: ReactNode; legacy: ReactNode })`
  - Test helper `setViewportWidth(width: number): void`. It installs a `window.matchMedia` that evaluates `min-width` queries against `width` and notifies subscribers.

- [ ] **Step 1: Write the test helper and the failing test**

`app-react/src/test/viewport.ts`:
```ts
type Listener = () => void
const listeners = new Set<Listener>()
let width = 390

/** Installs a matchMedia stub that evaluates `(min-width: Npx)` against `w`, then notifies subscribers. */
export function setViewportWidth(w: number) {
  width = w
  window.matchMedia = ((query: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0)
    return {
      matches: width >= min,
      media: query,
      onchange: null,
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  }) as typeof window.matchMedia
  listeners.forEach((l) => l())
}
```

`app-react/src/layouts/ByLayout.test.tsx`:
```tsx
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ByLayout } from './ByLayout'
import { setViewportWidth } from '../test/viewport'

const ui = <ByLayout mobile={<p>mobile</p>} desktop={<p>desktop</p>} legacy={<p>legacy</p>} />

describe('ByLayout', () => {
  beforeEach(() => setViewportWidth(390))

  it('renders the mobile element below 640px', () => {
    render(ui)
    expect(screen.getByText('mobile')).toBeInTheDocument()
  })

  it('falls back to legacy for a layout without an element (tablet)', () => {
    render(ui)
    act(() => setViewportWidth(800))
    expect(screen.getByText('legacy')).toBeInTheDocument()
  })

  it('renders the desktop element at 1024px and above', () => {
    setViewportWidth(1280)
    render(ui)
    expect(screen.getByText('desktop')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/layouts/ByLayout.test.tsx`
Expected: FAIL, because `./ByLayout` can't be resolved.

- [ ] **Step 3: Implement**

`app-react/src/layouts/useLayout.ts`:
```ts
import { useSyncExternalStore } from 'react'

export type Layout = 'mobile' | 'tablet' | 'desktop'

// Tailwind's sm / lg breakpoints.
const TABLET = '(min-width: 640px)'
const DESKTOP = '(min-width: 1024px)'

function current(): Layout {
  if (window.matchMedia(DESKTOP).matches) return 'desktop'
  if (window.matchMedia(TABLET).matches) return 'tablet'
  return 'mobile'
}

function subscribe(onChange: () => void) {
  const queries = [window.matchMedia(TABLET), window.matchMedia(DESKTOP)]
  queries.forEach((q) => q.addEventListener('change', onChange))
  return () => queries.forEach((q) => q.removeEventListener('change', onChange))
}

export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, current)
}
```

`app-react/src/layouts/ByLayout.tsx`:
```tsx
import type { ReactNode } from 'react'
import { useLayout } from './useLayout'

interface ByLayoutProps {
  mobile?: ReactNode
  tablet?: ReactNode
  desktop?: ReactNode
  legacy: ReactNode
}

/** Renders the current layout's element, or `legacy` until that layout is redesigned. */
export function ByLayout({ legacy, ...layouts }: ByLayoutProps) {
  return <>{layouts[useLayout()] ?? legacy}</>
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/layouts/ByLayout.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/layouts src/test/viewport.ts
git commit -m "feat(layouts): useLayout + ByLayout with legacy fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Theme tokens, fonts and i18n keys

**Files:**
- Create: `app-react/src/ui/theme.css`
- Modify: `app-react/src/index.css:1` (import theme right after tailwind)
- Modify: `app-react/index.html:9-22` (font URL)
- Modify: `app-react/public/locales/en/translation.json`, `ru/translation.json`, `uk/translation.json` (add a top-level `today` object)
- Modify: `app-react/src/test/setup.ts` (add the English `today` block next to `home`)
- Test: `app-react/src/features/today/locales.test.ts`

**Interfaces:**
- Produces:
  - Tailwind colours `ui-bg, ui-surface, ui-sheet, ui-field, ui-chip, ui-hairline, ui-control, ui-ink, ui-ink2, ui-muted, ui-faint, ui-faint2, ui-accent, ui-accent-fill, ui-accent-soft, ui-accent-pill, ui-toggle-off, ui-toggle-off-knob, ui-toggle-on-knob, ui-selected, ui-on-selected, ui-backdrop, ui-tabbar, ui-danger, ui-primary, ui-on-primary`, used as `bg-ui-surface`, `text-ui-muted`, `border-ui-control`, etc. They are only valid inside `.ui-root`.
  - Fonts `font-ui` and `font-ui-mono`.
  - CSS var `--ui-bg` (read by `MobileShell` for `theme-color`).
  - i18n keys under `today.*` (listed below).

- [ ] **Step 1: Write the failing locale test**

`app-react/src/features/today/locales.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/features/today/locales.test.ts`
Expected: FAIL, because `expected 0 to be greater than 20` (there are no `today` keys yet).

- [ ] **Step 3: Add the translations**

Add this top-level `"today"` object to `app-react/public/locales/en/translation.json`:
```json
"today": {
  "group": "Practices",
  "filledOf": "{{filled}} of {{total}}",
  "requiredLeft_one": "{{count}} required left",
  "requiredLeft_other": "{{count}} required left",
  "required": "Required",
  "add": "+ Add",
  "edit": "Edit",
  "editValue": "Edit {{name}}",
  "addTimeFor": "Add time to {{name}}",
  "done": "Done",
  "clear": "Clear",
  "mode": "Mode",
  "modeAdd": "Add",
  "modeSet": "Set total",
  "logged": "Logged:",
  "newTotal": "New total",
  "addAmount": "Add {{amount}}",
  "setAmount": "Set {{amount}}",
  "keyBackspace": "Delete digit",
  "keyReset": "Reset",
  "savedAsYouType": "Saved as you type",
  "textPrompt": "What's on your mind today?",
  "calendar": "Calendar",
  "openCalendar": "Open calendar",
  "prevMonth": "Previous month",
  "nextMonth": "Next month",
  "month": "Month",
  "year": "Year",
  "legendMissing": "Required practices missing",
  "goToday": "Today",
  "unitMin": "min",
  "unitH": "h",
  "more": "More",
  "tabs": "Main navigation",
  "tabToday": "Today",
  "tabInsights": "Insights",
  "tabYatra": "Yatra",
  "tabSettings": "Settings"
}
```

`app-react/public/locales/ru/translation.json`:
```json
"today": {
  "group": "Практики",
  "filledOf": "{{filled}} из {{total}}",
  "requiredLeft_one": "ещё {{count}} обязательная",
  "requiredLeft_few": "ещё {{count}} обязательные",
  "requiredLeft_many": "ещё {{count}} обязательных",
  "requiredLeft_other": "ещё {{count}} обязательных",
  "required": "Обязательно",
  "add": "+ Добавить",
  "edit": "Изменить",
  "editValue": "Изменить: {{name}}",
  "addTimeFor": "Добавить время: {{name}}",
  "done": "Готово",
  "clear": "Очистить",
  "mode": "Режим",
  "modeAdd": "Добавить",
  "modeSet": "Задать итог",
  "logged": "Записано:",
  "newTotal": "Новый итог",
  "addAmount": "Добавить {{amount}}",
  "setAmount": "Установить {{amount}}",
  "keyBackspace": "Удалить цифру",
  "keyReset": "Сбросить",
  "savedAsYouType": "Сохраняется по мере ввода",
  "textPrompt": "Что у вас на душе сегодня?",
  "calendar": "Календарь",
  "openCalendar": "Открыть календарь",
  "prevMonth": "Предыдущий месяц",
  "nextMonth": "Следующий месяц",
  "month": "Месяц",
  "year": "Год",
  "legendMissing": "Не заполнены обязательные практики",
  "goToday": "Сегодня",
  "unitMin": "мин",
  "unitH": "ч",
  "more": "Ещё",
  "tabs": "Основная навигация",
  "tabToday": "Сегодня",
  "tabInsights": "Аналитика",
  "tabYatra": "Ятра",
  "tabSettings": "Настройки"
}
```

`app-react/public/locales/uk/translation.json`:
```json
"today": {
  "group": "Практики",
  "filledOf": "{{filled}} з {{total}}",
  "requiredLeft_one": "ще {{count}} обов'язкова",
  "requiredLeft_few": "ще {{count}} обов'язкові",
  "requiredLeft_many": "ще {{count}} обов'язкових",
  "requiredLeft_other": "ще {{count}} обов'язкових",
  "required": "Обов'язково",
  "add": "+ Додати",
  "edit": "Змінити",
  "editValue": "Змінити: {{name}}",
  "addTimeFor": "Додати час: {{name}}",
  "done": "Готово",
  "clear": "Очистити",
  "mode": "Режим",
  "modeAdd": "Додати",
  "modeSet": "Задати підсумок",
  "logged": "Записано:",
  "newTotal": "Новий підсумок",
  "addAmount": "Додати {{amount}}",
  "setAmount": "Встановити {{amount}}",
  "keyBackspace": "Видалити цифру",
  "keyReset": "Скинути",
  "savedAsYouType": "Зберігається під час введення",
  "textPrompt": "Що у вас на душі сьогодні?",
  "calendar": "Календар",
  "openCalendar": "Відкрити календар",
  "prevMonth": "Попередній місяць",
  "nextMonth": "Наступний місяць",
  "month": "Місяць",
  "year": "Рік",
  "legendMissing": "Не заповнені обов'язкові практики",
  "goToday": "Сьогодні",
  "unitMin": "хв",
  "unitH": "год",
  "more": "Більше",
  "tabs": "Основна навігація",
  "tabToday": "Сьогодні",
  "tabInsights": "Аналітика",
  "tabYatra": "Ятра",
  "tabSettings": "Налаштування"
}
```

In `app-react/src/test/setup.ts`, add the same English block as a JS object (`today: { group: 'Practices', … }`) next to `home:` inside `translation`. Copy every key and value from the en JSON above verbatim.

- [ ] **Step 4: Run the locale test and confirm it passes**

Run: `npx vitest run src/features/today/locales.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the theme tokens**

`app-react/src/ui/theme.css`:
```css
/* New design system (Sadhana Redesign, Turn 3). Tokens are scoped to .ui-root
   so the legacy DaisyUI dark shell is untouched. Anything portalled must render
   inside a .ui-root element too (see ui/primitives/UiPortal.tsx). Light values
   come from frame 3a; dark values only from frame 1a-dark (+ #C2412D danger). */
.ui-root {
  color-scheme: light;
  --ui-bg: #F7F4EE;
  --ui-surface: #FFFFFF;
  --ui-sheet: #FFFDF9;
  --ui-field: #F8F4EC;
  --ui-chip: #F1ECE2;
  --ui-hairline: #ECE6DB;
  --ui-control: #E7E1D6;
  --ui-ink: #1F1B16;
  --ui-ink2: #3E372E;
  --ui-muted: #7A7163;
  --ui-faint: #BDB4A6;
  --ui-faint2: #8A8174;
  --ui-accent: #9A6410;
  --ui-accent-fill: #E8A93A;
  --ui-accent-soft: #FBF0DA;
  --ui-accent-pill: #F3DDB0;
  --ui-toggle-off: #ECE6DB;
  --ui-toggle-off-knob: #FFFFFF;
  --ui-toggle-on-knob: #FFFFFF;
  --ui-selected: #1F1B16;
  --ui-on-selected: #F7F4EE;
  --ui-backdrop: rgba(31, 27, 22, 0.42);
  --ui-tabbar: rgba(247, 244, 238, 0.96);
  --ui-danger: #C2412D;
  --ui-primary: #1F1B16;
  --ui-on-primary: #F7F4EE;

  color: var(--ui-ink);
  /* Literal, not var(--font-ui): Tailwind may tree-shake unused theme vars. */
  font-family: Manrope, ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

@media (prefers-color-scheme: dark) {
  .ui-root {
    color-scheme: dark;
    --ui-bg: #15121D;
    --ui-surface: #211D2C;
    --ui-sheet: #211D2C;
    --ui-field: #2C2738;
    --ui-chip: #2C2738;
    --ui-hairline: #2C2738;
    --ui-control: #332E40;
    --ui-ink: #F1ECE4;
    --ui-ink2: #BDB6C9;
    --ui-muted: #A39DB0;
    --ui-faint: #5C566B;
    --ui-faint2: #8F88A0;
    --ui-accent: #F0B54A;
    --ui-accent-fill: #F0B54A;
    --ui-accent-soft: #4A3D25;
    --ui-accent-pill: #4A3D25;
    --ui-toggle-off: #3A3448;
    --ui-toggle-off-knob: #8F88A0;
    --ui-toggle-on-knob: #15121D;
    --ui-selected: #F0B54A;
    --ui-on-selected: #15121D;
    --ui-backdrop: rgba(21, 18, 29, 0.6);
    --ui-tabbar: rgba(21, 18, 29, 0.94);
    --ui-danger: #C2412D;
    --ui-primary: #F1ECE4;
    --ui-on-primary: #15121D;
  }
}

@theme inline {
  --color-ui-bg: var(--ui-bg);
  --color-ui-surface: var(--ui-surface);
  --color-ui-sheet: var(--ui-sheet);
  --color-ui-field: var(--ui-field);
  --color-ui-chip: var(--ui-chip);
  --color-ui-hairline: var(--ui-hairline);
  --color-ui-control: var(--ui-control);
  --color-ui-ink: var(--ui-ink);
  --color-ui-ink2: var(--ui-ink2);
  --color-ui-muted: var(--ui-muted);
  --color-ui-faint: var(--ui-faint);
  --color-ui-faint2: var(--ui-faint2);
  --color-ui-accent: var(--ui-accent);
  --color-ui-accent-fill: var(--ui-accent-fill);
  --color-ui-accent-soft: var(--ui-accent-soft);
  --color-ui-accent-pill: var(--ui-accent-pill);
  --color-ui-toggle-off: var(--ui-toggle-off);
  --color-ui-toggle-off-knob: var(--ui-toggle-off-knob);
  --color-ui-toggle-on-knob: var(--ui-toggle-on-knob);
  --color-ui-selected: var(--ui-selected);
  --color-ui-on-selected: var(--ui-on-selected);
  --color-ui-backdrop: var(--ui-backdrop);
  --color-ui-tabbar: var(--ui-tabbar);
  --color-ui-danger: var(--ui-danger);
  --color-ui-primary: var(--ui-primary);
  --color-ui-on-primary: var(--ui-on-primary);
  --font-ui: Manrope, ui-sans-serif, system-ui, sans-serif;
  --font-ui-mono: 'IBM Plex Mono', ui-monospace, monospace;
}

.font-ui-mono {
  font-variant-numeric: tabular-nums;
}
```

In `app-react/src/index.css`, add the import as the second line, directly after `@import "tailwindcss";`:
```css
@import "tailwindcss";
@import "./ui/theme.css";
@plugin "daisyui";
```

- [ ] **Step 6: Load the fonts**

In `app-react/index.html`, replace **both** occurrences of the Google Fonts URL (the `preload` link and the `noscript` link) with:
```
https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Playfair+Display:wght@500;700&family=Allura&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap
```
Google serves `cyrillic` and `cyrillic-ext` `@font-face` blocks for both families automatically, which covers Russian and Ukrainian.

- [ ] **Step 7: Check that Tailwind compiles the tokens**

Run: `npx vite build 2>&1 | tail -3 && grep -o 'ui-root' dist/assets/*.css | head -1`
Expected: the build succeeds and `ui-root` appears in the built CSS.

- [ ] **Step 8: Commit**

```bash
git add src/ui/theme.css src/index.css index.html public/locales src/test/setup.ts src/features/today/locales.test.ts
git commit -m "feat(ui): redesign theme tokens (light + 1a-dark), Manrope/Plex Mono, today.* i18n

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `useToday` hook (and `saveDiaryEntry(null)`)

**Files:**
- Modify: `app-react/src/api/practices.ts` (`saveDiaryEntry` signature)
- Create: `app-react/src/features/today/useToday.ts`
- Test: `app-react/src/features/today/useToday.test.tsx`

**Interfaces:**
- Consumes: `toDateStr`, `fromDateStr` and `nineDayWindow` from Task 1; `sameValue` from Task 1.
- Produces:
  - `interface TodaySummary { filled: number; total: number; requiredLeft: number }`
  - `useToday(date: Date)`, which returns:
    `{ practices: UserPractice[]; values: Record<string, PracticeValue>; summary: TodaySummary; incomplete: Set<string>; save: (practice: UserPractice, value: PracticeValue | null) => void; failed: string | null; isLoading: boolean; isError: boolean; seedStarters: () => void; isSeeding: boolean }`
  - `practicesApi.saveDiaryEntry(date: string, practice: string, value: PracticeValue | null): Promise<void>`

- [ ] **Step 1: Write the failing test**

`app-react/src/features/today/useToday.test.tsx`:
```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useToday } from './useToday'
import type { UserPractice } from '../../types/api'

vi.mock('../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn(),
    getDiaryEntries: vi.fn(),
    getIncompleteDays: vi.fn(),
    saveDiaryEntry: vi.fn(),
    createUserPractice: vi.fn(),
  },
}))
import { practicesApi } from '../../api/practices'
const api = vi.mocked(practicesApi)

const A: UserPractice = { id: 'a', practice: 'A', data_type: 'Bool', is_active: true, is_required: true }
const B: UserPractice = { id: 'b', practice: 'B', data_type: 'Int', is_active: true, is_required: true }
const C: UserPractice = { id: 'c', practice: 'C', data_type: 'Text', is_active: true }
const D: UserPractice = { id: 'd', practice: 'D', data_type: 'Int', is_active: false, is_required: true }

function setup(date = new Date(2026, 9, 6)) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, ...renderHook(({ d }) => useToday(d), { wrapper, initialProps: { d: date } }) }
}

describe('useToday', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getUserPractices.mockResolvedValue([A, B, C, D])
    api.getDiaryEntries.mockImplementation(async (date) =>
      date === '2026-10-06'
        ? [{ practice: 'A', data_type: 'Bool', value: { Bool: false } }, { practice: 'C', data_type: 'Text', value: { Text: 'x' } }]
        : [])
    api.getIncompleteDays.mockResolvedValue(['2026-10-04', '2026-10-04', '2026-10-05'])
    api.saveDiaryEntry.mockResolvedValue(undefined)
  })

  it('counts filled, total and required-left over active practices', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.summary).toEqual({ filled: 2, total: 3, requiredLeft: 1 })
    expect(result.current.practices.map((p) => p.practice)).toEqual(['A', 'B', 'C'])
  })

  it('loads incomplete days for the 9-day window', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.incomplete.size).toBe(2))
    expect(api.getIncompleteDays).toHaveBeenCalledWith('2026-10-04', '2026-10-12')
  })

  it('sends null to clear a value and skips unchanged values', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.save(C, { Text: 'x' }))
    act(() => result.current.save(B, null))
    expect(api.saveDiaryEntry).not.toHaveBeenCalled()
    act(() => result.current.save(C, null))
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenCalledWith('2026-10-06', 'C', null))
  })

  it('rolls back and flags the practice when a save fails', async () => {
    api.saveDiaryEntry.mockRejectedValue(new Error('boom'))
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.save(B, { Int: 5 }))
    await waitFor(() => expect(result.current.failed).toBe('B'))
    expect(result.current.values.B).toBeUndefined()
  })

  it('invalidates the day the save was made on, even after switching day', async () => {
    let resolve!: () => void
    api.saveDiaryEntry.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const { result, rerender, qc } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.save(B, { Int: 5 }))
    rerender({ d: new Date(2026, 9, 7) })
    await act(async () => { resolve() })
    expect(api.saveDiaryEntry).toHaveBeenCalledWith('2026-10-06', 'B', { Int: 5 })
    // The 6th is no longer on screen, so it's marked stale rather than refetched.
    await waitFor(() => expect(qc.getQueryState(['diary', '2026-10-06'])?.isInvalidated).toBe(true))
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/features/today/useToday.test.tsx`
Expected: FAIL, because `./useToday` can't be resolved.

- [ ] **Step 3: Allow `null` in the API**

In `app-react/src/api/practices.ts`, change the `saveDiaryEntry` signature:
```ts
  async saveDiaryEntry(date: string, practice: string, value: PracticeValue | null): Promise<void> {
    await apiClient.put(`/diary/${date}/entry`, { entry: { practice, value } })
  },
```

- [ ] **Step 4: Implement the hook**

`app-react/src/features/today/useToday.ts`:
```ts
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../api/practices'
import { useToast } from '../../hooks/useToast'
import type { DiaryEntry, PracticeDataType, PracticeValue, UserPractice } from '../../types/api'
import { fromDateStr, nineDayWindow, toDateStr } from './date'
import { sameValue } from './values'

export interface TodaySummary { filled: number; total: number; requiredLeft: number }

const STARTERS: { practice: string; data_type: PracticeDataType }[] = [
  { practice: 'Wake up time',     data_type: 'Time'     },
  { practice: 'Go to sleep time', data_type: 'Time'     },
  { practice: 'Reading',          data_type: 'Bool'     },
  { practice: 'Meditation',       data_type: 'Duration' },
  { practice: 'Yoga',             data_type: 'Duration' },
]

const FAIL_FLASH_MS = 600

interface SaveVars { date: string; practice: UserPractice; value: PracticeValue | null }

export function useToday(date: Date) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const dateStr = toDateStr(date)
  const window9 = nineDayWindow(date)
  const from = toDateStr(window9[0])
  const to = toDateStr(window9[8])

  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const diaryQ = useQuery({ queryKey: ['diary', dateStr], queryFn: () => practicesApi.getDiaryEntries(dateStr) })
  const incompleteQ = useQuery({
    queryKey: ['incomplete-days', from, to],
    queryFn: () => practicesApi.getIncompleteDays(from, to),
  })

  const practices = (practicesQ.data ?? []).filter((p) => p.is_active)
  const values: Record<string, PracticeValue> = {}
  for (const e of diaryQ.data ?? []) if (e.value != null) values[e.practice] = e.value
  const isSet = (p: UserPractice) => values[p.practice] !== undefined
  const summary: TodaySummary = {
    filled: practices.filter(isSet).length,
    total: practices.length,
    requiredLeft: practices.filter((p) => p.is_required && !isSet(p)).length,
  }

  const [failed, setFailed] = useState<string | null>(null)
  const failTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(failTimer.current), [])

  // The date travels in the mutation variables so callbacks always target the
  // day the value was entered on, even if the user has moved to another day.
  const mutation = useMutation({
    mutationFn: ({ date, practice, value }: SaveVars) => practicesApi.saveDiaryEntry(date, practice.practice, value),
    onMutate: async ({ date, practice, value }) => {
      await qc.cancelQueries({ queryKey: ['diary', date] })
      const prev = qc.getQueryData<DiaryEntry[]>(['diary', date])
      qc.setQueryData<DiaryEntry[]>(['diary', date], (old = []) => [
        ...old.filter((e) => e.practice !== practice.practice),
        { practice: practice.practice, data_type: practice.data_type, value: value ?? undefined },
      ])
      return { prev }
    },
    onError: (_err, { date, practice }, ctx) => {
      if (ctx) qc.setQueryData(['diary', date], ctx.prev)
      showToast({ message: t('home.saveFailed'), variant: 'error' })
      setFailed(practice.practice)
      clearTimeout(failTimer.current)
      failTimer.current = setTimeout(() => setFailed(null), FAIL_FLASH_MS)
    },
    onSettled: (_data, _err, { date }) => {
      qc.invalidateQueries({ queryKey: ['diary', date] })
      qc.invalidateQueries({ queryKey: ['incomplete-days'] })
    },
  })

  const save = (practice: UserPractice, value: PracticeValue | null) => {
    if (sameValue(values[practice.practice], value)) return
    mutation.mutate({ date: dateStr, practice, value })
  }

  const seed = useMutation({
    mutationFn: async () => {
      for (const p of STARTERS) await practicesApi.createUserPractice(p).catch(() => {})
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practices'] }),
  })

  // Refetch the open day when the app returns to the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') qc.invalidateQueries({ queryKey: ['diary', dateStr] })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [qc, dateStr])

  // Prefetch the rest of the visible window so tapping a day is instant.
  useEffect(() => {
    for (const d of nineDayWindow(fromDateStr(dateStr))) {
      const ds = toDateStr(d)
      if (ds === dateStr) continue
      qc.prefetchQuery({ queryKey: ['diary', ds], queryFn: () => practicesApi.getDiaryEntries(ds), staleTime: 60_000 })
    }
  }, [qc, dateStr])

  return {
    practices,
    values,
    summary,
    incomplete: new Set(incompleteQ.data ?? []),
    save,
    failed,
    isLoading: practicesQ.isLoading || diaryQ.isLoading,
    isError: practicesQ.isError || diaryQ.isError,
    seedStarters: () => seed.mutate(),
    isSeeding: seed.isPending,
  }
}
```

- [ ] **Step 5: Run the test and confirm it passes, then typecheck**

Run: `npx vitest run src/features/today/useToday.test.tsx && npx tsc -b`
Expected: PASS (5 tests) and no type errors. The legacy `PracticeCard` still passes a `PracticeValue`, which is still valid.

- [ ] **Step 6: Commit**

```bash
git add src/api/practices.ts src/features/today/useToday.ts src/features/today/useToday.test.tsx
git commit -m "feat(today): useToday hook — optimistic save, null clears, summary, incomplete days

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Primitives: `UiPortal`, `Toggle`, `ListGroup`, `AnchoredMenu`

**Files:**
- Create: `app-react/src/ui/primitives/UiPortal.tsx`
- Create: `app-react/src/ui/primitives/Toggle.tsx`
- Create: `app-react/src/ui/primitives/ListGroup.tsx`
- Create: `app-react/src/ui/primitives/AnchoredMenu.tsx`
- Test: `app-react/src/ui/primitives/AnchoredMenu.test.tsx`, `app-react/src/ui/primitives/Toggle.test.tsx`

**Interfaces:**
- Produces:
  - `UiPortal({ children })`
  - `Toggle({ checked: boolean; onChange: (v: boolean) => void; label: string })`
  - `ListGroup({ label: string; children })`
  - `AnchoredMenu({ anchor: HTMLElement; onClose: () => void; label: string; children })`
  - `MenuItem({ children; onSelect: () => void; selected?: boolean; muted?: boolean })`. When `selected` is defined, the role is `menuitemradio` with `aria-checked`; otherwise it's `menuitem`.
  - `MenuDivider()`

- [ ] **Step 1: Write the failing tests**

`app-react/src/ui/primitives/AnchoredMenu.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { AnchoredMenu, MenuItem, MenuDivider } from './AnchoredMenu'

function Harness({ onPick = vi.fn() }: { onPick?: (v: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <button onClick={(e) => setAnchor(e.currentTarget)}>open</button>
      {anchor && (
        <AnchoredMenu anchor={anchor} label="Quality" onClose={() => setAnchor(null)}>
          <MenuItem selected={false} onSelect={() => { onPick('Great'); setAnchor(null) }}>Great</MenuItem>
          <MenuItem selected onSelect={() => { onPick('Good'); setAnchor(null) }}>Good</MenuItem>
          <MenuDivider />
          <MenuItem muted onSelect={() => { onPick('clear'); setAnchor(null) }}>Clear</MenuItem>
        </AnchoredMenu>
      )}
    </>
  )
}

describe('AnchoredMenu', () => {
  it('focuses the selected item and picks on click', () => {
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByRole('menuitemradio', { name: /Good/ })).toHaveFocus()
    expect(screen.getByRole('menuitemradio', { name: /Good/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Great' }))
    expect(onPick).toHaveBeenCalledWith('Great')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('moves focus with arrow keys and closes on Escape, returning focus', () => {
    render(<Harness />)
    const opener = screen.getByText('open')
    fireEvent.click(opener)
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: 'Clear' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('closes on backdrop click', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByTestId('menu-backdrop'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders inside a .ui-root portal', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByRole('menu').closest('.ui-root')).not.toBeNull()
  })
})
```

`app-react/src/ui/primitives/Toggle.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('is a labelled switch that reports the next state', () => {
    const onChange = vi.fn()
    render(<Toggle label="Japa" checked={false} onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: 'Japa' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/ui/primitives`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Implement**

`app-react/src/ui/primitives/UiPortal.tsx`:
```tsx
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Portals to <body> inside a .ui-root wrapper so theme tokens resolve. */
export function UiPortal({ children }: { children: ReactNode }) {
  return createPortal(<div className="ui-root">{children}</div>, document.body)
}
```

`app-react/src/ui/primitives/Toggle.tsx`:
```tsx
interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; label: string }

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`w-11 h-[26px] shrink-0 rounded-full p-[3px] flex transition-colors ${checked ? 'bg-ui-accent-fill justify-end' : 'bg-ui-toggle-off justify-start'}`}
    >
      <span className={`w-5 h-5 rounded-full ${checked ? 'bg-ui-toggle-on-knob' : 'bg-ui-toggle-off-knob'}`} />
    </button>
  )
}
```

`app-react/src/ui/primitives/ListGroup.tsx`:
```tsx
import type { ReactNode } from 'react'

export function ListGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <h2 className="px-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{label}</h2>
      <div className="flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline">
        {children}
      </div>
    </section>
  )
}
```

`app-react/src/ui/primitives/AnchoredMenu.tsx`:
```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { UiPortal } from './UiPortal'

const WIDTH = 210
const GAP = 6
const ITEM = '[role^="menuitem"]'

interface AnchoredMenuProps { anchor: HTMLElement; onClose: () => void; label: string; children: ReactNode }

/** Menu anchored under (or, without room, above) `anchor`, right-aligned. */
export function AnchoredMenu({ anchor, onClose, label, children }: AnchoredMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const height = ref.current?.offsetHeight ?? 0
    const fitsBelow = window.innerHeight - r.bottom - GAP >= height
    setPos({
      right: Math.max(8, window.innerWidth - r.right),
      ...(fitsBelow ? { top: r.bottom + GAP } : { bottom: window.innerHeight - r.top + GAP }),
    })
    const target = ref.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? ref.current?.querySelector<HTMLElement>(ITEM)
    target?.focus()
  }, [anchor])

  useEffect(() => () => anchor.focus(), [anchor])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation() // don't also close a sheet this menu sits in
      onClose()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <UiPortal>
      <div data-testid="menu-backdrop" className="fixed inset-0 z-50" onClick={onClose} />
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        style={{ ...pos, width: WIDTH }}
        className="fixed z-50 flex max-h-[372px] flex-col overflow-y-auto rounded-2xl bg-ui-surface p-1.5 shadow-[0_18px_48px_-12px_rgba(40,28,10,.35),0_0_0_1px_rgba(40,28,10,.06)]"
      >
        {children}
      </div>
    </UiPortal>
  )
}

interface MenuItemProps { children: ReactNode; onSelect: () => void; selected?: boolean; muted?: boolean }

export function MenuItem({ children, onSelect, selected, muted }: MenuItemProps) {
  const radio = selected !== undefined
  const tone = selected ? 'bg-ui-accent-soft font-bold' : muted ? 'text-sm font-semibold text-ui-muted' : 'font-medium text-ui-ink2'
  return (
    <button
      type="button"
      role={radio ? 'menuitemradio' : 'menuitem'}
      aria-checked={radio ? selected : undefined}
      onClick={onSelect}
      className={`flex h-11 shrink-0 items-center justify-between rounded-[10px] px-3 text-left text-[15px] outline-none focus-visible:bg-ui-accent-soft ${tone}`}
    >
      {children}
      {selected && <span aria-hidden className="text-ui-accent">✓</span>}
    </button>
  )
}

export function MenuDivider() {
  return <div role="separator" className="mx-1.5 my-1 h-px bg-ui-hairline" />
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/ui/primitives`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/primitives
git commit -m "feat(ui): UiPortal, Toggle, ListGroup, AnchoredMenu primitives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Primitives: `BottomSheet`, `Keypad`, `SegmentedControl`

**Files:**
- Create: `app-react/src/ui/primitives/BottomSheet.tsx`
- Create: `app-react/src/ui/primitives/Keypad.tsx`
- Create: `app-react/src/ui/primitives/SegmentedControl.tsx`
- Modify: `app-react/src/test/mocks/framer-motion.tsx` (strip drag props)
- Test: `app-react/src/ui/primitives/BottomSheet.test.tsx`

**Interfaces:**
- Consumes: `UiPortal` from Task 5.
- Produces:
  - `BottomSheet({ label: string; onClose: () => void; children })`, rendered as `role="dialog"` with `aria-modal`.
  - `Keypad({ onKey: (k: KeypadKey) => void })`
  - `type KeypadKey = '1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'C'|'0'|'⌫'`
  - `SegmentedControl<T extends string>({ options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string })`

- [ ] **Step 1: Write the failing test**

`app-react/src/ui/primitives/BottomSheet.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'
import { Keypad } from './Keypad'
import { SegmentedControl } from './SegmentedControl'

describe('BottomSheet', () => {
  it('is a focused modal dialog that closes on Escape and backdrop', () => {
    const onClose = vi.fn()
    render(<BottomSheet label="Audiobooks" onClose={onClose}><button>inside</button></BottomSheet>)
    const dialog = screen.getByRole('dialog', { name: 'Audiobooks' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveFocus()
    expect(dialog.closest('.ui-root')).not.toBeNull()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('traps Tab inside the sheet', () => {
    render(<BottomSheet label="S" onClose={() => {}}><button>first</button><button>last</button></BottomSheet>)
    screen.getByText('last').focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(screen.getByText('first')).toHaveFocus()
  })
})

describe('Keypad', () => {
  it('reports keys, with labelled C and ⌫', () => {
    const onKey = vi.fn()
    render(<Keypad onKey={onKey} />)
    fireEvent.click(screen.getByRole('button', { name: '7' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete digit' }))
    expect(onKey.mock.calls.map((c) => c[0])).toEqual(['7', 'C', '⌫'])
  })
})

describe('SegmentedControl', () => {
  it('is a radiogroup', () => {
    const onChange = vi.fn()
    render(<SegmentedControl label="Mode" value="add" onChange={onChange}
      options={[{ value: 'add', label: 'Add' }, { value: 'set', label: 'Set total' }]} />)
    expect(screen.getByRole('radio', { name: 'Add' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Set total' }))
    expect(onChange).toHaveBeenCalledWith('set')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/ui/primitives/BottomSheet.test.tsx`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Strip drag props in the framer-motion test mock**

In `app-react/src/test/mocks/framer-motion.tsx`, extend the destructuring inside `forwardRef` so drag props don't reach the DOM:
```tsx
          {
            children,
            initial: _i,
            animate: _a,
            exit: _e,
            transition: _t,
            whileHover: _wh,
            whileTap: _wt,
            drag: _d,
            dragConstraints: _dc,
            dragElastic: _de,
            onDragEnd: _ode,
            ...rest
          }: React.HTMLAttributes<HTMLElement> & {
            initial?: unknown
            animate?: unknown
            exit?: unknown
            transition?: unknown
            whileHover?: unknown
            whileTap?: unknown
            drag?: unknown
            dragConstraints?: unknown
            dragElastic?: unknown
            onDragEnd?: unknown
          },
```

- [ ] **Step 4: Implement**

`app-react/src/ui/primitives/BottomSheet.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { UiPortal } from './UiPortal'

const FOCUSABLE = 'button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])'
const CLOSE_DRAG_PX = 100

interface BottomSheetProps { label: string; onClose: () => void; children: ReactNode }

// ponytail: no exit animation (needs AnimatePresence at every call site); add if the snap-close feels abrupt.
export function BottomSheet({ label, onClose, children }: BottomSheetProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => prev?.focus?.()
  }, [])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
    if (e.key !== 'Tab' || !ref.current) return
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return (
    <UiPortal>
      <motion.div
        data-testid="sheet-backdrop"
        className="fixed inset-0 z-50 bg-ui-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-[18px] overflow-y-auto rounded-t-[28px] bg-ui-sheet px-5 pt-2.5 pb-[calc(30px+env(safe-area-inset-bottom))] outline-none"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > CLOSE_DRAG_PX || info.velocity.y > 500) onClose() }}
      >
        <span aria-hidden className="h-[5px] w-10 self-center rounded-full bg-ui-control" />
        {children}
      </motion.div>
    </UiPortal>
  )
}
```

`app-react/src/ui/primitives/Keypad.tsx`:
```tsx
import { useTranslation } from 'react-i18next'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const
export type KeypadKey = (typeof KEYS)[number]

export function Keypad({ onKey }: { onKey: (k: KeypadKey) => void }) {
  const { t } = useTranslation()
  const label = (k: KeypadKey) => (k === '⌫' ? t('today.keyBackspace') : k === 'C' ? t('today.keyReset') : undefined)
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={label(k)}
          onClick={() => onKey(k)}
          className="h-[50px] rounded-xl bg-ui-chip font-ui-mono text-xl font-medium"
        >
          {k}
        </button>
      ))}
    </div>
  )
}
```

`app-react/src/ui/primitives/SegmentedControl.tsx`:
```tsx
interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}

export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-xl bg-ui-chip p-[3px] text-[13px] font-bold">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-[9px] px-3 py-2 ${o.value === value ? 'bg-ui-surface shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-ui-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/ui/primitives`
Expected: PASS (all primitive tests, including Task 5's).

- [ ] **Step 6: Commit**

```bash
git add src/ui/primitives src/test/mocks/framer-motion.tsx
git commit -m "feat(ui): BottomSheet, Keypad, SegmentedControl primitives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Add-time sheet (3c)

**Files:**
- Create: `app-react/src/features/today/mobile/AddTimeSheet.tsx`
- Test: `app-react/src/features/today/mobile/AddTimeSheet.test.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `Keypad`, `KeypadKey` and `SegmentedControl` (Task 6); `formatDuration` (Task 1).
- Produces:
  - `type TimeMode = 'add' | 'set'`
  - `AddTimeSheet({ practice: string; current: number; initialMode: TimeMode; onSave: (v: PracticeValue | null) => void; onClose: () => void })`

- [ ] **Step 1: Write the failing test**

`app-react/src/features/today/mobile/AddTimeSheet.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddTimeSheet } from './AddTimeSheet'

function setup(initialMode: 'add' | 'set' = 'add', current = 30) {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<AddTimeSheet practice="Audiobooks" current={current} initialMode={initialMode} onSave={onSave} onClose={onClose} />)
  const key = (k: string) => fireEvent.click(screen.getByRole('button', { name: k }))
  return { onSave, onClose, key }
}

describe('AddTimeSheet', () => {
  it('stacks chips and previews the new total', () => {
    const { onSave, onClose, key } = setup()
    key('+30'); key('+15')
    expect(screen.getByTestId('amount')).toHaveTextContent('+45')
    expect(screen.getByTestId('new-total')).toHaveTextContent('1 h 15 min')
    key('Add 45 min')
    expect(onSave).toHaveBeenCalledWith({ Duration: 75 })
    expect(onClose).toHaveBeenCalled()
  })

  it('typing replaces the chip amount; backspace and reset work', () => {
    const { key } = setup()
    key('+30'); key('4'); key('5')
    expect(screen.getByTestId('amount')).toHaveTextContent('+45')
    key('Delete digit')
    expect(screen.getByTestId('amount')).toHaveTextContent('+4')
    key('Reset')
    expect(screen.getByTestId('amount')).toHaveTextContent('+0')
    expect(screen.getByRole('button', { name: 'Add 0 min' })).toBeDisabled()
  })

  it('Set total starts at the current value and replaces it', () => {
    const { onSave, key } = setup('set', 30)
    expect(screen.getByRole('radio', { name: 'Set total' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('amount')).toHaveTextContent('30')
    key('9'); key('0')
    key('Set 1 h 30 min')
    expect(onSave).toHaveBeenCalledWith({ Duration: 90 })
  })

  it('setting the total to 0 clears the value', () => {
    const { onSave, key } = setup('set', 30)
    key('Reset')
    key('Clear')
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('switching mode resets the amount', () => {
    const { key } = setup('add', 30)
    key('+10')
    fireEvent.click(screen.getByRole('radio', { name: 'Set total' }))
    expect(screen.getByTestId('amount')).toHaveTextContent('30')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/features/today/mobile/AddTimeSheet.test.tsx`
Expected: FAIL, because `./AddTimeSheet` can't be resolved.

- [ ] **Step 3: Implement**

`app-react/src/features/today/mobile/AddTimeSheet.tsx`:
```tsx
import { useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { Keypad, type KeypadKey } from '../../../ui/primitives/Keypad'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import type { PracticeValue } from '../../../types/api'
import { formatDuration } from '../values'

export type TimeMode = 'add' | 'set'

const CHIPS = [5, 10, 15, 30, 60]
const MAX_MINUTES = 9999

interface Amount { mode: TimeMode; minutes: number; typing: boolean }
type Action =
  | { type: 'key'; key: KeypadKey }
  | { type: 'chip'; minutes: number }
  | { type: 'mode'; mode: TimeMode; current: number }

const init = (mode: TimeMode, current: number): Amount => ({ mode, minutes: mode === 'set' ? current : 0, typing: false })

// Chips stack; the first typed digit replaces whatever the chips built up.
function reducer(s: Amount, a: Action): Amount {
  switch (a.type) {
    case 'mode':
      return init(a.mode, a.current)
    case 'chip':
      return { ...s, minutes: Math.min(MAX_MINUTES, s.minutes + a.minutes), typing: false }
    case 'key': {
      if (a.key === 'C') return { ...s, minutes: 0, typing: false }
      if (a.key === '⌫') return { ...s, minutes: Math.floor(s.minutes / 10), typing: true }
      const minutes = s.typing ? s.minutes * 10 + Number(a.key) : Number(a.key)
      return minutes > MAX_MINUTES ? s : { ...s, minutes, typing: true }
    }
  }
}

interface AddTimeSheetProps {
  practice: string
  current: number
  initialMode: TimeMode
  onSave: (v: PracticeValue | null) => void
  onClose: () => void
}

export function AddTimeSheet({ practice, current, initialMode, onSave, onClose }: AddTimeSheetProps) {
  const { t } = useTranslation()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const [s, dispatch] = useReducer(reducer, init(initialMode, current))
  const total = s.mode === 'add' ? current + s.minutes : s.minutes
  const clearing = s.mode === 'set' && s.minutes === 0
  const label = clearing
    ? t('today.clear')
    : s.mode === 'add'
      ? t('today.addAmount', { amount: formatDuration(s.minutes, units) })
      : t('today.setAmount', { amount: formatDuration(total, units) })

  function submit() {
    onSave(clearing ? null : { Duration: total })
    onClose()
  }

  return (
    <BottomSheet label={practice} onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="truncate text-xl font-extrabold">{practice}</h2>
          <p className="text-[13px] text-ui-muted">
            {t('today.logged')} <span className="font-ui-mono text-ui-ink">{formatDuration(current, units)}</span>
          </p>
        </div>
        <SegmentedControl
          label={t('today.mode')}
          value={s.mode}
          onChange={(mode) => dispatch({ type: 'mode', mode, current })}
          options={[{ value: 'add', label: t('today.modeAdd') }, { value: 'set', label: t('today.modeSet') }]}
        />
      </div>

      <div className="flex items-end justify-between rounded-[20px] bg-ui-field px-5 py-[18px]">
        <div data-testid="amount" className="flex items-baseline gap-1.5 text-ui-accent">
          <span className="font-ui-mono text-5xl leading-none font-medium">{s.mode === 'add' ? `+${s.minutes}` : s.minutes}</span>
          <span className="text-base font-semibold">{units.min}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[.08em] text-ui-muted">{t('today.newTotal')}</span>
          <span data-testid="new-total" className="font-ui-mono text-xl font-semibold">{formatDuration(total, units)}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {CHIPS.map((m) => (
          <button key={m} type="button" onClick={() => dispatch({ type: 'chip', minutes: m })}
            className="h-10 rounded-xl border border-ui-control font-ui-mono text-sm font-semibold">
            +{m}
          </button>
        ))}
      </div>

      <Keypad onKey={(key) => dispatch({ type: 'key', key })} />

      <div className="grid grid-cols-[1fr_2fr] gap-2.5">
        <button type="button" onClick={onClose} className="h-[52px] rounded-2xl text-[15px] font-bold text-ui-muted">
          {t('common.cancel')}
        </button>
        <button type="button" onClick={submit} disabled={s.mode === 'add' && s.minutes === 0}
          className="h-[52px] rounded-2xl bg-ui-primary text-[15px] font-bold text-ui-on-primary disabled:opacity-40">
          {label}
        </button>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/features/today/mobile/AddTimeSheet.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/today/mobile/AddTimeSheet.tsx src/features/today/mobile/AddTimeSheet.test.tsx
git commit -m "feat(today): add-time sheet with stacking chips, keypad, add/set total

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Text row with inline editor (3d), plus shared row bits

**Files:**
- Create: `app-react/src/features/today/mobile/rowParts.tsx`
- Create: `app-react/src/features/today/mobile/TextRow.tsx`
- Test: `app-react/src/features/today/mobile/TextRow.test.tsx`

**Interfaces:**
- Produces:
  - `RequiredBadge()`
  - `EmptyValue({ required: boolean; name: string; onClick: (e: MouseEvent<HTMLButtonElement>) => void })`, a button named `Edit {name}` that shows "+ Add" or "Required".
  - `Chevron()`
  - `TextRow({ label: string; value: string; required: boolean; failed: boolean; onSave: (v: PracticeValue | null) => void })`

- [ ] **Step 1: Write the failing test**

`app-react/src/features/today/mobile/TextRow.test.tsx`:
```tsx
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TextRow } from './TextRow'

describe('TextRow', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const setup = (value = '', required = false) => {
    const onSave = vi.fn()
    const utils = render(<TextRow label="Gratitude" value={value} required={required} failed={false} onSave={onSave} />)
    return { onSave, ...utils }
  }

  it('shows the prompt when empty and opens a focused editor on tap', () => {
    setup()
    fireEvent.click(screen.getByText("What's on your mind today?"))
    expect(screen.getByRole('textbox', { name: 'Gratitude' })).toHaveFocus()
    expect(screen.getByText('Saved as you type')).toBeInTheDocument()
  })

  it('shows Required instead of Edit when required and empty', () => {
    setup('', true)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('saves 600ms after typing stops', () => {
    const { onSave } = setup('Old')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New text' } })
    act(() => { vi.advanceTimersByTime(599) })
    expect(onSave).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onSave).toHaveBeenCalledWith({ Text: 'New text' })
  })

  it('Done saves immediately and returns to the preview', () => {
    const { onSave } = setup('Old')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Kirtan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onSave).toHaveBeenCalledWith({ Text: 'Kirtan' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('whitespace-only saves null', () => {
    const { onSave } = setup('Old')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    fireEvent.blur(screen.getByRole('textbox'))
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('flushes a pending edit on unmount', () => {
    const { onSave, unmount } = setup('Old')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Typed' } })
    unmount()
    expect(onSave).toHaveBeenCalledWith({ Text: 'Typed' })
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/features/today/mobile/TextRow.test.tsx`
Expected: FAIL, because `./TextRow` can't be resolved.

- [ ] **Step 3: Implement the shared row bits**

`app-react/src/features/today/mobile/rowParts.tsx`:
```tsx
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

export function RequiredBadge() {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-ui-danger">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ui-danger" />
      {t('today.required')}
    </span>
  )
}

/** "+ Add", or "Required" for a required practice. Both open the row's editor. */
export function EmptyValue({ required, name, onClick }: { required: boolean; name: string; onClick: (e: MouseEvent<HTMLButtonElement>) => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" aria-label={t('today.editValue', { name })} onClick={onClick} className="pr-2">
      {required ? <RequiredBadge /> : <span className="text-[13px] font-bold text-ui-accent">{t('today.add')}</span>}
    </button>
  )
}

export function Chevron() {
  return <span aria-hidden className="-mt-[3px] h-1.5 w-1.5 rotate-45 border-r-[1.8px] border-b-[1.8px] border-ui-muted" />
}
```

- [ ] **Step 4: Implement `TextRow`**

`app-react/src/features/today/mobile/TextRow.tsx`:
```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PracticeValue } from '../../../types/api'
import { RequiredBadge } from './rowParts'

const DEBOUNCE_MS = 600

interface TextRowProps {
  label: string
  value: string
  required: boolean
  failed: boolean
  onSave: (v: PracticeValue | null) => void
}

export function TextRow({ label, value, required, failed, onSave }: TextRowProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const area = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<string | null>(null)
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave })

  const flush = () => {
    clearTimeout(timer.current)
    if (pending.current === null) return
    const text = pending.current
    pending.current = null
    onSaveRef.current(text.trim() ? { Text: text } : null)
  }
  // Leaving the day (row unmounts) must not drop what was typed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => flush, [])

  function change(text: string) {
    setDraft(text)
    pending.current = text
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, DEBOUNCE_MS)
  }

  function start() {
    setDraft(value)
    setEditing(true)
  }

  function finish() {
    flush()
    setEditing(false)
  }

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft, editing])

  useEffect(() => {
    if (!editing) return
    const el = area.current
    el?.focus()
    const keepVisible = () => el?.scrollIntoView?.({ block: 'nearest' })
    keepVisible()
    window.visualViewport?.addEventListener('resize', keepVisible)
    return () => window.visualViewport?.removeEventListener('resize', keepVisible)
  }, [editing])

  return (
    <div className="flex flex-col bg-ui-surface px-4 pb-3.5">
      <div className="flex min-h-[50px] items-center justify-between gap-3">
        <span className="text-[15px] font-medium">{label}</span>
        {editing ? (
          <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={finish} className="text-sm font-bold text-ui-accent">
            {t('today.done')}
          </button>
        ) : !value && required ? (
          <RequiredBadge />
        ) : (
          <button type="button" onClick={start} className="text-xs font-semibold text-ui-muted">{t('today.edit')}</button>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            ref={area}
            aria-label={label}
            value={draft}
            maxLength={1024}
            rows={3}
            onChange={(e) => change(e.target.value)}
            onBlur={finish}
            className="min-h-[120px] resize-none rounded-xl border-[1.5px] border-ui-accent-fill bg-ui-surface px-3.5 py-3 text-[15px] leading-[1.55] shadow-[0_0_0_4px_var(--ui-accent-soft)] outline-none"
          />
          <p className="mt-2 text-xs text-ui-muted">{t('today.savedAsYouType')}</p>
        </>
      ) : (
        <button
          type="button"
          onClick={start}
          className={`whitespace-pre-wrap rounded-xl bg-ui-field px-3 py-2.5 text-left text-sm leading-normal ${failed ? 'text-ui-danger' : value ? 'text-ui-ink2' : 'text-ui-muted'}`}
        >
          {value || t('today.textPrompt')}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run src/features/today/mobile/TextRow.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/today/mobile/rowParts.tsx src/features/today/mobile/TextRow.tsx src/features/today/mobile/TextRow.test.tsx
git commit -m "feat(today): inline text editor row with debounced save

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `PracticeRow` for every practice type (3a, 3b)

**Files:**
- Create: `app-react/src/features/today/mobile/PracticeRow.tsx`
- Test: `app-react/src/features/today/mobile/PracticeRow.test.tsx`

**Interfaces:**
- Consumes: `Toggle`, `AnchoredMenu`, `MenuItem` and `MenuDivider` (Task 5); `AddTimeSheet` and `TimeMode` (Task 7); `TextRow`, `EmptyValue` and `Chevron` (Task 8); `parseOptions`, `formatDuration` and `formatTime` (Task 1); `formatTimeInput` and `parseTime` from `src/pages/home/inputFormat.ts`.
- Produces: `PracticeRow({ practice: UserPractice; value?: PracticeValue; failed: boolean; onSave: (v: PracticeValue | null) => void })`

- [ ] **Step 1: Write the failing test**

`app-react/src/features/today/mobile/PracticeRow.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PracticeRow } from './PracticeRow'
import type { PracticeValue, UserPractice } from '../../../types/api'

function setup(p: Partial<UserPractice> & Pick<UserPractice, 'practice' | 'data_type'>, value?: PracticeValue) {
  const onSave = vi.fn()
  render(<PracticeRow practice={{ id: '1', is_active: true, ...p }} value={value} failed={false} onSave={onSave} />)
  return onSave
}

describe('PracticeRow', () => {
  it('Time: required+empty shows Required; typing formats and saves on blur', () => {
    const onSave = setup({ practice: 'Wake up', data_type: 'Time', is_required: true })
    expect(screen.getByText('Required')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Wake up' }))
    const input = screen.getByRole('textbox', { name: 'Wake up' })
    fireEvent.change(input, { target: { value: '0410' } })
    expect(input).toHaveValue('04:10')
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith({ Time: { h: 4, m: 10 } })
  })

  it('Int: shows the value; clearing saves null', () => {
    const onSave = setup({ practice: 'Rounds', data_type: 'Int' }, { Int: 17 })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rounds' }))
    const input = screen.getByRole('textbox', { name: 'Rounds' })
    expect(input).toHaveValue('17')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('Int: empty and optional shows + Add', () => {
    setup({ practice: 'Rounds', data_type: 'Int' })
    expect(screen.getByText('+ Add')).toBeInTheDocument()
  })

  it('Bool: toggles', () => {
    const onSave = setup({ practice: 'Attunement', data_type: 'Bool' }, { Bool: false })
    fireEvent.click(screen.getByRole('switch', { name: 'Attunement' }))
    expect(onSave).toHaveBeenCalledWith({ Bool: true })
  })

  it('Int with options: anchored menu selects and clears', () => {
    const onSave = setup({ practice: 'Quality', data_type: 'Int', dropdown_variants: '1,2,3' }, { Int: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Quality' }))
    expect(screen.getByRole('menuitemradio', { name: /2/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: '3' }))
    expect(onSave).toHaveBeenCalledWith({ Int: 3 })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Quality' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }))
    expect(onSave).toHaveBeenLastCalledWith(null)
  })

  it('Text with newline options saves the text option', () => {
    const onSave = setup({ practice: 'Mood', data_type: 'Text', dropdown_variants: 'Low\nCalm' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mood' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Calm' }))
    expect(onSave).toHaveBeenCalledWith({ Text: 'Calm' })
  })

  it('shows a value missing from the options without selecting one', () => {
    setup({ practice: 'Mood', data_type: 'Text', dropdown_variants: 'Low,Calm' }, { Text: 'Joyful' })
    expect(screen.getByText('Joyful')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mood' }))
    expect(screen.getAllByRole('menuitemradio').every((el) => el.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  it('Duration: + opens Add mode, the value opens Set total', () => {
    setup({ practice: 'Audiobooks', data_type: 'Duration' }, { Duration: 30 })
    expect(screen.getByText('30 min')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add time to Audiobooks' }))
    expect(screen.getByRole('radio', { name: 'Add' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Audiobooks' }))
    expect(screen.getByRole('radio', { name: 'Set total' })).toHaveAttribute('aria-checked', 'true')
  })

  it('Text without options renders the text row', () => {
    setup({ practice: 'Gratitude', data_type: 'Text' })
    expect(screen.getByText("What's on your mind today?")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/features/today/mobile/PracticeRow.test.tsx`
Expected: FAIL, because `./PracticeRow` can't be resolved.

- [ ] **Step 3: Implement**

`app-react/src/features/today/mobile/PracticeRow.tsx`:
```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PracticeValue, UserPractice } from '../../../types/api'
import { Toggle } from '../../../ui/primitives/Toggle'
import { AnchoredMenu, MenuDivider, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { formatTimeInput, parseTime } from '../../../pages/home/inputFormat'
import { formatDuration, formatTime, parseOptions } from '../values'
import { AddTimeSheet, type TimeMode } from './AddTimeSheet'
import { TextRow } from './TextRow'
import { Chevron, EmptyValue } from './rowParts'

interface PracticeRowProps {
  practice: UserPractice
  value?: PracticeValue
  failed: boolean
  onSave: (v: PracticeValue | null) => void
}

export function PracticeRow(props: PracticeRowProps) {
  const { practice, value } = props
  const options = choiceOptions(practice)
  if (options.length) return <ChoiceRow {...props} options={options} />
  switch (practice.data_type) {
    case 'Bool':
      return <BoolRow {...props} />
    case 'Duration':
      return <DurationRow {...props} />
    case 'Text':
      return (
        <TextRow label={practice.practice} value={value && 'Text' in value ? value.Text : ''}
          required={!!practice.is_required} failed={props.failed} onSave={props.onSave} />
      )
    default:
      return <InlineInputRow {...props} />
  }
}

/** Int and Text practices can have options; Int options must be numbers. */
function choiceOptions(p: UserPractice): string[] {
  if (p.data_type === 'Text') return parseOptions(p.dropdown_variants)
  if (p.data_type === 'Int') return parseOptions(p.dropdown_variants).filter((o) => Number.isFinite(Number(o)))
  return []
}

function RowShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[50px] items-center justify-between gap-3 bg-ui-surface pr-2 pl-4">
      <span className="min-w-0 text-[15px] font-medium">{label}</span>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function InlineInputRow({ practice, value, failed, onSave }: PracticeRowProps) {
  const { t } = useTranslation()
  const isTime = practice.data_type === 'Time'
  const shown = value && 'Time' in value ? formatTime(value.Time) : value && 'Int' in value ? String(value.Int) : ''
  const [draft, setDraft] = useState<string | null>(null) // null = not editing

  function commit() {
    if (draft === null) return
    const text = draft.trim()
    setDraft(null)
    if (!text) return onSave(null)
    if (isTime) {
      const time = parseTime(text)
      if (time) onSave({ Time: time })
      return
    }
    const n = parseInt(text, 10)
    if (!isNaN(n) && n >= 0) onSave({ Int: n })
  }

  return (
    <RowShell label={practice.practice}>
      {draft !== null ? (
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          aria-label={practice.practice}
          placeholder={isTime ? 'HH:MM' : undefined}
          value={draft}
          onChange={(e) => setDraft(isTime ? formatTimeInput(e.target.value) : e.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="mr-1 h-9 w-20 rounded-[10px] border-[1.5px] border-ui-accent-fill bg-ui-field px-2 text-right font-ui-mono text-[15px] font-medium outline-none"
        />
      ) : shown ? (
        <button type="button" aria-label={t('today.editValue', { name: practice.practice })} onClick={() => setDraft(shown)}
          className={`pr-2 font-ui-mono text-[15px] font-medium ${failed ? 'text-ui-danger' : ''}`}>
          {shown}
        </button>
      ) : (
        <EmptyValue required={!!practice.is_required} name={practice.practice} onClick={() => setDraft('')} />
      )}
    </RowShell>
  )
}

function BoolRow({ practice, value, onSave }: PracticeRowProps) {
  const checked = !!value && 'Bool' in value && value.Bool
  return (
    <RowShell label={practice.practice}>
      <span className="pr-2">
        <Toggle label={practice.practice} checked={checked} onChange={(v) => onSave({ Bool: v })} />
      </span>
    </RowShell>
  )
}

function ChoiceRow({ practice, value, failed, onSave, options }: PracticeRowProps & { options: string[] }) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const current = value && 'Int' in value ? String(value.Int) : value && 'Text' in value ? value.Text : ''

  function pick(option: string | null) {
    setAnchor(null)
    if (option === null) onSave(null)
    else onSave(practice.data_type === 'Int' ? { Int: Number(option) } : { Text: option })
  }

  return (
    <RowShell label={practice.practice}>
      {current ? (
        <button type="button" aria-haspopup="menu" aria-expanded={!!anchor}
          aria-label={t('today.editValue', { name: practice.practice })}
          onClick={(e) => setAnchor(e.currentTarget)}
          className={`flex items-center gap-2 pr-2.5 text-[15px] font-semibold ${failed ? 'text-ui-danger' : ''}`}>
          {current}
          <Chevron />
        </button>
      ) : (
        <EmptyValue required={!!practice.is_required} name={practice.practice} onClick={(e) => setAnchor(e.currentTarget)} />
      )}
      {anchor && (
        <AnchoredMenu anchor={anchor} label={practice.practice} onClose={() => setAnchor(null)}>
          {options.map((o) => (
            <MenuItem key={o} selected={o === current} onSelect={() => pick(o)}>{o}</MenuItem>
          ))}
          <MenuDivider />
          <MenuItem muted onSelect={() => pick(null)}>{t('today.clear')}</MenuItem>
        </AnchoredMenu>
      )}
    </RowShell>
  )
}

function DurationRow({ practice, value, failed, onSave }: PracticeRowProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<TimeMode | null>(null)
  const minutes = value && 'Duration' in value ? value.Duration : 0
  const units = { h: t('today.unitH'), min: t('today.unitMin') }

  return (
    <RowShell label={practice.practice}>
      {value ? (
        <>
          <button type="button" aria-label={t('today.editValue', { name: practice.practice })} onClick={() => setMode('set')}
            className={`font-ui-mono text-[15px] font-medium ${failed ? 'text-ui-danger' : ''}`}>
            {formatDuration(minutes, units)}
          </button>
          <button type="button" aria-label={t('today.addTimeFor', { name: practice.practice })} onClick={() => setMode('add')}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-ui-accent-soft text-xl leading-none font-semibold text-ui-accent">
            +
          </button>
        </>
      ) : (
        <EmptyValue required={!!practice.is_required} name={practice.practice} onClick={() => setMode('add')} />
      )}
      {mode && (
        <AddTimeSheet practice={practice.practice} current={minutes} initialMode={mode} onSave={onSave} onClose={() => setMode(null)} />
      )}
    </RowShell>
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/features/today/mobile/PracticeRow.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/today/mobile/PracticeRow.tsx src/features/today/mobile/PracticeRow.test.tsx
git commit -m "feat(today): PracticeRow — inline values, choice menu, toggle, duration sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 9-day strip

**Files:**
- Create: `app-react/src/features/today/mobile/DayStrip9.tsx`
- Test: `app-react/src/features/today/mobile/DayStrip9.test.tsx`

**Interfaces:**
- Consumes: `nineDayWindow`, `toDateStr`, `addDays`, `isSameDay` and `isFuture` (Task 1).
- Produces: `DayStrip9({ date: Date; incomplete: Set<string>; onSelect: (d: Date) => void })`

- [ ] **Step 1: Write the failing test**

`app-react/src/features/today/mobile/DayStrip9.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DayStrip9 } from './DayStrip9'
import { toDateStr } from '../date'

const date = new Date(2026, 9, 6) // Tue

describe('DayStrip9', () => {
  it('renders Sun–Mon around the week with the selected day current', () => {
    render(<DayStrip9 date={date} incomplete={new Set()} onSelect={() => {}} />)
    const days = screen.getAllByRole('button')
    expect(days).toHaveLength(9)
    expect(days[0]).toHaveTextContent('4')
    expect(days[8]).toHaveTextContent('12')
    expect(days[2]).toHaveAttribute('aria-current', 'date')
  })

  it('marks incomplete days with a dot', () => {
    render(<DayStrip9 date={date} incomplete={new Set(['2026-10-04', '2026-10-06'])} onSelect={() => {}} />)
    expect(screen.getAllByTestId('incomplete-dot')).toHaveLength(2)
  })

  it('selects a tapped day', () => {
    const onSelect = vi.fn()
    render(<DayStrip9 date={date} incomplete={new Set()} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(toDateStr(onSelect.mock.calls[0][0])).toBe('2026-10-05')
  })

  it('swipes a week forward and back, ignoring short or vertical moves', () => {
    const onSelect = vi.fn()
    render(<DayStrip9 date={date} incomplete={new Set()} onSelect={onSelect} />)
    const strip = screen.getByTestId('day-strip')
    const swipe = (dx: number, dy = 0) => {
      fireEvent.touchStart(strip, { touches: [{ clientX: 200, clientY: 100 }] })
      fireEvent.touchEnd(strip, { changedTouches: [{ clientX: 200 + dx, clientY: 100 + dy }] })
    }
    swipe(-100)
    swipe(100)
    swipe(30)
    swipe(-80, 200)
    expect(onSelect.mock.calls.map((c) => toDateStr(c[0]))).toEqual(['2026-10-13', '2026-09-29'])
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/features/today/mobile/DayStrip9.test.tsx`
Expected: FAIL, because `./DayStrip9` can't be resolved.

- [ ] **Step 3: Implement**

`app-react/src/features/today/mobile/DayStrip9.tsx`:
```tsx
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, isFuture, isSameDay, nineDayWindow, toDateStr } from '../date'

const SWIPE_PX = 60

interface DayStrip9Props { date: Date; incomplete: Set<string>; onSelect: (d: Date) => void }

export function DayStrip9({ date, incomplete, onSelect }: DayStrip9Props) {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const start = useRef<{ x: number; y: number } | null>(null)
  const today = new Date()

  return (
    <div
      data-testid="day-strip"
      className="grid touch-pan-y grid-cols-9 px-2 pt-2 pb-3.5"
      onTouchStart={(e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
      onTouchEnd={(e) => {
        const s = start.current
        start.current = null
        if (!s) return
        const dx = e.changedTouches[0].clientX - s.x
        const dy = e.changedTouches[0].clientY - s.y
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return
        onSelect(addDays(date, dx < 0 ? 7 : -7))
      }}
    >
      {nineDayWindow(date).map((d, i) => {
        const ds = toDateStr(d)
        const selected = isSameDay(d, date)
        const edge = i === 0 || i === 8
        const missing = incomplete.has(ds)
        const numTone = selected
          ? 'bg-ui-selected text-ui-on-selected'
          : isFuture(d, today) || edge ? 'text-ui-faint' : 'text-ui-ink'
        return (
          <button key={ds} type="button" onClick={() => onSelect(d)} aria-label={full.format(d)}
            aria-current={selected ? 'date' : undefined} className="flex flex-col items-center gap-1">
            <span className={`text-[11px] font-semibold ${edge ? 'text-ui-faint' : 'text-ui-faint2'}`}>{weekday.format(d)}</span>
            <span className={`flex h-9 w-9 items-center justify-center rounded-[11px] font-ui-mono text-[15px] font-medium ${numTone}`}>
              {d.getDate()}
            </span>
            <span data-testid={missing ? 'incomplete-dot' : undefined}
              className={`h-[5px] w-[5px] rounded-full ${missing ? 'bg-ui-danger' : ''}`} />
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/features/today/mobile/DayStrip9.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/today/mobile/DayStrip9.tsx src/features/today/mobile/DayStrip9.test.tsx
git commit -m "feat(today): 9-day strip with incomplete dots and week swipe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Calendar sheet (2b content in a bottom sheet)

**Files:**
- Create: `app-react/src/features/today/mobile/CalendarSheet.tsx`
- Test: `app-react/src/features/today/mobile/CalendarSheet.test.tsx`

**Interfaces:**
- Consumes: `BottomSheet` (Task 6); `AnchoredMenu` and `MenuItem` (Task 5); `monthGrid`, `toDateStr`, `isSameDay` and `isFuture` (Task 1); `capitalize` (Task 1); `practicesApi.getIncompleteDays`.
- Produces: `CalendarSheet({ date: Date; onSelect: (d: Date) => void; onClose: () => void })`

- [ ] **Step 1: Write the failing test**

`app-react/src/features/today/mobile/CalendarSheet.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarSheet } from './CalendarSheet'
import { toDateStr } from '../date'

vi.mock('../../../api/practices', () => ({
  practicesApi: { getIncompleteDays: vi.fn() },
}))
import { practicesApi } from '../../../api/practices'

function setup() {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <CalendarSheet date={new Date(2026, 9, 6)} onSelect={onSelect} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onSelect, onClose }
}

describe('CalendarSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 12))
    vi.mocked(practicesApi.getIncompleteDays).mockResolvedValue(['2026-10-02', '2026-10-05'])
  })
  afterEach(() => { vi.useRealTimers() })

  it('shows the month with incomplete dots and disables future days', async () => {
    setup()
    expect(screen.getByRole('button', { name: 'October ▾' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2026 ▾' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId('incomplete-dot')).toHaveLength(2))
    expect(practicesApi.getIncompleteDays).toHaveBeenCalledWith('2026-10-01', '2026-10-31')
    expect(screen.getByRole('button', { name: /October 7/ })).toBeDisabled()
  })

  it('navigates months', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('button', { name: 'September ▾' })).toBeInTheDocument()
    await waitFor(() => expect(practicesApi.getIncompleteDays).toHaveBeenCalledWith('2026-09-01', '2026-09-30'))
  })

  it('selects a day and closes', () => {
    const { onSelect, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: /October 5/ }))
    expect(toDateStr(onSelect.mock.calls[0][0])).toBe('2026-10-05')
    expect(onClose).toHaveBeenCalled()
  })

  it('Today jumps to today', () => {
    const { onSelect } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(toDateStr(onSelect.mock.calls[0][0])).toBe('2026-10-06')
  })

  it('picks a month from the month picker', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'October ▾' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'March' }))
    expect(screen.getByRole('button', { name: 'March ▾' })).toBeInTheDocument()
  })

  it('Escape in the month picker keeps the sheet open', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'October ▾' }))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/features/today/mobile/CalendarSheet.test.tsx`
Expected: FAIL, because `./CalendarSheet` can't be resolved.

- [ ] **Step 3: Implement**

`app-react/src/features/today/mobile/CalendarSheet.tsx`:
```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../../api/practices'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { isFuture, isSameDay, monthGrid, toDateStr } from '../date'
import { capitalize } from '../values'

const FIRST_YEAR = 2015
const PILL = 'rounded-[10px] border border-ui-control bg-ui-surface px-2.5 py-1.5 text-xl font-extrabold'
const SQUARE = 'flex h-10 w-10 items-center justify-center rounded-xl border border-ui-control bg-ui-surface font-bold'

interface CalendarSheetProps { date: Date; onSelect: (d: Date) => void; onClose: () => void }

export function CalendarSheet({ date, onSelect, onClose }: CalendarSheetProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const [view, setView] = useState({ y: date.getFullYear(), m: date.getMonth() })
  const [picker, setPicker] = useState<{ kind: 'month' | 'year'; anchor: HTMLElement } | null>(null)

  const from = toDateStr(new Date(view.y, view.m, 1))
  const to = toDateStr(new Date(view.y, view.m + 1, 0))
  const { data = [] } = useQuery({ queryKey: ['incomplete-days', from, to], queryFn: () => practicesApi.getIncompleteDays(from, to) })
  const incomplete = new Set(data)

  const today = new Date()
  const monthName = (m: number) => capitalize(new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, m, 1)), locale)
  const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  const weekdays = Array.from({ length: 7 }, (_, i) => narrow.format(new Date(2024, 0, 1 + i))) // 1 Jan 2024 is a Monday
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const years = Array.from({ length: today.getFullYear() - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)

  const shift = (n: number) => setView((v) => {
    const d = new Date(v.y, v.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const pick = (d: Date) => { onSelect(d); onClose() }

  return (
    <BottomSheet label={t('today.calendar')} onClose={onClose}>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button type="button" aria-haspopup="menu" className={PILL}
            onClick={(e) => setPicker({ kind: 'month', anchor: e.currentTarget })}>
            {monthName(view.m)} ▾
          </button>
          <button type="button" aria-haspopup="menu" className={PILL}
            onClick={(e) => setPicker({ kind: 'year', anchor: e.currentTarget })}>
            {view.y} ▾
          </button>
        </div>
        <div className="flex gap-1.5">
          <button type="button" aria-label={t('today.prevMonth')} onClick={() => shift(-1)} className={SQUARE}>‹</button>
          <button type="button" aria-label={t('today.nextMonth')} onClick={() => shift(1)} className={SQUARE}>›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((w, i) => <span key={i} className="text-[11px] font-bold text-ui-faint">{w}</span>)}
        {monthGrid(view.y, view.m).map((d, i) => {
          if (!d) return <span key={`blank-${i}`} />
          const ds = toDateStr(d)
          const selected = isSameDay(d, date)
          const future = isFuture(d, today)
          const missing = incomplete.has(ds)
          return (
            <button key={ds} type="button" disabled={future} onClick={() => pick(d)} aria-label={full.format(d)}
              aria-current={selected ? 'date' : undefined} className="flex h-[46px] flex-col items-center justify-center gap-[3px]">
              <span className={`flex h-[34px] w-[38px] items-center justify-center rounded-[10px] font-ui-mono text-sm ${selected ? 'bg-ui-selected font-semibold text-ui-on-selected' : future ? 'text-ui-faint' : ''}`}>
                {d.getDate()}
              </span>
              <span data-testid={missing ? 'incomplete-dot' : undefined}
                className={`h-[5px] w-[5px] rounded-full ${missing ? 'bg-ui-danger' : ''}`} />
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t border-ui-control pt-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ui-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ui-danger" />
          {t('today.legendMissing')}
        </span>
        <button type="button" onClick={() => pick(new Date())} className="text-sm font-bold text-ui-accent">{t('today.goToday')}</button>
      </div>

      {picker && (
        <AnchoredMenu anchor={picker.anchor} label={t(picker.kind === 'month' ? 'today.month' : 'today.year')} onClose={() => setPicker(null)}>
          {picker.kind === 'month'
            ? Array.from({ length: 12 }, (_, m) => (
                <MenuItem key={m} selected={m === view.m} onSelect={() => { setView((v) => ({ ...v, m })); setPicker(null) }}>
                  {monthName(m)}
                </MenuItem>
              ))
            : years.map((y) => (
                <MenuItem key={y} selected={y === view.y} onSelect={() => { setView((v) => ({ ...v, y })); setPicker(null) }}>
                  {y}
                </MenuItem>
              ))}
        </AnchoredMenu>
      )}
    </BottomSheet>
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/features/today/mobile/CalendarSheet.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/today/mobile/CalendarSheet.tsx src/features/today/mobile/CalendarSheet.test.tsx
git commit -m "feat(today): calendar bottom sheet with month/year pickers and incomplete dots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Mobile shell, app bar, Today screen and route wiring

**Files:**
- Create: `app-react/src/features/today/actions.ts`
- Modify: `app-react/src/components/layout/HomeHeaderActions.tsx` (use the extracted actions)
- Create: `app-react/src/layouts/mobile/AppBar.tsx`
- Create: `app-react/src/layouts/mobile/MobileShell.tsx`
- Create: `app-react/src/features/today/mobile/DateHeader.tsx`
- Create: `app-react/src/features/today/mobile/TodayMobile.tsx`
- Modify: `app-react/src/router.tsx` (route `/` through `ByLayout`)
- Test: `app-react/src/features/today/mobile/TodayMobile.test.tsx`

**Interfaces:**
- Consumes: everything above. `useToday` (Task 4), `ByLayout` (Task 2), `ListGroup` and `AnchoredMenu`/`MenuItem` (Task 5), `PracticeRow` (Task 9), `DayStrip9` (Task 10), `CalendarSheet` (Task 11), `capitalize` (Task 1).
- Produces:
  - `downloadCsv(): Promise<void>`
  - `copyShareLink(): boolean`
  - `AppBar({ title: ReactNode; actions?: AppBarAction[] })`
  - `interface AppBarAction { label: string; onSelect: () => void }`
  - `MobileShell({ children })`
  - `DateHeader({ date: Date; summary: TodaySummary; onOpenCalendar: () => void })`
  - `TodayMobile()`
  - `TodayMobileScreen()`

- [ ] **Step 1: Write the failing test**

`app-react/src/features/today/mobile/TodayMobile.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TodayMobileScreen } from './TodayMobile'
import { setViewportWidth } from '../../../test/viewport'

vi.mock('../../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn(),
    getDiaryEntries: vi.fn(),
    getIncompleteDays: vi.fn(),
    saveDiaryEntry: vi.fn(),
    createUserPractice: vi.fn(),
  },
}))
vi.mock('../../../hooks/useNetworkStatus', () => ({ default: () => true }))
import { practicesApi } from '../../../api/practices'
const api = vi.mocked(practicesApi)

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}><TodayMobileScreen /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TodayMobile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(390)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    api.getUserPractices.mockResolvedValue([
      { id: '1', practice: 'Wake up', data_type: 'Time', is_active: true, is_required: true },
      { id: '2', practice: 'Reading', data_type: 'Bool', is_active: true },
    ])
    api.getDiaryEntries.mockResolvedValue([{ practice: 'Reading', data_type: 'Bool', value: { Bool: false } }])
    api.getIncompleteDays.mockResolvedValue([])
    api.saveDiaryEntry.mockResolvedValue(undefined)
  })
  afterEach(() => { vi.useRealTimers() })

  it('renders the date header, summary, group and tabs', async () => {
    renderScreen()
    expect(await screen.findByText('Wake up')).toBeInTheDocument()
    expect(screen.getByText('Tue, October 6')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 · 1 required left')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Practices' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
  })

  it('saves a toggle for the selected day', async () => {
    renderScreen()
    fireEvent.click(await screen.findByRole('switch', { name: 'Reading' }))
    await waitFor(() => expect(api.saveDiaryEntry).toHaveBeenCalledWith('2026-10-06', 'Reading', { Bool: true }))
  })

  it('opens the calendar from the date header', async () => {
    renderScreen()
    fireEvent.click(await screen.findByText('Tue, October 6'))
    expect(screen.getByRole('dialog', { name: 'Calendar' })).toBeInTheDocument()
  })

  it('shows screen actions in the ⋯ menu', async () => {
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'More' }))
    expect(screen.getByRole('menuitem', { name: 'Add new practice' })).toBeInTheDocument()
  })

  it('shows the empty state with starters', async () => {
    api.getUserPractices.mockResolvedValue([])
    renderScreen()
    expect(await screen.findByRole('button', { name: 'Add starter practices' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/features/today/mobile/TodayMobile.test.tsx`
Expected: FAIL, because `./TodayMobile` can't be resolved.

- [ ] **Step 3: Extract the export and share actions**

`app-react/src/features/today/actions.ts`:
```ts
import { chartsApi } from '../../api/charts'
import { practicesApi } from '../../api/practices'
import { toCSV, triggerCSVDownload } from '../../pages/charts/csv'
import { useAuthStore } from '../../store/authStore'
import { toDateStr } from './date'

export async function downloadCsv() {
  const [entries, practices] = await Promise.all([
    chartsApi.getReportData(toDateStr(new Date()), 'AllData'),
    practicesApi.getUserPractices(),
  ])
  const practiceMap = Object.fromEntries(practices.map((p) => [p.id, p.practice]))
  triggerCSVDownload(toCSV(entries, practiceMap))
}

/** Copies the public charts link. Returns false when nobody is signed in. */
export function copyShareLink(): boolean {
  const user = useAuthStore.getState().user
  if (!user) return false
  void navigator.clipboard.writeText(`${window.location.origin}/shared/${user.id}`)
  return true
}
```

In `app-react/src/components/layout/HomeHeaderActions.tsx`, delete the local `downloadCsv` and `shareLink` functions and the now-unused imports (`useAuthStore`, `chartsApi`, `practicesApi`, `toCSV`, `triggerCSVDownload`). Then add:
```tsx
import { copyShareLink, downloadCsv } from '../../features/today/actions'
```
and change the share item to:
```tsx
    {
      label: t('charts.shareLink'),
      onClick: () => {
        if (copyShareLink()) useToastStore.getState().showToast({ message: t('charts.copied'), variant: 'success' })
      },
    },
```
Leave the CSV item as `onClick: () => void downloadCsv()`.

- [ ] **Step 4: Implement the app bar and shell**

`app-react/src/layouts/mobile/AppBar.tsx`:
```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnchoredMenu, MenuItem } from '../../ui/primitives/AnchoredMenu'

export interface AppBarAction { label: string; onSelect: () => void }

/** Sits below the status bar (safe-area aware). ⋯ shows the screen's own actions. */
export function AppBar({ title, actions }: { title: ReactNode; actions?: AppBarAction[] }) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-14 items-center justify-between py-1.5 pr-2 pl-5">
        <div className="min-w-0">{title}</div>
        {actions?.length ? (
          <button type="button" aria-label={t('today.more')} aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}
            className="flex h-11 w-11 items-center justify-center gap-[3px] rounded-[14px]">
            {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
          </button>
        ) : null}
      </div>
      {anchor && actions && (
        <AnchoredMenu anchor={anchor} label={t('today.more')} onClose={() => setAnchor(null)}>
          {actions.map((a) => (
            <MenuItem key={a.label} onSelect={() => { setAnchor(null); a.onSelect() }}>{a.label}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
    </header>
  )
}
```

`app-react/src/layouts/mobile/MobileShell.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ToastContainer } from '../../components/ui/Toast'

const TABS = [
  { to: '/', key: 'today.tabToday', icon: 'rounded-[3px]' },
  { to: '/charts', key: 'today.tabInsights', icon: 'rounded-[3px]' },
  { to: '/yatras', key: 'today.tabYatra', icon: 'rounded-full' },
  { to: '/settings', key: 'today.tabSettings', icon: 'rotate-45' },
] as const

function TabBar() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('today.tabs')}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ui-control bg-ui-tabbar px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] text-xs font-semibold text-ui-faint2">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'}
          className={({ isActive }) => `flex flex-col items-center gap-1.5 ${isActive ? 'text-ui-ink' : ''}`}>
          {({ isActive }) => (
            <>
              <span className={`flex h-7 w-11 items-center justify-center rounded-full ${isActive ? 'bg-ui-accent-pill' : ''}`}>
                <span aria-hidden className={`h-2.5 w-2.5 ${tab.icon} ${isActive ? 'bg-ui-accent' : 'border-[1.5px] border-ui-faint2'}`} />
              </span>
              {t(tab.key)}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/** Matches the browser chrome and overscroll area to the shell's background while mounted. */
function useShellBackground(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    const html = document.documentElement
    const prevBg = html.style.backgroundColor
    const apply = () => {
      if (!ref.current) return
      const bg = getComputedStyle(ref.current).getPropertyValue('--ui-bg').trim()
      meta!.content = bg
      html.style.backgroundColor = bg
    }
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    apply()
    scheme.addEventListener('change', apply)
    return () => {
      scheme.removeEventListener('change', apply)
      html.style.backgroundColor = prevBg
      if (created) meta!.remove()
    }
  }, [ref])
}

export function MobileShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useShellBackground(ref)
  return (
    <div ref={ref} className="ui-root min-h-dvh bg-ui-bg pb-[calc(72px+env(safe-area-inset-bottom))]">
      {children}
      <TabBar />
      <ToastContainer />
    </div>
  )
}
```

- [ ] **Step 5: Implement the date header and the Today screen**

`app-react/src/features/today/mobile/DateHeader.tsx`:
```tsx
import { useTranslation } from 'react-i18next'
import type { TodaySummary } from '../useToday'
import { capitalize } from '../values'

interface DateHeaderProps { date: Date; summary: TodaySummary; onOpenCalendar: () => void }

export function DateHeader({ date, summary, onOpenCalendar }: DateHeaderProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const title = capitalize(new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'long' }).format(date), locale)
  const line = t('today.filledOf', { filled: summary.filled, total: summary.total })
    + (summary.requiredLeft ? ` · ${t('today.requiredLeft', { count: summary.requiredLeft })}` : '')
  return (
    <button type="button" aria-haspopup="dialog" title={t('today.openCalendar')} onClick={onOpenCalendar}
      className="flex flex-col gap-px text-left">
      <span className="flex items-center gap-1.5 text-xl font-extrabold tracking-[-0.01em]">
        <span>{title}</span>
        <span aria-hidden className="-mt-1 ml-1 h-[7px] w-[7px] rotate-45 border-r-2 border-b-2 border-ui-accent" />
      </span>
      <span className="text-xs text-ui-muted">{line}</span>
    </button>
  )
}
```

`app-react/src/features/today/mobile/TodayMobile.tsx`:
```tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useNetworkStatus from '../../../hooks/useNetworkStatus'
import { useToast } from '../../../hooks/useToast'
import { AppBar, type AppBarAction } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { ListGroup } from '../../../ui/primitives/ListGroup'
import { copyShareLink, downloadCsv } from '../actions'
import { toDateStr } from '../date'
import { useToday } from '../useToday'
import { CalendarSheet } from './CalendarSheet'
import { DateHeader } from './DateHeader'
import { DayStrip9 } from './DayStrip9'
import { PracticeRow } from './PracticeRow'

export function TodayMobile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isOnline = useNetworkStatus()
  const [date, setDate] = useState(() => new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const today = useToday(date)
  const dateStr = toDateStr(date)

  const actions: AppBarAction[] = [
    { label: t('home.addPractice'), onSelect: () => navigate('/user/practice/new') },
    { label: t('home.editPractices'), onSelect: () => navigate('/user/practices') },
    { label: t('charts.downloadCsv'), onSelect: () => void downloadCsv() },
    {
      label: t('charts.shareLink'),
      onSelect: () => { if (copyShareLink()) showToast({ message: t('charts.copied'), variant: 'success' }) },
    },
  ]

  return (
    <>
      <AppBar title={<DateHeader date={date} summary={today.summary} onOpenCalendar={() => setCalendarOpen(true)} />} actions={actions} />
      {!isOnline && (
        <p role="status" className="mx-4 mb-2 rounded-xl bg-ui-accent-soft px-3 py-2 text-xs font-semibold text-ui-accent">
          {t('home.offline')}
        </p>
      )}
      <DayStrip9 date={date} incomplete={today.incomplete} onSelect={setDate} />
      <div className="flex flex-col gap-4 px-4 pb-6">
        {today.isLoading ? (
          <ListGroup label={t('today.group')}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex h-[50px] items-center bg-ui-surface px-4">
                <div className="h-3.5 w-1/2 animate-pulse rounded-full bg-ui-field" />
              </div>
            ))}
          </ListGroup>
        ) : today.isError ? (
          <p role="alert" className="rounded-2xl bg-ui-surface px-4 py-3 text-sm text-ui-danger">{t('common.error')}</p>
        ) : today.practices.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-ui-muted">{t('home.noPractices')}</p>
            <button type="button" onClick={today.seedStarters} disabled={today.isSeeding}
              className="h-11 rounded-full bg-ui-primary px-6 text-sm font-semibold text-ui-on-primary disabled:opacity-60">
              {t('home.addStarters')}
            </button>
            <Link to="/user/practice/new" className="text-sm font-semibold text-ui-accent">{t('home.addCustom')}</Link>
          </div>
        ) : (
          <ListGroup label={t('today.group')}>
            {today.practices.map((p) => (
              <PracticeRow key={`${p.id}-${dateStr}`} practice={p} value={today.values[p.practice]}
                failed={today.failed === p.practice} onSave={(v) => today.save(p, v)} />
            ))}
          </ListGroup>
        )}
      </div>
      {calendarOpen && <CalendarSheet date={date} onSelect={setDate} onClose={() => setCalendarOpen(false)} />}
    </>
  )
}

export function TodayMobileScreen() {
  return (
    <MobileShell>
      <TodayMobile />
    </MobileShell>
  )
}
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npx vitest run src/features/today/mobile/TodayMobile.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Wire `/` through `ByLayout`**

In `app-react/src/router.tsx`, add next to the other lazy imports:
```tsx
import { ByLayout } from './layouts/ByLayout'
const TodayMobileScreen = lazy(() => import('./features/today/mobile/TodayMobile').then((m) => ({ default: m.TodayMobileScreen })))
```
Then replace the authenticated `children` array so `/` sits outside the shared `AppShell` route:
```tsx
  {
    element: <ProtectedRoute />,
    children: [
      {
        // Redesigned layouts render their own shell; the rest fall back to the legacy AppShell.
        path: '/',
        element: <ByLayout mobile={<TodayMobileScreen />} legacy={<AppShell />} />,
        children: [{ index: true, element: <HomePage /> }],
      },
      {
        element: <AppShell />,
        children: [
          { path: '/charts', element: <ChartsPage /> },
          // …every other existing route, unchanged…
        ],
      },
    ],
  },
```
Keep every other child route exactly as it was. Remove only the `{ path: '/', element: <HomePage /> }` line from the `AppShell` children.

- [ ] **Step 8: Run the full checks**

Run: `npx tsc -b && npm run lint && npx vitest run`
Expected: no type errors, no lint errors, and every test file passes (existing ones included, e.g. `HomeHeaderActions.test.tsx`).

- [ ] **Step 9: Commit**

```bash
git add src/features/today src/layouts src/components/layout/HomeHeaderActions.tsx src/router.tsx
git commit -m "feat(today): mobile Today screen in new MobileShell, routed via ByLayout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Manual verification in the browser

**Files:** none, unless a fix is needed. Commit any fix with a message describing it.

- [ ] **Step 1: Start the app**

The API server must be running on `:8080` (`make run_server` inside the dev container; see CLAUDE.md). Then, on the host:
Run: `cd app-react && npm run dev`
Expected: Vite serves on `http://localhost:5173` and proxies `/api` to `:8080`.

- [ ] **Step 2: Check the mobile layout at 390×844 (DevTools device mode), light scheme**

- Header reads "Tue, October 6 ⌄" with "N of M · K required left" underneath.
- The 9-day strip shows the edge days lighter, the selected day ink-filled, and red dots on past incomplete days. Swiping moves a week.
- Tapping the header opens the calendar bottom sheet. The month and year pickers, ‹ › and "Today" work, and future days are disabled.
- Every row type works:
  - Time/Int edit inline;
  - choices open the anchored menu, which flips up near the bottom of the screen;
  - Bool toggles;
  - Duration's ＋ opens Add mode and its value opens Set total;
  - Text edits inline, saves as you type, and Done closes it.
- Saving the last required value for a past day clears that day's red dot.
- The bottom tabs navigate. The Insights, Yatra and Settings screens render in the legacy dark shell (expected).

- [ ] **Step 3: Repeat in dark mode**

Emulate `prefers-color-scheme: dark` in DevTools rendering. Every new surface, including menus and sheets, uses the 1a-dark palette. Nothing renders transparent or dark-on-dark.

- [ ] **Step 4: Repeat in ru and uk**

Settings → Language, or set `localStorage.i18nextLng`. Cyrillic text renders in Manrope and Plex Mono, not a fallback font. Check that "1 / 2 / 5 required left" use the right plural forms.

- [ ] **Step 5: Check the other layouts fall back**

Resize to 800px and 1280px: the legacy home page renders. Resize back to 390px: the new screen returns without a reload.

- [ ] **Step 6: Report**

List anything that didn't match, with screenshots, and fix it or raise it with the user before calling the work done.
