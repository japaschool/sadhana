# Mobile Yatra Settings — Phase 2 (Admin Side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the mobile layout, yatra admins manage a yatra from a hub of sub-pages (12m9–23): General, Practices (with a practice editor and range bar), Members, Statistics, Invite and Danger zone. Every change saves at once, with Undo where it can be undone.

**Architecture:** Pure helpers: `zones.ts` (value parse/format, validation, palettes, range-bar geometry) and `statistics.ts` (aggregations per type, tile values). One hook, `useYatraAdmin`, owns the yatra/practices/users queries. Saves go through `useQueuedSave`, which is optimistic, sends one request at a time in order, and offers Undo; it is pulled out of phase 1's `useLinkPractices`. Each screen renders inside `AdminPage`, which provides the shell, back link, title, loading/error states and the admin gate. `/yatra/:id/admin/settings` and `/yatra/:id/practice/:practice_id/edit` become `ByLayout` routes. The new `/yatra/:id/admin/:section` route renders the mobile section, and redirects to the hub on the other layouts.

**Tech Stack:** React 19, TypeScript, React Router 6, TanStack Query, zustand, Tailwind v4 (`ui-*` tokens), i18next, `@dnd-kit/sortable` (installed), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-08-mobile-yatra-settings-design.md` (sections "Routes", "Saving, Undo and errors", "Admin side (phase 2)", "i18n", "Testing").

**Spec correction found while planning:** the server's practice field is `daily_score` (`server/src/app/yatras/domain/mod.rs:270`, and the Rust UI's `frontend/src/model/yatra.rs:218` on `main`). The React type calls it `daily_score_config`. Because of that, the legacy React editor never shows a stored daily score, and it clears the score on every save. Task 1 renames the field. Everywhere the spec says `daily_score_config`, read `daily_score`.

## Global Constraints

- Mobile layout only. Tablet/desktop keep the legacy pages via `ByLayout`; the new `admin/*` sub-routes redirect to `/yatra/:id/admin/settings` there.
- No server changes. `PUT /yatra/:id` takes `name`, `show_stability_metrics` and `statistics` together: always send all three from the current cache, so a save never clears `statistics`.
- New code only in `src/ui`, `src/layouts`, `src/features/...`. Don't extend `pages/`, `components/layout/`, `theme/tokens.ts` (Task 1's field rename in the legacy editor is the one exception: it's a bug fix). No DaisyUI classes; only `ui-*` Tailwind colours; zone colours via `ZONE_BG` from `features/yatras/yatrasLogic.ts`. Sheets via `BottomSheet`, menus via `AnchoredMenu`.
- Every user-visible string in en, ru and uk (`public/locales/{en,ru,uk}/translation.json`), new keys flat under `yatraSettings.*` (the parity test in `settings/locales.test.ts` only reads that object). Plural keys: en `_one`/`_other`; ru and uk `_one`/`_few`/`_many`/`_other`. Zone colour names reuse the existing `yatras.zone{Colour}` keys.
- No Save buttons. Text fields save 600 ms after the last keystroke and on blur; everything else saves on change. Undo for value/toggle/link changes; deleting a practice or statistic, removing a member and deleting the yatra ask first and have no Undo.
- Invalid values are never sent; the field says why.
- Bonus: one threshold worth +1, stored as `bonus_rules: [{ threshold, points: 1 }]`.
- Admin routes check the current user's `is_admin` in `GET /yatra/:id/users`; non-admins are redirected to `/yatra/:id/settings`.
- Run tooling inside the dev container: `docker exec <container> bash -lc 'cd /workspaces/sadhana-pro/app-react && npx vitest run <path>'` (find `<container>` with `docker ps`). Host Node 26 breaks jsdom.

## Review Focus

1. **Two quick edits to the yatra** (rename, then flip the metrics toggle before the rename's PUT returns). The second PUT must carry the new name, because each save builds on the cache, not on stale component state. Pinned in Task 6.
2. **A save landing while the admin is still typing in a bound field.** The optimistic update re-renders the editor, and that must not overwrite the draft in the focused field. Pinned in Task 8.
3. **Deleting a practice that statistics use.** Those statistics are removed first. If that request fails, the practice is not deleted, and an error toast shows. Pinned in Task 7.
4. **The last admin.** Their own Admin toggle is disabled with the reason, and they get no Remove row for themselves. Pinned in Task 9.
5. **A Count statistic on a Time practice.** The server wraps the count as `{Time:{h,m}}`, so the tile must show the count (e.g. `112`), not a time. Average values can be fractional. Pinned in Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/types/api.ts` (modify) | `daily_score` field name |
| `src/pages/yatras/YatraPracticeEditPage.tsx` (modify) | use `daily_score` |
| `src/features/yatras/yatrasLogic.ts` (modify) | export `zoneNumber` |
| `src/features/yatras/settings/useQueuedSave.ts` (create) | optimistic, serialized, undoable save for one query key |
| `src/features/yatras/settings/useLinkPractices.ts` (modify) | use `useQueuedSave` |
| `src/features/yatras/settings/useDebouncedCommit.ts` (create) | 600 ms debounce + flush on blur/unmount |
| `src/features/yatras/settings/zones.ts` (create) | pure: values, validation, palettes, bar geometry, samples |
| `src/features/yatras/settings/statistics.ts` (create) | pure: aggregations per type, defaults, tile value text |
| `src/features/yatras/settings/useYatraAdmin.ts` (create) | queries, saves and mutations for the admin screens |
| `src/features/yatras/settings/mobile/AdminPage.tsx` (create) | shell, back link, title, gate; shared class strings |
| `src/features/yatras/settings/mobile/fields.tsx` (create) | `AutosaveText`, `ConfirmSheet`, `ChoiceChips` |
| `src/features/yatras/settings/mobile/summaries.ts` (create) | row summaries and zone colour keys (i18n-aware) |
| `src/features/yatras/settings/mobile/ManageYatraMobile.tsx` (create) | 12m9 hub |
| `src/features/yatras/settings/mobile/AdminSectionMobile.tsx` (create) | `admin/:section` → section screen |
| `src/features/yatras/settings/mobile/GeneralMobile.tsx` (create) | 12m10 |
| `src/features/yatras/settings/mobile/PracticesMobile.tsx` (create) | 12m11–13 |
| `src/features/yatras/settings/mobile/PracticeSheets.tsx` (create) | add / rename / delete practice sheets |
| `src/features/yatras/settings/mobile/RangeBar.tsx` (create) | the range bar |
| `src/features/yatras/settings/mobile/PracticeEditorMobile.tsx` (create) | 12m14–16 |
| `src/features/yatras/settings/mobile/MembersMobile.tsx` (create) | 12m17–19 |
| `src/features/yatras/settings/mobile/StatisticsMobile.tsx` (create) | 12m20–21 |
| `src/features/yatras/settings/mobile/InviteMobile.tsx` (create) | 12m22 |
| `src/features/yatras/settings/mobile/DangerZoneMobile.tsx` (create) | 12m23 |
| `src/features/yatras/settings/mobile/adminTestUtils.tsx` (create) | fixtures + render helper for the admin tests |
| `src/features/yatras/settings/mobile/LeaveSheets.tsx` (modify) | last-admin links → Members / Danger zone |
| `src/features/settings/mobile/SettingsRow.tsx` (modify) | `danger` prop |
| `src/ui/primitives/Toggle.tsx` (modify) | `disabled` prop |
| `src/router.tsx` (modify) | routes by layout |
| `public/locales/{en,ru,uk}/translation.json` (modify) | strings |

---

### Task 1: The `daily_score` field

**Files:**
- Modify: `app-react/src/types/api.ts:115`
- Modify: `app-react/src/pages/yatras/YatraPracticeEditPage.tsx` (the two `daily_score_config` uses)
- Test: `app-react/src/pages/yatras/YatraPracticeEditPage.test.tsx` (create)

**Interfaces:**
- Produces: `YatraPractice.daily_score?: DailyScoreConfig | null` (replaces `daily_score_config`). Every later task uses `daily_score`.

- [ ] **Step 1: Write the failing test** — `src/pages/yatras/YatraPracticeEditPage.test.tsx`

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { YatraPracticeEditPage } from './YatraPracticeEditPage'

vi.mock('../../api/yatras', () => ({ yatrasApi: { getYatraPractice: vi.fn(), updateYatraPractice: vi.fn() } }))
import { yatrasApi } from '../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('YatraPracticeEditPage', () => {
  it('loads and saves the daily score under the server field name', async () => {
    api.getYatraPractice.mockResolvedValue({
      id: 'p1', practice: 'Japa rounds', data_type: 'Int', colour_zones: null,
      daily_score: { better_direction: 'Higher', mandatory_threshold: { Int: 16 }, bonus_rules: [] },
    })
    api.updateYatraPractice.mockResolvedValue()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/yatra/y1/practice/p1/edit']}>
          <Routes>
            <Route path="/yatra/:id/practice/:practice_id/edit" element={<YatraPracticeEditPage />} />
            <Route path="/yatra/:id/admin/settings" element={<p>Admin</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(screen.getByLabelText(/mandatory/i)).toHaveValue(16))
    fireEvent.submit(screen.getByLabelText(/mandatory/i).closest('form')!)
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(api.updateYatraPractice.mock.calls[0][1]).toMatchObject({ daily_score: { mandatory_threshold: { Int: 16 } } })
    expect(api.updateYatraPractice.mock.calls[0][1]).not.toHaveProperty('daily_score_config')
  })
})
```

(The label comes from `yatras.mandatoryValue`; `src/test/setup.ts` fills it from the real en file. If the label text doesn't match `/mandatory/i`, use `screen.getByRole('spinbutton', …)` with the label's actual en text from `public/locales/en/translation.json`.)

- [ ] **Step 2: Run it — expect FAIL** (TypeScript lets the test through at runtime; the input is empty because the page reads `daily_score_config`).

Run: `npx vitest run src/pages/yatras/YatraPracticeEditPage.test.tsx`

- [ ] **Step 3: Rename the field**

In `src/types/api.ts`:

```ts
export interface YatraPractice {
  id: string
  practice: string
  data_type: PracticeDataType
  colour_zones?: ColourZonesConfig | null
  daily_score?: DailyScoreConfig | null // the server's name; Rust UI uses the same
}
```

In `YatraPracticeEditPage.tsx`, replace `p.daily_score_config` with `p.daily_score` in the load effect, and `daily_score_config:` with `daily_score:` in the save mutation. Then run `grep -rn daily_score_config app-react/src`. It should return nothing.

- [ ] **Step 4: Run it — expect PASS**, plus `npx tsc -b` (or `npm run build`) for type errors.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/types/api.ts app-react/src/pages/yatras/YatraPracticeEditPage.tsx app-react/src/pages/yatras/YatraPracticeEditPage.test.tsx
git commit -m "fix(yatras): send and read the practice daily score as daily_score, the server's field"
```

---

### Task 2: `useQueuedSave` and `useDebouncedCommit`

**Files:**
- Create: `app-react/src/features/yatras/settings/useQueuedSave.ts`, `useQueuedSave.test.tsx`
- Create: `app-react/src/features/yatras/settings/useDebouncedCommit.ts`
- Modify: `app-react/src/features/yatras/settings/useLinkPractices.ts`

**Interfaces:**
- Produces:
  - `useQueuedSave<T>(key: QueryKey, onSaved?: () => void): (next: T, send: (v: T) => Promise<void>, message: string, undoable?: boolean) => void`. Sets the cache to `next` at once and queues `send(next)` behind earlier sends from the same hook. On success it shows a toast with `message` and, when `undoable` (default true), an Undo action that calls `save(prev, send, t('yatraSettings.undone'), false)`, where `prev` is the cache value before this save; then it calls `onSaved`. On failure it shows the `common.error` toast and invalidates `key`.
  - `useDebouncedCommit(commit: () => void): { schedule(): void; flush(): void }`. Runs the **latest** `commit` 600 ms after the last `schedule()`, on `flush()`, and on unmount while still pending. `DEBOUNCE_MS = 600` is exported.

- [ ] **Step 1: Write the failing test** — `useQueuedSave.test.tsx`

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../../../hooks/useToast'
import { useQueuedSave } from './useQueuedSave'

function setup() {
  const qc = new QueryClient()
  qc.setQueryData(['k'], 1)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  const onSaved = vi.fn()
  const { result } = renderHook(() => useQueuedSave<number>(['k'], onSaved), { wrapper })
  return { qc, save: result.current, onSaved }
}

describe('useQueuedSave', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }))

  it('shows the value at once and sends one request at a time, in order', async () => {
    const { qc, save } = setup()
    const sent: number[] = []
    let release!: () => void
    const held = new Promise<void>((r) => { release = r })
    const send = vi.fn((v: number) => { sent.push(v); return v === 2 ? held : Promise.resolve() })
    save(2, send, 'a')
    save(3, send, 'b')
    expect(qc.getQueryData(['k'])).toBe(3)
    await waitFor(() => expect(sent).toEqual([2]))
    release()
    await waitFor(() => expect(sent).toEqual([2, 3]))
  })

  it('Undo restores and resends the value from before the change', async () => {
    const { qc, save, onSaved } = setup()
    const send = vi.fn().mockResolvedValue(undefined)
    save(2, send, 'Saved')
    await waitFor(() => expect(useToastStore.getState().toasts[0]?.action).toBeDefined())
    expect(onSaved).toHaveBeenCalledOnce()
    act(() => useToastStore.getState().toasts[0].action!.onClick())
    expect(qc.getQueryData(['k'])).toBe(1)
    await waitFor(() => expect(send).toHaveBeenLastCalledWith(1))
  })

  it('a failed send shows an error, refetches, and later saves still run', async () => {
    const { qc, save } = setup()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const send = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined)
    save(2, send, 'a')
    save(3, send, 'b')
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2))
    expect(useToastStore.getState().toasts.some((t) => t.variant === 'error')).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['k'] })
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (module not found). `npx vitest run src/features/yatras/settings/useQueuedSave.test.tsx`

- [ ] **Step 3: Implement**

`useQueuedSave.ts`:

```ts
import { useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../../hooks/useToast'

/** Shows `next` at once and sends it after earlier saves from this hook. Undo resends the value from before. */
export function useQueuedSave<T>(key: QueryKey, onSaved?: () => void) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const queue = useRef<Promise<void>>(Promise.resolve())

  return function save(next: T, send: (v: T) => Promise<void>, message: string, undoable = true) {
    const prev = qc.getQueryData<T>(key) as T
    qc.setQueryData(key, next)
    queue.current = queue.current
      .then(() => send(next))
      .then(
        () => {
          showToast({
            message, variant: 'success',
            action: undoable ? { label: t('common.undo'), onClick: () => save(prev, send, t('yatraSettings.undone'), false) } : undefined,
          })
          onSaved?.()
        },
        () => {
          showToast({ message: t('common.error'), variant: 'error' })
          void qc.invalidateQueries({ queryKey: key })
        },
      )
  }
}
```

`useDebouncedCommit.ts`:

```ts
import { useCallback, useEffect, useRef } from 'react'

export const DEBOUNCE_MS = 600

/** Runs the latest `commit` 600 ms after the last schedule(), on flush(), and on unmount if one is pending. */
export function useDebouncedCommit(commit: () => void) {
  const latest = useRef(commit)
  useEffect(() => { latest.current = commit })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef(false)

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (!pending.current) return
    pending.current = false
    latest.current()
  }, [])

  const schedule = useCallback(() => {
    pending.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, DEBOUNCE_MS)
  }, [flush])

  useEffect(() => flush, [flush])
  return { schedule, flush }
}
```

In `useLinkPractices.ts`, delete the `queue` ref and the body of `save`, and route the save through the hook (drop the now-unused `useRef` import):

```ts
  const saveQueued = useQueuedSave<YatraUserPracticeItem[]>(key, () => { void qc.invalidateQueries({ queryKey: ['yatra-data', yatraId] }) })
  const send = (next: YatraUserPracticeItem[]) => yatrasApi.updateYatraUserPractices(yatraId, next)

  function save(next: YatraUserPracticeItem[], message: string, undoable: boolean) {
    saveQueued(next, send, message, undoable)
  }
```

- [ ] **Step 4: Run — expect PASS** for the new test **and** the phase 1 tests: `npx vitest run src/features/yatras/settings`

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings/useQueuedSave.ts app-react/src/features/yatras/settings/useQueuedSave.test.tsx app-react/src/features/yatras/settings/useDebouncedCommit.ts app-react/src/features/yatras/settings/useLinkPractices.ts
git commit -m "refactor(yatras): queued undoable saves and debounced commits as shared hooks"
```

---

### Task 3: Zone and threshold helpers (`zones.ts`)

**Files:**
- Modify: `app-react/src/features/yatras/yatrasLogic.ts` (`function zoneNumber` → `export function zoneNumber`)
- Create: `app-react/src/features/yatras/settings/zones.ts`, `zones.test.ts`

**Interfaces:**
- Consumes: `zoneNumber(raw: unknown): number | null`, `findZone(raw, cfg): ZoneColour` from `yatrasLogic.ts`.
- Produces (all exported from `zones.ts`):
  - `type ScoredType = 'Int' | 'Time' | 'Duration'`; `isScored(dt: PracticeDataType): dt is ScoredType`
  - `fromNumber(n: number, dt: ScoredType): PracticeValue`
  - `formatValue(v: PracticeValue | null | undefined, dt: ScoredType): string`: `16`, `1:30` (Duration, h:mm), `05:30` (Time); `''` for none
  - `parseValue(text: string, dt: ScoredType): PracticeValue | null | 'invalid'`: empty → `null`
  - `type ZoneCount = 0 | 2 | 3`; `zoneCount(z?: ColourZonesConfig | null): ZoneCount`
  - `paletteZones(count: 2 | 3, dir: BetterDirection, prev?: ColourZonesConfig | null): ColourZonesConfig`
  - `aboveColour(z: ColourZonesConfig): ZoneColour`
  - `type FieldError = { kind: 'format' } | { kind: 'order'; than: PracticeValue; colour: ZoneColour } | { kind: 'bonus'; done: PracticeValue; dir: BetterDirection }`
  - `interface Checked { values: (PracticeValue | null)[]; errors: (FieldError | null)[]; ok: boolean }`
  - `checkBounds(texts: string[], colours: ZoneColour[], dt: ScoredType): Checked`
  - `checkScore(doneText: string, bonusText: string, dir: BetterDirection, dt: ScoredType): Checked` (values/errors: `[done, bonus]`)
  - `scoreConfig(dir: BetterDirection, done: PracticeValue | null, bonus: PracticeValue | null): DailyScoreConfig | null`
  - `bonusOf(s?: DailyScoreConfig | null): PracticeValue | null`
  - `greenStart(z: ColourZonesConfig, dt: ScoredType): PracticeValue | null`
  - `interface Bar { min: number; max: number; segments: { left: number; width: number; colour: ZoneColour }[]; ticks: { at: number; value: PracticeValue }[]; done: { at: number; value: PracticeValue } | null; bonus: { at: number; value: PracticeValue } | null }` (`at`, `left`, `width` in %)
  - `barGeometry(z: ColourZonesConfig | null | undefined, s: DailyScoreConfig | null | undefined, dt: ScoredType): Bar | null`
  - `zoneSamples(bar: Bar, z: ColourZonesConfig, dt: ScoredType): { value: PracticeValue; colour: ZoneColour }[]`

Rules (from the spec):
- Higher → `bounds: [Red, Yellow]`, best Green; Lower → `bounds: [Green, Yellow]`, best Red; 2 colours drops Yellow. Changing count or direction rebuilds colours from these palettes, but keeps bound values by position and keeps `no_value_colour`.
- Bounds must be strictly increasing; an empty bound is allowed (saved as `to: null`) and is skipped when comparing.
- Bonus ≥ done for Higher, ≤ done for Lower.
- Scale: from 0 (Number, Duration) to `ceil(largest × 1.2)`. Time: from the earliest value minus padding to the latest plus padding, where padding = max(30 min, 25 % of the spread), clamped to 00:00–23:59.
- Where green starts, as a done threshold: Higher → one step above the last filled bound; Lower → the first bound.

