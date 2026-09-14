# Home Page Clarity Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a date context label, a "nothing logged" banner for past dates, and improve the Required/Optional section divider.

**Architecture:** All changes are confined to `app-react/src/pages/home/HomePage.tsx` and its test file, plus 3 locale JSON files. No new components files are created — new helper components (`DateContextLabel`, updated `SectionLabel`) live in the same file and are exported for direct unit testing. The date context label and nothing-logged banner both read from already-available state (`dateStr`, `diaryQuery`, `activePractices`).

**Tech Stack:** React 19, TypeScript, i18next (react-i18next), Vitest + React Testing Library, Tailwind CSS

## Global Constraints

- No new npm dependencies
- Locale files: `app-react/public/locales/en/translation.json`, `ru/translation.json`, `uk/translation.json`
- Test command: `cd app-react && npm test`
- All tests must pass after every task
- `toDateStr` is already defined in `HomePage.tsx` as `(d: Date) => d.toISOString().split('T')[0]`
- `home.today` already exists in all locales — do not add it again
- The nothing-logged banner must NOT appear on today (only strictly past dates: `dateStr < todayStr`)
- The nothing-logged banner must NOT appear when `diaryQuery.isLoading` or `diaryQuery.isError` is true
- `SectionLabel` and `DateContextLabel` must be exported (named exports) so tests can import them directly

---

### Task 1: i18n keys

**Files:**
- Modify: `app-react/public/locales/en/translation.json`
- Modify: `app-react/public/locales/ru/translation.json`
- Modify: `app-react/public/locales/uk/translation.json`

**Interfaces:**
- Produces: `t('home.yesterday')`, `t('home.tomorrow')`, `t('home.nothingLogged')` — used by Tasks 2 and 3

- [ ] **Step 1: Add keys to English locale**

Open `app-react/public/locales/en/translation.json`. Find the `"home"` object (around line 57). Add three keys after `"today": "Today"`:

```json
"home": {
  "noPractices": "No practices yet",
  "addStarters": "Add starter practices",
  "addCustom": "or create a custom one",
  "addFirst": "Add your first practice",
  "offline": "You're offline — changes will sync when reconnected",
  "addMinutes": "Add minutes",
  "addMinutesPlaceholder": "e.g. 30",
  "optional": "Optional",
  "saveFailed": "Could not save — please try again",
  "durationHint": "Enter total minutes (e.g. 90 for 1h 30m)",
  "required": "Required",
  "today": "Today",
  "yesterday": "Yesterday",
  "tomorrow": "Tomorrow",
  "nothingLogged": "Nothing was logged on this day"
},
```

- [ ] **Step 2: Add keys to Russian locale**

Open `app-react/public/locales/ru/translation.json`. Find the `"home"` object. Add after `"today": "Сегодня"`:

```json
"today": "Сегодня",
"yesterday": "Вчера",
"tomorrow": "Завтра",
"nothingLogged": "В этот день ничего не было записано"
```

- [ ] **Step 3: Add keys to Ukrainian locale**

Open `app-react/public/locales/uk/translation.json`. Find the `"home"` object. Add after `"today": "Сьогодні"`:

```json
"today": "Сьогодні",
"yesterday": "Вчора",
"tomorrow": "Завтра",
"nothingLogged": "У цей день нічого не було записано"
```

- [ ] **Step 4: Run tests to confirm nothing broke**

```bash
cd app-react && npm test
```

Expected: all existing tests pass (JSON changes have no test coverage, the test suite loads a mock i18n setup).

- [ ] **Step 5: Commit**

```bash
git add app-react/public/locales/en/translation.json \
        app-react/public/locales/ru/translation.json \
        app-react/public/locales/uk/translation.json
git commit -m "i18n: add yesterday, tomorrow, nothingLogged keys to all locales"
```

---

### Task 2: SectionLabel — size and horizontal rule

