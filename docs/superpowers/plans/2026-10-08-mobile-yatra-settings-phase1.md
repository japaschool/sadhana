# Mobile Yatra Settings — Phase 1 (Member Side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the mobile layout, members link their practices to a yatra on a redesigned page (12m2–7), see an unlinked banner and a new switcher on the Yatra screen (12m1, 12m8), and reach their yatras from the Settings tab.

**Architecture:** Pure helpers in `src/features/yatras/settings/linking.ts` (matching, picker groups, summary). One hook, `useLinkPractices`, owns the queries and a serialized, optimistic, undoable save of the whole mapping. Screens live in `src/features/yatras/settings/mobile/`. `/yatra/:id/settings` becomes a `ByLayout` route: mobile gets the new screen, other layouts keep `YatraSettingsPage` in `AppShell`.

**Tech Stack:** React 19, TypeScript, React Router 6 (data router), TanStack Query, zustand, Tailwind v4 (`ui-*` tokens), i18next, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-08-mobile-yatra-settings-design.md` (sections "Saving, Undo and errors", "Member side (phase 1)", "i18n", "Testing").

## Global Constraints

- Mobile layout only. Tablet/desktop keep the legacy pages via `ByLayout`.
- No server changes. Linking is `PUT /yatra/:id/user-practices` with the **full** list; links are by user practice **name**.
- New code only in `src/ui`, `src/layouts`, `src/features/...`. Don't extend `pages/`, `components/layout/`, `theme/tokens.ts`. No DaisyUI classes; only `ui-*` Tailwind colours. Sheets via `BottomSheet` (portals through `UiPortal`).
- Every user-visible string in en, ru and uk (`public/locales/{en,ru,uk}/translation.json`), new keys under `yatraSettings.*`.
- localStorage access wrapped in try/catch.
- No Save buttons; every change saves at once with a toast; Undo where reversible; leaving confirms first.
- Run tooling inside the dev container: `docker exec <container> bash -lc 'cd /workspaces/sadhana-pro/app-react && npx vitest run <path>'` (find `<container>` with `docker ps`). Host Node 26 breaks jsdom.

## Review Focus

1. **Two links in quick succession** (tap Link on two rows fast) — both must persist; the second PUT must include the first link. Pinned in Task 3.
2. **Undo after a later change** — Undo restores the mapping from before *that* change only if nothing else changed since; otherwise it restores exactly the snapshot it captured (documented behaviour). Pinned in Task 3.
3. **A failed save** — the optimistic state rolls back to the server's (refetch), an error toast shows, and later saves still run. Pinned in Task 3.
4. **Cyrillic practice names** — word matching must use Unicode letters (`\p{L}`), so "Чтение книг" suggests for "Чтение". Pinned in Task 2.
5. **The same user practice suggested for two yatra practices** — only the first yatra practice (in order) gets it; "Link N suggested" never links one practice twice. Pinned in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/hooks/useToast.ts` (modify) | add optional `action` (Undo) and a longer timeout when it has one |
| `src/ui/primitives/Toast.tsx` (create) | redesigned toast container (ui tokens) with an action button |
| `src/layouts/mobile/MobileShell.tsx` (modify) | use the new container |
| `src/test/setup.ts` (modify) | fill missing en test strings from the real en translation |
| `src/features/yatras/settings/linking.ts` (create) | pure: suggestions, picker groups, link edits, summary, "Later" storage |
| `src/features/yatras/settings/useLinkPractices.ts` (create) | queries + serialized undoable save + leave |
| `src/features/yatras/settings/mobile/TypeChip.tsx` (create) | data-type icon + label |
| `src/features/yatras/settings/mobile/LinkPracticesMobile.tsx` (create) | 12m2–4 screen |
| `src/features/yatras/settings/mobile/LinkPickerSheet.tsx` (create) | 12m5 picker |
| `src/features/yatras/settings/mobile/LeaveSheets.tsx` (create) | 12m6 / 12m7 |
| `src/features/yatras/mobile/YatrasMobile.tsx` (modify) | Settings action, banner, "not linked" cells, switcher |
| `src/features/yatras/mobile/YatraSwitcherSheet.tsx` (create) | 12m8 |
| `src/features/settings/mobile/SettingsMobile.tsx` (modify) | Yatras section |
| `src/router.tsx` (modify) | `/yatra/:id/settings` by layout |
| `src/pages/yatras/YatraJoinPage.tsx` (modify) | `?joined=1` on redirect |
| `public/locales/{en,ru,uk}/translation.json` (modify) | `yatraSettings.*`, `common.undo` |
| `src/features/yatras/settings/locales.test.ts` (create) | key parity |

---

### Task 1: Toast with Undo, redesigned container, test strings

**Files:**
- Modify: `app-react/src/hooks/useToast.ts`
- Create: `app-react/src/ui/primitives/Toast.tsx`, `app-react/src/ui/primitives/Toast.test.tsx`
- Modify: `app-react/src/layouts/mobile/MobileShell.tsx`
- Modify: `app-react/src/test/setup.ts`
- Modify: `app-react/public/locales/{en,ru,uk}/translation.json` (add `common.undo`)

**Interfaces:**
- Produces: `showToast({ message, variant, action?: { label: string; onClick: () => void } })`. With an action the toast lasts 5000 ms, else 3000 ms. `UiToastContainer` component.

- [ ] **Step 1: Write the failing test** — `src/ui/primitives/Toast.test.tsx`

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../../hooks/useToast'
import { UiToastContainer } from './Toast'