- [ ] **Step 1: Write the failing test** — `zones.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import type { ColourZonesConfig } from '../../../types/api'
import {
  barGeometry, checkBounds, checkScore, formatValue, greenStart, paletteZones, parseValue, scoreConfig, zoneCount, zoneSamples,
} from './zones'

const japa: ColourZonesConfig = {
  better_direction: 'Higher',
  bounds: [{ to: { Int: 7 }, colour: 'Red' }, { to: { Int: 15 }, colour: 'Yellow' }],
  no_value_colour: 'Neutral', best_colour: 'Green',
}
const score = scoreConfig('Higher', { Int: 16 }, { Int: 20 })

describe('values', () => {
  it('formats each type the way the fields show it', () => {
    expect(formatValue({ Int: 16 }, 'Int')).toBe('16')
    expect(formatValue({ Duration: 90 }, 'Duration')).toBe('1:30')
    expect(formatValue({ Time: { h: 5, m: 0 } }, 'Time')).toBe('05:00')
    expect(formatValue(null, 'Int')).toBe('')
  })

  it('parses, treats empty as null and rejects the rest', () => {
    expect(parseValue(' 16 ', 'Int')).toEqual({ Int: 16 })
    expect(parseValue('', 'Int')).toBeNull()
    expect(parseValue('1.5', 'Int')).toBe('invalid')
    expect(parseValue('1:30', 'Duration')).toEqual({ Duration: 90 })
    expect(parseValue('45', 'Duration')).toEqual({ Duration: 45 })
    expect(parseValue('1:75', 'Duration')).toBe('invalid')
    expect(parseValue('5:30', 'Time')).toEqual({ Time: { h: 5, m: 30 } })
    expect(parseValue('24:00', 'Time')).toBe('invalid')
  })
})

describe('palettes', () => {
  it('maps count and direction to the standard colours, keeping values and the empty colour', () => {
    expect(zoneCount(null)).toBe(0)
    expect(zoneCount(japa)).toBe(3)
    const two = paletteZones(2, 'Higher', { ...japa, no_value_colour: 'Red' })
    expect(two).toEqual({ better_direction: 'Higher', bounds: [{ to: { Int: 7 }, colour: 'Red' }], no_value_colour: 'Red', best_colour: 'Green' })
    const lower = paletteZones(3, 'Lower', japa)
    expect(lower.bounds.map((b) => b.colour)).toEqual(['Green', 'Yellow'])
    expect(lower.best_colour).toBe('Red')
    expect(lower.bounds.map((b) => b.to)).toEqual([{ Int: 7 }, { Int: 15 }])
    expect(paletteZones(3, 'Higher', null).bounds).toEqual([{ to: null, colour: 'Red' }, { to: null, colour: 'Yellow' }])
  })

  it('green starts one above the last bound (Higher) or at the first bound (Lower)', () => {
    expect(greenStart(japa, 'Int')).toEqual({ Int: 16 })
    expect(greenStart(paletteZones(3, 'Lower', japa), 'Int')).toEqual({ Int: 7 })
    expect(greenStart(paletteZones(3, 'Higher', null), 'Int')).toBeNull()
  })
})

describe('validation', () => {
  it('names the bound a value must exceed', () => {
    const r = checkBounds(['7', '6'], ['Red', 'Yellow'], 'Int')
    expect(r.ok).toBe(false)
    expect(r.errors).toEqual([null, { kind: 'order', than: { Int: 7 }, colour: 'Red' }])
  })

  it('allows an empty bound and compares with the last filled one', () => {
    expect(checkBounds(['', '6'], ['Red', 'Yellow'], 'Int')).toEqual({ values: [null, { Int: 6 }], errors: [null, null], ok: true })
    expect(checkBounds(['x', '6'], ['Red', 'Yellow'], 'Int').errors[0]).toEqual({ kind: 'format' })
  })

  it('bonus must be at least done for Higher and at most done for Lower', () => {
    expect(checkScore('16', '20', 'Higher', 'Int').ok).toBe(true)
    expect(checkScore('16', '12', 'Higher', 'Int').errors[1]).toEqual({ kind: 'bonus', done: { Int: 16 }, dir: 'Higher' })
    expect(checkScore('05:00', '04:30', 'Lower', 'Time').ok).toBe(true)
    expect(checkScore('05:00', '05:30', 'Lower', 'Time').ok).toBe(false)
  })

  it('both thresholds empty means no daily score', () => {
    expect(scoreConfig('Higher', null, null)).toBeNull()
    expect(scoreConfig('Lower', null, { Int: 3 })).toEqual({ better_direction: 'Lower', mandatory_threshold: null, bonus_rules: [{ threshold: { Int: 3 }, points: 1 }] })
  })
})

describe('range bar', () => {
  it('matches the 12m14 mockup: 0–24, bounds at 7 and 15, ✓ 16, ★ 20', () => {
    const bar = barGeometry(japa, score, 'Int')!
    expect([bar.min, bar.max]).toEqual([0, 24])
    expect(bar.ticks.map((t) => t.at)).toEqual([(7 / 24) * 100, (15 / 24) * 100])
    expect(bar.segments.map((s) => s.colour)).toEqual(['Red', 'Yellow', 'Green'])
    expect(bar.segments[2].left + bar.segments[2].width).toBeCloseTo(100)
    expect(bar.done!.at).toBeCloseTo((16 / 24) * 100)
    expect(bar.bonus!.at).toBeCloseTo((20 / 24) * 100)
  })

  it('pads a Time scale around the values', () => {
    const bar = barGeometry(null, scoreConfig('Lower', { Time: { h: 5, m: 0 } }, { Time: { h: 4, m: 30 } }), 'Time')!
    expect([bar.min, bar.max]).toEqual([270 - 30, 300 + 30])
    expect(bar.segments).toEqual([])
  })

  it('has no bar with nothing set', () => {
    expect(barGeometry(paletteZones(3, 'Higher', null), null, 'Int')).toBeNull()
  })

  it('takes one sample inside each zone', () => {
    const bar = barGeometry(japa, score, 'Int')!
    expect(zoneSamples(bar, japa, 'Int')).toEqual([
      { value: { Int: 4 }, colour: 'Red' }, { value: { Int: 11 }, colour: 'Yellow' }, { value: { Int: 20 }, colour: 'Green' },
    ])
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/features/yatras/settings/zones.test.ts`

- [ ] **Step 3: Implement** — `zones.ts`

```ts
import type {
  BetterDirection, ColourBound, ColourZonesConfig, DailyScoreConfig, PracticeDataType, PracticeValue, ZoneColour,
} from '../../../types/api'
import { findZone, zoneNumber } from '../yatrasLogic'

export type ScoredType = 'Int' | 'Time' | 'Duration'
export const isScored = (dt: PracticeDataType): dt is ScoredType => dt === 'Int' || dt === 'Time' || dt === 'Duration'

export function fromNumber(n: number, dt: ScoredType): PracticeValue {
  if (dt === 'Int') return { Int: n }
  if (dt === 'Duration') return { Duration: n }
  return { Time: { h: Math.floor(n / 60), m: n % 60 } }
}

/** As typed in a field: 16, 1:30 (h:mm), 05:30. */
export function formatValue(v: PracticeValue | null | undefined, dt: ScoredType): string {
  const n = zoneNumber(v)
  if (n === null) return ''
  if (dt === 'Int') return String(n)
  const h = Math.floor(n / 60)
  const m = String(n % 60).padStart(2, '0')
  return dt === 'Time' ? `${String(h).padStart(2, '0')}:${m}` : `${h}:${m}`
}

/** Empty → null; anything that isn't a value of this type → 'invalid'. Durations also take plain minutes. */
export function parseValue(text: string, dt: ScoredType): PracticeValue | null | 'invalid' {
  const s = text.trim()
  if (!s) return null
  if (dt === 'Int') return /^\d+$/.test(s) ? { Int: Number(s) } : 'invalid'
  const hm = /^(\d{1,2}):([0-5]\d)$/.exec(s)
  if (dt === 'Time') return hm && Number(hm[1]) < 24 ? fromNumber(Number(hm[1]) * 60 + Number(hm[2]), 'Time') : 'invalid'
  if (/^\d+$/.test(s)) return { Duration: Number(s) }
  return hm ? { Duration: Number(hm[1]) * 60 + Number(hm[2]) } : 'invalid'
}

export type ZoneCount = 0 | 2 | 3
export const zoneCount = (z?: ColourZonesConfig | null): ZoneCount => (!z?.bounds.length ? 0 : z.bounds.length === 1 ? 2 : 3)

/** Standard palettes. Higher: Red, (Yellow,) Green above. Lower: Green, (Yellow,) Red above. Values and the empty colour carry over. */
export function paletteZones(count: 2 | 3, dir: BetterDirection, prev?: ColourZonesConfig | null): ColourZonesConfig {
  const [first, above]: ZoneColour[] = dir === 'Higher' ? ['Red', 'Green'] : ['Green', 'Red']
  const colours: ZoneColour[] = count === 3 ? [first, 'Yellow'] : [first]
  return {
    better_direction: dir,
    bounds: colours.map((colour, i) => ({ to: prev?.bounds[i]?.to ?? null, colour })),
    no_value_colour: prev?.no_value_colour ?? 'Neutral',
    best_colour: above,
  }
}

export const aboveColour = (z: ColourZonesConfig): ZoneColour => z.best_colour ?? (z.better_direction === 'Higher' ? 'Green' : 'Red')

export type FieldError =
  | { kind: 'format' }
  | { kind: 'order'; than: PracticeValue; colour: ZoneColour }
  | { kind: 'bonus'; done: PracticeValue; dir: BetterDirection }

export interface Checked { values: (PracticeValue | null)[]; errors: (FieldError | null)[]; ok: boolean }

/** Each bound must parse and be more than the last filled one before it. */
export function checkBounds(texts: string[], colours: ZoneColour[], dt: ScoredType): Checked {
  const values: (PracticeValue | null)[] = []
  const errors: (FieldError | null)[] = []
  let prev: { v: PracticeValue; colour: ZoneColour } | null = null
  texts.forEach((text, i) => {
    const v = parseValue(text, dt)
    if (v === 'invalid') { values.push(null); errors.push({ kind: 'format' }); return }
    values.push(v)
    if (v && prev && zoneNumber(v)! <= zoneNumber(prev.v)!) { errors.push({ kind: 'order', than: prev.v, colour: prev.colour }); return }
    errors.push(null)
    if (v) prev = { v, colour: colours[i] }
  })
  return { values, errors, ok: errors.every((e) => !e) }
}

/** Done and bonus must parse; bonus is at least done (Higher) or at most done (Lower). */
export function checkScore(doneText: string, bonusText: string, dir: BetterDirection, dt: ScoredType): Checked {
  const done = parseValue(doneText, dt)
  const bonus = parseValue(bonusText, dt)
  const errors: (FieldError | null)[] = [done === 'invalid' ? { kind: 'format' } : null, bonus === 'invalid' ? { kind: 'format' } : null]
  if (done && done !== 'invalid' && bonus && bonus !== 'invalid') {
    const d = zoneNumber(done)!
    const b = zoneNumber(bonus)!
    if (dir === 'Higher' ? b < d : b > d) errors[1] = { kind: 'bonus', done, dir }
  }
  const ok = (v: PracticeValue | null | 'invalid') => (v === 'invalid' ? null : v)
  return { values: [ok(done), ok(bonus)], errors, ok: errors.every((e) => !e) }
}

export function scoreConfig(dir: BetterDirection, done: PracticeValue | null, bonus: PracticeValue | null): DailyScoreConfig | null {
  if (!done && !bonus) return null
  return { better_direction: dir, mandatory_threshold: done, bonus_rules: bonus ? [{ threshold: bonus, points: 1 }] : [] }
}

export const bonusOf = (s?: DailyScoreConfig | null): PracticeValue | null => s?.bonus_rules[0]?.threshold ?? null

/** Where Green starts, as a done threshold: one above the last filled bound (Higher) or the first bound (Lower). */
export function greenStart(z: ColourZonesConfig, dt: ScoredType): PracticeValue | null {
  if (z.better_direction === 'Lower') {
    const n = zoneNumber(z.bounds[0]?.to)
    return n === null ? null : fromNumber(n, dt)
  }
  const filled = z.bounds.map((b) => zoneNumber(b.to)).filter((n): n is number => n !== null)
  return filled.length ? fromNumber(filled[filled.length - 1] + 1, dt) : null
}

export interface Bar {
  min: number
  max: number
  segments: { left: number; width: number; colour: ZoneColour }[]
  ticks: { at: number; value: PracticeValue }[]
  done: { at: number; value: PracticeValue } | null
  bonus: { at: number; value: PracticeValue } | null
}

const DAY_END = 24 * 60 - 1

/** One scale for the colour bounds and the ✓/★ thresholds; positions in %. Null when nothing is set. */
export function barGeometry(z: ColourZonesConfig | null | undefined, s: DailyScoreConfig | null | undefined, dt: ScoredType): Bar | null {
  const bounds = (z?.bounds ?? []).filter((b): b is ColourBound & { to: PracticeValue } => !!b.to)
  const done = s?.mandatory_threshold ?? null
  const bonus = bonusOf(s)
  const nums = [...bounds.map((b) => b.to), done, bonus].map(zoneNumber).filter((n): n is number => n !== null)
  if (!nums.length) return null
  const lo = Math.min(...nums)
  const hi = Math.max(...nums)
  let min = 0
  let max = Math.ceil(hi * 1.2) || 1
  if (dt === 'Time') {
    const pad = Math.max(30, Math.round((hi - lo) * 0.25))
    min = Math.max(0, lo - pad)
    max = Math.min(DAY_END, hi + pad)
  }
  const at = (n: number) => ((n - min) / (max - min)) * 100
  const segments: Bar['segments'] = []
  if (z && bounds.length) {
    let left = 0
    for (const b of bounds) {
      const x = at(zoneNumber(b.to)!)
      segments.push({ left, width: x - left, colour: b.colour })
      left = x
    }
    segments.push({ left, width: 100 - left, colour: aboveColour(z) })
  }
  const mark = (v: PracticeValue | null) => (v ? { at: at(zoneNumber(v)!), value: v } : null)
  return { min, max, segments, ticks: bounds.map((b) => ({ at: at(zoneNumber(b.to)!), value: b.to })), done: mark(done), bonus: mark(bonus) }
}

/** A value from the middle of each zone, coloured the way the table paints it. */
export function zoneSamples(bar: Bar, z: ColourZonesConfig, dt: ScoredType): { value: PracticeValue; colour: ZoneColour }[] {
  const edges = [bar.min, ...bar.ticks.map((t) => zoneNumber(t.value)!), bar.max]
  return bar.segments.map((_, i) => {
    const value = fromNumber(Math.round((edges[i] + edges[i + 1]) / 2), dt)
    return { value, colour: findZone(value, z) }
  })
}
```

Note on the mockup check: the samples are 4/11/20. The mockup shows 4/12/16/22, which is illustrative only. The test pins the midpoints.