**Files:**
- Modify: `app-react/src/pages/home/HomePage.tsx`
- Modify: `app-react/src/pages/home/HomePage.test.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `export function SectionLabel({ label }: { label: string }): JSX.Element` — a flex row with text and a decorative `<div>` rule

- [ ] **Step 1: Export SectionLabel and add a failing test**

Open `app-react/src/pages/home/HomePage.test.tsx`. Add this import at the top alongside the existing `HomePage` import:

```tsx
import { HomePage, SectionLabel } from './HomePage'
```

Then add a new `describe` block after the existing `describe('HomePage', ...)`:

```tsx
describe('SectionLabel', () => {
  it('renders label text and a decorative horizontal rule', () => {
    const { container } = render(<SectionLabel label="Required" />)
    expect(screen.getByText('Required')).toBeInTheDocument()
    // outer element must have exactly 2 children: the <p> and the rule <div>
    expect(container.firstChild?.childNodes).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd app-react && npm test -- --run
```

Expected: FAIL — `SectionLabel` is not exported yet.

- [ ] **Step 3: Update SectionLabel in HomePage.tsx**

Open `app-react/src/pages/home/HomePage.tsx`. Find the current `SectionLabel` (around line 26):

```tsx
function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest px-1" style={{ color: '#ffffff' }}>
      {label}
    </p>
  )
}
```

Replace it with:

```tsx
export function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <p className="text-xs font-semibold uppercase tracking-widest flex-shrink-0"
         style={{ color: 'rgba(255,255,255,0.85)' }}>
        {label}
      </p>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.20)' }} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd app-react && npm test -- --run
```

Expected: all tests pass including the new `SectionLabel` test.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/pages/home/HomePage.tsx \
        app-react/src/pages/home/HomePage.test.tsx
git commit -m "feat: SectionLabel — 12px text + decorative horizontal rule"
```

---

### Task 3: DateContextLabel and past-date "nothing logged" banner

**Files:**
- Modify: `app-react/src/pages/home/HomePage.tsx`
- Modify: `app-react/src/pages/home/HomePage.test.tsx`

**Interfaces:**
- Consumes: `t('home.today')`, `t('home.yesterday')`, `t('home.tomorrow')`, `t('home.nothingLogged')` from Task 1
- Produces:
  - `export function DateContextLabel({ dateStr }: { dateStr: string }): JSX.Element`
  - A conditional amber banner inside `HomePage` JSX when `isPast && diaryEntries.length === 0 && !loading && !error && activePractices.length > 0`

- [ ] **Step 1: Add failing tests for DateContextLabel**

Open `app-react/src/pages/home/HomePage.test.tsx`. Add this import at the top:

```tsx
import { HomePage, SectionLabel, DateContextLabel } from './HomePage'
```

Add a new `describe` block after the `SectionLabel` describe:

```tsx
describe('DateContextLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Fix "today" to 2026-07-30
    vi.setSystemTime(new Date('2026-07-30T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders "Today" for today\'s date', () => {
    render(<DateContextLabel dateStr="2026-07-30" />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('renders "Yesterday" for the previous day', () => {
    render(<DateContextLabel dateStr="2026-07-29" />)
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  it('renders "Tomorrow" for the next day', () => {
    render(<DateContextLabel dateStr="2026-07-31" />)
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
  })

  it('renders a formatted date for other past dates', () => {
    render(<DateContextLabel dateStr="2026-07-15" />)
    // Should not render "Today", "Yesterday", or "Tomorrow"
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument()
    // Should render some non-empty text (locale-formatted date)
    expect(screen.getByRole('paragraph').textContent?.length).toBeGreaterThan(0)
  })
})
```

Then add tests for the nothing-logged banner inside the existing `describe('HomePage', ...)`, after the last existing test. Add `fireEvent` to the RTL import at the top of the test file:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
```

Then add these two tests:

```tsx
it('shows nothing-logged banner when navigating to a past date with no diary entries', async () => {
  vi.useFakeTimers()
  // Lock "today" to 2026-07-30 (Wednesday); day 29 is yesterday (past)
  vi.setSystemTime(new Date('2026-07-30T12:00:00'))

  const { practicesApi } = await import('../../api/practices')
  vi.mocked(practicesApi.getDiaryEntries).mockResolvedValue([])

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><HomePage /></MemoryRouter>
    </QueryClientProvider>
  )

  await screen.findByText('Meditation')

  // Click the day-29 button in the week calendar grid.
  // WeekCalendar renders each day as a <button> whose inner <div> contains the date number.
  const btn29 = Array.from(document.querySelectorAll('button[type="button"]')).find(
    el => el.querySelector('div')?.textContent === '29'
  ) as HTMLElement | undefined
  expect(btn29).toBeTruthy()
  fireEvent.click(btn29!)

  expect(await screen.findByText('Nothing was logged on this day')).toBeInTheDocument()

  vi.useRealTimers()
})