describe('UiToastContainer', () => {
  afterEach(() => { vi.useRealTimers(); useToastStore.setState({ toasts: [] }) })

  it('shows the action, runs it once and dismisses the toast', () => {
    const onClick = vi.fn()
    render(<UiToastContainer />)
    act(() => useToastStore.getState().showToast({ message: 'Linked A → B', variant: 'success', action: { label: 'Undo', onClick } }))
    expect(screen.getByText('Linked A → B')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('keeps an action toast for 5 s, a plain one for 3 s', () => {
    vi.useFakeTimers()
    const { showToast } = useToastStore.getState()
    act(() => { showToast({ message: 'plain', variant: 'success' }); showToast({ message: 'undo', variant: 'success', action: { label: 'Undo', onClick: () => {} } }) })
    act(() => { vi.advanceTimersByTime(3001) })
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['undo'])
    act(() => { vi.advanceTimersByTime(2000) })
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/ui/primitives/Toast.test.tsx`
Expected: FAIL — `./Toast` has no export `UiToastContainer`.

- [ ] **Step 3: Implement**

`src/hooks/useToast.ts` — extend the type and timeout:

```ts
export interface ToastAction { label: string; onClick: () => void }

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  action?: ToastAction
}

interface ToastStore {
  toasts: Toast[]
  showToast: (opts: { message: string; variant: ToastVariant; action?: ToastAction }) => void
  dismiss: (id: string) => void
}
```

and in `showToast`:

```ts
  showToast: ({ message, variant, action }) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({
      toasts: [...s.toasts.slice(-2), { id, message, variant, action }],
    }))
    const timer = setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      timers.delete(id)
    }, action ? 5000 : 3000)
    timers.set(id, timer)
  },
```

`src/ui/primitives/Toast.tsx`:

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore } from '../../hooks/useToast'

/** Toasts above the tab bar, in the new design's colours; an action (Undo) dismisses the toast. */
export function UiToastContainer() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div key={toast.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[14px] px-4 py-3 shadow-lg ${toast.variant === 'error' ? 'bg-ui-danger text-white' : 'bg-ui-primary text-ui-on-primary'}`}>
            <span className="min-w-0 flex-1 text-sm font-semibold">{toast.message}</span>
            {toast.action && (
              <button type="button" onClick={() => { dismiss(toast.id); toast.action!.onClick() }}
                className="shrink-0 text-sm font-extrabold text-ui-accent-fill">
                {toast.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

`src/layouts/mobile/MobileShell.tsx`: replace `import { ToastContainer } from '../../components/ui/Toast'` with `import { UiToastContainer } from '../../ui/primitives/Toast'` and `<ToastContainer />` with `<UiToastContainer />`.

`src/test/setup.ts`: after the `i18n.init(...)` block (inside the `if`), fill keys the hand-written test dictionary lacks from the real English file, without overwriting existing test strings:

```ts
import en from '../../public/locales/en/translation.json'
// …after init:
  i18n.addResourceBundle('en', 'translation', en, true, false)
```

(put the `import` with the other imports at the top.)

Locales — add to `common` in each file: en `"undo": "Undo"`, ru `"undo": "Отменить"`, uk `"undo": "Скасувати"`.

- [ ] **Step 4: Run the new test and the whole suite**

Run: `npx vitest run src/ui/primitives/Toast.test.tsx && npx vitest run`
Expected: PASS, and the full suite still passes (the bundle merge must not change existing expectations; if a test breaks because a real en string replaced a missing one, fix the test's expectation to the real string).

- [ ] **Step 5: Commit**

```bash
git add app-react/src/hooks/useToast.ts app-react/src/ui/primitives/Toast.tsx app-react/src/ui/primitives/Toast.test.tsx app-react/src/layouts/mobile/MobileShell.tsx app-react/src/test/setup.ts app-react/public/locales
git commit -m "feat(ui): toast with an Undo action in the new design"
```

---

### Task 2: Linking helpers

**Files:**
- Create: `app-react/src/features/yatras/settings/linking.ts`
- Test: `app-react/src/features/yatras/settings/linking.test.ts`

**Interfaces:**
- Consumes: `UserPractice`, `YatraPractice`, `YatraUserPracticeItem` from `src/types/api.ts`.
- Produces:
  - `suggestions(items: YatraUserPracticeItem[], practices: UserPractice[]): Map<string, UserPractice>` — yatra practice id → suggested user practice.
  - `withLink(items, yatraPracticeId: string, name: string | null): YatraUserPracticeItem[]` — sets that row; clears any other row holding `name` (move).
  - `withLinks(items, links: Map<string, UserPractice>): YatraUserPracticeItem[]`
  - `unlinked(items): YatraPractice[]`
  - `pickerGroups(items, practices, yatraPracticeId): PickerGroups`
  - `laterDismissed(yatraId: string, unlinkedIds: string[]): boolean`, `dismissLater(yatraId: string, unlinkedIds: string[]): void`

- [ ] **Step 1: Write the failing tests** — `linking.test.ts`

```ts
import { afterEach, describe, expect, it } from 'vitest'
import type { PracticeDataType, UserPractice, YatraUserPracticeItem } from '../../../types/api'
import { dismissLater, laterDismissed, pickerGroups, suggestions, unlinked, withLink, withLinks } from './linking'

const yp = (id: string, practice: string, data_type: PracticeDataType, user_practice: string | null = null): YatraUserPracticeItem =>
  ({ yatra_practice: { id, practice, data_type }, user_practice })
const up = (practice: string, data_type: PracticeDataType, is_active = true): UserPractice =>
  ({ id: practice, practice, data_type, is_active })

describe('suggestions', () => {
  it('prefers an exact name, then a shared word, same type and active only', () => {
    const items = [yp('a', 'Japa rounds', 'Int'), yp('b', 'Reading', 'Duration'), yp('c', 'Wake up', 'Time')]
    const mine = [up('Rounds of japa', 'Int'), up('japa rounds ', 'Int'), up('Book reading', 'Duration'), up('Wake up', 'Duration')]
    const s = suggestions(items, mine)
    expect(s.get('a')?.practice).toBe('japa rounds ')
    expect(s.get('b')?.practice).toBe('Book reading')
    expect(s.has('c')).toBe(false) // same name, wrong type
  })

  it('skips practices already linked in this yatra and rows already linked', () => {
    const items = [yp('a', 'Reading', 'Duration', 'Book reading'), yp('b', 'Book reading', 'Duration')]
    expect(suggestions(items, [up('Book reading', 'Duration')]).size).toBe(0)
  })

  it('skips inactive practices and words under 4 letters', () => {
    const items = [yp('a', 'Japa', 'Int'), yp('b', 'Go to bed', 'Time')]
    expect(suggestions(items, [up('Japa', 'Int', false), up('Bed at', 'Time')]).size).toBe(0)
  })

  it('pairs a plural with its singular', () => {
    expect(suggestions([yp('a', 'Hearing lectures', 'Duration')], [up('Lecture listening', 'Duration')]).get('a')?.practice).toBe('Lecture listening')
  })

  it('matches Cyrillic words', () => {
    expect(suggestions([yp('a', 'Чтение', 'Duration')], [up('Чтение книг', 'Duration')]).get('a')?.practice).toBe('Чтение книг')
  })

  it('suggests one user practice for one yatra practice only, first in order', () => {
    const items = [yp('a', 'Reading', 'Duration'), yp('b', 'Reading SB', 'Duration')]
    const s = suggestions(items, [up('Reading', 'Duration')])
    expect([...s.keys()]).toEqual(['a'])
  })
})

describe('link edits', () => {
  const items = [yp('a', 'Reading', 'Duration', 'Book reading'), yp('b', 'Lectures', 'Duration')]

  it('withLink moves a practice linked elsewhere', () => {
    expect(withLink(items, 'b', 'Book reading').map((i) => i.user_practice)).toEqual([null, 'Book reading'])
  })

  it('withLink(null) unlinks', () => {
    expect(withLink(items, 'a', null).map((i) => i.user_practice)).toEqual([null, null])
  })

  it('withLinks applies several and unlinked lists the rest', () => {
    const next = withLinks(items, new Map([['b', up('Lecture listening', 'Duration')]]))
    expect(next.map((i) => i.user_practice)).toEqual(['Book reading', 'Lecture listening'])
    expect(unlinked(items).map((p) => p.id)).toEqual(['b'])
  })
})

describe('pickerGroups', () => {
  it('groups suggested, compatible, linked elsewhere and can-not-link with reasons', () => {
    const items = [yp('a', 'Reading', 'Duration', 'Book reading'), yp('b', 'Hearing lectures', 'Duration')]
    const mine = [
      up('Lecture listening', 'Duration'), up('Kirtan time', 'Duration'), up('Book reading', 'Duration'),
      up('Wake-up time', 'Time'), up('Exercise', 'Duration', false),
    ]
    const g = pickerGroups(items, mine, 'b')
    expect(g.suggested?.practice).toBe('Lecture listening')
    expect(g.compatible.map((p) => p.practice)).toEqual(['Kirtan time'])
    expect(g.current).toBeNull()
    expect(g.linkedElsewhere.map((l) => [l.practice.practice, l.linkedTo.practice])).toEqual([['Book reading', 'Reading']])
    expect(g.cantLink.map((c) => [c.practice.practice, c.reason])).toEqual([['Wake-up time', 'type'], ['Exercise', 'inactive']])
  })

  it('reports the row\'s current practice separately', () => {
    const items = [yp('a', 'Reading', 'Duration', 'Book reading')]
    const g = pickerGroups(items, [up('Book reading', 'Duration')], 'a')
    expect(g.current?.practice).toBe('Book reading')
    expect(g.linkedElsewhere).toEqual([])
  })
})

describe('Later', () => {
  afterEach(() => localStorage.clear())
  it('stays dismissed for the same unlinked set, in any order, and comes back when it changes', () => {
    dismissLater('y1', ['b', 'a'])
    expect(laterDismissed('y1', ['a', 'b'])).toBe(true)
    expect(laterDismissed('y1', ['a'])).toBe(false)
    expect(laterDismissed('y2', ['a', 'b'])).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/yatras/settings/linking.test.ts`
Expected: FAIL — module `./linking` not found.

- [ ] **Step 3: Implement** — `linking.ts`

```ts
import type { UserPractice, YatraPractice, YatraUserPracticeItem } from '../../../types/api'

const norm = (s: string) => s.trim().toLowerCase()
const words = (s: string) => (norm(s).match(/\p{L}+/gu) ?? []).filter((w) => w.length >= 4)

function nameScore(yatraName: string, mine: string): number {
  const a = norm(yatraName), b = norm(mine)
  if (a === b) return 2
  if (a.includes(b) || b.includes(a)) return 1
  // Words "match" when one starts the other, so plurals pair up: "lectures" ~ "lecture".
  const wa = [...words(a)]
  return [...words(b)].some((w) => wa.some((v) => v.startsWith(w) || w.startsWith(v))) ? 1 : 0
}

const linkedNames = (items: YatraUserPracticeItem[]) =>
  new Set(items.flatMap((i) => (i.user_practice ? [i.user_practice] : [])))

/** Yatra practice id → one matching, active, same-type practice not linked anywhere in this yatra. */
export function suggestions(items: YatraUserPracticeItem[], practices: UserPractice[]): Map<string, UserPractice> {
  const taken = linkedNames(items)
  const out = new Map<string, UserPractice>()
  for (const { yatra_practice: y, user_practice } of items) {
    if (user_practice) continue
    let best: UserPractice | undefined
    let bestScore = 0
    for (const p of practices) {
      if (!p.is_active || p.data_type !== y.data_type || taken.has(p.practice)) continue
      const s = nameScore(y.practice, p.practice)
      if (s > bestScore) { best = p; bestScore = s }
    }
    if (best) { out.set(y.id, best); taken.add(best.practice) }
  }
  return out
}

/** Links `name` to one yatra practice; any other row holding it is unlinked (a move). */
export function withLink(items: YatraUserPracticeItem[], yatraPracticeId: string, name: string | null): YatraUserPracticeItem[] {
  return items.map((i) =>
    i.yatra_practice.id === yatraPracticeId ? { ...i, user_practice: name }
    : name !== null && i.user_practice === name ? { ...i, user_practice: null }
    : i)
}

export function withLinks(items: YatraUserPracticeItem[], links: Map<string, UserPractice>): YatraUserPracticeItem[] {
  return items.map((i) => (links.has(i.yatra_practice.id) ? { ...i, user_practice: links.get(i.yatra_practice.id)!.practice } : i))
}

export const unlinked = (items: YatraUserPracticeItem[]): YatraPractice[] =>
  items.filter((i) => !i.user_practice).map((i) => i.yatra_practice)

export interface PickerGroups {
  suggested: UserPractice | null
  compatible: UserPractice[]
  current: UserPractice | null
  linkedElsewhere: { practice: UserPractice; linkedTo: YatraPractice }[]
  cantLink: { practice: UserPractice; reason: 'inactive' | 'type' }[]
}

/** Every user practice, grouped for the picker of one yatra practice. */
export function pickerGroups(items: YatraUserPracticeItem[], practices: UserPractice[], yatraPracticeId: string): PickerGroups {
  const row = items.find((i) => i.yatra_practice.id === yatraPracticeId)!
  const owner = new Map(items.flatMap((i) => (i.user_practice ? [[i.user_practice, i.yatra_practice] as const] : [])))
  const suggested = row.user_practice ? null : suggestions(items, practices).get(yatraPracticeId) ?? null
  const g: PickerGroups = { suggested, compatible: [], current: null, linkedElsewhere: [], cantLink: [] }
  for (const p of practices) {
    if (!p.is_active) { g.cantLink.push({ practice: p, reason: 'inactive' }); continue }
    if (p.data_type !== row.yatra_practice.data_type) { g.cantLink.push({ practice: p, reason: 'type' }); continue }
    if (p.practice === row.user_practice) { g.current = p; continue }
    const other = owner.get(p.practice)
    if (other) g.linkedElsewhere.push({ practice: p, linkedTo: other })
    else if (p !== suggested) g.compatible.push(p)
  }
  // Type mismatches first, then inactive, as in 12m5.
  g.cantLink.sort((a, b) => (a.reason === b.reason ? 0 : a.reason === 'type' ? -1 : 1))
  return g
}

const laterKey = (yatraId: string) => `yatra_link_later_${yatraId}`
const setKey = (ids: string[]) => [...ids].sort().join(',')

export function laterDismissed(yatraId: string, unlinkedIds: string[]): boolean {
  try { return localStorage.getItem(laterKey(yatraId)) === setKey(unlinkedIds) } catch { return false }
}

export function dismissLater(yatraId: string, unlinkedIds: string[]): void {
  try { localStorage.setItem(laterKey(yatraId), setKey(unlinkedIds)) } catch { /* private mode: banner just returns */ }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/yatras/settings/linking.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings/linking.ts app-react/src/features/yatras/settings/linking.test.ts
git commit -m "feat(yatras): linking helpers for suggestions, the picker and Later"
```

---

### Task 3: `useLinkPractices` — serialized, optimistic, undoable saves

**Files:**
- Create: `app-react/src/features/yatras/settings/useLinkPractices.ts`
- Test: `app-react/src/features/yatras/settings/useLinkPractices.test.tsx`
- Modify: locales (`yatraSettings.linked`, `yatraSettings.unlinkedToast`, `yatraSettings.linkedMany`, `yatraSettings.undone`) — strings in Task 4's table; add these four now.

**Interfaces:**
- Consumes: Task 1 `showToast({ action })`, Task 2 `withLink`, `withLinks`.
- Produces:

```ts
useLinkPractices(yatraId: string): {
  yatra: Yatra | undefined
  items: YatraUserPracticeItem[]
  practices: UserPractice[]
  users: YatraUser[]
  me: YatraUser | undefined          // current user's row in users
  isLoading: boolean
  isError: boolean
  link(yatraPracticeId: string, name: string | null): void   // toast "Linked X → Y" / "Unlinked Y", with Undo
  linkAll(links: Map<string, UserPractice>): void             // toast "Linked N practices", with Undo
  leave: UseMutationResult<void, Error, void>
}
```

Query keys: `['yatras']`, `['yatra-user-practices', id]`, `['practices']`, `['yatra-users', id]` (shared with legacy pages).

- [ ] **Step 1: Write the failing tests**

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { YatraUserPracticeItem } from '../../../types/api'
import { useLinkPractices } from './useLinkPractices'

vi.mock('../../../api/yatras', () => ({
  yatrasApi: { getYatras: vi.fn(), getYatraUserPractices: vi.fn(), updateYatraUserPractices: vi.fn(), getYatraUsers: vi.fn(), leaveYatra: vi.fn() },
}))
vi.mock('../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
import { yatrasApi } from '../../../api/yatras'
import { practicesApi } from '../../../api/practices'
const api = vi.mocked(yatrasApi)

const items: YatraUserPracticeItem[] = [
  { yatra_practice: { id: 'a', practice: 'Reading', data_type: 'Duration' }, user_practice: null },
  { yatra_practice: { id: 'b', practice: 'Lectures', data_type: 'Duration' }, user_practice: null },
]

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(() => useLinkPractices('y1'), { wrapper })
}

const sent = () => api.updateYatraUserPractices.mock.calls.map(([, list]) => list.map((i) => i.user_practice))

describe('useLinkPractices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToastStore.setState({ toasts: [] })
    useAuthStore.setState({ user: { id: 'u1', email: '', token: 't', name: 'Me' }, token: 't' })
    api.getYatras.mockResolvedValue([{ id: 'y1', name: 'League', show_stability_metrics: false }])
    api.getYatraUserPractices.mockResolvedValue(items)
    api.getYatraUsers.mockResolvedValue([{ user_id: 'u1', user_name: 'Me', is_admin: false }])
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([])
  })

  it('sends quick successive links in order, each including the previous', async () => {
    let release!: () => void
    api.updateYatraUserPractices.mockImplementationOnce(() => new Promise<void>((r) => { release = r })).mockResolvedValue()
    const { result } = setup()
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => { result.current.link('a', 'Book reading'); result.current.link('b', 'Lecture listening') })
    expect(result.current.items.map((i) => i.user_practice)).toEqual(['Book reading', 'Lecture listening'])
    expect(api.updateYatraUserPractices).toHaveBeenCalledTimes(1)
    await act(async () => { release() })
    await waitFor(() => expect(sent()).toEqual([['Book reading', null], ['Book reading', 'Lecture listening']]))
  })

  it('Undo restores the snapshot from before that change', async () => {
    api.updateYatraUserPractices.mockResolvedValue()
    const { result } = setup()
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => result.current.link('a', 'Book reading'))
    await waitFor(() => expect(useToastStore.getState().toasts[0]?.message).toBe('Linked Book reading → Reading'))
    act(() => useToastStore.getState().toasts[0].action!.onClick())
    await waitFor(() => expect(sent().at(-1)).toEqual([null, null]))
    expect(result.current.items.map((i) => i.user_practice)).toEqual([null, null])
    // The undo itself offers no further Undo.
    await waitFor(() => expect(useToastStore.getState().toasts.at(-1)?.action).toBeUndefined())
  })

  it('a failed save shows an error, refetches, and later saves still run', async () => {
    api.updateYatraUserPractices.mockRejectedValueOnce(new Error('500')).mockResolvedValue()
    const { result } = setup()
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => result.current.link('a', 'Book reading'))
    await waitFor(() => expect(useToastStore.getState().toasts.some((t) => t.variant === 'error')).toBe(true))
    await waitFor(() => expect(api.getYatraUserPractices).toHaveBeenCalledTimes(2))
    act(() => result.current.link('b', 'Lecture listening'))
    await waitFor(() => expect(api.updateYatraUserPractices).toHaveBeenCalledTimes(2))
  })

  it('finds the current user among the members', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.me?.user_id).toBe('u1'))
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/yatras/settings/useLinkPractices.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `useLinkPractices.ts`