- [ ] **Step 4: Run — expect PASS.** Also run `npx vitest run src/features/yatras` (the `zoneNumber` export must not break `yatrasLogic.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/yatrasLogic.ts app-react/src/features/yatras/settings/zones.ts app-react/src/features/yatras/settings/zones.test.ts
git commit -m "feat(yatras): zone, threshold and range-bar helpers for the practice editor"
```

---

### Task 4: Statistic helpers (`statistics.ts`)

**Files:**
- Create: `app-react/src/features/yatras/settings/statistics.ts`, `statistics.test.ts`

**Interfaces:**
- Consumes: `formatDuration(total, units)` and `DurationUnits` from `src/features/today/values.ts`.
- Produces:
  - `TIME_RANGES: TimeRange[]` (in the order Last7Days, Last30Days, Last90Days, Last365Days, ThisWeek, ThisMonth, ThisQuarter, ThisYear)
  - `aggregationsFor(dt: PracticeDataType): Aggregation[]`: Number/Duration: Sum, Avg, Min, Max, Count; Time: Avg, Min, Max, Count; Yes/No and Text: Count
  - `withPractice(stat: YatraStatisticConfig, p: YatraPractice): YatraStatisticConfig`: switches the aggregation to Count when the old one isn't valid for `p`
  - `newStatistic(practices: YatraPractice[]): YatraStatisticConfig | null`: first Number/Duration/Time practice (else the first one), labelled with its name, Avg (Count if Avg isn't valid), Last 30 days; null when there are no practices
  - `statValue(raw: unknown, agg: Aggregation, dt: PracticeDataType, u: DurationUnits): string`

- [ ] **Step 1: Write the failing test** — `statistics.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import type { YatraPractice } from '../../../types/api'
import { aggregationsFor, newStatistic, statValue, withPractice } from './statistics'

const u = { h: 'h', min: 'min' }
const japa: YatraPractice = { id: 'p1', practice: 'Japa rounds', data_type: 'Int' }
const wake: YatraPractice = { id: 'p2', practice: 'Wake up', data_type: 'Time' }
const arati: YatraPractice = { id: 'p4', practice: 'Mangala arati', data_type: 'Bool' }

describe('statistics', () => {
  it('offers only aggregations that mean something for the type', () => {
    expect(aggregationsFor('Int')).toEqual(['Sum', 'Avg', 'Min', 'Max', 'Count'])
    expect(aggregationsFor('Time')).toEqual(['Avg', 'Min', 'Max', 'Count'])
    expect(aggregationsFor('Bool')).toEqual(['Count'])
    expect(aggregationsFor('Text')).toEqual(['Count'])
  })

  it('switches to Count when the new practice cannot take the aggregation', () => {
    const sum = { label: 'x', practice_id: 'p1', aggregation: 'Sum' as const, time_range: 'ThisWeek' as const }
    expect(withPractice(sum, wake)).toMatchObject({ practice_id: 'p2', aggregation: 'Count' })
    expect(withPractice({ ...sum, aggregation: 'Min' }, wake).aggregation).toBe('Min')
  })

  it('defaults a new statistic to the first measurable practice, Average, last 30 days', () => {
    expect(newStatistic([arati, japa])).toEqual({ label: 'Japa rounds', practice_id: 'p1', aggregation: 'Avg', time_range: 'Last30Days' })
    expect(newStatistic([arati])).toMatchObject({ practice_id: 'p4', aggregation: 'Count' })
    expect(newStatistic([])).toBeNull()
  })

  it('formats tile values, unwrapping counts and fractional averages', () => {
    expect(statValue({ Int: 15.83 }, 'Avg', 'Int', u)).toBe('15.8')
    expect(statValue({ Time: { h: 1, m: 52 } }, 'Count', 'Time', u)).toBe('112')
    expect(statValue({ Time: { h: 3, m: 55 } }, 'Min', 'Time', u)).toBe('03:55')
    expect(statValue({ Time: { h: 4.25, m: 15.4 } }, 'Avg', 'Time', u)).toBe('04:15')
    expect(statValue({ Duration: 2480 }, 'Sum', 'Duration', u)).toBe('41 h 20 min')
    expect(statValue(null, 'Sum', 'Int', u)).toBe('—')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** — `statistics.ts`

```ts
import type { Aggregation, PracticeDataType, TimeRange, YatraPractice, YatraStatisticConfig } from '../../../types/api'
import { formatDuration } from '../../today/values'
import type { DurationUnits } from '../../today/values'

export const TIME_RANGES: TimeRange[] = [
  'Last7Days', 'Last30Days', 'Last90Days', 'Last365Days', 'ThisWeek', 'ThisMonth', 'ThisQuarter', 'ThisYear',
]

export function aggregationsFor(dt: PracticeDataType): Aggregation[] {
  if (dt === 'Int' || dt === 'Duration') return ['Sum', 'Avg', 'Min', 'Max', 'Count']
  if (dt === 'Time') return ['Avg', 'Min', 'Max', 'Count'] // adding up times of day means nothing
  return ['Count']
}

export function withPractice(stat: YatraStatisticConfig, p: YatraPractice): YatraStatisticConfig {
  return { ...stat, practice_id: p.id, aggregation: aggregationsFor(p.data_type).includes(stat.aggregation) ? stat.aggregation : 'Count' }
}

export function newStatistic(practices: YatraPractice[]): YatraStatisticConfig | null {
  const p = practices.find((x) => x.data_type === 'Int' || x.data_type === 'Duration' || x.data_type === 'Time') ?? practices[0]
  if (!p) return null
  return { label: p.practice, practice_id: p.id, aggregation: aggregationsFor(p.data_type).includes('Avg') ? 'Avg' : 'Count', time_range: 'Last30Days' }
}

/** The server wraps every result in the practice's type, counts included, and averages can be fractional. */
export function statValue(raw: unknown, agg: Aggregation, dt: PracticeDataType, u: DurationUnits): string {
  if (raw === null || raw === undefined) return '—'
  const o = raw as { Int?: number; Duration?: number; Time?: { h: number; m: number } }
  // Time is built as (x / 60, x % 60): h is fractional when x is.
  const n = o.Time ? Math.trunc(o.Time.h) * 60 + o.Time.m : (o.Int ?? o.Duration ?? null)
  if (n === null) return '—'
  if (agg === 'Count' || dt === 'Int') return String(Math.round(n * 10) / 10)
  const mins = Math.round(n)
  if (dt === 'Duration') return formatDuration(mins, u)
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings/statistics.ts app-react/src/features/yatras/settings/statistics.test.ts
git commit -m "feat(yatras): statistic aggregations per type and tile values"
```

---
### Task 5: `useYatraAdmin`, `AdminPage`, the hub (12m9) and routes

**Files:**
- Create: `app-react/src/features/yatras/settings/useYatraAdmin.ts`
- Create: `app-react/src/features/yatras/settings/mobile/AdminPage.tsx`, `summaries.ts`, `ManageYatraMobile.tsx`, `AdminSectionMobile.tsx`, `adminTestUtils.tsx`
- Test: `app-react/src/features/yatras/settings/mobile/ManageYatraMobile.test.tsx`
- Modify: `app-react/src/features/settings/mobile/SettingsRow.tsx` (`danger` prop)
- Modify: `app-react/src/features/yatras/settings/mobile/LeaveSheets.tsx` and its test in `LinkPracticesMobile.test.tsx`
- Modify: `app-react/src/router.tsx`
- Modify: locales

**Interfaces:**
- Consumes: `useQueuedSave` (Task 2); `Yatra`, `YatraPractice`, `YatraUser` with `daily_score` (Task 1).
- Produces:
  - `useYatraAdmin(yatraId)` → `YatraAdmin`:
    `{ yatra?: Yatra; practices: YatraPractice[]; users: YatraUser[]; me?: YatraUser; isAdmin: boolean; isLoading: boolean; isError: boolean;`
    `saveYatra(patch: Partial<Pick<Yatra,'name'|'show_stability_metrics'|'statistics'>>, message: string, undoable?: boolean): void;`
    `savePractice(p: YatraPractice, message: string, undoable?: boolean): void; reorder(ids: string[]): void; toggleAdmin(u: YatraUser): void;`
    `statCount(practiceId: string): number;`
    `createPractice: UseMutationResult<YatraPractice | undefined, Error, { name: string; type: PracticeDataType }>;`
    `deletePractice: UseMutationResult<void, Error, YatraPractice>; removeMember: UseMutationResult<void, Error, YatraUser>; deleteYatra: UseMutationResult<void, Error, void> }`.
    Query keys: `['yatra', id]`, `['yatra-practices', id]`, `['yatra-users', id]` (the same keys the legacy admin page uses). After each save it invalidates `['yatra-data', id]` and `['yatras']`.
  - `AdminPage({ admin, title, back?, children: () => ReactNode })`. Default back: "‹ Manage yatra" → `/yatra/:id/admin/settings`. Class strings `CARD`, `LIST`, `FIELD`, `BTN`, `HINT`, `SECTION_TITLE`.
  - `summaries.ts`: `zoneKey(c: ZoneColour): string`, `membersLine(t, users): string`.
  - `AdminSectionMobile`: renders `SECTIONS[section]` or redirects to the hub. Tasks 6–11 add `general`, `practices`, `members`, `statistics`, `invite`, `danger`.
  - `adminTestUtils.tsx`: `PRACTICES`, `YATRA`, `USERS`, `mockAdmin(api, { admin?, users? })`, `renderAdmin(url)`.
  - `SettingsRow` gains `danger?: boolean` (the label is in `text-ui-danger`).

**Strings** (`yatraSettings.*`):

| key | en | ru | uk |
|---|---|---|---|
| general | General | Общие | Загальні |
| generalHint | Name, daily score metrics | Название, показатели оценки за день | Назва, показники оцінки за день |
| practices | Practices | Практики | Практики |
| practicesHint | {{count}} · order, colours, score | {{count}} · порядок, цвета, оценка | {{count}} · порядок, кольори, оцінка |
| membersTitle | Members | Участники | Учасники |
| adminsCount_one / _few / _many / _other | {{count}} admin / — / — / {{count}} admins | {{count}} админ / {{count}} админа / {{count}} админов / {{count}} админа | {{count}} адмін / {{count}} адміни / {{count}} адмінів / {{count}} адміна |
| statistics | Statistics | Статистика | Статистика |
| statsHintAll_one / _few / _many / _other | {{count}} tile · visible to everyone / — / — / {{count}} tiles · visible to everyone | {{count}} плитка · видна всем / {{count}} плитки · видны всем / {{count}} плиток · видны всем / {{count}} плитки · видны всем | {{count}} плитка · видна всім / {{count}} плитки · видно всім / {{count}} плиток · видно всім / {{count}} плитки · видно всім |
| statsHintAdmins_one / _few / _many / _other | {{count}} tile · visible to admins / — / — / {{count}} tiles · visible to admins | {{count}} плитка · видна админам / {{count}} плитки · видны админам / {{count}} плиток · видны админам / {{count}} плитки · видны админам | {{count}} плитка · видна адмінам / {{count}} плитки · видно адмінам / {{count}} плиток · видно адмінам / {{count}} плитки · видно адмінам |
| invite | Invite | Приглашение | Запрошення |
| inviteHint | Share the join link | Поделиться ссылкой для вступления | Поділитися посиланням для вступу |
| danger | Danger zone | Опасная зона | Небезпечна зона |
| dangerHint | Delete yatra | Удалить ятру | Видалити ятру |

(en has only `_one` / `_other`; "—" means the form doesn't exist in en.)

- [ ] **Step 1: Test utilities** — `adminTestUtils.tsx`

```tsx
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Mocked } from 'vitest'
import type { yatrasApi } from '../../../../api/yatras'
import { useAuthStore } from '../../../../store/authStore'
import type { Yatra, YatraPractice, YatraUser } from '../../../../types/api'
import { AdminSectionMobile } from './AdminSectionMobile'
import { ManageYatraMobile } from './ManageYatraMobile'

export const PRACTICES: YatraPractice[] = [
  {
    id: 'p1', practice: 'Japa rounds', data_type: 'Int',
    colour_zones: { better_direction: 'Higher', bounds: [{ to: { Int: 7 }, colour: 'Red' }, { to: { Int: 15 }, colour: 'Yellow' }], no_value_colour: 'Neutral', best_colour: 'Green' },
    daily_score: { better_direction: 'Higher', mandatory_threshold: { Int: 16 }, bonus_rules: [{ threshold: { Int: 20 }, points: 1 }] },
  },
  {
    id: 'p2', practice: 'Wake up', data_type: 'Time', colour_zones: null,
    daily_score: { better_direction: 'Lower', mandatory_threshold: { Time: { h: 5, m: 0 } }, bonus_rules: [{ threshold: { Time: { h: 4, m: 30 } }, points: 1 }] },
  },
  {
    id: 'p3', practice: 'Reading', data_type: 'Duration', daily_score: null,
    colour_zones: { better_direction: 'Higher', bounds: [{ to: { Duration: 30 }, colour: 'Red' }], no_value_colour: 'Neutral', best_colour: 'Green' },
  },
  { id: 'p4', practice: 'Mangala arati', data_type: 'Bool' },
  { id: 'p5', practice: "Day's realisation", data_type: 'Text' },
]

export const YATRA: Yatra = {
  id: 'y1', name: "Balarama's League", show_stability_metrics: true,
  statistics: {
    visible_to_all: true,
    statistics: [
      { label: 'Average japa', practice_id: 'p1', aggregation: 'Avg', time_range: 'Last30Days' },
      { label: 'Earliest wake-up', practice_id: 'p2', aggregation: 'Min', time_range: 'Last7Days' },
    ],
  },
}

export const USERS: YatraUser[] = [
  { user_id: 'u1', user_name: 'Alex das', is_admin: true },
  { user_id: 'u2', user_name: 'Gaura Priya devi dasi', is_admin: true },
  { user_id: 'u3', user_name: 'Madhava das', is_admin: false },
]

/** Every call the admin screens make. The current user is u1 (admin) or u3 (member). */
export function mockAdmin(api: Mocked<typeof yatrasApi>, { admin = true, users = USERS }: { admin?: boolean; users?: YatraUser[] } = {}) {
  useAuthStore.setState({ user: { id: admin ? 'u1' : 'u3', email: '', token: 't', name: 'Me' }, token: 't' })
  api.getYatra.mockResolvedValue(structuredClone(YATRA))
  api.getYatraPractices.mockResolvedValue(structuredClone(PRACTICES))
  api.getYatraUsers.mockResolvedValue(structuredClone(users))
  api.getYatraData.mockResolvedValue({
    practices: [], data: [], stability_heatmap_days: [],
    statistics: [{ label: 'Average japa', value: { Int: 15.8 } }, { label: 'Earliest wake-up', value: { Time: { h: 3, m: 55 } } }],
  })
  for (const fn of ['updateYatra', 'updateYatraPractice', 'reorderPractices', 'createYatraPractice', 'deleteYatraPractice', 'toggleAdmin', 'removeMember', 'deleteYatra'] as const) {
    api[fn].mockResolvedValue()
  }
}

export function renderAdmin(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/yatra/:id/admin/settings" element={<ManageYatraMobile />} />
          <Route path="/yatra/:id/admin/:section" element={<AdminSectionMobile />} />
          <Route path="/yatra/:id/practice/:practice_id/edit" element={<p>Editor</p>} />
          <Route path="/yatra/:id/settings" element={<p>Link page</p>} />
          <Route path="/yatras" element={<p>Yatras page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return qc
}
```

Each admin test file mocks the whole API the same way (the factory is hoisted, so it can't import a shared list):

```ts
vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)
```

- [ ] **Step 2: Write the failing test** — `ManageYatraMobile.test.tsx`

```tsx
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, renderAdmin } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('ManageYatraMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }) })

  it('lists the sections with live summaries', async () => {
    mockAdmin(api)
    renderAdmin('/yatra/y1/admin/settings')
    expect(await screen.findByRole('link', { name: /General/ })).toHaveAttribute('href', '/yatra/y1/admin/general')
    expect(screen.getByRole('heading', { name: 'Manage yatra' })).toBeInTheDocument()
    expect(screen.getByText('5 · order, colours, score')).toBeInTheDocument()
    expect(screen.getByText('3 members · 2 admins')).toBeInTheDocument()
    expect(screen.getByText('2 tiles · visible to everyone')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Danger zone/ })).toHaveAttribute('href', '/yatra/y1/admin/danger')
    expect(screen.getByRole('link', { name: /Link your practices/ })).toHaveAttribute('href', '/yatra/y1/settings')
  })

  it('sends a member who opens an admin URL to the link page', async () => {
    mockAdmin(api, { admin: false })
    renderAdmin('/yatra/y1/admin/members')
    expect(await screen.findByText('Link page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run — expect FAIL.** `npx vitest run src/features/yatras/settings/mobile/ManageYatraMobile.test.tsx`

- [ ] **Step 4: Implement `useYatraAdmin.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../../api/yatras'
import { useToast } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { PracticeDataType, Yatra, YatraPractice, YatraUser } from '../../../types/api'
import { useQueuedSave } from './useQueuedSave'

type YatraFields = Pick<Yatra, 'name' | 'show_stability_metrics' | 'statistics'>

/** What the admin screens read and change for one yatra. */
export function useYatraAdmin(yatraId: string) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const userId = useAuthStore((s) => s.user?.id)
  const yatraKey = ['yatra', yatraId]
  const practicesKey = ['yatra-practices', yatraId]
  const usersKey = ['yatra-users', yatraId]

  const yatraQ = useQuery({ queryKey: yatraKey, queryFn: () => yatrasApi.getYatra(yatraId) })
  const practicesQ = useQuery({ queryKey: practicesKey, queryFn: () => yatrasApi.getYatraPractices(yatraId) })
  const usersQ = useQuery({ queryKey: usersKey, queryFn: () => yatrasApi.getYatraUsers(yatraId) })

  // The yatra screen and its switcher show names, columns and tiles from these.
  const refreshTable = () => {
    void qc.invalidateQueries({ queryKey: ['yatra-data', yatraId] })
    void qc.invalidateQueries({ queryKey: ['yatras'] })
  }
  const failed = () => showToast({ message: t('common.error'), variant: 'error' })

  const queueYatra = useQueuedSave<Yatra>(yatraKey, refreshTable)
  const queuePractices = useQueuedSave<YatraPractice[]>(practicesKey, refreshTable)
  const queueUsers = useQueuedSave<YatraUser[]>(usersKey)

  // PUT /yatra/:id replaces all three fields, so always send the statistics too.
  const sendYatra = (y: Yatra) =>
    yatrasApi.updateYatra(yatraId, { name: y.name, show_stability_metrics: y.show_stability_metrics, statistics: y.statistics ?? null })
  const practicesNow = () => qc.getQueryData<YatraPractice[]>(practicesKey) ?? []

  /** Builds on the cached yatra, so quick edits in a row keep each other. */
  function saveYatra(patch: Partial<YatraFields>, message: string, undoable = true) {
    const cur = qc.getQueryData<Yatra>(yatraKey)
    if (cur) queueYatra({ ...cur, ...patch }, sendYatra, message, undoable)
  }

  function savePractice(p: YatraPractice, message: string, undoable = true) {
    queuePractices(
      practicesNow().map((x) => (x.id === p.id ? p : x)),
      (list) => yatrasApi.updateYatraPractice(yatraId, list.find((x) => x.id === p.id)!),
      message, undoable,
    )
  }

  function reorder(ids: string[]) {
    const byId = new Map(practicesNow().map((p) => [p.id, p]))
    queuePractices(ids.map((id) => byId.get(id)!), (list) => yatrasApi.reorderPractices(yatraId, list.map((p) => p.id)), t('yatraSettings.reordered'))
  }

  function toggleAdmin(u: YatraUser) {
    const users = qc.getQueryData<YatraUser[]>(usersKey) ?? []
    // The toggle is its own inverse, so Undo sends the same request again.
    queueUsers(
      users.map((x) => (x.user_id === u.user_id ? { ...x, is_admin: !x.is_admin } : x)),
      () => yatrasApi.toggleAdmin(yatraId, u.user_id),
      t(u.is_admin ? 'yatraSettings.adminRemoved' : 'yatraSettings.adminAdded', { name: u.user_name }),
    )
  }

  const statCount = (practiceId: string) =>
    yatraQ.data?.statistics?.statistics.filter((s) => s.practice_id === practiceId).length ?? 0

  const createPractice = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: PracticeDataType }) => {
      const before = new Set(practicesNow().map((p) => p.id))
      await yatrasApi.createYatraPractice(yatraId, { practice: name, data_type: type })
      // The server doesn't return the new practice: find it in a fresh list.
      const list = await yatrasApi.getYatraPractices(yatraId)
      qc.setQueryData(practicesKey, list)
      return list.find((p) => !before.has(p.id))
    },
    onSuccess: (p) => {
      refreshTable()
      if (p) showToast({ message: t('yatraSettings.practiceAdded', { name: p.practice }), variant: 'success' })
    },
    onError: failed,
  })

  const deletePractice = useMutation({
    mutationFn: async (p: YatraPractice) => {
      const y = qc.getQueryData<Yatra>(yatraKey)
      const stats = y?.statistics
      // Statistics on this practice go first; if that fails, the practice stays.
      if (y && stats?.statistics.some((s) => s.practice_id === p.id)) {
        await sendYatra({ ...y, statistics: { ...stats, statistics: stats.statistics.filter((s) => s.practice_id !== p.id) } })
      }
      await yatrasApi.deleteYatraPractice(yatraId, p.id)
    },
    onSuccess: (_, p) => showToast({ message: t('yatraSettings.practiceDeleted', { name: p.practice }), variant: 'success' }),
    onError: failed,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: yatraKey })
      void qc.invalidateQueries({ queryKey: practicesKey })
      refreshTable()
    },
  })

  const removeMember = useMutation({
    mutationFn: (u: YatraUser) => yatrasApi.removeMember(yatraId, u.user_id),
    onSuccess: (_, u) => showToast({ message: t('yatraSettings.memberRemoved', { name: u.user_name }), variant: 'success' }),
    onError: failed,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: usersKey })
      refreshTable()
    },
  })

  const deleteYatra = useMutation({
    mutationFn: () => yatrasApi.deleteYatra(yatraId),
    onSuccess: () => {
      showToast({ message: t('yatraSettings.yatraDeleted', { name: yatraQ.data?.name }), variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['yatras'] })
    },
    onError: failed,
  })

  const users = usersQ.data ?? []
  const me = users.find((u) => u.user_id === userId)
  return {
    yatra: yatraQ.data,
    practices: practicesQ.data ?? [],
    users,
    me,
    isAdmin: !!me?.is_admin,
    isLoading: yatraQ.isLoading || practicesQ.isLoading || usersQ.isLoading,
    isError: yatraQ.isError || practicesQ.isError || usersQ.isError,
    saveYatra, savePractice, reorder, toggleAdmin, statCount,
    createPractice, deletePractice, removeMember, deleteYatra,
  }
}

export type YatraAdmin = ReturnType<typeof useYatraAdmin>
```

The strings used here (`reordered`, `adminAdded`, …) are added by the tasks whose screens trigger them (6–11).

- [ ] **Step 5: Implement `AdminPage.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MobileShell } from '../../../../layouts/mobile/MobileShell'
import type { YatraAdmin } from '../useYatraAdmin'

export const CARD = 'rounded-[18px] border border-ui-hairline bg-ui-surface'
export const LIST = 'flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline'
export const FIELD = 'min-h-12 w-full rounded-xl border border-ui-control bg-ui-surface px-3.5 text-base text-ui-ink outline-none focus:border-ui-accent aria-invalid:border-ui-danger'
export const BTN = 'flex min-h-[50px] items-center justify-center rounded-[14px] px-4 text-[15px] font-bold'
export const HINT = 'text-[13px] leading-normal text-ui-muted'
export const SECTION_TITLE = 'text-[17px] font-extrabold text-ui-ink'

/** An admin page: back link, title over the yatra name, and the content once loaded. Members are sent to their own page. */
export function AdminPage({ admin, title, back, children }: {
  admin: YatraAdmin; title: string; back?: { to: string; label: string }; children: () => ReactNode
}) {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  if (!admin.isLoading && !admin.isError && !admin.isAdmin) return <Navigate to={`/yatra/${id}/settings`} replace />
  const up = back ?? { to: `/yatra/${id}/admin/settings`, label: t('yatraSettings.manage') }
  return (
    <MobileShell>
      <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-11 items-center px-2">
          <Link to={up.to} className="flex min-h-11 items-center gap-1 px-2 text-[17px] font-semibold text-ui-accent">
            <span aria-hidden>‹</span>{up.label}
          </Link>
        </div>
      </header>
      <div className="flex flex-col gap-0.5 px-5 pb-4">
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.02em] break-words text-ui-ink">{title}</h1>
        {admin.yatra && <p className="text-sm text-ui-muted">{admin.yatra.name}</p>}
      </div>
      {admin.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <span role="status" aria-label={t('common.loading')} className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
        </div>
      ) : admin.isError ? (
        <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('common.error')}</p>
      ) : (
        <div className="flex flex-col gap-4 px-4 pb-8">{children()}</div>
      )}
    </MobileShell>
  )
}
```

- [ ] **Step 6: Implement `summaries.ts`, `SettingsRow.danger`, the hub and the section switch**

`summaries.ts`:

```ts
import type { TFunction } from 'i18next'
import type { YatraUser, ZoneColour } from '../../../../types/api'

/** The existing colour names: yatras.zoneRed, yatras.zoneGreen, … */
export const zoneKey = (c: ZoneColour) => `yatras.zone${c}`

export const membersLine = (t: TFunction, users: YatraUser[]) =>
  `${t('yatraSettings.members', { count: users.length })} · ${t('yatraSettings.adminsCount', { count: users.filter((u) => u.is_admin).length })}`
```

`SettingsRow.tsx`: add `danger?: boolean` to the props and destructuring, and set the label class to
`` `text-[15px] ${danger ? 'font-bold text-ui-danger' : accent ? 'font-bold text-ui-accent' : 'font-semibold text-ui-ink'}` ``.

`ManageYatraMobile.tsx`:

```tsx
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SettingsRow } from '../../../settings/mobile/SettingsRow'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, LIST } from './AdminPage'
import { membersLine } from './summaries'

export function ManageYatraMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const a = useYatraAdmin(id)
  const base = `/yatra/${id}/admin`
  return (
    <AdminPage admin={a} title={t('yatraSettings.manage')} back={{ to: `/yatra/${id}/settings`, label: t('yatraSettings.title') }}>
      {() => {
        const stats = a.yatra?.statistics
        return (
          <div className={LIST}>
            <SettingsRow label={t('yatraSettings.general')} hint={t('yatraSettings.generalHint')} to={`${base}/general`} />
            <SettingsRow label={t('yatraSettings.practices')} hint={t('yatraSettings.practicesHint', { count: a.practices.length })} to={`${base}/practices`} />
            <SettingsRow label={t('yatraSettings.membersTitle')} hint={membersLine(t, a.users)} to={`${base}/members`} />
            <SettingsRow label={t('yatraSettings.statistics')} to={`${base}/statistics`}
              hint={t(stats?.visible_to_all ? 'yatraSettings.statsHintAll' : 'yatraSettings.statsHintAdmins', { count: stats?.statistics.length ?? 0 })} />
            <SettingsRow label={t('yatraSettings.invite')} hint={t('yatraSettings.inviteHint')} to={`${base}/invite`} />
            <SettingsRow label={t('yatraSettings.danger')} hint={t('yatraSettings.dangerHint')} to={`${base}/danger`} danger />
          </div>
        )
      }}
    </AdminPage>
  )
}
```

`AdminSectionMobile.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'

// Tasks 6–11 add: general, practices, members, statistics, invite, danger.
const SECTIONS: Record<string, ReactNode> = {}

/** /yatra/:id/admin/:section on mobile; unknown sections go to the hub. */
export function AdminSectionMobile() {
  const { id = '', section = '' } = useParams()
  return SECTIONS[section] ?? <Navigate to={`/yatra/${id}/admin/settings`} replace />
}
```

- [ ] **Step 7: Routes** — in `src/router.tsx`

Add `useParams` to the `react-router-dom` import, then add the lazy imports next to `LinkPracticesMobileScreen`:

```tsx
const ManageYatraMobile = lazy(() => import('./features/yatras/settings/mobile/ManageYatraMobile').then((m) => ({ default: m.ManageYatraMobile })))
const AdminSectionMobile = lazy(() => import('./features/yatras/settings/mobile/AdminSectionMobile').then((m) => ({ default: m.AdminSectionMobile })))

/** The admin sub-pages exist on mobile only; the legacy admin page has every section. */
function ToAdminHub() {
  const { id } = useParams()
  return <Navigate to={`/yatra/${id}/admin/settings`} replace />
}
```

Remove `{ path: '/yatra/:id/admin/settings', element: <YatraAdminSettingsPage /> }` from the `AppShell` children, and add these after the `/yatra/:id/settings` entry:

```tsx
      {
        path: '/yatra/:id/admin/settings',
        element: <ByLayout mobile={<ManageYatraMobile />} legacy={<AppShell />} />,
        children: [{ index: true, element: <YatraAdminSettingsPage /> }],
      },
      { path: '/yatra/:id/admin/:section', element: <ByLayout mobile={<AdminSectionMobile />} legacy={<ToAdminHub />} /> },
```

- [ ] **Step 8: Last-admin links** — in `LeaveSheets.tsx`, delete the `ponytail:` comment and point the links at `/yatra/${yatraId}/admin/members` (Choose another admin) and `/yatra/${yatraId}/admin/danger` (Delete yatra…). In `LinkPracticesMobile.test.tsx` ("the last admin gets the explanation…"), change the link assertion to:

```tsx
    expect(within(sheet).getByRole('link', { name: 'Choose another admin' })).toHaveAttribute('href', '/yatra/y1/admin/members')
    expect(within(sheet).getByRole('link', { name: 'Delete yatra…' })).toHaveAttribute('href', '/yatra/y1/admin/danger')
```

- [ ] **Step 9: Strings** — add the table above to the three locale files.

- [ ] **Step 10: Run — expect PASS.** `npx vitest run src/features/yatras src/features/settings`

- [ ] **Step 11: Commit**

```bash
git add app-react/src app-react/public/locales
git commit -m "feat(yatras): mobile Manage yatra hub with admin-only routes"
```

---
### Task 6: General (12m10)

**Files:**
- Create: `app-react/src/features/yatras/settings/mobile/fields.tsx` (`AutosaveText`)
- Create: `app-react/src/features/yatras/settings/mobile/GeneralMobile.tsx`
- Modify: `summaries.ts` (`scoreSummary`), `AdminSectionMobile.tsx` (`general`)
- Test: `app-react/src/features/yatras/settings/mobile/GeneralMobile.test.tsx`
- Modify: locales

**Interfaces:**
- Consumes: `useYatraAdmin` / `AdminPage` / class strings (Task 5); `useDebouncedCommit` (Task 2); `isScored`, `formatValue`, `bonusOf` (Task 3); `TypeIcon` (phase 1, `mobile/TypeChip.tsx`); `Toggle`, `ListGroup`.
- Produces:
  - `AutosaveText({ id, label, hint?, value, validate?, onCommit, placeholder? })`: a labelled text input. It keeps a draft while focused, commits through `useDebouncedCommit` (600 ms, and on blur), and only when `validate(draft)` returns null and the draft differs from `value`. The error, if any, replaces the hint (`role="alert"`). When not focused, it re-syncs to `value` (e.g. after Undo).
  - `scoreSummary(p: YatraPractice, t): string | null`: "done 16 · bonus 20", "done 05:00", or null.

**Strings:**

| key | en | ru | uk |
|---|---|---|---|
| yatraName | Yatra name | Название ятры | Назва ятри |
| yatraNameHint | Shown at the top of the table and in invites. | Показывается над таблицей и в приглашениях. | Показується над таблицею і в запрошеннях. |
| nameEmpty | Name can't be empty | Название не может быть пустым | Назва не може бути порожньою |
| renamed | Name saved | Название сохранено | Назву збережено |
| metrics | Show daily score metrics | Показывать показатели оценки за день | Показувати показники оцінки за день |
| metricsHint | Adds a 7-day trend column and a 2-week stability heatmap. Both use a 7-day moving average of each member's daily score. | Добавляет столбец тренда за 7 дней и карту стабильности за 2 недели. Оба строятся по скользящему среднему за 7 дней от оценки каждого участника. | Додає стовпець тренду за 7 днів і карту стабільності за 2 тижні. Обидва будуються за ковзним середнім за 7 днів від оцінки кожного учасника. |
| metricsOn | Daily score metrics on | Показатели оценки включены | Показники оцінки увімкнено |
| metricsOff | Daily score metrics off | Показатели оценки выключены | Показники оцінки вимкнено |
| thresholdsCount_one / _few / _many / _other | {{k}} of {{count}} practice has score thresholds / — / — / {{k}} of {{count}} practices have score thresholds | Пороги оценки: у {{k}} из {{count}} практики / Пороги оценки: у {{k}} из {{count}} практик / Пороги оценки: у {{k}} из {{count}} практик / Пороги оценки: у {{k}} из {{count}} практики | Пороги оцінки: у {{k}} з {{count}} практики / Пороги оцінки: у {{k}} з {{count}} практик / Пороги оцінки: у {{k}} з {{count}} практик / Пороги оцінки: у {{k}} з {{count}} практики |
| doneValue | done {{value}} | выполнено {{value}} | виконано {{value}} |
| bonusValue | bonus {{value}} | бонус {{value}} | бонус {{value}} |
| setThreshold | Set threshold › | Задать порог › | Задати поріг › |
| thresholdsNote | Practices without a threshold add nothing to the score. Yes / No and Text practices can't have one. | Практики без порога не добавляют баллов. У практик «Да / Нет» и «Текст» порога быть не может. | Практики без порогу не додають балів. У практик «Так / Ні» і «Текст» порогу бути не може. |

- [ ] **Step 1: Write the failing test** — `GeneralMobile.test.tsx`

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, renderAdmin, YATRA } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('GeneralMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })

  it('saves the name after a pause in typing, keeping the other fields', async () => {
    renderAdmin('/yatra/y1/admin/general')
    fireEvent.change(await screen.findByLabelText('Yatra name'), { target: { value: 'Balarama League' } })
    expect(api.updateYatra).not.toHaveBeenCalled()
    await waitFor(() => expect(api.updateYatra).toHaveBeenCalledWith('y1', {
      name: 'Balarama League', show_stability_metrics: true, statistics: YATRA.statistics,
    }))
  })

  it("doesn't save an empty name and says why", async () => {
    renderAdmin('/yatra/y1/admin/general')
    const name = await screen.findByLabelText('Yatra name')
    fireEvent.change(name, { target: { value: '  ' } })
    fireEvent.blur(name)
    expect(screen.getByRole('alert')).toHaveTextContent("Name can't be empty")
    expect(api.updateYatra).not.toHaveBeenCalled()
  })

  it('a toggle right after a rename keeps the new name', async () => {
    let release!: () => void
    api.updateYatra.mockImplementationOnce(() => new Promise<void>((r) => { release = r }))
    renderAdmin('/yatra/y1/admin/general')
    const name = await screen.findByLabelText('Yatra name')
    fireEvent.change(name, { target: { value: 'New name' } })
    fireEvent.blur(name)
    fireEvent.click(screen.getByRole('switch', { name: 'Show daily score metrics' }))
    await waitFor(() => expect(api.updateYatra).toHaveBeenCalledOnce())
    release()
    await waitFor(() => expect(api.updateYatra).toHaveBeenCalledTimes(2))
    expect(api.updateYatra.mock.calls[1][1]).toEqual({ name: 'New name', show_stability_metrics: false, statistics: YATRA.statistics })
    expect(await screen.findAllByRole('button', { name: 'Undo' })).not.toHaveLength(0)
  })

  it('lists measurable practices with their thresholds', async () => {
    renderAdmin('/yatra/y1/admin/general')
    expect(await screen.findByText('2 of 3 practices have score thresholds')).toBeInTheDocument()
    expect(screen.getByText('done 16 · bonus 20')).toBeInTheDocument()
    expect(screen.getByText('done 05:00 · bonus 04:30')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reading.*Set threshold/ })).toHaveAttribute('href', '/yatra/y1/practice/p3/edit')
    expect(screen.queryByText('Mangala arati')).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

`fields.tsx`:

```tsx
import { useState } from 'react'
import { useDebouncedCommit } from '../useDebouncedCommit'
import { FIELD, HINT } from './AdminPage'

/** A text field that saves while you type (after a pause) and on blur; invalid text stays local and says why. */
export function AutosaveText({ id, label, hint, value, validate, onCommit, placeholder }: {
  id: string; label: string; hint?: string; value: string; placeholder?: string
  validate?: (v: string) => string | null; onCommit: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const [seen, setSeen] = useState(value)
  // Follow outside changes (Undo, a refetch), but never over what's being typed.
  if (value !== seen) {
    setSeen(value)
    if (!focused) setDraft(value)
  }
  const error = validate?.(draft) ?? null
  const { schedule, flush } = useDebouncedCommit(() => { if (!error && draft !== value) onCommit(draft) })
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold text-ui-muted">{label}</label>
      <input id={id} value={draft} placeholder={placeholder} aria-invalid={!!error} className={FIELD}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); flush() }}
        onChange={(e) => { setDraft(e.target.value); schedule() }} />
      {error ? <p role="alert" className="text-xs font-semibold text-ui-danger">{error}</p> : hint && <p className={HINT}>{hint}</p>}
    </div>
  )
}
```

`summaries.ts`: add

```ts
import type { YatraPractice } from '../../../../types/api'
import { bonusOf, formatValue, isScored } from '../zones'

/** "done 16 · bonus 20", or null when the practice adds nothing to the score. */
export function scoreSummary(p: YatraPractice, t: TFunction): string | null {
  if (!isScored(p.data_type)) return null
  const dt = p.data_type
  const done = p.daily_score?.mandatory_threshold
  const bonus = bonusOf(p.daily_score)
  const parts = [
    done && t('yatraSettings.doneValue', { value: formatValue(done, dt) }),
    bonus && t('yatraSettings.bonusValue', { value: formatValue(bonus, dt) }),
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
```

`GeneralMobile.tsx`:

```tsx
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ListGroup } from '../../../../ui/primitives/ListGroup'
import { Toggle } from '../../../../ui/primitives/Toggle'
import { useYatraAdmin } from '../useYatraAdmin'
import { isScored } from '../zones'
import { AdminPage, CARD, HINT } from './AdminPage'
import { AutosaveText } from './fields'
import { scoreSummary } from './summaries'
import { TypeIcon } from './TypeChip'

export function GeneralMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const a = useYatraAdmin(id)
  return (
    <AdminPage admin={a} title={t('yatraSettings.general')}>
      {() => {
        const y = a.yatra!
        const scored = a.practices.filter((p) => isScored(p.data_type))
        const withScore = scored.filter((p) => scoreSummary(p, t)).length
        return (
          <>
            <section className={`${CARD} p-4`}>
              <AutosaveText id="yatra-name" label={t('yatraSettings.yatraName')} hint={t('yatraSettings.yatraNameHint')} value={y.name}
                validate={(v) => (v.trim() ? null : t('yatraSettings.nameEmpty'))}
                onCommit={(v) => a.saveYatra({ name: v.trim() }, t('yatraSettings.renamed'))} />
            </section>
            <section className={`${CARD} flex items-start gap-3 p-4`}>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] font-bold text-ui-ink">{t('yatraSettings.metrics')}</span>
                <span className={HINT}>{t('yatraSettings.metricsHint')}</span>
              </div>
              <Toggle checked={y.show_stability_metrics} label={t('yatraSettings.metrics')}
                onChange={(v) => a.saveYatra({ show_stability_metrics: v }, t(v ? 'yatraSettings.metricsOn' : 'yatraSettings.metricsOff'))} />
            </section>
            {scored.length > 0 && (
              <div className="flex flex-col gap-2">
                <ListGroup label={t('yatraSettings.thresholdsCount', { k: withScore, count: scored.length })}>
                  {scored.map((p) => {
                    const s = scoreSummary(p, t)
                    return (
                      <Link key={p.id} to={`/yatra/${id}/practice/${p.id}/edit`} className="flex min-h-[52px] items-center gap-3 bg-ui-surface px-4 py-2">
                        <TypeIcon type={p.data_type} />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ui-ink">{p.practice}</span>
                        {s
                          ? <span className="shrink-0 font-ui-mono text-[13px] text-ui-muted">{s}</span>
                          : <span className="shrink-0 text-[13px] font-bold text-ui-accent">{t('yatraSettings.setThreshold')}</span>}
                      </Link>
                    )
                  })}
                </ListGroup>
                <p className={`${HINT} px-1.5`}>{t('yatraSettings.thresholdsNote')}</p>
              </div>
            )}
          </>
        )
      }}
    </AdminPage>
  )
}
```

`AdminSectionMobile.tsx`: `import { GeneralMobile } from './GeneralMobile'` and `const SECTIONS: Record<string, ReactNode> = { general: <GeneralMobile /> }`.

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/features/yatras/settings`

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings app-react/public/locales
git commit -m "feat(yatras): mobile General page with autosaving name and score metrics"
```

---
### Task 7: Practices list, add / rename / delete (12m11–13)

**Files:**
- Create: `app-react/src/features/yatras/settings/mobile/PracticesMobile.tsx`, `PracticeSheets.tsx`
- Modify: `fields.tsx` (`ConfirmSheet`, `SheetHeader`), `summaries.ts` (`practiceSummary`), `AdminSectionMobile.tsx` (`practices`)
- Test: `app-react/src/features/yatras/settings/mobile/PracticesMobile.test.tsx`, `app-react/src/features/yatras/settings/useYatraAdmin.test.tsx`
- Modify: locales

**Interfaces:**
- Consumes: `useYatraAdmin` (`reorder`, `savePractice`, `createPractice`, `deletePractice`, `statCount`); `AutosaveText`; `zoneCount`, `isScored`; `TypeIcon`, `typeLabelKey`; `AnchoredMenu`, `MenuItem`, `BottomSheet`; `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- Produces:
  - `ConfirmSheet({ title, text, confirm, busy?, disabled?, onConfirm, onClose, children? })`: a danger button and Cancel.
  - `SheetHeader({ title, onClose, children? })`: the title with a × close button; `children` go before the title (e.g. an avatar).
  - `DeletePracticeSheet({ practice, statCount, busy, onConfirm, onClose })`. Task 8 reuses it.
  - `practiceSummary(p, t): string`: "3 colours · done 16 · bonus 20", "2 colours · not in score", "No colours · not in score", "Shown as ✓", "Shown as written".

**Strings:**

| key | en | ru | uk |
|---|---|---|---|
| practicesIntro | Drag to reorder: the table shows columns in this order. Tap a practice to edit its colours and score. | Перетаскивайте, чтобы изменить порядок: в нём идут столбцы таблицы. Нажмите на практику, чтобы настроить цвета и оценку. | Перетягуйте, щоб змінити порядок: у ньому йдуть стовпці таблиці. Натисніть на практику, щоб налаштувати кольори й оцінку. |
| nColours_one / _few / _many / _other | {{count}} colour / — / — / {{count}} colours | {{count}} цвет / {{count}} цвета / {{count}} цветов / {{count}} цвета | {{count}} колір / {{count}} кольори / {{count}} кольорів / {{count}} кольору |
| noColours | No colours | Без цветов | Без кольорів |
| notInScore | not in score | не в оценке | не в оцінці |
| shownAsCheck | Shown as ✓ | Показывается как ✓ | Показується як ✓ |
| shownAsWritten | Shown as written | Показывается как написано | Показується як написано |
| dragHandle | Move {{name}} | Переместить «{{name}}» | Перемістити «{{name}}» |
| practiceMenu | Actions for {{name}} | Действия: «{{name}}» | Дії: «{{name}}» |
| rename | Rename | Переименовать | Перейменувати |
| deleteEllipsis | Delete… | Удалить… | Видалити… |
| addPractice | + Add practice | + Добавить практику | + Додати практику |
| newPractice | New practice | Новая практика | Нова практика |
| name | Name | Название | Назва |
| whatKind | What kind of value? | Какое значение? | Яке значення? |
| typeDescInt | A count: rounds, pages | Количество: круги, страницы | Кількість: кола, сторінки |
| typeDescBool | Done or not | Сделано или нет | Зроблено чи ні |
| typeDescTime | When it happened | Когда это было | Коли це було |
| typeDescDuration | How long it took | Сколько времени заняло | Скільки часу зайняло |
| typeDescText | A short note | Короткая заметка | Коротка нотатка |
| exampleYes | Yes | Да | Так |
| typeFixed | The type can't be changed after the practice is created. | Тип нельзя изменить после создания практики. | Тип не можна змінити після створення практики. |
| addPracticeButton | Add practice | Добавить практику | Додати практику |
| practiceAdded | Added {{name}} | Добавлено: {{name}} | Додано: {{name}} |
| renameTitle | Rename practice | Переименовать практику | Перейменувати практику |
| done | Done | Готово | Готово |
| deletePracticeTitle | Delete “{{name}}”? | Удалить «{{name}}»? | Видалити «{{name}}»? |
| deletePracticeText_one / _few / _many / _other | Its column, colours and the {{count}} statistic that uses it are removed for everyone. Members keep their own entries. / — / — / Its column, colours and the {{count}} statistics that use it are removed for everyone. Members keep their own entries. | Её столбец, цвета и {{count}} статистика на её основе удаляются у всех. Записи участников остаются у них. (_few: «статистики», _many: «статистик», _other: «статистики») | Її стовпець, кольори і {{count}} статистика на її основі видаляються в усіх. Записи учасників лишаються в них. (_few: «статистики», _many: «статистик», _other: «статистики») |
| deletePracticeTextNoStats | Its column and colours are removed for everyone. Members keep their own entries. | Её столбец и цвета удаляются у всех. Записи участников остаются у них. | Її стовпець і кольори видаляються в усіх. Записи учасників лишаються в них. |
| deletePractice | Delete practice | Удалить практику | Видалити практику |
| practiceDeleted | Deleted {{name}} | Удалено: {{name}} | Видалено: {{name}} |
| reordered | Order saved | Порядок сохранён | Порядок збережено |

- [ ] **Step 1: Write the failing tests**

`useYatraAdmin.test.tsx` (reordering, which jsdom can't drag):

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { mockAdmin } from './mobile/adminTestUtils'
import { useYatraAdmin } from './useYatraAdmin'

vi.mock('../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('useYatraAdmin', () => {
  it('reorder shows the new order at once and sends every id', async () => {
    mockAdmin(api)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useYatraAdmin('y1'), { wrapper })
    await waitFor(() => expect(result.current.practices).toHaveLength(5))
    act(() => result.current.reorder(['p2', 'p1', 'p3', 'p4', 'p5']))
    expect(result.current.practices.map((p) => p.id)).toEqual(['p2', 'p1', 'p3', 'p4', 'p5'])
    await waitFor(() => expect(api.reorderPractices).toHaveBeenCalledWith('y1', ['p2', 'p1', 'p3', 'p4', 'p5']))
  })
})
```

`PracticesMobile.test.tsx`:

```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, PRACTICES, renderAdmin } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)

async function openMenu(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
}

describe('PracticesMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })

  it('summarises each practice and links it to the editor', async () => {
    renderAdmin('/yatra/y1/admin/practices')
    expect(await screen.findByText('3 colours · done 16 · bonus 20')).toBeInTheDocument()
    expect(screen.getByText('No colours · done 05:00 · bonus 04:30')).toBeInTheDocument()
    expect(screen.getByText('2 colours · not in score')).toBeInTheDocument()
    expect(screen.getByText('Shown as ✓')).toBeInTheDocument()
    expect(screen.getByText('Shown as written')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Japa rounds/ })).toHaveAttribute('href', '/yatra/y1/practice/p1/edit')
  })

  it('removes the statistics that use a practice, then deletes it', async () => {
    renderAdmin('/yatra/y1/admin/practices')
    await openMenu('Japa rounds')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    const sheet = screen.getByRole('dialog', { name: 'Delete “Japa rounds”?' })
    expect(within(sheet).getByText(/the 1 statistic that uses it/)).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete practice' }))
    await waitFor(() => expect(api.deleteYatraPractice).toHaveBeenCalledWith('y1', 'p1'))
    expect(api.updateYatra.mock.calls[0][1].statistics!.statistics.map((s) => s.label)).toEqual(['Earliest wake-up'])
    expect(api.updateYatra.mock.invocationCallOrder[0]).toBeLessThan(api.deleteYatraPractice.mock.invocationCallOrder[0])
  })

  it('keeps the practice when removing its statistics fails', async () => {
    api.updateYatra.mockRejectedValue(new Error('x'))
    renderAdmin('/yatra/y1/admin/practices')
    await openMenu('Japa rounds')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete practice' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(api.deleteYatraPractice).not.toHaveBeenCalled()
  })

  it('deletes a practice no statistic uses without touching the yatra', async () => {
    renderAdmin('/yatra/y1/admin/practices')
    await openMenu('Reading')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByText('Its column and colours are removed for everyone. Members keep their own entries.')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete practice' }))
    await waitFor(() => expect(api.deleteYatraPractice).toHaveBeenCalledWith('y1', 'p3'))
    expect(api.updateYatra).not.toHaveBeenCalled()
  })

  it('renames from the row menu', async () => {
    renderAdmin('/yatra/y1/admin/practices')
    await openMenu('Japa rounds')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const sheet = screen.getByRole('dialog', { name: 'Rename practice' })
    fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Japa' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledWith('y1', { ...PRACTICES[0], practice: 'Japa' }))
  })

  it('adds a practice of the chosen type and opens its editor', async () => {
    api.getYatraPractices
      .mockResolvedValueOnce(structuredClone(PRACTICES))
      .mockResolvedValueOnce([...structuredClone(PRACTICES), { id: 'p6', practice: 'Seva', data_type: 'Bool' }])
    renderAdmin('/yatra/y1/admin/practices')
    fireEvent.click(await screen.findByRole('button', { name: '+ Add practice' }))
    const sheet = screen.getByRole('dialog', { name: 'New practice' })
    const add = within(sheet).getByRole('button', { name: 'Add practice' })
    expect(add).toBeDisabled()
    fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Seva' } })
    fireEvent.click(within(sheet).getByRole('radio', { name: /Yes \/ No/ }))
    fireEvent.click(add)
    expect(await screen.findByText('Editor')).toBeInTheDocument()
    expect(api.createYatraPractice).toHaveBeenCalledWith('y1', { practice: 'Seva', data_type: 'Bool' })
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

`fields.tsx`: add (with imports `type ReactNode`, `useTranslation`, `BottomSheet` from `../../../../ui/primitives/BottomSheet`, and `BTN`):

```tsx
export function SheetHeader({ title, onClose, children }: { title: string; onClose: () => void; children?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3">
      {children}
      <h2 className="min-w-0 flex-1 text-xl font-extrabold break-words text-ui-ink">{title}</h2>
      <button type="button" aria-label={t('yatraSettings.close')} onClick={onClose}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-chip text-lg text-ui-muted">×</button>
    </div>
  )
}

/** Asks before something that can't be undone. */
export function ConfirmSheet({ title, text, confirm, busy, disabled, onConfirm, onClose, children }: {
  title: string; text: string; confirm: string; busy?: boolean; disabled?: boolean
  onConfirm: () => void; onClose: () => void; children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet label={title} onClose={onClose}>
      <h2 className="text-xl font-extrabold break-words text-ui-ink">{title}</h2>
      <p className="text-sm leading-normal text-ui-ink2">{text}</p>
      {children}
      <div className="flex flex-col gap-2.5">
        <button type="button" disabled={busy || disabled} onClick={onConfirm} className={`${BTN} bg-ui-danger text-white disabled:opacity-50`}>{confirm}</button>
        <button type="button" onClick={onClose} className={`${BTN} border border-ui-control text-ui-ink`}>{t('common.cancel')}</button>
      </div>
    </BottomSheet>
  )
}
```

`summaries.ts`: add (import `zoneCount` too):

```ts
export function practiceSummary(p: YatraPractice, t: TFunction): string {
  if (p.data_type === 'Bool') return t('yatraSettings.shownAsCheck')
  if (p.data_type === 'Text') return t('yatraSettings.shownAsWritten')
  const n = zoneCount(p.colour_zones)
  const colours = n ? t('yatraSettings.nColours', { count: n }) : t('yatraSettings.noColours')
  return `${colours} · ${scoreSummary(p, t) ?? t('yatraSettings.notInScore')}`
}
```

`PracticeSheets.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PracticeDataType, YatraPractice } from '../../../../types/api'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import { BTN, FIELD, HINT } from './AdminPage'
import { AutosaveText, ConfirmSheet, SheetHeader } from './fields'
import { TypeIcon, typeLabelKey } from './TypeChip'

const TYPES: { type: PracticeDataType; example: string }[] = [
  { type: 'Int', example: '16' }, { type: 'Bool', example: '' }, { type: 'Time', example: '05:30' },
  { type: 'Duration', example: '1:30' }, { type: 'Text', example: 'Aa' },
]

export function AddPracticeSheet({ busy, onAdd, onClose }: {
  busy: boolean; onAdd: (name: string, type: PracticeDataType) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [type, setType] = useState<PracticeDataType>('Int')
  const title = t('yatraSettings.newPractice')
  return (
    <BottomSheet label={title} onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-practice" className="text-[13px] font-bold text-ui-muted">{t('yatraSettings.name')}</label>
        <input id="new-practice" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
      </div>
      <div className="flex flex-col gap-2">
        <span id="new-practice-kind" className="text-[13px] font-bold text-ui-muted">{t('yatraSettings.whatKind')}</span>
        <div role="radiogroup" aria-labelledby="new-practice-kind" className="flex flex-col gap-2">
          {TYPES.map(({ type: ty, example }) => (
            <button key={ty} type="button" role="radio" aria-checked={type === ty} onClick={() => setType(ty)}
              className={`flex min-h-14 items-center gap-3 rounded-[14px] border bg-ui-surface px-3.5 py-2 text-left ${type === ty ? 'border-ui-ink' : 'border-ui-control'}`}>
              <TypeIcon type={ty} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold text-ui-ink">{t(typeLabelKey(ty))}</span>
                <span className="text-xs text-ui-muted">{t(`yatraSettings.typeDesc${ty}`)}</span>
              </span>
              <span className="shrink-0 font-ui-mono text-sm text-ui-muted">{ty === 'Bool' ? t('yatraSettings.exampleYes') : example}</span>
            </button>
          ))}
        </div>
      </div>
      <p className={HINT}>{t('yatraSettings.typeFixed')}</p>
      <button type="button" disabled={!name.trim() || busy} onClick={() => onAdd(name.trim(), type)}
        className={`${BTN} bg-ui-primary text-ui-on-primary disabled:opacity-50`}>
        {t('yatraSettings.addPracticeButton')}
      </button>
    </BottomSheet>
  )
}

export function RenamePracticeSheet({ practice, onRename, onClose }: {
  practice: YatraPractice; onRename: (name: string) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const title = t('yatraSettings.renameTitle')
  return (
    <BottomSheet label={title} onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      <AutosaveText id="rename-practice" label={t('yatraSettings.name')} value={practice.practice}
        validate={(v) => (v.trim() ? null : t('yatraSettings.nameEmpty'))} onCommit={(v) => onRename(v.trim())} />
      <button type="button" onClick={onClose} className={`${BTN} bg-ui-primary text-ui-on-primary`}>{t('yatraSettings.done')}</button>
    </BottomSheet>
  )
}

export function DeletePracticeSheet({ practice, statCount, busy, onConfirm, onClose }: {
  practice: YatraPractice; statCount: number; busy: boolean; onConfirm: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <ConfirmSheet title={t('yatraSettings.deletePracticeTitle', { name: practice.practice })}
      text={statCount ? t('yatraSettings.deletePracticeText', { count: statCount }) : t('yatraSettings.deletePracticeTextNoStats')}
      confirm={t('yatraSettings.deletePractice')} busy={busy} onConfirm={onConfirm} onClose={onClose} />
  )
}
```

`PracticesMobile.tsx`:

```tsx
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { YatraPractice } from '../../../../types/api'
import { AnchoredMenu, MenuItem } from '../../../../ui/primitives/AnchoredMenu'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, BTN, HINT, LIST } from './AdminPage'
import { AddPracticeSheet, DeletePracticeSheet, RenamePracticeSheet } from './PracticeSheets'
import { practiceSummary } from './summaries'
import { TypeIcon } from './TypeChip'

export function PracticesMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const a = useYatraAdmin(id)
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const find = (pid: string | null) => a.practices.find((p) => p.id === pid)

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = a.practices.map((p) => p.id)
    a.reorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <AdminPage admin={a} title={t('yatraSettings.practices')}>
      {() => {
        const menuFor = find(menu?.id ?? null)
        const renaming = find(renamingId)
        const deleting = find(deletingId)
        return (
          <>
            <p className={`${HINT} px-1.5`}>{t('yatraSettings.practicesIntro')}</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={a.practices.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <ul className={LIST}>
                  {a.practices.map((p) => (
                    <PracticeRow key={p.id} p={p} to={`/yatra/${id}/practice/${p.id}/edit`} onMenu={(anchor) => setMenu({ id: p.id, anchor })} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <button type="button" onClick={() => setAdding(true)} className={`${BTN} border border-dashed border-ui-control bg-ui-surface text-ui-accent`}>
              {t('yatraSettings.addPractice')}
            </button>
            {menu && menuFor && (
              <AnchoredMenu anchor={menu.anchor} label={menuFor.practice} onClose={() => setMenu(null)}>
                <MenuItem onSelect={() => { setMenu(null); setRenamingId(menuFor.id) }}>{t('yatraSettings.rename')}</MenuItem>
                <MenuItem onSelect={() => { setMenu(null); setDeletingId(menuFor.id) }}>
                  <span className="text-ui-danger">{t('yatraSettings.deleteEllipsis')}</span>
                </MenuItem>
              </AnchoredMenu>
            )}
            {renaming && (
              <RenamePracticeSheet practice={renaming} onClose={() => setRenamingId(null)}
                onRename={(name) => a.savePractice({ ...renaming, practice: name }, t('yatraSettings.renamed'))} />
            )}
            {deleting && (
              <DeletePracticeSheet practice={deleting} statCount={a.statCount(deleting.id)} busy={a.deletePractice.isPending}
                onClose={() => setDeletingId(null)} onConfirm={() => a.deletePractice.mutate(deleting, { onSettled: () => setDeletingId(null) })} />
            )}
            {adding && (
              <AddPracticeSheet busy={a.createPractice.isPending} onClose={() => setAdding(false)}
                onAdd={(name, type) => a.createPractice.mutate({ name, type }, {
                  onSuccess: (p) => { setAdding(false); if (p) navigate(`/yatra/${id}/practice/${p.id}/edit`) },
                })} />
            )}
          </>
        )
      }}
    </AdminPage>
  )
}

function PracticeRow({ p, to, onMenu }: { p: YatraPractice; to: string; onMenu: (anchor: HTMLElement) => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-h-[60px] items-center gap-1 bg-ui-surface pr-1 ${isDragging ? 'relative z-10 shadow-lg' : ''}`}>
      <button type="button" {...attributes} {...listeners} aria-label={t('yatraSettings.dragHandle', { name: p.practice })}
        className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-ui-faint2">
        <span aria-hidden className="text-lg leading-none">⋮⋮</span>
      </button>
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ui-chip text-ui-ink2"><TypeIcon type={p.data_type} /></span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-bold text-ui-ink">{p.practice}</span>
          <span className="text-xs text-ui-muted">{practiceSummary(p, t)}</span>
        </span>
      </Link>
      <button type="button" aria-label={t('yatraSettings.practiceMenu', { name: p.practice })} aria-haspopup="menu"
        onClick={(e) => onMenu(e.currentTarget)} className="flex h-11 w-11 shrink-0 items-center justify-center gap-[3px]">
        {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
      </button>
    </li>
  )
}
```

`AdminSectionMobile.tsx`: add `practices: <PracticesMobile />`.

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/features/yatras/settings`

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings app-react/public/locales
git commit -m "feat(yatras): mobile Practices page with reorder, add, rename and delete"
```

---
### Task 8: Range bar and practice editor (12m14–16)

**Files:**
- Create: `app-react/src/features/yatras/settings/mobile/RangeBar.tsx`, `PracticeEditorMobile.tsx`
- Test: `app-react/src/features/yatras/settings/mobile/PracticeEditorMobile.test.tsx`
- Modify: `adminTestUtils.tsx` (editor route), `PracticesMobile.test.tsx` (last test's expectation), `src/router.tsx`, locales

**Interfaces:**
- Consumes: `zones.ts` (Task 3); `useDebouncedCommit` (Task 2); `useYatraAdmin.savePractice`, `deletePractice`, `statCount` (Task 5); `AutosaveText` (Task 6); `DeletePracticeSheet` (Task 7); `zoneKey` (Task 5); `ZONE_BG`; `SegmentedControl`; `TypeChip`.
- Produces: `RangeBar({ bar: Bar; dt: ScoredType })` (decorative, `aria-hidden`; the score summary line carries the same facts as text) and `PracticeEditorMobile` (the route element).

Behaviour:
- The bar, "Above X" and the score summary read the **saved** practice. So while a field is invalid, the bar keeps the last valid config (spec 12m15).
- Bound and threshold fields hold drafts. They save 600 ms after typing and on blur. Valid parts are sent and invalid parts are kept local with the reason shown. While a field has focus, a save landing doesn't rewrite its text (e.g. `45` stays `45`, not `0:45`).
- Count, direction, empty colour, score direction and the "Done starts where Green starts" chip save at once. They build on the valid drafts, so nothing typed is lost.
- "Same as colours" is selected whenever colours are on and the score direction equals the colour direction. Changing the colour direction then moves the score direction too. (ponytail: no stored flag. Choosing Higher when colours are Higher shows as "Same as colours"; this is harmless because the stored config is identical.)
- With no daily score stored yet, picking a score direction is kept locally until a threshold is entered.

**Strings:**

| key | en | ru | uk |
|---|---|---|---|
| type | Type | Тип | Тип |
| typeSet | Set when the practice was created | Задаётся при создании практики | Задається під час створення практики |
| coloursTitle | Colours in the table | Цвета в таблице | Кольори в таблиці |
| coloursHint | Paint each cell by its value. | Каждая ячейка окрашивается по значению. | Кожна клітинка фарбується за значенням. |
| colours | Colours | Цвета | Кольори |
| coloursOff | Off | Выкл. | Вимк. |
| colours2 | 2 colours | 2 цвета | 2 кольори |
| colours3 | 3 colours | 3 цвета | 3 кольори |
| betterWhen | Better when the value is | Лучше, когда значение | Краще, коли значення |
| scoreBetterWhen | Daily score is better when the value is | Оценка лучше, когда значение | Оцінка краща, коли значення |
| higher | Higher | Выше | Вище |
| lower | Lower | Ниже | Нижче |
| sameAsColours | Same as colours | Как у цветов | Як у кольорів |
| upTo | {{colour}} up to | {{colour}} до | {{colour}} до |
| aboveBest | Above {{value}}: {{colour}} | Выше {{value}}: {{colour}} | Вище {{value}}: {{colour}} |
| notSavedYet | Not saved yet. The bar keeps the last valid bounds until this is fixed. | Пока не сохранено. Шкала показывает последние верные границы, пока это не исправлено. | Поки не збережено. Шкала показує останні правильні межі, доки це не виправлено. |
| mustBeAbove | Must be more than {{value}}, the {{colour}} bound | Должно быть больше {{value}} — границы «{{colour}}» | Має бути більше за {{value}} — межу «{{colour}}» |
| formatInt | Enter a whole number | Введите целое число | Введіть ціле число |
| formatDuration | Enter h:mm, e.g. 1:30 | Введите ч:мм, например 1:30 | Введіть г:хх, наприклад 1:30 |
| formatTime | Enter hh:mm, e.g. 05:30 | Введите чч:мм, например 05:30 | Введіть гг:хх, наприклад 05:30 |
| bonusAtLeast | Must be at least the done value, {{value}} | Должно быть не меньше порога выполнения, {{value}} | Має бути не менше за поріг виконання, {{value}} |
| bonusAtMost | Must be at most the done value, {{value}} | Должно быть не больше порога выполнения, {{value}} | Має бути не більше за поріг виконання, {{value}} |
| emptyCell | Empty cell | Пустая ячейка | Порожня клітинка |
| inTable | In the table | В таблице | У таблиці |
| emptySample | empty | пусто | порожньо |
| scoreTitle | Daily score | Оценка за день | Оцінка за день |
| scoreHint | Up to 2 points a day from this practice. Shown on the bar above as ✓ and ★. | До 2 баллов в день за эту практику. На шкале выше — ✓ и ★. | До 2 балів на день за цю практику. На шкалі вище — ✓ і ★. |
| scoreDoneBonus | Counts as done at {{op}} {{done}} · bonus at {{op}} {{bonus}} | Выполнено при {{op}} {{done}} · бонус при {{op}} {{bonus}} | Виконано при {{op}} {{done}} · бонус при {{op}} {{bonus}} |
| scoreDone | Counts as done at {{op}} {{done}} | Выполнено при {{op}} {{done}} | Виконано при {{op}} {{done}} |
| scoreBonus | Bonus at {{op}} {{bonus}} | Бонус при {{op}} {{bonus}} | Бонус при {{op}} {{bonus}} |
| scoreNone | Not in the daily score yet | Пока не входит в оценку | Поки не входить в оцінку |
| doneAt | ✓ Done at · +1 point | ✓ Выполнено при · +1 балл | ✓ Виконано при · +1 бал |
| bonusAt | ★ Bonus at · +1 more | ★ Бонус при · ещё +1 | ★ Бонус при · ще +1 |
| doneWhereGreen | Done starts where {{colour}} starts | Выполнено там, где начинается «{{colour}}» | Виконано там, де починається «{{colour}}» |
| bonusNote | Bonus only counts on days when every practice with a done threshold is done. | Бонус засчитывается только в дни, когда выполнены все практики с порогом выполнения. | Бонус зараховується лише в дні, коли виконано всі практики з порогом виконання. |
| savedAsYouEdit | Saved as you edit | Сохраняется по ходу | Зберігається по ходу |
| noZonesTitle | Colours and daily score | Цвета и оценка за день | Кольори та оцінка за день |
| noZonesBool | Yes / No practices show ✓ in the table. Colours and the daily score only apply to Number, Time of day and Duration practices. | Практики «Да / Нет» показываются в таблице как ✓. Цвета и оценка за день есть только у практик «Число», «Время суток» и «Длительность». | Практики «Так / Ні» показуються в таблиці як ✓. Кольори й оцінка за день є лише в практик «Число», «Час доби» і «Тривалість». |
| noZonesText | Text practices show what was written. Colours and the daily score only apply to Number, Time of day and Duration practices. | Текстовые практики показывают написанное. Цвета и оценка за день есть только у практик «Число», «Время суток» и «Длительность». | Текстові практики показують написане. Кольори й оцінка за день є лише в практик «Число», «Час доби» і «Тривалість». |

- [ ] **Step 1: Point the test route at the editor**

In `adminTestUtils.tsx`, import `PracticeEditorMobile` from `./PracticeEditorMobile` and replace `element={<p>Editor</p>}` with `element={<PracticeEditorMobile />}`. In `PracticesMobile.test.tsx` ("adds a practice…"), replace `expect(await screen.findByText('Editor')).toBeInTheDocument()` with:

```tsx
    expect(await screen.findByRole('heading', { name: 'Seva' })).toBeInTheDocument()
```

- [ ] **Step 2: Write the failing test** — `PracticeEditorMobile.test.tsx`

```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, renderAdmin } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)
const sent = () => api.updateYatraPractice.mock.calls.at(-1)![1]

describe('PracticeEditorMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })

  it('shows the bounds, the bar and the score of a Number practice', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    expect(await screen.findByLabelText('Red up to')).toHaveValue('7')
    expect(screen.getByLabelText('Yellow up to')).toHaveValue('15')
    expect(screen.getByText('Above 15: Green')).toBeInTheDocument()
    expect(screen.getByText('✓ 16')).toBeInTheDocument()
    expect(screen.getByText('★ 20')).toBeInTheDocument()
    expect(screen.getByText('Counts as done at ≥ 16 · bonus at ≥ 20')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Japa rounds' })).toBeInTheDocument()
  })

  it('a bound out of order says why and nothing is sent', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const yellow = await screen.findByLabelText('Yellow up to')
    fireEvent.change(yellow, { target: { value: '6' } })
    fireEvent.blur(yellow)
    expect(screen.getByText('Must be more than 7, the Red bound')).toBeInTheDocument()
    expect(screen.getByText('Not saved yet. The bar keeps the last valid bounds until this is fixed.')).toBeInTheDocument()
    expect(api.updateYatraPractice).not.toHaveBeenCalled()
  })

  it('saves a valid bound and keeps its colours', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const yellow = await screen.findByLabelText('Yellow up to')
    fireEvent.change(yellow, { target: { value: '14' } })
    fireEvent.blur(yellow)
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(sent().colour_zones!.bounds).toEqual([{ to: { Int: 7 }, colour: 'Red' }, { to: { Int: 14 }, colour: 'Yellow' }])
  })

  it('keeps what is typed in a focused field when its save lands', async () => {
    renderAdmin('/yatra/y1/practice/p3/edit')
    const red = await screen.findByLabelText('Red up to')
    expect(red).toHaveValue('0:30')
    fireEvent.focus(red)
    fireEvent.change(red, { target: { value: '45' } })
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(sent().colour_zones!.bounds[0].to).toEqual({ Duration: 45 })
    expect(red).toHaveValue('45')
  })

  it('2 colours keeps the first bound and offers Undo', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    fireEvent.click(await screen.findByRole('radio', { name: '2 colours' }))
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(sent().colour_zones).toEqual({ better_direction: 'Higher', bounds: [{ to: { Int: 7 }, colour: 'Red' }], no_value_colour: 'Neutral', best_colour: 'Green' })
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('Lower re-colours the zones and the score follows', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const colourDir = await screen.findByRole('radiogroup', { name: 'Better when the value is' })
    fireEvent.click(within(colourDir).getByRole('radio', { name: 'Lower' }))
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(sent().colour_zones!.bounds.map((b) => b.colour)).toEqual(['Green', 'Yellow'])
    expect(sent().colour_zones!.best_colour).toBe('Red')
    expect(sent().daily_score!.better_direction).toBe('Lower')
  })

  it('clearing both thresholds removes the daily score', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const done = await screen.findByLabelText('✓ Done at · +1 point')
    const bonus = screen.getByLabelText('★ Bonus at · +1 more')
    fireEvent.change(done, { target: { value: '' } })
    fireEvent.change(bonus, { target: { value: '' } })
    fireEvent.blur(bonus)
    await waitFor(() => expect(api.updateYatraPractice).toHaveBeenCalledOnce())
    expect(sent().daily_score).toBeNull()
  })

  it('offers to start done where Green starts', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    const done = await screen.findByLabelText('✓ Done at · +1 point')
    expect(screen.queryByRole('button', { name: 'Done starts where Green starts' })).toBeNull()
    fireEvent.change(done, { target: { value: '18' } })
    fireEvent.blur(done)
    fireEvent.click(await screen.findByRole('button', { name: 'Done starts where Green starts' }))
    await waitFor(() => expect(sent().daily_score!.mandatory_threshold).toEqual({ Int: 16 }))
    expect(done).toHaveValue('16')
  })

  it('a Yes / No practice explains why it has no colours or score', async () => {
    renderAdmin('/yatra/y1/practice/p4/edit')
    expect(await screen.findByText(/Yes \/ No practices show ✓ in the table/)).toBeInTheDocument()
    expect(screen.queryByText('Colours in the table')).toBeNull()
  })

  it('deletes the practice and goes back to Practices', async () => {
    renderAdmin('/yatra/y1/practice/p1/edit')
    fireEvent.click(await screen.findByRole('button', { name: 'Delete practice' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete practice' }))
    await waitFor(() => expect(api.deleteYatraPractice).toHaveBeenCalledWith('y1', 'p1'))
    expect(await screen.findByRole('heading', { name: 'Practices' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run — expect FAIL.**

- [ ] **Step 4: Implement `RangeBar.tsx`**

```tsx
import { ZONE_BG } from '../../yatrasLogic'
import type { Bar, ScoredType } from '../zones'
import { formatValue, fromNumber } from '../zones'

function Marker({ at, label, stem }: { at: number; label: string; stem: string }) {
  return (
    <span className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center gap-0.5" style={{ left: `${at}%` }}>
      <span className="rounded-md bg-ui-primary px-1.5 py-0.5 font-ui-mono text-[11px] font-semibold whitespace-nowrap text-ui-on-primary">{label}</span>
      <span className={`w-[1.5px] bg-ui-primary ${stem}`} />
    </span>
  )
}

/** Colour zones, bound handles and the ✓ done / ★ bonus thresholds on one scale. Decorative: the text around it says the same. */
export function RangeBar({ bar, dt }: { bar: Bar; dt: ScoredType }) {
  const end = (n: number) => formatValue(fromNumber(n, dt), dt)
  return (
    <div aria-hidden className="flex flex-col gap-0.5 px-3">
      <div className="relative h-[50px]">
        {bar.done && <Marker at={bar.done.at} label={`✓ ${formatValue(bar.done.value, dt)}`} stem="h-2" />}
        {bar.bonus && <Marker at={bar.bonus.at} label={`★ ${formatValue(bar.bonus.value, dt)}`} stem="h-7" />}
      </div>
      <div className="relative flex h-7 items-center">
        <div className="relative h-3.5 w-full overflow-hidden rounded-[7px] bg-ui-chip">
          {bar.segments.map((s, i) => (
            <span key={i} className={`absolute inset-y-0 ${ZONE_BG[s.colour] || 'bg-ui-chip'}`} style={{ left: `${s.left}%`, width: `${s.width}%` }} />
          ))}
        </div>
        {bar.ticks.map((tk, i) => (
          <span key={i} className="absolute top-1/2 -mt-[13px] -ml-[13px] h-[26px] w-[26px] rounded-full border-2 border-ui-ink bg-ui-surface shadow-[0_2px_6px_rgba(0,0,0,.25)]"
            style={{ left: `${tk.at}%` }} />
        ))}
      </div>
      <div className="relative h-[18px] font-ui-mono text-[11px]">
        <span className="absolute -left-3 text-ui-faint2">{end(bar.min)}</span>
        <span className="absolute -right-3 text-ui-faint2">{end(bar.max)}</span>
        {bar.ticks.map((tk, i) => (
          <span key={i} className="absolute -translate-x-1/2 text-xs font-semibold text-ui-ink" style={{ left: `${tk.at}%` }}>{formatValue(tk.value, dt)}</span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implement `PracticeEditorMobile.tsx`**

```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { BetterDirection, YatraPractice, ZoneColour } from '../../../../types/api'
import { SegmentedControl } from '../../../../ui/primitives/SegmentedControl'
import { ZONE_BG } from '../../yatrasLogic'
import { useDebouncedCommit } from '../useDebouncedCommit'
import { useYatraAdmin } from '../useYatraAdmin'
import type { FieldError, ScoredType } from '../zones'
import {
  aboveColour, barGeometry, bonusOf, checkBounds, checkScore, formatValue, greenStart, isScored, paletteZones, scoreConfig, zoneCount, zoneSamples,
} from '../zones'
import { AdminPage, BTN, CARD, FIELD, HINT, SECTION_TITLE } from './AdminPage'
import { AutosaveText } from './fields'
import { DeletePracticeSheet } from './PracticeSheets'
import { zoneKey } from './summaries'
import { TypeChip } from './TypeChip'

const EMPTY_COLOURS: ZoneColour[] = ['Neutral', 'Red', 'Yellow', 'Green']
const PLACEHOLDER: Record<ScoredType, string> = { Int: '', Duration: '1:30', Time: '05:30' }
const LABEL = 'text-[13px] font-bold text-ui-muted'

export function PracticeEditorMobile() {
  const { t } = useTranslation()
  const { id = '', practice_id = '' } = useParams()
  const navigate = useNavigate()
  const a = useYatraAdmin(id)
  const [deleting, setDeleting] = useState(false)
  const p = a.practices.find((x) => x.id === practice_id)
  const back = `/yatra/${id}/admin/practices`
  return (
    <AdminPage admin={a} title={p?.practice ?? ''} back={{ to: back, label: t('yatraSettings.practices') }}>
      {() => !p ? <Navigate to={back} replace /> : (
        <>
          <section className={`${CARD} flex flex-col gap-4 p-4`}>
            <AutosaveText id="practice-name" label={t('yatraSettings.name')} value={p.practice}
              validate={(v) => (v.trim() ? null : t('yatraSettings.nameEmpty'))}
              onCommit={(v) => a.savePractice({ ...p, practice: v.trim() }, t('yatraSettings.renamed'))} />
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>{t('yatraSettings.type')}</span>
              <div className="flex flex-wrap items-center gap-2">
                <TypeChip type={p.data_type} />
                <span className={HINT}>{t('yatraSettings.typeSet')}</span>
              </div>
            </div>
          </section>
          {isScored(p.data_type) ? (
            <>
              <ColoursAndScore p={p} dt={p.data_type} save={(next) => a.savePractice(next, t('common.saved'))} />
              <p className="flex items-center gap-1.5 px-1.5 text-xs font-semibold text-ui-muted">
                <span className="h-[7px] w-[7px] rounded-full bg-ui-good" />{t('yatraSettings.savedAsYouEdit')}
              </p>
            </>
          ) : (
            <section className={`${CARD} flex flex-col gap-1.5 p-4`}>
              <h2 className={SECTION_TITLE}>{t('yatraSettings.noZonesTitle')}</h2>
              <p className={HINT}>{t(p.data_type === 'Bool' ? 'yatraSettings.noZonesBool' : 'yatraSettings.noZonesText')}</p>
            </section>
          )}
          <button type="button" onClick={() => setDeleting(true)} className={`${BTN} border border-ui-control bg-ui-surface text-ui-danger`}>
            {t('yatraSettings.deletePractice')}
          </button>
          {deleting && (
            <DeletePracticeSheet practice={p} statCount={a.statCount(p.id)} busy={a.deletePractice.isPending} onClose={() => setDeleting(false)}
              onConfirm={() => a.deletePractice.mutate(p, { onSuccess: () => navigate(back, { replace: true }), onSettled: () => setDeleting(false) })} />
          )}
        </>
      )}
    </AdminPage>
  )
}

interface Drafts { bounds: string[]; done: string; bonus: string }

const draftsOf = (p: YatraPractice, dt: ScoredType): Drafts => ({
  bounds: (p.colour_zones?.bounds ?? []).map((b) => formatValue(b.to, dt)),
  done: formatValue(p.daily_score?.mandatory_threshold, dt),
  bonus: formatValue(bonusOf(p.daily_score), dt),
})

/** A missing field and null are the same config. */
const sameConfig = (x: YatraPractice, y: YatraPractice) =>
  JSON.stringify([x.colour_zones ?? null, x.daily_score ?? null]) === JSON.stringify([y.colour_zones ?? null, y.daily_score ?? null])

function errorText(e: FieldError, dt: ScoredType, t: TFunction): string {
  if (e.kind === 'format') return t(`yatraSettings.format${dt}`)
  if (e.kind === 'order') return t('yatraSettings.mustBeAbove', { value: formatValue(e.than, dt), colour: t(zoneKey(e.colour)) })
  return t(e.dir === 'Higher' ? 'yatraSettings.bonusAtLeast' : 'yatraSettings.bonusAtMost', { value: formatValue(e.done, dt) })
}

function ColoursAndScore({ p, dt, save }: { p: YatraPractice; dt: ScoredType; save: (next: YatraPractice) => void }) {
  const { t } = useTranslation()
  const count = zoneCount(p.colour_zones)
  const zones = count ? p.colour_zones! : null
  const score = p.daily_score ?? null
  const [dirChoice, setDirChoice] = useState<BetterDirection | null>(null)
  const scoreDir = score?.better_direction ?? dirChoice ?? zones?.better_direction ?? 'Higher'
  const follows = !!zones && scoreDir === zones.better_direction

  const [drafts, setDrafts] = useState(() => draftsOf(p, dt))
  const [editing, setEditing] = useState(false)
  const [seen, setSeen] = useState(p)
  // Follow saves, Undo and refetches, but never rewrite the field being typed in.
  if (p !== seen) {
    setSeen(p)
    if (!editing) setDrafts(draftsOf(p, dt))
  }

  const bounds = checkBounds(drafts.bounds, zones?.bounds.map((b) => b.colour) ?? [], dt)
  const thresholds = checkScore(drafts.done, drafts.bonus, scoreDir, dt)

  /** The saved practice with every valid draft applied; invalid drafts keep what's saved. */
  const fromDrafts = (): YatraPractice => ({
    ...p,
    colour_zones: zones && bounds.ok ? { ...zones, bounds: zones.bounds.map((b, i) => ({ ...b, to: bounds.values[i] })) } : p.colour_zones,
    daily_score: thresholds.ok ? scoreConfig(scoreDir, thresholds.values[0], thresholds.values[1]) : p.daily_score,
  })
  const { schedule, flush } = useDebouncedCommit(() => {
    const next = fromDrafts()
    if (!sameConfig(next, p)) save(next)
  })
  // Immediate changes build on the drafts too; the pending debounced commit then finds nothing new.
  const saveNow = (change: (base: YatraPractice) => YatraPractice) => save(change(fromDrafts()))

  const setCount = (c: string) => saveNow((b) => ({
    ...b, colour_zones: c === '0' ? null : paletteZones(Number(c) as 2 | 3, b.colour_zones?.better_direction ?? scoreDir, b.colour_zones),
  }))
  const setZoneDir = (d: BetterDirection) => saveNow((b) => ({
    ...b,
    colour_zones: paletteZones(count as 2 | 3, d, b.colour_zones),
    daily_score: follows && b.daily_score ? { ...b.daily_score, better_direction: d } : b.daily_score,
  }))
  const setEmpty = (c: ZoneColour) => saveNow((b) => ({ ...b, colour_zones: { ...b.colour_zones!, no_value_colour: c } }))
  function setScoreDir(choice: string) {
    const d = (choice === 'same' ? zones!.better_direction : choice) as BetterDirection
    if (score) saveNow((b) => ({ ...b, daily_score: b.daily_score ? { ...b.daily_score, better_direction: d } : b.daily_score }))
    else setDirChoice(d)
  }
  const green = zones && follows ? greenStart(zones, dt) : null
  function doneAtGreen() {
    setDrafts((d) => ({ ...d, done: formatValue(green, dt) }))
    saveNow((b) => ({ ...b, daily_score: scoreConfig(scoreDir, green, bonusOf(b.daily_score)) }))
  }

  const field = (key: 'done' | 'bonus' | number) => ({
    value: typeof key === 'number' ? drafts.bounds[key] ?? '' : drafts[key],
    onFocus: () => setEditing(true),
    onBlur: () => { setEditing(false); flush() },
    onChange: (v: string) => {
      setDrafts((d) => (typeof key === 'number' ? { ...d, bounds: d.bounds.map((x, j) => (j === key ? v : x)) } : { ...d, [key]: v }))
      schedule()
    },
  })

  const bar = barGeometry(p.colour_zones, p.daily_score, dt)
  const lastBound = zones && [...zones.bounds].reverse().find((b) => b.to)
  const op = scoreDir === 'Higher' ? '≥' : '≤'
  const savedDone = formatValue(score?.mandatory_threshold, dt)
  const savedBonus = formatValue(bonusOf(score), dt)
  const summary = savedDone && savedBonus ? t('yatraSettings.scoreDoneBonus', { op, done: savedDone, bonus: savedBonus })
    : savedDone ? t('yatraSettings.scoreDone', { op, done: savedDone })
    : savedBonus ? t('yatraSettings.scoreBonus', { op, bonus: savedBonus })
    : t('yatraSettings.scoreNone')
  const dirOptions = [{ value: 'Higher', label: t('yatraSettings.higher') }, { value: 'Lower', label: t('yatraSettings.lower') }]

  return (
    <>
      <section className={`${CARD} flex flex-col gap-4 p-4`}>
        <div className="flex flex-col gap-0.5">
          <h2 className={SECTION_TITLE}>{t('yatraSettings.coloursTitle')}</h2>
          <p className={HINT}>{t('yatraSettings.coloursHint')}</p>
        </div>
        <SegmentedControl label={t('yatraSettings.colours')} value={String(count)} onChange={setCount} options={[
          { value: '0', label: t('yatraSettings.coloursOff') },
          { value: '2', label: t('yatraSettings.colours2') },
          { value: '3', label: t('yatraSettings.colours3') },
        ]} />
        {zones && (
          <>
            <Row label={t('yatraSettings.betterWhen')}>
              <SegmentedControl label={t('yatraSettings.betterWhen')} value={zones.better_direction} options={dirOptions}
                onChange={(d) => setZoneDir(d as BetterDirection)} />
            </Row>
            {bar && <RangeBar bar={bar} dt={dt} />}
            <div className="grid grid-cols-2 gap-2.5">
              {zones.bounds.map((b, i) => (
                <ValueField key={i} id={`bound-${i}`} dt={dt} {...field(i)} error={bounds.errors[i] && errorText(bounds.errors[i]!, dt, t)}
                  label={<><Swatch colour={b.colour} />{t('yatraSettings.upTo', { colour: t(zoneKey(b.colour)) })}</>} />
              ))}
            </div>
            {lastBound && (
              <p className="text-sm font-semibold text-ui-ink2">
                {t('yatraSettings.aboveBest', { value: formatValue(lastBound.to, dt), colour: t(zoneKey(aboveColour(zones))) })}
              </p>
            )}
            {!bounds.ok && <p className="text-xs font-semibold text-ui-danger">{t('yatraSettings.notSavedYet')}</p>}
            <div className="flex flex-col gap-2">
              <span className={LABEL}>{t('yatraSettings.emptyCell')}</span>
              <div className="overflow-x-auto">
                <SegmentedControl label={t('yatraSettings.emptyCell')} value={zones.no_value_colour} onChange={(c) => setEmpty(c as ZoneColour)}
                  options={EMPTY_COLOURS.map((c) => ({ value: c, label: t(zoneKey(c)) }))} />
              </div>
            </div>
            {bar && bar.segments.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className={LABEL}>{t('yatraSettings.inTable')}</span>
                <div className="flex gap-1.5">
                  {[...zoneSamples(bar, zones, dt).map((s) => ({ text: formatValue(s.value, dt), colour: s.colour })),
                    { text: t('yatraSettings.emptySample'), colour: zones.no_value_colour }].map((c, i) => (
                    <span key={i} className={`flex h-10 min-w-0 flex-1 items-center justify-center rounded-[10px] font-ui-mono text-[13px] font-semibold text-ui-ink ${ZONE_BG[c.colour] || 'bg-ui-chip'}`}>
                      {c.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className={`${CARD} flex flex-col gap-4 p-4`}>
        <div className="flex flex-col gap-0.5">
          <h2 className={SECTION_TITLE}>{t('yatraSettings.scoreTitle')}</h2>
          <p className={HINT}>{t('yatraSettings.scoreHint')}</p>
        </div>
        {!zones && bar && <RangeBar bar={bar} dt={dt} />}
        <p className="text-sm font-semibold text-ui-ink2">{summary}</p>
        <Row label={t('yatraSettings.betterWhen')}>
          <SegmentedControl label={t('yatraSettings.scoreBetterWhen')} value={follows ? 'same' : scoreDir} onChange={setScoreDir}
            options={zones ? [{ value: 'same', label: t('yatraSettings.sameAsColours') }, ...dirOptions] : dirOptions} />
        </Row>
        <div className="grid grid-cols-2 gap-2.5">
          <ValueField id="score-done" dt={dt} label={t('yatraSettings.doneAt')} {...field('done')}
            error={thresholds.errors[0] && errorText(thresholds.errors[0]!, dt, t)} />
          <ValueField id="score-bonus" dt={dt} label={t('yatraSettings.bonusAt')} {...field('bonus')}
            error={thresholds.errors[1] && errorText(thresholds.errors[1]!, dt, t)} />
        </div>
        {green && formatValue(green, dt) !== drafts.done && (
          <button type="button" onClick={doneAtGreen} className="self-start rounded-full bg-ui-accent-soft px-3 py-1.5 text-[13px] font-bold text-ui-accent">
            {t('yatraSettings.doneWhereGreen', { colour: t(zoneKey('Green')) })}
          </button>
        )}
        <p className={HINT}>{t('yatraSettings.bonusNote')}</p>
      </section>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2">
      <span className="text-sm font-bold text-ui-ink">{label}</span>
      {children}
    </div>
  )
}

function Swatch({ colour }: { colour: ZoneColour }) {
  return <span aria-hidden className={`h-3 w-3 shrink-0 rounded ${ZONE_BG[colour] || 'bg-ui-chip'}`} />
}

function ValueField({ id, label, dt, value, error, onChange, onFocus, onBlur }: {
  id: string; label: ReactNode; dt: ScoredType; value: string; error?: string | null | false
  onChange: (v: string) => void; onFocus: () => void; onBlur: () => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-bold leading-[1.35] text-ui-muted">{label}</label>
      <input id={id} value={value} inputMode={dt === 'Int' ? 'numeric' : 'text'} placeholder={PLACEHOLDER[dt]} aria-invalid={!!error}
        className={`${FIELD} font-ui-mono`} onFocus={onFocus} onBlur={onBlur} onChange={(e) => onChange(e.target.value)} />
      {error && <p role="alert" className="text-xs font-semibold text-ui-danger">{error}</p>}
    </div>
  )
}
```

Add the `RangeBar` import: `import { RangeBar } from './RangeBar'`.

- [ ] **Step 6: Route** — in `src/router.tsx` add

```tsx
const PracticeEditorMobile = lazy(() => import('./features/yatras/settings/mobile/PracticeEditorMobile').then((m) => ({ default: m.PracticeEditorMobile })))
```

then remove `{ path: '/yatra/:id/practice/:practice_id/edit', element: <YatraPracticeEditPage /> }` from the `AppShell` children and add next to the admin entries:

```tsx
      {
        path: '/yatra/:id/practice/:practice_id/edit',
        element: <ByLayout mobile={<PracticeEditorMobile />} legacy={<AppShell />} />,
        children: [{ index: true, element: <YatraPracticeEditPage /> }],
      },
```

- [ ] **Step 7: Run — expect PASS.** `npx vitest run src/features/yatras/settings`

- [ ] **Step 8: Commit**

```bash
git add app-react/src app-react/public/locales
git commit -m "feat(yatras): mobile practice editor with range bar, colours and daily score"
```

---
### Task 9: Members (12m17–19)

**Files:**
- Create: `app-react/src/features/yatras/settings/mobile/MembersMobile.tsx`
- Modify: `app-react/src/ui/primitives/Toggle.tsx` (`disabled`), `AdminSectionMobile.tsx` (`members`)
- Test: `app-react/src/features/yatras/settings/mobile/MembersMobile.test.tsx`
- Modify: locales

**Interfaces:**
- Consumes: `useYatraAdmin` (`users`, `me`, `toggleAdmin`, `removeMember`); `membersLine`; `SheetHeader`, `ConfirmSheet`; `initials` from `src/ui/initials.ts`; `BottomSheet`; `Toggle`.
- Produces: `Toggle` accepts `disabled?: boolean` (`disabled` attribute + `disabled:opacity-50`).

Rules: the Admin toggle is disabled, with the reason, for the yatra's only admin (which also covers "on yourself only when another admin exists"). Removing yourself isn't offered; Leave yatra covers that. Removing asks first.

**Strings:**

| key | en | ru | uk |
|---|---|---|---|
| oneAdminRule | A yatra always keeps at least one admin. | В ятре всегда остаётся хотя бы один админ. | У ятрі завжди лишається хоча б один адмін. |
| you | You | Вы | Ви |
| adminHint | Can edit practices, members, statistics and yatra settings | Может менять практики, участников, статистику и настройки ятры | Може змінювати практики, учасників, статистику й налаштування ятри |
| lastAdminToggle | The only admin. Make someone else admin first. | Единственный админ. Сначала назначьте другого. | Єдиний адмін. Спершу призначте іншого. |
| removeMember | Remove from yatra | Удалить из ятры | Видалити з ятри |
| removeTitle | Remove {{name}}? | Удалить {{name}}? | Видалити {{name}}? |
| removeText | They'll lose access to this yatra's table. Their own practices and entries stay with them, and they can rejoin with an invite link. | Участник потеряет доступ к таблице ятры. Его практики и записи останутся у него, а вернуться можно по ссылке-приглашению. | Учасник втратить доступ до таблиці ятри. Його практики й записи лишаться в нього, а повернутися можна за посиланням-запрошенням. |
| remove | Remove | Удалить | Видалити |
| memberRemoved | Removed {{name}} | Удалено из ятры: {{name}} | Видалено з ятри: {{name}} |
| adminAdded | {{name}} is now an admin | {{name}} теперь админ | {{name}} тепер адмін |
| adminRemoved | {{name}} is no longer an admin | {{name}} больше не админ | {{name}} більше не адмін |

- [ ] **Step 1: Write the failing test** — `MembersMobile.test.tsx`

```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, renderAdmin } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('MembersMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }) })

  it('lists members with You and Admin badges', async () => {
    mockAdmin(api)
    renderAdmin('/yatra/y1/admin/members')
    expect(await screen.findByText('3 members · 2 admins. A yatra always keeps at least one admin.')).toBeInTheDocument()
    const me = screen.getByRole('button', { name: /Alex das/ })
    expect(within(me).getByText('You')).toBeInTheDocument()
    expect(within(me).getByText('Admin')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /Madhava das/ })).queryByText('Admin')).toBeNull()
  })

  it('makes a member admin, with Undo', async () => {
    mockAdmin(api)
    renderAdmin('/yatra/y1/admin/members')
    fireEvent.click(await screen.findByRole('button', { name: /Madhava das/ }))
    const sheet = screen.getByRole('dialog', { name: 'Madhava das' })
    fireEvent.click(within(sheet).getByRole('switch', { name: 'Admin' }))
    expect(within(sheet).getByRole('switch', { name: 'Admin' })).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(api.toggleAdmin).toHaveBeenCalledWith('y1', 'u3'))
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('removes a member after asking', async () => {
    mockAdmin(api)
    renderAdmin('/yatra/y1/admin/members')
    fireEvent.click(await screen.findByRole('button', { name: /Madhava das/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove from yatra' }))
    const confirm = screen.getByRole('dialog', { name: 'Remove Madhava das?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('y1', 'u3'))
  })

  it("the only admin can't drop the role or remove themselves", async () => {
    mockAdmin(api, { users: [{ user_id: 'u1', user_name: 'Alex das', is_admin: true }, { user_id: 'u3', user_name: 'Madhava das', is_admin: false }] })
    renderAdmin('/yatra/y1/admin/members')
    fireEvent.click(await screen.findByRole('button', { name: /Alex das/ }))
    const sheet = screen.getByRole('dialog', { name: 'Alex das' })
    expect(within(sheet).getByRole('switch', { name: 'Admin' })).toBeDisabled()
    expect(within(sheet).getByText('The only admin. Make someone else admin first.')).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Remove from yatra' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

`Toggle.tsx`:

```tsx
interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-11 h-[26px] shrink-0 rounded-full p-[3px] flex transition-colors disabled:opacity-50 ${checked ? 'bg-ui-accent-fill justify-end' : 'bg-ui-toggle-off justify-start'}`}
    >
      <span className={`w-5 h-5 rounded-full ${checked ? 'bg-ui-toggle-on-knob' : 'bg-ui-toggle-off-knob'}`} />
    </button>
  )
}
```

`MembersMobile.tsx`:

```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { initials } from '../../../../ui/initials'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import { Toggle } from '../../../../ui/primitives/Toggle'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, BTN, CARD, HINT, LIST } from './AdminPage'
import { ConfirmSheet, SheetHeader } from './fields'
import { membersLine } from './summaries'

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ui-accent-pill text-sm font-extrabold text-ui-accent">
      {initials(name)}
    </span>
  )
}

function Badge({ accent, children }: { accent?: boolean; children: ReactNode }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${accent ? 'bg-ui-accent-pill text-ui-accent' : 'bg-ui-chip text-ui-ink2'}`}>
      {children}
    </span>
  )
}

export function MembersMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const a = useYatraAdmin(id)
  const [openId, setOpenId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const close = () => { setOpenId(null); setRemoving(false) }
  return (
    <AdminPage admin={a} title={t('yatraSettings.membersTitle')}>
      {() => {
        const member = a.users.find((u) => u.user_id === openId)
        const lastAdmin = !!member?.is_admin && a.users.filter((u) => u.is_admin).length === 1
        const isMe = !!member && member.user_id === a.me?.user_id
        return (
          <>
            <p className={`${HINT} px-1.5`}>{`${membersLine(t, a.users)}. ${t('yatraSettings.oneAdminRule')}`}</p>
            <ul className={LIST}>
              {a.users.map((u) => (
                <li key={u.user_id}>
                  <button type="button" onClick={() => setOpenId(u.user_id)} className="flex min-h-[60px] w-full items-center gap-3 bg-ui-surface px-4 py-2 text-left">
                    <Avatar name={u.user_name} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ui-ink">{u.user_name}</span>
                    {u.user_id === a.me?.user_id && <Badge>{t('yatraSettings.you')}</Badge>}
                    {u.is_admin && <Badge accent>{t('yatraSettings.admin')}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
            {member && !removing && (
              <BottomSheet label={member.user_name} onClose={close}>
                <SheetHeader title={member.user_name} onClose={close}><Avatar name={member.user_name} /></SheetHeader>
                <div className={`${CARD} flex items-start gap-3 p-4`}>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[15px] font-bold text-ui-ink">{t('yatraSettings.admin')}</span>
                    <span className={HINT}>{lastAdmin ? t('yatraSettings.lastAdminToggle') : t('yatraSettings.adminHint')}</span>
                  </div>
                  <Toggle checked={member.is_admin} disabled={lastAdmin} label={t('yatraSettings.admin')} onChange={() => a.toggleAdmin(member)} />
                </div>
                {!isMe && (
                  <button type="button" onClick={() => setRemoving(true)} className={`${BTN} border border-ui-control text-ui-danger`}>
                    {t('yatraSettings.removeMember')}
                  </button>
                )}
              </BottomSheet>
            )}
            {member && removing && (
              <ConfirmSheet title={t('yatraSettings.removeTitle', { name: member.user_name })} text={t('yatraSettings.removeText')}
                confirm={t('yatraSettings.remove')} busy={a.removeMember.isPending} onClose={close}
                onConfirm={() => a.removeMember.mutate(member, { onSettled: close })} />
            )}
          </>
        )
      }}
    </AdminPage>
  )
}
```

(An admin who turns off their own Admin role (allowed when another admin exists) loses access at once. `AdminPage` then sends them to the member page, where the Undo toast is still shown; the server refuses that Undo because they're no longer an admin, so it shows the error toast. Acceptable for this rare path.)

`AdminSectionMobile.tsx`: add `members: <MembersMobile />`.

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/features/yatras/settings src/ui`

- [ ] **Step 5: Commit**

```bash
git add app-react/src app-react/public/locales
git commit -m "feat(yatras): mobile Members page with admin toggle and remove"
```

---

### Task 10: Statistics (12m20–21)

**Files:**
- Create: `app-react/src/features/yatras/settings/mobile/StatisticsMobile.tsx`
- Modify: `fields.tsx` (`ChoiceChips`), `summaries.ts` (`aggLabel`), `AdminSectionMobile.tsx` (`statistics`)
- Test: `app-react/src/features/yatras/settings/mobile/StatisticsMobile.test.tsx`
- Modify: locales

**Interfaces:**
- Consumes: `statistics.ts` (Task 4); `useYatraAdmin.saveYatra`; `yatrasApi.getYatraData`; `toDateStr` from `src/features/today/date.ts`; `AutosaveText`, `ConfirmSheet`, `SheetHeader`; `SegmentedControl`; `TypeIcon`, `typeLabelKey`.
- Produces:
  - `ChoiceChips<T extends string>({ label, value, options, onChange })`: a wrapping radiogroup of chips.
  - `aggLabel(t, agg: Aggregation, dt?: PracticeDataType): string` (Time Min/Max read "Min (earliest)" / "Max (latest)").

Behaviour:
- Tile values come from today's `GET /yatra/:id/data`, matched to the config by position. The query key `['yatra-data', id, today]` is the one the Yatra screen uses, so saves refresh both.
- "Visible to" saves `statistics.visible_to_all`. When no config exists yet, it starts from `{ visible_to_all: false, statistics: [] }`.
- Each sheet change saves at once with Undo. The label saves on the debounce. A new statistic is added on its first change, and later changes update it. Closing a new sheet without changes adds nothing.
- Delete statistic asks first, then saves with no Undo.

**Strings:**

| key | en | ru | uk |
|---|---|---|---|
| visibleTo | Visible to | Кому видно | Кому видно |
| visibleAdmins | Admins | Админам | Адмінам |
| visibleAll | Everyone | Всем | Усім |
| visibleHint | Tiles sit above the yatra table. | Плитки показываются над таблицей ятры. | Плитки показуються над таблицею ятри. |
| preview | Preview | Предпросмотр | Попередній перегляд |
| times | times | раз | разів |
| aggSum | Sum | Сумма | Сума |
| aggAvg | Average | Среднее | Середнє |
| aggMin | Min | Минимум | Мінімум |
| aggMax | Max | Максимум | Максимум |
| aggCount | Count | Количество | Кількість |
| aggMinTime | Min (earliest) | Мин. (самое раннее) | Мін. (найраніше) |
| aggMaxTime | Max (latest) | Макс. (самое позднее) | Макс. (найпізніше) |
| rangeLast7Days | Last 7 days | Последние 7 дней | Останні 7 днів |
| rangeLast30Days | Last 30 days | Последние 30 дней | Останні 30 днів |
| rangeLast90Days | Last 90 days | Последние 90 дней | Останні 90 днів |
| rangeLast365Days | Last 365 days | Последние 365 дней | Останні 365 днів |
| rangeThisWeek | This week | Эта неделя | Цей тиждень |
| rangeThisMonth | This month | Этот месяц | Цей місяць |
| rangeThisQuarter | This quarter | Этот квартал | Цей квартал |
| rangeThisYear | This year | Этот год | Цей рік |
| addStatistic | + Add statistic | + Добавить статистику | + Додати статистику |
| newStatistic | New statistic | Новая статистика | Нова статистика |
| editStatistic | Edit statistic | Изменить статистику | Змінити статистику |
| tilePreview | Tile preview | Как выглядит плитка | Як виглядає плитка |
| label | Label | Подпись | Підпис |
| labelEmpty | Label can't be empty | Подпись не может быть пустой | Підпис не може бути порожнім |
| practice | Practice | Практика | Практика |
| aggregation | Aggregation | Расчёт | Розрахунок |
| noSumForTime | Sum isn't offered: adding up times of day has no meaning. | Суммы нет: складывать время суток бессмысленно. | Суми немає: додавати час доби немає сенсу. |
| timeRange | Time range | Период | Період |
| deleteStat | Delete statistic | Удалить статистику | Видалити статистику |
| deleteStatTitle | Delete “{{label}}”? | Удалить «{{label}}»? | Видалити «{{label}}»? |
| deleteStatText | The tile is removed for everyone. | Плитка пропадёт у всех. | Плитка зникне в усіх. |
| statAdded | Statistic added | Статистика добавлена | Статистику додано |
| statDeleted | Statistic deleted | Статистика удалена | Статистику видалено |

- [ ] **Step 1: Write the failing test** — `StatisticsMobile.test.tsx`

```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, renderAdmin } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)
const sentStats = () => api.updateYatra.mock.calls.at(-1)![1].statistics!

async function openStat(label: string) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${label}`) }))
  return screen.getByRole('dialog', { name: 'Edit statistic' })
}

describe('StatisticsMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })

  it("previews the tiles with today's values", async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    expect(await screen.findByText('15.8')).toBeInTheDocument()
    expect(screen.getByText('03:55')).toBeInTheDocument()
    expect(screen.getAllByText('Min (earliest) · Last 7 days').length).toBeGreaterThan(0)
  })

  it('Visible to Admins keeps the statistics', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    fireEvent.click(await screen.findByRole('radio', { name: 'Admins' }))
    await waitFor(() => expect(api.updateYatra).toHaveBeenCalledOnce())
    expect(sentStats().visible_to_all).toBe(false)
    expect(sentStats().statistics).toHaveLength(2)
  })

  it('offers only aggregations that fit the practice', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    const sheet = await openStat('Earliest wake-up')
    const aggs = within(within(sheet).getByRole('radiogroup', { name: 'Aggregation' })).getAllByRole('radio').map((r) => r.textContent)
    expect(aggs).toEqual(['Average', 'Min (earliest)', 'Max (latest)', 'Count'])
    expect(within(sheet).getByText("Sum isn't offered: adding up times of day has no meaning.")).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Count' }))
    await waitFor(() => expect(sentStats().statistics[1].aggregation).toBe('Count'))
  })

  it('switches to Count when the new practice cannot take the aggregation', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    const sheet = await openStat('Average japa')
    fireEvent.change(within(sheet).getByLabelText('Practice'), { target: { value: 'p4' } })
    await waitFor(() => expect(sentStats().statistics[0]).toMatchObject({ practice_id: 'p4', aggregation: 'Count' }))
  })

  it('adds a new statistic on its first change, and not before', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    fireEvent.click(await screen.findByRole('button', { name: '+ Add statistic' }))
    const sheet = screen.getByRole('dialog', { name: 'New statistic' })
    expect(api.updateYatra).not.toHaveBeenCalled()
    fireEvent.click(within(sheet).getByRole('radio', { name: 'This week' }))
    await waitFor(() => expect(sentStats().statistics).toHaveLength(3))
    expect(sentStats().statistics[2]).toEqual({ label: 'Japa rounds', practice_id: 'p1', aggregation: 'Avg', time_range: 'ThisWeek' })
  })

  it('closing a new statistic untouched adds nothing', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    fireEvent.click(await screen.findByRole('button', { name: '+ Add statistic' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.updateYatra).not.toHaveBeenCalled()
  })

  it('deletes a statistic after asking', async () => {
    renderAdmin('/yatra/y1/admin/statistics')
    const sheet = await openStat('Average japa')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete statistic' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete “Average japa”?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete statistic' }))
    await waitFor(() => expect(sentStats().statistics.map((s) => s.label)).toEqual(['Earliest wake-up']))
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

`fields.tsx`: add

```tsx
/** A wrapping set of chips; picks one. */
export function ChoiceChips<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden className="text-[13px] font-bold text-ui-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
            className={`min-h-9 rounded-full px-3.5 text-[13px] font-bold ${o.value === value ? 'bg-ui-selected text-ui-on-selected' : 'bg-ui-chip text-ui-ink2'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

`summaries.ts`: add

```ts
import type { Aggregation, PracticeDataType } from '../../../../types/api'

/** For times of day, Min and Max read "earliest" and "latest". */
export const aggLabel = (t: TFunction, agg: Aggregation, dt?: PracticeDataType) =>
  t(dt === 'Time' && (agg === 'Min' || agg === 'Max') ? `yatraSettings.agg${agg}Time` : `yatraSettings.agg${agg}`)
```

`StatisticsMobile.tsx`:

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../../../api/yatras'
import type { PracticeDataType, YatraPractice, YatraStatisticConfig } from '../../../../types/api'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import { SegmentedControl } from '../../../../ui/primitives/SegmentedControl'
import { toDateStr } from '../../../today/date'
import type { DurationUnits } from '../../../today/values'
import { aggregationsFor, newStatistic, statValue, TIME_RANGES, withPractice } from '../statistics'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, BTN, CARD, FIELD, HINT, LIST } from './AdminPage'
import { AutosaveText, ChoiceChips, ConfirmSheet, SheetHeader } from './fields'
import { aggLabel } from './summaries'
import { TypeIcon, typeLabelKey } from './TypeChip'

export function StatisticsMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const a = useYatraAdmin(id)
  const today = toDateStr(new Date())
  const dataQ = useQuery({ queryKey: ['yatra-data', id, today], queryFn: () => yatrasApi.getYatraData(id, today) })
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  return (
    <AdminPage admin={a} title={t('yatraSettings.statistics')}>
      {() => {
        const cfg = a.yatra!.statistics ?? { visible_to_all: false, statistics: [] }
        const list = cfg.statistics
        const practiceOf = (s: YatraStatisticConfig) => a.practices.find((p) => p.id === s.practice_id)
        const setList = (statistics: YatraStatisticConfig[], message: string, undoable = true) =>
          a.saveYatra({ statistics: { ...cfg, statistics } }, message, undoable)
        const raw = (i: number) => dataQ.data?.statistics[i]?.value
        const draft = editing === 'new' ? newStatistic(a.practices) : editing === null ? null : list[editing]

        function onChange(next: YatraStatisticConfig) {
          if (editing === 'new') {
            setList([...list, next], t('yatraSettings.statAdded'))
            setEditing(list.length)
          } else if (editing !== null) {
            setList(list.map((s, i) => (i === editing ? next : s)), t('common.saved'))
          }
        }

        return (
          <>
            <section className={`${CARD} flex flex-col gap-2 p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2">
                <span className="text-sm font-bold text-ui-ink">{t('yatraSettings.visibleTo')}</span>
                <SegmentedControl label={t('yatraSettings.visibleTo')} value={cfg.visible_to_all ? 'all' : 'admins'}
                  onChange={(v) => a.saveYatra({ statistics: { ...cfg, visible_to_all: v === 'all' } }, t('common.saved'))}
                  options={[{ value: 'admins', label: t('yatraSettings.visibleAdmins') }, { value: 'all', label: t('yatraSettings.visibleAll') }]} />
              </div>
              <p className={HINT}>{t('yatraSettings.visibleHint')}</p>
            </section>
            {list.length > 0 && (
              <section aria-label={t('yatraSettings.preview')} className="flex flex-col gap-2">
                <h2 className="px-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{t('yatraSettings.preview')}</h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {list.map((s, i) => <Tile key={i} stat={s} dt={practiceOf(s)?.data_type} raw={raw(i)} units={units} />)}
                </div>
              </section>
            )}
            {list.length > 0 && (
              <div className={LIST}>
                {list.map((s, i) => {
                  const p = practiceOf(s)
                  return (
                    <button key={i} type="button" onClick={() => setEditing(i)} className="flex min-h-[60px] items-center gap-3 bg-ui-surface px-4 py-2 text-left">
                      {p && <TypeIcon type={p.data_type} />}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-bold text-ui-ink">{s.label}</span>
                        <span className="text-xs text-ui-muted">
                          {`${p?.practice ?? '—'} · ${aggLabel(t, s.aggregation, p?.data_type)} · ${t(`yatraSettings.range${s.time_range}`)}`}
                        </span>
                      </span>
                      <span aria-hidden className="text-lg text-ui-faint2">›</span>
                    </button>
                  )
                })}
              </div>
            )}
            <button type="button" disabled={!a.practices.length} onClick={() => setEditing('new')}
              className={`${BTN} border border-dashed border-ui-control bg-ui-surface text-ui-accent disabled:opacity-50`}>
              {t('yatraSettings.addStatistic')}
            </button>
            {draft && (
              // One sheet for add and edit: a new statistic becomes an edited one after its first change.
              <StatisticSheet key="statistic" initial={draft} isNew={editing === 'new'} practices={a.practices} units={units}
                raw={typeof editing === 'number' ? raw(editing) : undefined} onChange={onChange} onClose={() => setEditing(null)}
                onDelete={() => {
                  setList(list.filter((_, i) => i !== editing), t('yatraSettings.statDeleted'), false)
                  setEditing(null)
                }} />
            )}
          </>
        )
      }}
    </AdminPage>
  )
}

function Tile({ stat, dt, raw, units }: { stat: YatraStatisticConfig; dt?: PracticeDataType; raw: unknown; units: DurationUnits }) {
  const { t } = useTranslation()
  return (
    <div className={`${CARD} flex min-w-0 flex-col gap-1 p-3.5`}>
      <span className="truncate text-xs font-bold text-ui-muted">{stat.label}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-[22px] font-extrabold tracking-[-0.01em] text-ui-ink">{statValue(raw, stat.aggregation, dt ?? 'Int', units)}</span>
        {stat.aggregation === 'Count' && <span className="text-xs text-ui-muted">{t('yatraSettings.times')}</span>}
      </span>
      <span className="text-[11px] text-ui-muted">{`${aggLabel(t, stat.aggregation, dt)} · ${t(`yatraSettings.range${stat.time_range}`)}`}</span>
    </div>
  )
}

function StatisticSheet({ initial, isNew, practices, units, raw, onChange, onDelete, onClose }: {
  initial: YatraStatisticConfig; isNew: boolean; practices: YatraPractice[]; units: DurationUnits; raw: unknown
  onChange: (s: YatraStatisticConfig) => void; onDelete: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(initial)
  const [confirming, setConfirming] = useState(false)
  const dt = practices.find((p) => p.id === draft.practice_id)?.data_type ?? 'Int'
  const change = (next: YatraStatisticConfig) => {
    setDraft(next)
    if (next.label.trim()) onChange(next)
  }
  if (confirming) {
    return (
      <ConfirmSheet title={t('yatraSettings.deleteStatTitle', { label: draft.label })} text={t('yatraSettings.deleteStatText')}
        confirm={t('yatraSettings.deleteStat')} onConfirm={onDelete} onClose={() => setConfirming(false)} />
    )
  }
  const title = t(isNew ? 'yatraSettings.newStatistic' : 'yatraSettings.editStatistic')
  return (
    <BottomSheet label={title} onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-ui-muted">{t('yatraSettings.tilePreview')}</span>
        <Tile stat={draft} dt={dt} raw={raw} units={units} />
      </div>
      <AutosaveText id="stat-label" label={t('yatraSettings.label')} value={draft.label}
        validate={(v) => (v.trim() ? null : t('yatraSettings.labelEmpty'))} onCommit={(v) => change({ ...draft, label: v.trim() })} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stat-practice" className="text-[13px] font-bold text-ui-muted">{t('yatraSettings.practice')}</label>
        <select id="stat-practice" className={FIELD} value={draft.practice_id}
          onChange={(e) => change(withPractice(draft, practices.find((p) => p.id === e.target.value)!))}>
          {practices.map((p) => <option key={p.id} value={p.id}>{`${p.practice} · ${t(typeLabelKey(p.data_type))}`}</option>)}
        </select>
      </div>
      <ChoiceChips label={t('yatraSettings.aggregation')} value={draft.aggregation} onChange={(g) => change({ ...draft, aggregation: g })}
        options={aggregationsFor(dt).map((g) => ({ value: g, label: aggLabel(t, g, dt) }))} />
      {dt === 'Time' && <p className={HINT}>{t('yatraSettings.noSumForTime')}</p>}
      <ChoiceChips label={t('yatraSettings.timeRange')} value={draft.time_range} onChange={(r) => change({ ...draft, time_range: r })}
        options={TIME_RANGES.map((r) => ({ value: r, label: t(`yatraSettings.range${r}`) }))} />
      <div className="flex gap-2.5">
        {!isNew && (
          <button type="button" onClick={() => setConfirming(true)} className={`${BTN} flex-1 border border-ui-control text-ui-danger`}>
            {t('yatraSettings.deleteStat')}
          </button>
        )}
        <button type="button" onClick={onClose} className={`${BTN} flex-1 bg-ui-primary text-ui-on-primary`}>{t('yatraSettings.done')}</button>
      </div>
    </BottomSheet>
  )
}
```

`AdminSectionMobile.tsx`: add `statistics: <StatisticsMobile />`.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings app-react/public/locales
git commit -m "feat(yatras): mobile Statistics page with tile preview and edit sheet"
```

---

### Task 11: Invite and Danger zone (12m22–23)

**Files:**
- Create: `app-react/src/features/yatras/settings/mobile/InviteMobile.tsx`, `DangerZoneMobile.tsx`
- Modify: `AdminSectionMobile.tsx` (`invite`, `danger`)
- Test: `app-react/src/features/yatras/settings/mobile/InviteDangerMobile.test.tsx`
- Modify: locales

**Interfaces:**
- Consumes: `useYatraAdmin` (`yatra`, `users`, `deleteYatra`); `ConfirmSheet`; `useToast`.
- Produces: the two route elements.

**Strings:**

| key | en | ru | uk |
|---|---|---|---|
| inviteTitle | Invite devotees | Пригласить преданных | Запросити відданих |
| inviteText | Anyone with this link can join {{name}}. After joining they link their own practices. | По этой ссылке любой может вступить в «{{name}}». После вступления участник связывает свои практики. | За цим посиланням будь-хто може вступити до «{{name}}». Після вступу учасник зв’язує свої практики. |
| share | Share link | Поделиться | Поділитися |
| copy | Copy | Копировать | Копіювати |
| copied | Link copied | Ссылка скопирована | Посилання скопійовано |
| shareHint | Share opens your phone's share sheet. | «Поделиться» открывает меню отправки телефона. | «Поділитися» відкриває меню надсилання телефона. |
| dangerText | Removes the table, practices, colours, statistics and member list for everyone. Members keep their own practices and entries. This can't be undone. | Удаляет таблицу, практики, цвета, статистику и список участников у всех. Свои практики и записи участники сохраняют. Это нельзя отменить. | Видаляє таблицю, практики, кольори, статистику і список учасників для всіх. Свої практики й записи учасники зберігають. Це не можна скасувати. |
| deleteYatraTitle | Delete {{name}}? | Удалить «{{name}}»? | Видалити «{{name}}»? |
| deleteYatraText_one / _few / _many / _other | This deletes the yatra for its {{count}} member and can't be undone. / — / — / This deletes the yatra for all {{count}} members and can't be undone. | Ятра удалится у {{count}} участника, и это нельзя отменить. / Ятра удалится у всех {{count}} участников, и это нельзя отменить. (same text for _many and _other) | Ятра видалиться в {{count}} учасника, і це не можна скасувати. / Ятра видалиться в усіх {{count}} учасників, і це не можна скасувати. (same text for _many and _other) |
| typeName | Type the yatra name to confirm | Введите название ятры для подтверждения | Введіть назву ятри для підтвердження |
| typeNameHint | The button turns on when the name matches. | Кнопка включится, когда название совпадёт. | Кнопка ввімкнеться, коли назва збігатиметься. |
| deleteForever | Delete forever | Удалить навсегда | Видалити назавжди |
| yatraDeleted | Deleted {{name}} | Удалено: {{name}} | Видалено: {{name}} |

The Danger zone page's heading reuses `dangerHint` ("Delete yatra"), and its button reuses phase 1's `deleteYatra` ("Delete yatra…").

- [ ] **Step 1: Write the failing test** — `InviteDangerMobile.test.tsx`

```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, renderAdmin } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('InviteMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })
  afterEach(() => { delete (navigator as { share?: unknown }).share })

  it('shows the join link and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderAdmin('/yatra/y1/admin/invite')
    expect(await screen.findByText(`${window.location.host}/yatra/y1/join`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share link' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/yatra/y1/join`)
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
  })

  it('shares through the phone when it can', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    renderAdmin('/yatra/y1/admin/invite')
    fireEvent.click(await screen.findByRole('button', { name: 'Share link' }))
    expect(share).toHaveBeenCalledWith({ title: "Balarama's League", url: `${window.location.origin}/yatra/y1/join` })
  })
})

describe('DangerZoneMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })

  it('deletes only after the exact name is typed', async () => {
    renderAdmin('/yatra/y1/admin/danger')
    fireEvent.click(await screen.findByRole('button', { name: 'Delete yatra…' }))
    const sheet = screen.getByRole('dialog', { name: "Delete Balarama's League?" })
    expect(within(sheet).getByText('This deletes the yatra for all 3 members and can\'t be undone.')).toBeInTheDocument()
    const forever = within(sheet).getByRole('button', { name: 'Delete forever' })
    expect(forever).toBeDisabled()
    const input = within(sheet).getByLabelText('Type the yatra name to confirm')
    fireEvent.change(input, { target: { value: "Balarama's Lea" } })
    expect(forever).toBeDisabled()
    fireEvent.change(input, { target: { value: "Balarama's League" } })
    expect(forever).toBeEnabled()
    fireEvent.click(forever)
    expect(await screen.findByText('Yatras page')).toBeInTheDocument()
    expect(api.deleteYatra).toHaveBeenCalledWith('y1')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

`InviteMobile.tsx`:

```tsx
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../../../hooks/useToast'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, BTN, CARD, HINT, SECTION_TITLE } from './AdminPage'

export function InviteMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const a = useYatraAdmin(id)
  const { showToast } = useToast()
  const url = `${window.location.origin}/yatra/${id}/join`
  const canShare = typeof navigator.share === 'function'

  function copy() {
    // clipboard is missing outside secure contexts: that's an error toast, not a crash.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(url))
      .then(
        () => showToast({ message: t('yatraSettings.copied'), variant: 'success' }),
        () => showToast({ message: t('common.error'), variant: 'error' }),
      )
  }

  return (
    <AdminPage admin={a} title={t('yatraSettings.invite')}>
      {() => (
        <section className={`${CARD} flex flex-col gap-3 p-4`}>
          <h2 className={SECTION_TITLE}>{t('yatraSettings.inviteTitle')}</h2>
          <p className={HINT}>{t('yatraSettings.inviteText', { name: a.yatra!.name })}</p>
          <p className="rounded-xl bg-ui-field px-3.5 py-3 font-ui-mono text-sm break-all text-ui-ink">{url.replace(/^https?:\/\//, '')}</p>
          <div className="flex gap-2.5">
            {canShare && (
              <button type="button" onClick={() => { navigator.share({ title: a.yatra!.name, url }).catch(() => { /* dismissed */ }) }}
                className={`${BTN} flex-1 bg-ui-primary text-ui-on-primary`}>
                {t('yatraSettings.share')}
              </button>
            )}
            <button type="button" onClick={copy} className={`${BTN} flex-1 border border-ui-control text-ui-ink`}>{t('yatraSettings.copy')}</button>
          </div>
          {canShare && <p className={HINT}>{t('yatraSettings.shareHint')}</p>}
        </section>
      )}
    </AdminPage>
  )
}
```

`DangerZoneMobile.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, BTN, CARD, FIELD, HINT } from './AdminPage'
import { ConfirmSheet } from './fields'

export function DangerZoneMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const a = useYatraAdmin(id)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const close = () => { setOpen(false); setTyped('') }
  return (
    <AdminPage admin={a} title={t('yatraSettings.danger')}>
      {() => {
        const name = a.yatra!.name
        return (
          <>
            <section className={`${CARD} flex flex-col gap-3 p-4`}>
              <h2 className="text-[17px] font-extrabold text-ui-danger">{t('yatraSettings.dangerHint')}</h2>
              <p className={HINT}>{t('yatraSettings.dangerText')}</p>
              <button type="button" onClick={() => setOpen(true)} className={`${BTN} border border-ui-danger text-ui-danger`}>
                {t('yatraSettings.deleteYatra')}
              </button>
            </section>
            {open && (
              <ConfirmSheet title={t('yatraSettings.deleteYatraTitle', { name })} text={t('yatraSettings.deleteYatraText', { count: a.users.length })}
                confirm={t('yatraSettings.deleteForever')} disabled={typed !== name} busy={a.deleteYatra.isPending} onClose={close}
                onConfirm={() => a.deleteYatra.mutate(undefined, { onSuccess: () => navigate('/yatras', { replace: true }) })}>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirm-name" className="text-[13px] font-bold text-ui-muted">{t('yatraSettings.typeName')}</label>
                  <input id="confirm-name" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} className={FIELD} />
                  <p className={HINT}>{t('yatraSettings.typeNameHint')}</p>
                </div>
              </ConfirmSheet>
            )}
          </>
        )
      }}
    </AdminPage>
  )
}
```

`AdminSectionMobile.tsx`: add `invite: <InviteMobile />` and `danger: <DangerZoneMobile />`.

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/features/yatras/settings`

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings app-react/public/locales
git commit -m "feat(yatras): mobile Invite and Danger zone pages"
```

---

### Task 12: Verify

- [ ] **Step 1: Full checks** (in the dev container)

```bash
docker exec <container> bash -lc 'cd /workspaces/sadhana-pro/app-react && npm run lint && npm test -- --run && npm run build'
```

Expected: lint clean, all tests pass, and the build succeeds (it type-checks). Fix anything that fails before moving on. A likely spot is `TFunction` typing in `summaries.ts` and the editor's `errorText`. If `useTranslation()`'s `t` isn't assignable to `TFunction` from `i18next`, type the parameter as `ReturnType<typeof useTranslation>['t']`.

- [ ] **Step 2: Manual check** — `make run` in the container, open `localhost:8080` at 390 px width, in light and dark, logged in as a yatra admin:
  - Link page → Manage yatra → each row; every back link returns to its parent.
  - General: rename, flip metrics, Set threshold opens the editor.
  - Practices: drag a row, rename, add (each type), delete one used by a statistic.
  - Editor (Number, Time, Duration, Yes / No): change count and direction, type an out-of-order bound (12m15), use the "Done starts where Green starts" chip, check that the bar's markers and labels line up and don't overflow.
  - Members, Statistics (add, edit, delete), Invite (Copy), Danger zone (don't confirm on real data).
  - Switch the language to ru and uk: nothing truncates except names in single-line rows.
  - At tablet width (≥ 640 px), `/yatra/:id/admin/settings` and the practice editor show the legacy pages, and `/yatra/:id/admin/members` redirects to the legacy admin page.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A app-react
git commit -m "fix(yatras): admin settings polish from manual check"
```