it('does not show nothing-logged banner on today even with no diary entries', async () => {
  const { practicesApi } = await import('../../api/practices')
  vi.mocked(practicesApi.getDiaryEntries).mockResolvedValue([])

  wrap(<HomePage />)
  await screen.findByText('Meditation')
  expect(screen.queryByText('Nothing was logged on this day')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm the new tests fail**

```bash
cd app-react && npm test -- --run
```

Expected: the `DateContextLabel` describe block fails because the component is not exported yet.

- [ ] **Step 3: Add DateContextLabel component to HomePage.tsx**

Open `app-react/src/pages/home/HomePage.tsx`. After the `SectionLabel` component (around line 34), add:

```tsx
export function DateContextLabel({ dateStr }: { dateStr: string }) {
  const todayStr = toDateStr(new Date())
  const yesterday = toDateStr(new Date(Date.now() - 86_400_000))
  const tomorrow  = toDateStr(new Date(Date.now() + 86_400_000))
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'

  let label: string
  if (dateStr === todayStr)        label = t('home.today')
  else if (dateStr === yesterday)  label = t('home.yesterday')
  else if (dateStr === tomorrow)   label = t('home.tomorrow')
  else {
    const d = new Date(dateStr + 'T00:00:00')
    label = d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <p role="paragraph" className="text-[11px] font-semibold uppercase tracking-widest px-1"
       style={{ color: 'rgba(255,255,255,0.70)' }}>
      {label}
    </p>
  )
}
```

- [ ] **Step 4: Insert DateContextLabel and the nothing-logged banner into HomePage JSX**

In `HomePage.tsx`, find the return statement. The structure currently is:

```tsx
return (
  <>
    <div className="px-4 py-4 pb-28 max-w-lg mx-auto flex flex-col gap-3">
      {/* Offline banner */}
      ...
      {/* Week calendar */}
      <WeekCalendar date={date} onDateChange={setDate} />

      {/* Practice cards */}
      <div className="flex flex-col gap-3">
        {(practicesQuery.isLoading || diaryQuery.isLoading) ? (
```

Add `todayStr` and `isPast` derivations right after the existing `const dateStr = toDateStr(date)` line (around line 40):

```tsx
const dateStr = toDateStr(date)
const todayStr = toDateStr(new Date())
const isPast = dateStr < todayStr
```

Then insert `DateContextLabel` and the banner between `<WeekCalendar>` and the practice cards `<div>`:

```tsx
      {/* Week calendar */}
      <WeekCalendar date={date} onDateChange={setDate} />

      {/* Date context */}
      <DateContextLabel dateStr={dateStr} />

      {/* Past-date nothing-logged banner */}
      {isPast && (diaryQuery.data ?? []).length === 0 && !diaryQuery.isLoading && !diaryQuery.isError && activePractices.length > 0 && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
          style={{
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.18)',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          {t('home.nothingLogged')}
        </div>
      )}

      {/* Practice cards */}
      <div className="flex flex-col gap-3">
```

- [ ] **Step 5: Run all tests**

```bash
cd app-react && npm test -- --run
```

Expected: all tests pass. The `DateContextLabel` describe block should pass. The `HomePage` nothing-logged tests should pass.

- [ ] **Step 6: Commit**

```bash
git add app-react/src/pages/home/HomePage.tsx \
        app-react/src/pages/home/HomePage.test.tsx
git commit -m "feat: date context label and past-date nothing-logged banner"
```