```ts
import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../../api/practices'
import { yatrasApi } from '../../../api/yatras'
import { useToast } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { UserPractice, YatraUserPracticeItem } from '../../../types/api'
import { withLink, withLinks } from './linking'

/** The member's links for one yatra. Each change is shown at once and saved in order; Undo resends the snapshot from before it. */
export function useLinkPractices(yatraId: string) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const userId = useAuthStore((s) => s.user?.id)
  const key = ['yatra-user-practices', yatraId]
  const queue = useRef<Promise<void>>(Promise.resolve())

  const yatrasQ = useQuery({ queryKey: ['yatras'], queryFn: yatrasApi.getYatras })
  const itemsQ = useQuery({ queryKey: key, queryFn: () => yatrasApi.getYatraUserPractices(yatraId) })
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const usersQ = useQuery({ queryKey: ['yatra-users', yatraId], queryFn: () => yatrasApi.getYatraUsers(yatraId) })

  function save(next: YatraUserPracticeItem[], message: string, undoable: boolean) {
    const prev = qc.getQueryData<YatraUserPracticeItem[]>(key) ?? []
    qc.setQueryData(key, next)
    queue.current = queue.current
      .then(() => yatrasApi.updateYatraUserPractices(yatraId, next))
      .then(
        () => {
          showToast({
            message, variant: 'success',
            action: undoable ? { label: t('common.undo'), onClick: () => save(prev, t('yatraSettings.undone'), false) } : undefined,
          })
          void qc.invalidateQueries({ queryKey: ['yatra-data', yatraId] })
        },
        () => {
          showToast({ message: t('common.error'), variant: 'error' })
          void qc.invalidateQueries({ queryKey: key })
        },
      )
  }

  const current = () => qc.getQueryData<YatraUserPracticeItem[]>(key) ?? []

  function link(yatraPracticeId: string, name: string | null) {
    const items = current()
    const row = items.find((i) => i.yatra_practice.id === yatraPracticeId)!
    const message = name
      ? t('yatraSettings.linked', { mine: name, yatra: row.yatra_practice.practice })
      : t('yatraSettings.unlinkedToast', { yatra: row.yatra_practice.practice })
    save(withLink(items, yatraPracticeId, name), message, true)
  }

  function linkAll(links: Map<string, UserPractice>) {
    save(withLinks(current(), links), t('yatraSettings.linkedMany', { count: links.size }), true)
  }

  const leave = useMutation({
    mutationFn: () => yatrasApi.leaveYatra(yatraId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['yatras'] }) },
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
  })

  const users = usersQ.data ?? []
  return {
    yatra: yatrasQ.data?.find((y) => y.id === yatraId),
    items: itemsQ.data ?? [],
    practices: practicesQ.data ?? [],
    users,
    me: users.find((u) => u.user_id === userId),
    isLoading: yatrasQ.isLoading || itemsQ.isLoading || practicesQ.isLoading || usersQ.isLoading,
    isError: yatrasQ.isError || itemsQ.isError || practicesQ.isError || usersQ.isError,
    link, linkAll, leave,
  }
}
```

Locales (en / ru / uk) under `yatraSettings`:
- `linked`: "Linked {{mine}} → {{yatra}}" / "Связано: {{mine}} → {{yatra}}" / "Зв’язано: {{mine}} → {{yatra}}"
- `unlinkedToast`: "Unlinked {{yatra}}" / "Связь с «{{yatra}}» снята" / "Зв’язок із «{{yatra}}» знято"
- `linkedMany_one` / `_other` (ru/uk also `_few`, `_many`): "Linked {{count}} practice(s)" / "Связано практик: {{count}}" (all ru forms) / "Зв’язано практик: {{count}}" (all uk forms)
- `undone`: "Undone" / "Отменено" / "Скасовано"

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/yatras/settings/useLinkPractices.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings/useLinkPractices.ts app-react/src/features/yatras/settings/useLinkPractices.test.tsx app-react/public/locales
git commit -m "feat(yatras): save practice links in order, with Undo"
```

---

### Task 4: Link your practices screen (12m2–4) + route

**Files:**
- Create: `app-react/src/features/yatras/settings/mobile/TypeChip.tsx`
- Create: `app-react/src/features/yatras/settings/mobile/LinkPracticesMobile.tsx`
- Test: `app-react/src/features/yatras/settings/mobile/LinkPracticesMobile.test.tsx`
- Modify: `app-react/src/router.tsx`
- Modify: `app-react/src/pages/yatras/YatraJoinPage.tsx:33`
- Modify: locales
- Create: `app-react/src/features/yatras/settings/locales.test.ts`

**Interfaces:**
- Consumes: Task 2 `suggestions`, `unlinked`; Task 3 `useLinkPractices`.
- Produces: `LinkPracticesMobileScreen` (route element), `TypeChip({ type, compact? })`, `TypeIcon({ type })`, `typeLabelKey(type): string`. Task 5 adds `LinkPickerSheet`; Task 6 adds `LeaveSheets`; this task renders placeholders-free hooks for them via state `pickerFor: string | null` and `leaving: boolean` (wired in Tasks 5–6).

**Strings** (`yatraSettings.*`; en / ru / uk — ru/uk from 12m24/25):

| key | en | ru | uk |
|---|---|---|---|
| title | Link your practices | Связать практики | Зв’язати практики |
| back | Yatra | Ятра | Ятра |
| joinedTitle | You've joined {{name}} | Вы в ятре «{{name}}» | Ви в ятрі «{{name}}» |
| joinedIntro | Link your practices so your entries appear in the yatra table. Practices you leave unlinked just won't show up there. | Свяжите свои практики, чтобы ваши записи попали в таблицу ятры. Несвязанные практики там просто не появятся. | Зв’яжіть свої практики, щоб ваші записи потрапили в таблицю ятри. Незв’язані практики там просто не з’являться. |
| countLinked | {{linked}} of {{total}} linked | Связано {{linked}} из {{total}} | Зв’язано {{linked}} з {{total}} |
| allLinked | All {{total}} linked | Связаны все {{total}} | Зв’язано всі {{total}} |
| savesAsYouGo | Saves as you go | Сохраняется сразу | Зберігається одразу |
| wontAppear | Your entries for {{names}} won't appear in the table. | {{names}}: ваши записи не попадут в таблицу. | {{names}}: ваші записи не потраплять у таблицю. |
| allAppear | Everything you log on Today appears in the table. | Всё, что вы отмечаете в «Сегодня», попадает в таблицу. | Усе, що ви відмічаєте в «Сьогодні», потрапляє в таблицю. |
| linkSuggested | Link {{count}} suggested matches | Связать похожие ({{count}}) | Зв’язати схожі ({{count}}) |
| colYatra | Yatra practice | Практика ятры | Практика ятри |
| colMine | Your practice that fills it | Ваша практика, которая её заполняет | Ваша практика, що її заповнює |
| yourPractice | Your practice | Ваша практика | Ваша практика |
| statusLinked | Linked | Связано | Зв’язано |
| suggestedMatch | Suggested match | Похожая практика | Схожа практика |
| link | Link | Связать | Зв’язати |
| notLinked | Not linked · your entries won't appear | Не связано · ваши записи не попадут в таблицу | Не зв’язано · ваші записи не потраплять у таблицю |
| choose | Choose a practice | Выбрать практику | Обрати практику |
| noneOfType | You have no {{type}} practice | У вас нет практики типа «{{type}}» | У вас немає практики типу «{{type}}» |
| nothingYet | Nothing to link yet · | Пока нечего связать · | Поки нічого зв’язати · |
| addInMyPractices | Add one in My practices › | Добавить в «Моих практиках» › | Додати в «Моїх практиках» › |
| manage | Manage yatra | Управление ятрой | Керування ятрою |
| admin | Admin | Админ | Адмін |
| leave | Leave yatra | Покинуть ятру | Покинути ятру |
| typeInt | Number | Число | Число |
| typeBool | Yes / No | Да / Нет | Так / Ні |
| typeTime | Time of day | Время суток | Час доби |
| typeDuration | Duration | Длительность | Тривалість |
| typeText | Text | Текст | Текст |

(`names` is the `Intl.ListFormat` join; in ru/uk each name is wrapped in «».)

- [ ] **Step 1: Write the failing tests** — `LinkPracticesMobile.test.tsx`

```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useAuthStore } from '../../../../store/authStore'
import { useToastStore } from '../../../../hooks/useToast'
import { LinkPracticesMobileScreen } from './LinkPracticesMobile'

vi.mock('../../../../api/yatras', () => ({
  yatrasApi: { getYatras: vi.fn(), getYatraUserPractices: vi.fn(), updateYatraUserPractices: vi.fn(), getYatraUsers: vi.fn(), leaveYatra: vi.fn() },
}))
vi.mock('../../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
import { yatrasApi } from '../../../../api/yatras'
import { practicesApi } from '../../../../api/practices'
const api = vi.mocked(yatrasApi)

export function renderLinkScreen(url = '/yatra/y1/settings') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/yatra/:id/settings" element={<LinkPracticesMobileScreen />} />
          <Route path="/yatra/:id/admin/settings" element={<p>Admin hub</p>} />
          <Route path="/user/practices" element={<p>My practices</p>} />
          <Route path="/yatras" element={<p>Yatras page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

export function mockLinkApi(isAdmin = false) {
  useAuthStore.setState({ user: { id: 'u1', email: '', token: 't', name: 'Me' }, token: 't' })
  api.getYatras.mockResolvedValue([{ id: 'y1', name: "Balarama's League", show_stability_metrics: false }])
  api.getYatraUserPractices.mockResolvedValue([
    { yatra_practice: { id: 'a', practice: 'Japa rounds', data_type: 'Int' }, user_practice: 'Japa rounds' },
    { yatra_practice: { id: 'b', practice: 'Hearing lectures', data_type: 'Duration' }, user_practice: null },
    { yatra_practice: { id: 'c', practice: "Day's realisation", data_type: 'Text' }, user_practice: null },
  ])
  api.getYatraUsers.mockResolvedValue([
    { user_id: 'u1', user_name: 'Me', is_admin: isAdmin },
    { user_id: 'u2', user_name: 'Other', is_admin: false },
  ])
  api.updateYatraUserPractices.mockResolvedValue()
  vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
    { id: '1', practice: 'Japa rounds', data_type: 'Int', is_active: true },
    { id: '2', practice: 'Lecture listening', data_type: 'Duration', is_active: true },
  ])
}

describe('LinkPracticesMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockLinkApi() })

  it('shows the count, the unlinked summary and one row per yatra practice', async () => {
    renderLinkScreen()
    expect(await screen.findByText('1 of 3 linked')).toBeInTheDocument()
    expect(screen.getByText("Your entries for Hearing lectures and Day's realisation won't appear in the table.")).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Link your practices' })).toBeInTheDocument()
    expect(screen.getByText('You have no Text practice')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add one in My practices ›' })).toHaveAttribute('href', '/user/practices')
  })

  it('links a suggestion from its row and offers Undo', async () => {
    renderLinkScreen()
    const row = (await screen.findByText('Hearing lectures')).closest('li')!
    expect(within(row).getByText('Lecture listening')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: 'Link' }))
    expect(await screen.findByText('2 of 3 linked')).toBeInTheDocument()
    await waitFor(() => expect(api.updateYatraUserPractices).toHaveBeenCalledOnce())
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('"Link N suggested matches" links them all in one request', async () => {
    renderLinkScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Link 1 suggested matches' }))
    await waitFor(() => expect(api.updateYatraUserPractices).toHaveBeenCalledOnce())
    expect(api.updateYatraUserPractices.mock.calls[0][1].map((i) => i.user_practice)).toEqual(['Japa rounds', 'Lecture listening', null])
  })

  it('shows the joined header after joining', async () => {
    renderLinkScreen('/yatra/y1/settings?joined=1')
    expect(await screen.findByRole('heading', { name: "You've joined Balarama's League" })).toBeInTheDocument()
  })

  it('shows Manage yatra only to admins', async () => {
    renderLinkScreen()
    await screen.findByText('1 of 3 linked')
    expect(screen.queryByRole('link', { name: /Manage yatra/ })).toBeNull()
  })

  it('admins get Manage yatra to the admin hub', async () => {
    mockLinkApi(true)
    renderLinkScreen()
    expect(await screen.findByRole('link', { name: /Manage yatra/ })).toHaveAttribute('href', '/yatra/y1/admin/settings')
  })
})
```

`locales.test.ts` (key parity across en/ru/uk for `yatraSettings`):

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/yatras/settings`
Expected: FAIL — `./LinkPracticesMobile` not found; locales test fails until strings exist.

- [ ] **Step 3: Implement**

`TypeChip.tsx` (icons drawn as in the mockup: `#`, clock, duration bar, check, `Aa`):

```tsx
import { useTranslation } from 'react-i18next'
import type { PracticeDataType } from '../../../../types/api'

export const typeLabelKey = (type: PracticeDataType) => `yatraSettings.type${type}`

export function TypeIcon({ type }: { type: PracticeDataType }) {
  const box = 'inline-flex h-4 w-4 shrink-0 items-center justify-center'
  if (type === 'Int') return <span aria-hidden className={`${box} font-ui-mono text-sm font-bold`}>#</span>
  if (type === 'Text') return <span aria-hidden className={`${box} font-ui-mono text-[13px] font-bold`}>Aa</span>
  if (type === 'Bool') return <span aria-hidden className={`${box} text-sm font-bold`}>✓</span>
  if (type === 'Time') return (
    <span aria-hidden className={box}>
      <span className="relative block h-3.5 w-3.5 rounded-full border-[1.7px] border-current">
        <span className="absolute top-[1.6px] left-[4.6px] h-[4.4px] w-[1.7px] rounded-[1px] bg-current" />
        <span className="absolute top-[4.6px] left-[4.6px] h-[1.7px] w-1 rounded-[1px] bg-current" />
      </span>
    </span>
  )
  return (
    <span aria-hidden className={box}>
      <span className="flex h-2.5 w-3.5 items-center border-x-[1.8px] border-current px-px"><span className="h-[1.8px] flex-1 bg-current" /></span>
    </span>
  )
}

/** Data type as a pill: icon + label. */
export function TypeChip({ type }: { type: PracticeDataType }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ui-chip py-1 pr-2.5 pl-1.5 text-xs font-bold whitespace-nowrap text-ui-ink2">
      <TypeIcon type={type} />{t(typeLabelKey(type))}
    </span>
  )
}
```

`LinkPracticesMobile.tsx`:

```tsx
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MobileShell } from '../../../../layouts/mobile/MobileShell'
import type { UserPractice, YatraUserPracticeItem } from '../../../../types/api'
import { suggestions, unlinked } from '../linking'
import { useLinkPractices } from '../useLinkPractices'
import { TypeChip, TypeIcon, typeLabelKey } from './TypeChip'

const CARD = 'rounded-[18px] border border-ui-hairline bg-ui-surface'

/** "A, B and C" in the UI language; ru/uk quote each name. */
export function joinNames(names: string[], lang: string): string {
  const quoted = lang.startsWith('en') ? names : names.map((n) => `«${n}»`)
  return new Intl.ListFormat(lang, { type: 'conjunction' }).format(quoted)
}

export function LinkPracticesMobile() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const s = useLinkPractices(id)
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  const missing = unlinked(s.items)
  const suggested = suggestions(s.items, s.practices)
  const total = s.items.length
  const linked = total - missing.length
  const joined = params.get('joined') === '1'

  return (
    <>
      <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-11 items-center px-2">
          <Link to="/yatras" className="flex min-h-11 items-center gap-1 px-2 text-[17px] font-semibold text-ui-accent">
            <span aria-hidden>‹</span>{t('yatraSettings.back')}
          </Link>
        </div>
      </header>
      <div className="flex flex-col gap-0.5 px-5 pb-4">
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ui-ink">
          {joined && s.yatra ? t('yatraSettings.joinedTitle', { name: s.yatra.name }) : t('yatraSettings.title')}
        </h1>
        {!joined && s.yatra && <p className="text-sm text-ui-muted">{s.yatra.name}</p>}
        {joined && <p className="pt-1 text-sm leading-normal text-ui-ink2">{t('yatraSettings.joinedIntro')}</p>}
      </div>

      {s.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <span role="status" aria-label={t('common.loading')} className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
        </div>
      ) : s.isError ? (
        <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('common.error')}</p>
      ) : (
        <div className="flex flex-col gap-4 px-4 pb-8">
          <section className={`${CARD} flex flex-col gap-3 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span className="text-[22px] font-extrabold tracking-[-0.01em] text-ui-ink">
                {missing.length ? t('yatraSettings.countLinked', { linked, total }) : t('yatraSettings.allLinked', { total })}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-ui-muted">
                <span className="h-[7px] w-[7px] rounded-full bg-ui-good" />{t('yatraSettings.savesAsYouGo')}
              </span>
            </div>
            <div className="flex gap-1" aria-hidden>
              {s.items.map((i) => (
                <span key={i.yatra_practice.id}
                  className={`h-2 flex-1 rounded ${i.user_practice ? 'bg-ui-good' : 'border-[1.5px] border-dashed border-ui-faint'}`} />
              ))}
            </div>
            <p className="text-sm leading-normal text-ui-ink2">
              {missing.length
                ? t('yatraSettings.wontAppear', { names: joinNames(missing.map((p) => p.practice), i18n.language || 'en') })
                : t('yatraSettings.allAppear')}
            </p>
            {suggested.size > 0 && (
              <button type="button" onClick={() => s.linkAll(suggested)}
                className="min-h-12 rounded-[14px] bg-ui-accent-fill px-5 text-[15px] font-extrabold text-ui-ink">
                {t('yatraSettings.linkSuggested', { count: suggested.size })}
              </button>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">
              <span>{t('yatraSettings.colYatra')}</span><span aria-hidden className="text-sm text-ui-faint2">←</span><span>{t('yatraSettings.colMine')}</span>
            </div>
            <ul className="flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline">
              {s.items.map((item) => (
                <LinkRow key={item.yatra_practice.id} item={item} suggestion={suggested.get(item.yatra_practice.id)}
                  hasCompatible={s.practices.some((p) => p.is_active && p.data_type === item.yatra_practice.data_type)}
                  onLink={(name) => s.link(item.yatra_practice.id, name)} onPick={() => setPickerFor(item.yatra_practice.id)} />
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline">
            {s.me?.is_admin && (
              <Link to={`/yatra/${id}/admin/settings`} className="flex min-h-[52px] items-center gap-3 bg-ui-surface px-4">
                <span className="flex-1 text-[15px] font-semibold text-ui-ink">{t('yatraSettings.manage')}</span>
                <span className="rounded-full bg-ui-accent-pill px-2 py-0.5 text-[11px] font-bold text-ui-accent">{t('yatraSettings.admin')}</span>
                <span aria-hidden className="text-lg text-ui-faint2">›</span>
              </Link>
            )}
            <button type="button" onClick={() => setLeaving(true)}
              className="flex min-h-[52px] items-center bg-ui-surface px-4 text-left text-[15px] font-bold text-ui-danger">
              {t('yatraSettings.leave')}
            </button>
          </div>
        </div>
      )}
      {/* Task 5 renders LinkPickerSheet for pickerFor; Task 6 renders LeaveSheets for leaving. */}
      {pickerFor && leaving && null}
    </>
  )
}

function LinkRow({ item, suggestion, hasCompatible, onLink, onPick }: {
  item: YatraUserPracticeItem; suggestion?: UserPractice; hasCompatible: boolean
  onLink: (name: string) => void; onPick: () => void
}) {
  const { t } = useTranslation()
  const { yatra_practice: y, user_practice: mine } = item
  const slot = 'flex min-h-[54px] w-full items-center gap-2.5 rounded-xl border border-ui-hairline bg-ui-field px-3 py-[7px] text-left'
  return (
    <li className="flex flex-col gap-2.5 bg-ui-surface py-3.5 pr-3.5 pl-4">
      <div className="flex items-start justify-between gap-2.5">
        <span className="min-w-0 pt-0.5 text-base font-extrabold leading-[1.3] text-ui-ink">{y.practice}</span>
        <TypeChip type={y.data_type} />
      </div>
      {mine ? (
        <button type="button" onClick={onPick} className={slot}>
          <TypeIcon type={y.data_type} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11px] font-bold text-ui-faint2">{t('yatraSettings.yourPractice')}</span>
            <span className="truncate text-[15px] font-bold text-ui-ink">{mine}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-extrabold text-ui-good">
            <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ui-good text-[11px] text-white">✓</span>
            {t('yatraSettings.statusLinked')}
          </span>
        </button>
      ) : suggestion ? (
        <>
          <div className={slot}>
            <button type="button" onClick={onPick} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <TypeIcon type={y.data_type} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[11px] font-bold text-ui-accent">{t('yatraSettings.suggestedMatch')}</span>
                <span className="truncate text-[15px] font-bold text-ui-ink">{suggestion.practice}</span>
              </span>
            </button>
            <button type="button" onClick={() => onLink(suggestion.practice)}
              className="h-9 shrink-0 rounded-[10px] bg-ui-primary px-4 text-[13px] font-extrabold text-ui-on-primary">
              {t('yatraSettings.link')}
            </button>
          </div>
          <span className="text-xs font-semibold text-ui-muted">{t('yatraSettings.notLinked')}</span>
        </>
      ) : hasCompatible ? (
        <>
          <button type="button" onClick={onPick} className={`${slot} border-dashed`}>
            <TypeIcon type={y.data_type} />
            <span className="flex-1 text-[15px] font-bold text-ui-accent">{t('yatraSettings.choose')}</span>
            <span aria-hidden className="text-lg text-ui-faint2">›</span>
          </button>
          <span className="text-xs font-semibold text-ui-muted">{t('yatraSettings.notLinked')}</span>
        </>
      ) : (
        <div className={`${slot} border-dashed`}>
          <TypeIcon type={y.data_type} />
          <span className="flex min-w-0 flex-1 flex-col text-[13px]">
            <span className="font-bold text-ui-ink">{t('yatraSettings.noneOfType', { type: t(typeLabelKey(y.data_type)) })}</span>
            <span className="text-ui-muted">
              {t('yatraSettings.nothingYet')}{' '}
              <Link to="/user/practices" className="font-bold text-ui-accent">{t('yatraSettings.addInMyPractices')}</Link>
            </span>
          </span>
        </div>
      )}
    </li>
  )
}

export function LinkPracticesMobileScreen() {
  return (
    <MobileShell>
      <LinkPracticesMobile />
    </MobileShell>
  )
}
```

(Remove the `{pickerFor && leaving && null}` line when Tasks 5–6 wire the sheets; it only keeps the state "used" for lint until then.)

`router.tsx`: add the lazy import next to the other yatras screens:

```tsx
const LinkPracticesMobileScreen = lazy(() => import('./features/yatras/settings/mobile/LinkPracticesMobile').then((m) => ({ default: m.LinkPracticesMobileScreen })))
```

remove `{ path: '/yatra/:id/settings', element: <YatraSettingsPage /> }` from the `AppShell` children, and add next to the `/yatras` route:

```tsx
      {
        path: '/yatra/:id/settings',
        element: <ByLayout mobile={<LinkPracticesMobileScreen />} legacy={<AppShell />} />,
        children: [{ index: true, element: <YatraSettingsPage /> }],
      },
```

`YatraJoinPage.tsx` line 33: `navigate(\`/yatra/${id}/settings?joined=1\`, { replace: true })`.

Add the table's strings to all three locale files under `yatraSettings`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/yatras/settings src/router* && npm run lint`
Expected: PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings app-react/src/router.tsx app-react/src/pages/yatras/YatraJoinPage.tsx app-react/public/locales
git commit -m "feat(yatras): mobile Link your practices screen"
```

---

### Task 5: Picker sheet (12m5, 12m25)

**Files:**
- Create: `app-react/src/features/yatras/settings/mobile/LinkPickerSheet.tsx`
- Modify: `app-react/src/features/yatras/settings/mobile/LinkPracticesMobile.tsx` (render the sheet; drop the placeholder line's `pickerFor` part)
- Test: add cases to `LinkPracticesMobile.test.tsx`
- Modify: locales

**Interfaces:**
- Consumes: Task 2 `pickerGroups`; Task 3 `link`; Task 4 `TypeIcon`, `typeLabelKey`.
- Produces: `LinkPickerSheet({ item, groups, onPick(name: string | null), onClose })`.

**Strings** (en / ru / uk):

| key | en | ru | uk |
|---|---|---|---|
| pickerTitle | Link to “{{name}}” | Связать с «{{name}}» | Зв’язати з «{{name}}» |
| pickerOnly | Only {{type}} practices can fill it | Подойдёт только практика типа «{{type}}» | Підійде лише практика типу «{{type}}» |
| close | Close | Закрыть | Закрити |
| groupSuggested | Suggested | Предлагаем | Пропонуємо |
| groupOther | Your {{type}} practices | Ваши практики типа «{{type}}» | Ваші практики типу «{{type}}» |
| dontLink | Don't link | Не связывать | Не зв’язувати |
| dontLinkHint | Your entries won't appear | Ваши записи не попадут в таблицу | Ваші записи не потраплять у таблицю |
| groupLinkedHere | Already linked in this yatra | Уже связано в этой ятре | Уже зв’язано в цій ятрі |
| linkedTo | Linked to {{name}} · moving unlinks it there | Связано с «{{name}}» · там связь исчезнет | Зв’язано з «{{name}}» · там зв’язок зникне |
| moveHere | Move here | Перенести сюда | Перенести сюди |
| groupCant | Can't link here | Здесь не подходит | Тут не підходить |
| needsType | {{has}} · this needs a {{needs}} | {{has}} · здесь нужна «{{needs}}» | {{has}} · тут потрібна «{{needs}}» |
| inactive | Inactive · turn it on in My practices | Неактивна · включите в «Моих практиках» | Неактивна · увімкніть у «Моїх практиках» |
| timeOrDuration | Time of day or Duration? | Время суток или длительность? | Час доби чи тривалість? |
| timeHint | when it happened | когда это было | коли це сталося |
| durationHint | how long it took | сколько это длилось | скільки це тривало |
| current | Current | Сейчас | Зараз |

- [ ] **Step 1: Write the failing tests** (append to `LinkPracticesMobile.test.tsx`)

```tsx
describe('LinkPickerSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockLinkApi()
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: '1', practice: 'Japa rounds', data_type: 'Int', is_active: true },
      { id: '2', practice: 'Lecture listening', data_type: 'Duration', is_active: true },
      { id: '3', practice: 'Book reading', data_type: 'Duration', is_active: true },
      { id: '4', practice: 'Wake-up time', data_type: 'Time', is_active: true },
      { id: '5', practice: 'Exercise', data_type: 'Duration', is_active: false },
    ])
    api.getYatraUserPractices.mockResolvedValue([
      { yatra_practice: { id: 'a', practice: 'Reading', data_type: 'Duration' }, user_practice: 'Book reading' },
      { yatra_practice: { id: 'b', practice: 'Hearing lectures', data_type: 'Duration' }, user_practice: null },
    ])
  })

  async function openPicker() {
    renderLinkScreen()
    const row = (await screen.findByText('Hearing lectures')).closest('li')!
    fireEvent.click(within(row).getByText('Lecture listening'))
    return screen.getByRole('dialog', { name: 'Link to “Hearing lectures”' })
  }

  it('lists every practice in its group, with reasons', async () => {
    const sheet = await openPicker()
    expect(within(sheet).getByText('Only Duration practices can fill it')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /Lecture listening/ })).toBeInTheDocument()
    expect(within(sheet).getByText('Linked to Reading · moving unlinks it there')).toBeInTheDocument()
    expect(within(sheet).getByText('Time of day · this needs a Duration')).toBeInTheDocument()
    expect(within(sheet).getByText('Number · this needs a Duration')).toBeInTheDocument()
    expect(within(sheet).getByText('Inactive · turn it on in My practices')).toBeInTheDocument()
    expect(within(sheet).getByText('Time of day or Duration?')).toBeInTheDocument()
  })

  it('Move here sends one request with the link moved', async () => {
    const sheet = await openPicker()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Move here' }))
    await waitFor(() => expect(api.updateYatraUserPractices).toHaveBeenCalledOnce())
    expect(api.updateYatraUserPractices.mock.calls[0][1].map((i) => i.user_practice)).toEqual([null, 'Book reading'])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("Don't link unlinks a linked row", async () => {
    renderLinkScreen()
    const row = (await screen.findByText('Reading')).closest('li')!
    fireEvent.click(within(row).getByText('Book reading'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Don't link/ }))
    await waitFor(() => expect(api.updateYatraUserPractices.mock.calls[0][1].map((i) => i.user_practice)).toEqual([null, null]))
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/yatras/settings/mobile/LinkPracticesMobile.test.tsx`
Expected: FAIL — no dialog named "Link to “Hearing lectures”".

- [ ] **Step 3: Implement** — `LinkPickerSheet.tsx`

```tsx
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import type { YatraUserPracticeItem } from '../../../../types/api'
import type { PickerGroups } from '../linking'
import { TypeIcon, typeLabelKey } from './TypeChip'

const ROW = 'flex min-h-[54px] w-full items-center gap-2.5 bg-ui-surface px-3.5 py-2 text-left'

function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {label && <h3 className="px-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{label}</h3>}
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-ui-hairline bg-ui-hairline">{children}</div>
    </section>
  )
}

function Line({ title, hint, muted }: { title: string; hint?: string; muted?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={`truncate text-[15px] font-bold ${muted ? 'text-ui-faint2' : 'text-ui-ink'}`}>{title}</span>
      {hint && <span className="text-xs font-medium text-ui-muted">{hint}</span>}
    </span>
  )
}

export function LinkPickerSheet({ item, groups, onPick, onClose }: {
  item: YatraUserPracticeItem; groups: PickerGroups; onPick: (name: string | null) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const y = item.yatra_practice
  const typeName = (type: typeof y.data_type) => t(typeLabelKey(type))
  const pick = (name: string | null) => { onPick(name); onClose() }
  const choices = [
    ...(groups.current ? [{ p: groups.current, current: true }] : []),
    ...groups.compatible.map((p) => ({ p, current: false })),
  ]

  return (
    <BottomSheet label={t('yatraSettings.pickerTitle', { name: y.practice })} onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-extrabold text-ui-ink">{t('yatraSettings.pickerTitle', { name: y.practice })}</h2>
          <p className="text-sm text-ui-muted">{t('yatraSettings.pickerOnly', { type: typeName(y.data_type) })}</p>
        </div>
        <button type="button" aria-label={t('yatraSettings.close')} onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-chip text-lg text-ui-ink">×</button>
      </div>

      {groups.suggested && (
        <Group label={t('yatraSettings.groupSuggested')}>
          <button type="button" onClick={() => pick(groups.suggested!.practice)} className={ROW}>
            <TypeIcon type={y.data_type} /><Line title={groups.suggested.practice} hint={typeName(y.data_type)} />
          </button>
        </Group>
      )}
      {choices.length > 0 && (
        <Group label={t('yatraSettings.groupOther', { type: typeName(y.data_type) })}>
          {choices.map(({ p, current }) => (
            <button key={p.id} type="button" onClick={() => pick(p.practice)} className={ROW}>
              <TypeIcon type={y.data_type} /><Line title={p.practice} />
              {current && <span className="text-xs font-extrabold text-ui-good">✓ {t('yatraSettings.current')}</span>}
            </button>
          ))}
        </Group>
      )}
      <Group>
        <button type="button" onClick={() => pick(null)} className={ROW}>
          <Line title={t('yatraSettings.dontLink')} hint={t('yatraSettings.dontLinkHint')} />
        </button>
      </Group>
      {groups.linkedElsewhere.length > 0 && (
        <Group label={t('yatraSettings.groupLinkedHere')}>
          {groups.linkedElsewhere.map(({ practice, linkedTo }) => (
            <div key={practice.id} className={ROW}>
              <TypeIcon type={y.data_type} />
              <Line title={practice.practice} hint={t('yatraSettings.linkedTo', { name: linkedTo.practice })} />
              <button type="button" onClick={() => pick(practice.practice)}
                className="h-9 shrink-0 rounded-[10px] border border-ui-control px-3 text-[13px] font-extrabold text-ui-ink">
                {t('yatraSettings.moveHere')}
              </button>
            </div>
          ))}
        </Group>
      )}
      {groups.cantLink.length > 0 && (
        <Group label={t('yatraSettings.groupCant')}>
          {groups.cantLink.map(({ practice, reason }) => (
            <div key={practice.id} aria-disabled className={ROW}>
              <TypeIcon type={practice.data_type} />
              <Line muted title={practice.practice}
                hint={reason === 'inactive'
                  ? t('yatraSettings.inactive')
                  : t('yatraSettings.needsType', { has: typeName(practice.data_type), needs: typeName(y.data_type) })} />
            </div>
          ))}
        </Group>
      )}
      {(y.data_type === 'Time' || y.data_type === 'Duration') && (
        <section className="flex flex-col gap-2 rounded-2xl bg-ui-field p-3.5">
          <h3 className="text-[13px] font-extrabold text-ui-ink">{t('yatraSettings.timeOrDuration')}</h3>
          <p className="flex items-center gap-2 text-[13px] text-ui-ink2">
            <TypeIcon type="Time" /><b>{t('yatraSettings.typeTime')}</b>
            <span className="font-ui-mono">05:30</span><span className="text-ui-muted">{t('yatraSettings.timeHint')}</span>
          </p>
          <p className="flex items-center gap-2 text-[13px] text-ui-ink2">
            <TypeIcon type="Duration" /><b>{t('yatraSettings.typeDuration')}</b>
            <span className="font-ui-mono">1:30</span><span className="text-ui-muted">{t('yatraSettings.durationHint')}</span>
          </p>
        </section>
      )}
    </BottomSheet>
  )
}
```

(The spec places the explainer after the "Can't link here" header; placing it at the end of the sheet, right after that group, matches 12m5's visual order.)

In `LinkPracticesMobile.tsx` add `import { pickerGroups } from '../linking'` and `import { LinkPickerSheet } from './LinkPickerSheet'`, replace the placeholder line's picker part with:

```tsx
      {pickerFor && (() => {
        const item = s.items.find((i) => i.yatra_practice.id === pickerFor)
        return item && (
          <LinkPickerSheet item={item} groups={pickerGroups(s.items, s.practices, pickerFor)}
            onPick={(name) => s.link(pickerFor, name)} onClose={() => setPickerFor(null)} />
        )
      })()}
```

Add the strings to the three locale files.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/yatras/settings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings app-react/public/locales
git commit -m "feat(yatras): practice picker with every practice and the reason it can't link"
```

---

### Task 6: Leave yatra (12m6, 12m7)

**Files:**
- Create: `app-react/src/features/yatras/settings/mobile/LeaveSheets.tsx`
- Modify: `LinkPracticesMobile.tsx` (render; delete the placeholder line)
- Test: add cases to `LinkPracticesMobile.test.tsx`
- Modify: locales

**Interfaces:**
- Consumes: Task 3 `leave`, `users`, `me`.
- Produces: `LeaveSheets({ yatraId, yatraName, lastAdmin: boolean, leaving: boolean, onLeave(), onClose })`.

**Strings** (en / ru / uk):

| key | en | ru | uk |
|---|---|---|---|
| leaveTitle | Leave {{name}}? | Покинуть «{{name}}»? | Покинути «{{name}}»? |
| leaveText | You'll disappear from its table. Your practices and entries stay in your account. To come back you'll need a new invite. | Вы исчезнете из её таблицы. Ваши практики и записи останутся в аккаунте. Чтобы вернуться, понадобится новое приглашение. | Ви зникнете з її таблиці. Ваші практики й записи залишаться в акаунті. Щоб повернутися, знадобиться нове запрошення. |
| lastAdminTitle | You're the last admin | Вы последний админ | Ви останній адмін |
| lastAdminText | Last yatra admin can't leave. Add another admin or delete the yatra instead. | Последний админ не может покинуть ятру. Назначьте другого админа или удалите ятру. | Останній адмін не може покинути ятру. Призначте іншого адміна або видаліть ятру. |
| chooseAdmin | Choose another admin | Выбрать другого админа | Обрати іншого адміна |
| deleteYatra | Delete yatra… | Удалить ятру… | Видалити ятру… |

(`common.cancel` exists.) Phase 1 links "Choose another admin" to `/yatra/:id/admin/settings` and "Delete yatra…" to `/yatra/:id/admin/settings` too; phase 2 retargets them to `/admin/members` and `/admin/danger`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('Leave yatra', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }) })

  it('asks first, then leaves and goes to the Yatras screen', async () => {
    mockLinkApi(false)
    api.leaveYatra.mockResolvedValue()
    renderLinkScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Leave yatra' }))
    const sheet = screen.getByRole('dialog', { name: "Leave Balarama's League?" })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Leave yatra' }))
    expect(await screen.findByText('Yatras page')).toBeInTheDocument()
    expect(api.leaveYatra).toHaveBeenCalledWith('y1')
  })

  it('the last admin gets the explanation and nothing is sent', async () => {
    mockLinkApi(true) // u1 is the only admin
    renderLinkScreen()
    fireEvent.click(await screen.findByRole('button', { name: 'Leave yatra' }))
    const sheet = screen.getByRole('dialog', { name: "You're the last admin" })
    expect(within(sheet).getByRole('link', { name: 'Choose another admin' })).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.leaveYatra).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/yatras/settings/mobile/LinkPracticesMobile.test.tsx`
Expected: FAIL — no dialog.

- [ ] **Step 3: Implement** — `LeaveSheets.tsx`

```tsx
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'

const BTN = 'flex h-[50px] items-center justify-center rounded-[14px] text-[15px] font-bold'

export function LeaveSheets({ yatraId, yatraName, lastAdmin, leaving, onLeave, onClose }: {
  yatraId: string; yatraName: string; lastAdmin: boolean; leaving: boolean; onLeave: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const cancel = (
    <button type="button" onClick={onClose} className={`${BTN} border border-ui-control text-ui-ink`}>{t('common.cancel')}</button>
  )
  if (lastAdmin) {
    const title = t('yatraSettings.lastAdminTitle')
    return (
      <BottomSheet label={title} onClose={onClose}>
        <h2 className="text-xl font-extrabold text-ui-ink">{title}</h2>
        <p className="text-sm leading-normal text-ui-ink2">{t('yatraSettings.lastAdminText')}</p>
        <div className="flex flex-col gap-2.5">
          {/* ponytail: phase 2 points these at /admin/members and /admin/danger */}
          <Link to={`/yatra/${yatraId}/admin/settings`} className={`${BTN} bg-ui-primary text-ui-on-primary`}>{t('yatraSettings.chooseAdmin')}</Link>
          <Link to={`/yatra/${yatraId}/admin/settings`} className={`${BTN} border border-ui-control text-ui-danger`}>{t('yatraSettings.deleteYatra')}</Link>
          {cancel}
        </div>
      </BottomSheet>
    )
  }
  const title = t('yatraSettings.leaveTitle', { name: yatraName })
  return (
    <BottomSheet label={title} onClose={onClose}>
      <h2 className="text-xl font-extrabold text-ui-ink">{title}</h2>
      <p className="text-sm leading-normal text-ui-ink2">{t('yatraSettings.leaveText')}</p>
      <div className="flex flex-col gap-2.5">
        <button type="button" disabled={leaving} onClick={onLeave} className={`${BTN} bg-ui-danger text-white disabled:opacity-60`}>
          {t('yatraSettings.leave')}
        </button>
        {cancel}
      </div>
    </BottomSheet>
  )
}
```

In `LinkPracticesMobile.tsx`: import `LeaveSheets` and `useNavigate`; `const navigate = useNavigate()`; delete the placeholder line; add:

```tsx
      {leaving && s.yatra && (
        <LeaveSheets yatraId={id} yatraName={s.yatra.name}
          lastAdmin={!!s.me?.is_admin && s.users.filter((u) => u.is_admin).length === 1}
          leaving={s.leave.isPending} onClose={() => setLeaving(false)}
          onLeave={() => s.leave.mutate(undefined, { onSuccess: () => navigate('/yatras', { replace: true }) })} />
      )}
```

Add strings to the three locale files.

- [ ] **Step 4: Run tests and lint**

Run: `npx vitest run src/features/yatras/settings && npm run lint`
Expected: PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras/settings app-react/public/locales
git commit -m "feat(yatras): leave a yatra from the link page; explain the last-admin case"
```

---

### Task 7: Yatra screen — Settings action, unlinked banner, "not linked" cells (12m1)

**Files:**
- Modify: `app-react/src/features/yatras/mobile/YatrasMobile.tsx`
- Test: `app-react/src/features/yatras/mobile/YatrasMobile.test.tsx`
- Modify: locales

**Interfaces:**
- Consumes: Task 2 `unlinked`, `laterDismissed`, `dismissLater`; Task 4 `joinNames` (exported from `LinkPracticesMobile.tsx`).

**Strings** (en / ru / uk):

| key | en | ru | uk |
|---|---|---|---|
| bannerTitle_one / _other (ru, uk: + _few, _many) | {{count}} of your practices isn't linked / aren't linked | {{count}} ваших практик не связаны (all forms; _one: «{{count}} ваша практика не связана») | {{count}} ваших практик не зв’язані (_one: «{{count}} ваша практика не зв’язана») |
| bannerText | What you log for {{names}} won't appear in this table. | {{names}}: ваши записи не попадут в эту таблицу. | {{names}}: ваші записи не потраплять у цю таблицю. |
| linkPractices | Link practices | Связать практики | Зв’язати практики |
| later | Later | Позже | Пізніше |
| notLinkedCell | not linked | не связано | не зв’язано |

- [ ] **Step 1: Write the failing tests** (add to `YatrasMobile.test.tsx`; extend the `vi.mock` with `getYatraUserPractices: vi.fn(), getYatraUsers: vi.fn()`, set `useAuthStore.setState({ user: { id: 'u1', … } })` in `beforeEach`, and in `beforeEach` mock `api.getYatraUserPractices.mockResolvedValue([{ yatra_practice: { id: 'p1', practice: 'Rounds', data_type: 'Int' }, user_practice: null }])` and `api.getYatraUsers.mockResolvedValue([])`; the existing test's `getYatraData` row is `u1` so update its expectation of `'16'` by first resolving the mapping to linked in that test: `api.getYatraUserPractices.mockResolvedValueOnce([{ …, user_practice: 'Rounds' }])`)

```tsx
  it('shows the unlinked banner; Later hides it until the set changes', async () => {
    renderScreen()
    expect(await screen.findByText('1 of your practices isn\'t linked')).toBeInTheDocument()
    expect(screen.getByText("What you log for Rounds won't appear in this table.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Link practices' })).toHaveAttribute('href', '/yatra/y1/settings')
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByText('1 of your practices isn\'t linked')).toBeNull()
    expect(localStorage.getItem('yatra_link_later_y1')).toBe('p1')
  })

  it("marks the user's own unlinked cells", async () => {
    renderScreen()
    expect(await screen.findByText('not linked')).toBeInTheDocument()
  })

  it('has a Settings action to the link page', async () => {
    renderScreen()
    expect(await screen.findByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/yatra/y1/settings')
  })
```

(add `fireEvent` to the testing-library import and `localStorage.clear()` to `beforeEach`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/yatras/mobile/YatrasMobile.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** in `YatrasMobile.tsx`

Imports:

```tsx
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { yatrasApi } from '../../../api/yatras'
import { useAuthStore } from '../../../store/authStore'
import { dismissLater, laterDismissed, unlinked } from '../settings/linking'
import { joinNames } from '../settings/mobile/LinkPracticesMobile'
```

Inside `YatrasMobile`, after `const data = y.data`:

```tsx
  const userId = useAuthStore((s) => s.user?.id)
  const linksQ = useQuery({
    queryKey: ['yatra-user-practices', y.yatra?.id],
    queryFn: () => yatrasApi.getYatraUserPractices(y.yatra!.id),
    enabled: !!y.yatra,
  })
  const missing = unlinked(linksQ.data ?? [])
  const missingIds = missing.map((p) => p.id)
  const [, rerender] = useState(0) // Later writes localStorage; re-render to re-read it
  const showBanner = !!y.yatra && missing.length > 0 && !laterDismissed(y.yatra.id, missingIds)
```

Replace the `actions` array: drop the Settings entry (it becomes a header link) — keep `createNewYatra` for now (Task 8 removes it):

```tsx
  const actions = [{ label: t('yatras.createNewYatra'), onSelect: () => setCreating(true) }]
```

and in the yatra/date row, add before the date button:

```tsx
            <Link to={`/yatra/${y.yatra.id}/settings`} className="flex min-h-9 shrink-0 items-center text-[13px] font-bold text-ui-accent">
              {t('nav.settings')}
            </Link>
```

(wrap the date button and this link in `<div className="flex items-center gap-3">`.)

Banner, rendered right after the yatra/date row:

```tsx
        {showBanner && (
          <section className="flex flex-col gap-2.5 rounded-[18px] border border-ui-accent-pill bg-ui-accent-soft p-4">
            <h2 className="text-[15px] font-extrabold text-ui-ink">{t('yatraSettings.bannerTitle', { count: missing.length })}</h2>
            <p className="text-sm leading-normal text-ui-ink2">
              {t('yatraSettings.bannerText', { names: joinNames(missing.map((p) => p.practice), i18n.language || 'en') })}
            </p>
            <div className="flex gap-2.5">
              <Link to={`/yatra/${y.yatra!.id}/settings`}
                className="flex h-11 items-center rounded-xl bg-ui-primary px-4 text-sm font-bold text-ui-on-primary">
                {t('yatraSettings.linkPractices')}
              </Link>
              <button type="button" onClick={() => { dismissLater(y.yatra!.id, missingIds); rerender((n) => n + 1) }}
                className="h-11 rounded-xl px-4 text-sm font-bold text-ui-ink">
                {t('yatraSettings.later')}
              </button>
            </div>
          </section>
        )}
```

Cells — in the `data.data.map` call, pass the row owner's unlinked practices:

```tsx
                  cells={data.practices.map((p, j) => {
                    const notLinked = row.user_id === userId && missingIds.includes(p.id)
                    return {
                      name: p.practice,
                      text: notLinked ? t('yatraSettings.notLinkedCell') : cellText(row.row[j], p.data_type, units) || '—',
                      bg: !notLinked && p.colour_zones ? ZONE_BG[findZone(row.row[j], p.colour_zones)] : '',
                      muted: notLinked,
                    }
                  })} />
```

and in `MemberCard`, extend `Cell` with `muted?: boolean` and render the value with `className={\`truncate font-ui-mono font-semibold ${c.muted ? 'text-[11px] text-ui-faint2' : 'text-[15px] text-ui-ink'}\`}`.

Add strings to the three locale files.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/yatras`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras app-react/public/locales
git commit -m "feat(yatras): unlinked-practices banner and a Settings link on the Yatra screen"
```

---

### Task 8: Yatra switcher sheet with New yatra (12m8)

**Files:**
- Create: `app-react/src/features/yatras/mobile/YatraSwitcherSheet.tsx`
- Modify: `app-react/src/features/yatras/mobile/YatrasMobile.tsx` (replace the AnchoredMenu and `CreateSheet` usage; drop the ⋯ actions)
- Test: `YatrasMobile.test.tsx`
- Modify: locales

**Interfaces:**
- Consumes: `useYatras().yatras`, `.select`, `.create`; `CreateSheet` stays exported for `YatrasTablet.tsx`, which imports it.
- Produces: `YatraSwitcherSheet({ yatras, currentId, onSelect(id), create(name), pending, onClose })`.

**Strings** (en / ru / uk):

| key | en | ru | uk |
|---|---|---|---|
| yourYatras | Your yatras | Ваши ятры | Ваші ятри |
| roleAdmin | Admin | Админ | Адмін |
| roleMember | Member | Участник | Учасник |
| members_one / _other (+ru/uk _few/_many) | {{count}} member(s) | {{count}} участник / участника / участников | {{count}} учасник / учасники / учасників |
| newYatra | New yatra | Новая ятра | Нова ятра |
| newName | Name | Название | Назва |
| newHint | You'll be its admin. Add practices and invite devotees next. | Вы станете её админом. Затем добавьте практики и пригласите преданных. | Ви станете її адміном. Потім додайте практики й запросіть відданих. |
| createYatra | Create yatra | Создать ятру | Створити ятру |

- [ ] **Step 1: Write the failing test** (extend the mock with `getYatraUsers`, which `beforeEach` now resolves to `[{ user_id: 'u1', user_name: 'Me', is_admin: true }, { user_id: 'u2', user_name: 'B', is_admin: false }]`)

```tsx
  it('switcher lists yatras with role and members, and creates a new one', async () => {
    api.createYatra.mockResolvedValue({ id: 'y2', name: 'Kartika 2026', show_stability_metrics: false })
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: "Lord Balarama's League" }))
    const sheet = screen.getByRole('dialog', { name: 'Your yatras' })
    expect(await within(sheet).findByText('Admin · 2 members')).toBeInTheDocument()
    fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Kartika 2026' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Create yatra' }))
    await waitFor(() => expect(api.createYatra).toHaveBeenCalled())
    expect(api.createYatra.mock.calls[0][0]).toBe('Kartika 2026')
  })
```

(import `within`, `waitFor`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/yatras/mobile/YatrasMobile.test.tsx`
Expected: FAIL — no dialog "Your yatras".

- [ ] **Step 3: Implement** — `YatraSwitcherSheet.tsx`

```tsx
import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../../api/yatras'
import { useAuthStore } from '../../../store/authStore'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import type { Yatra } from '../../../types/api'

export function YatraSwitcherSheet({ yatras, currentId, onSelect, create, pending, onClose }: {
  yatras: Yatra[]; currentId?: string; onSelect: (id: string) => void
  create: (name: string) => void; pending: boolean; onClose: () => void
}) {
  const { t } = useTranslation()
  const userId = useAuthStore((s) => s.user?.id)
  const [name, setName] = useState('')
  // ponytail: one users call per yatra, only while the sheet is open; add counts to GET /yatras if lists get long.
  const users = useQueries({
    queries: yatras.map((y) => ({ queryKey: ['yatra-users', y.id], queryFn: () => yatrasApi.getYatraUsers(y.id) })),
  })
  const submit = () => { if (name.trim()) create(name.trim()) }

  return (
    <BottomSheet label={t('yatraSettings.yourYatras')} onClose={onClose}>
      <h2 className="text-xl font-extrabold text-ui-ink">{t('yatraSettings.yourYatras')}</h2>
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-ui-hairline bg-ui-hairline">
        {yatras.map((y, i) => {
          const list = users[i]?.data
          const admin = list?.find((u) => u.user_id === userId)?.is_admin
          return (
            <button key={y.id} type="button" onClick={() => { onSelect(y.id); onClose() }}
              className="flex min-h-[58px] items-center gap-3 bg-ui-surface px-4 py-2 text-left">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-bold text-ui-ink">{y.name}</span>
                {list && (
                  <span className="text-xs text-ui-muted">
                    {t(admin ? 'yatraSettings.roleAdmin' : 'yatraSettings.roleMember')} · {t('yatraSettings.members', { count: list.length })}
                  </span>
                )}
              </span>
              {y.id === currentId && <span aria-hidden className="font-extrabold text-ui-accent">✓</span>}
            </button>
          )
        })}
      </div>
      <section className="flex flex-col gap-2.5 rounded-2xl border border-ui-hairline bg-ui-surface p-4">
        <h3 className="text-[15px] font-extrabold text-ui-ink">{t('yatraSettings.newYatra')}</h3>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ui-muted">{t('yatraSettings.newName')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            className="h-[50px] rounded-[14px] border border-ui-control bg-ui-field px-4 font-semibold text-ui-ink outline-none" />
        </label>
        <p className="text-xs text-ui-muted">{t('yatraSettings.newHint')}</p>
        <button type="button" disabled={!name.trim() || pending} onClick={submit}
          className="h-[50px] rounded-[14px] bg-ui-primary text-[15px] font-bold text-ui-on-primary disabled:opacity-60">
          {t('yatraSettings.createYatra')}
        </button>
      </section>
    </BottomSheet>
  )
}
```

In `YatrasMobile.tsx`: replace `menuAnchor` state with `const [switching, setSwitching] = useState(false)`; the yatra-name button's `onClick` becomes `() => setSwitching(true)` (keep `aria-haspopup="dialog"`); remove the `AnchoredMenu` block and the `actions` prop from `AppBar`; keep `creating`/`CreateSheet` only for the empty state ("Create a Yatra" button). Render:

```tsx
      {switching && (
        <YatraSwitcherSheet yatras={y.yatras} currentId={y.yatra?.id} onSelect={y.select} onClose={() => setSwitching(false)}
          pending={y.create.isPending}
          create={(name) => y.create.mutate(name, { onSuccess: (created) => { setSwitching(false); navigate(`/yatra/${created.id}/settings`) } })} />
      )}
```

Remove now-unused imports (`AnchoredMenu`, `MenuItem`). Add strings to the three locale files.

- [ ] **Step 4: Run tests and lint**

Run: `npx vitest run src/features/yatras && npm run lint`
Expected: PASS (`YatrasTablet` tests unaffected), lint clean.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/yatras app-react/public/locales
git commit -m "feat(yatras): yatra switcher sheet with roles, member counts and New yatra"
```

---

### Task 9: Yatras section in the mobile Settings hub

**Files:**
- Modify: `app-react/src/features/settings/mobile/SettingsMobile.tsx`
- Test: `app-react/src/features/settings/mobile/SettingsMobile.test.tsx`
- Modify: locales (`settings.yatras`: "Yatras" / "Ятры" / "Ятри")

**Interfaces:**
- Consumes: `yatrasApi.getYatras`, `yatrasApi.getYatraUsers`; Task 8's `yatraSettings.roleAdmin/roleMember`.
- Note: `SettingsList` is shared by mobile and desktop. The section goes in `SettingsMobile` only (between the heading and `SettingsList` would misplace it), so add a `yatras` slot prop: `SettingsList({ extra }: { extra?: ReactNode })` rendered after the Preferences group, and pass it only from `SettingsMobile`.

- [ ] **Step 1: Write the failing test** — SettingsMobile now needs a QueryClient. Wrap `renderScreen` in `QueryClientProvider` (new `QueryClient({ defaultOptions: { queries: { retry: false } } })`), mock `../../../api/yatras` with `getYatras` / `getYatraUsers` (`getYatras` resolving `[]` by default), then:

```tsx
  it('lists yatras with the role, each linking to its settings', async () => {
    vi.mocked(yatrasApi.getYatras).mockResolvedValue([{ id: 'y1', name: 'League', show_stability_metrics: false }])
    vi.mocked(yatrasApi.getYatraUsers).mockResolvedValue([{ user_id: '1', user_name: 'Test User', is_admin: true }])
    renderScreen()
    const row = await screen.findByRole('link', { name: /League/ })
    expect(row).toHaveAttribute('href', '/yatra/y1/settings')
    expect(await within(row).findByText('Admin')).toBeInTheDocument()
  })

  it('hides the section without yatras', async () => {
    renderScreen()
    await waitFor(() => expect(yatrasApi.getYatras).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: 'Yatras' })).toBeNull()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/settings`
Expected: FAIL.

- [ ] **Step 3: Implement** — in `SettingsMobile.tsx`

```tsx
function YatraRows() {
  const { t } = useTranslation()
  const userId = useAuthStore((s) => s.user?.id)
  const { data: yatras = [] } = useQuery({ queryKey: ['yatras'], queryFn: yatrasApi.getYatras })
  const users = useQueries({
    queries: yatras.map((y) => ({ queryKey: ['yatra-users', y.id], queryFn: () => yatrasApi.getYatraUsers(y.id) })),
  })
  if (!yatras.length) return null
  return (
    <ListGroup label={t('settings.yatras')}>
      {yatras.map((y, i) => {
        const admin = users[i]?.data?.find((u) => u.user_id === userId)?.is_admin
        return (
          <SettingsRow key={y.id} label={y.name} to={`/yatra/${y.id}/settings`}
            value={admin === undefined ? undefined : t(admin ? 'yatraSettings.roleAdmin' : 'yatraSettings.roleMember')} />
        )
      })}
    </ListGroup>
  )
}
```

`SettingsMobile` renders `<SettingsList extra={<YatraRows />} />`; `SettingsList({ extra }: { extra?: ReactNode })` renders `{extra}` right after the Preferences `ListGroup`. Imports: `useQuery`, `useQueries` from `@tanstack/react-query`, `yatrasApi`, `useAuthStore`, `SettingsRow`, `ReactNode` type.

Check `features/settings/desktop/SettingsDesktop.tsx` still renders `SettingsList` without the prop (no change needed). If the desktop/tablet Settings tests render without a QueryClient they're unaffected, since `YatraRows` is only in mobile.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/settings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/features/settings app-react/public/locales
git commit -m "feat(settings): Yatras section on the mobile Settings hub"
```

---

### Task 10: Verify

- [ ] **Step 1: Full checks in the dev container**

```bash
docker exec <container> bash -lc 'cd /workspaces/sadhana-pro/app-react && npm run lint && npx vitest run && npm run build'
```

Expected: lint clean, all tests pass, build succeeds.

- [ ] **Step 2: Manual run at mobile width (390×844)** — `make run` in the container, open `localhost:8080`:
  - Yatra screen: banner appears with unlinked practices; Later hides it; Settings link opens the link page.
  - Link page: link a suggestion, Undo, Link all suggested, picker with Move here, Don't link; ru and uk (Settings → Language) wrap without truncation.
  - Leave as member (confirm) and as last admin (explanation).
  - Switcher: roles and member counts; New yatra lands on its link page.
  - Settings tab: Yatras rows.
  - Repeat the link page in dark theme.
  - Tablet width (820): `/yatra/:id/settings` still shows the legacy page.

- [ ] **Step 3: Commit any fixes** from the manual pass with specific messages.
