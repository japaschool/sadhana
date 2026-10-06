# Mobile Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile Settings hub (design frames 4a/4b, Theme row from 2d) in the new `MobileShell`. It covers inline language, theme, preview-channel and logout controls. Sub-pages stay legacy.

**Architecture:**
- `/settings` gets its own `ByLayout` route, the way `/` did. Mobile renders `SettingsMobileScreen`; every other layout keeps the legacy `SettingsPage` in `AppShell`.
- A theme preference (`localStorage['ui-theme']` → `data-ui-theme` on `<html>`) overrides `prefers-color-scheme` through CSS only.
- The preview channel is a cookie port of `frontend/src/utils/release_channel.rs`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, react-router 7, react-i18next, zustand, Vitest + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-06-mobile-settings-redesign-design.md`

## Global Constraints

- All commands run from `app-react/` on the host. Tests: `npx vitest run <path>`. Types: `npx tsc -b`. Lint: `npm run lint`.
- **No new dependencies.**
- New code uses only the `ui-*` Tailwind colours from `src/ui/theme.css`. No DaisyUI classes and no imports from `src/theme/tokens.ts`.
- Dark palette: the existing 1a-dark tokens. 4b's hexes (`#17151F`, `#221F2C`, `#F08A74`, …) are **not** adopted. Logout uses `--ui-danger`.
- Every user-visible string goes through i18n, with keys in `en`, `ru` and `uk` (`public/locales/*/translation.json`). English test strings also go in `src/test/setup.ts`. Language names stay native ("English", "Русский", "Українська") and are not translated.
- Portalled UI (menus, sheets) goes through the existing `AnchoredMenu` / `BottomSheet`, which already use `UiPortal`.
- Legacy `SettingsPage` and `LanguagePage` are **not modified**. Legacy files touched: only `src/router.tsx` (route wiring) and `src/main.tsx` (applies the theme before the first render).
- Theme storage key `'ui-theme'`, values `'light' | 'dark'`, missing = Auto. Every storage read/write is wrapped in try/catch.
- Preview cookie, exactly: `sadhana_release_channel=<preview|stable>; Path=/; Secure; SameSite=Lax; Max-Age=2592000`.
- Commit after every task with a conventional message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Changing the theme while the shell is mounted.** The browser chrome (`theme-color`) and the `<html>` overscroll background must follow the override, not just the system scheme. Test: Task 2 (`re-reads the background when data-ui-theme changes`).
2. **Blocked storage (Safari private mode, disabled site data).** Reading must fall back to Auto, and choosing a theme must not throw. Tests: Task 2 (`falls back to Auto when storage throws`, `setThemePref survives a throwing setItem`).
3. **Look-alike cookies.** `xsadhana_release_channel=preview`, or the value `preview2`, must read as stable, or nginx and the toggle would disagree. Test: Task 1 (`ignores look-alike names and values`).
4. **Unusual user names.** An empty name, one word, extra spaces or lower-case Cyrillic must still give sane initials (`?`, `A`, `АМ`). Test: Task 4 (`initials` table).
5. **Dismissing the logout sheet with Escape.** It must close without logging out. Test: Task 4 (`Escape closes the sheet without logging out`).

---

### Task 1: Preview channel cookie

**Files:**
- Create: `app-react/src/features/settings/releaseChannel.ts`
- Test: `app-react/src/features/settings/releaseChannel.test.ts`

**Interfaces:**
- Produces:
  - `isPreview(): boolean`, which reads `document.cookie`.
  - `setPreview(on: boolean): void`, which writes the cookie only. The caller reloads.

- [ ] **Step 1: Write the failing test**

jsdom drops `Secure` cookies on `http://localhost`, so the test stubs `document.cookie` with an own property.

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { isPreview, setPreview } from './releaseChannel'

function stubCookie(jar: string) {
  const writes: string[] = []
  Object.defineProperty(document, 'cookie', { configurable: true, get: () => jar, set: (v: string) => { writes.push(v) } })
  return writes
}

describe('releaseChannel', () => {
  afterEach(() => { Reflect.deleteProperty(document, 'cookie') })

  it('parses a preview cookie among others', () => {
    stubCookie('foo=bar; sadhana_release_channel=preview; x=1')
    expect(isPreview()).toBe(true)
  })

  it('reads a missing or other value as stable', () => {
    stubCookie('foo=bar')
    expect(isPreview()).toBe(false)
    stubCookie('sadhana_release_channel=stable')
    expect(isPreview()).toBe(false)
  })

  it('ignores look-alike names and values', () => {
    stubCookie('xsadhana_release_channel=preview; sadhana_release_channel=preview2')
    expect(isPreview()).toBe(false)
  })

  it('setPreview writes the exact cookie string', () => {
    const writes = stubCookie('')
    setPreview(true)
    setPreview(false)
    expect(writes).toEqual([
      'sadhana_release_channel=preview; Path=/; Secure; SameSite=Lax; Max-Age=2592000',
      'sadhana_release_channel=stable; Path=/; Secure; SameSite=Lax; Max-Age=2592000',
    ])
  })
})
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run src/features/settings/releaseChannel.test.ts`
Expected: FAIL, because `./releaseChannel` can't be resolved.

- [ ] **Step 3: Implement**

```ts
// Port of frontend/src/utils/release_channel.rs. nginx routes on this cookie, so keep it identical.
const COOKIE = 'sadhana_release_channel'

export function isPreview(): boolean {
  for (const pair of document.cookie.split(';')) {
    const [name, value] = pair.trim().split('=')
    if (name === COOKIE) return value === 'preview'
  }
  return false
}

export function setPreview(on: boolean): void {
  document.cookie = `${COOKIE}=${on ? 'preview' : 'stable'}; Path=/; Secure; SameSite=Lax; Max-Age=2592000`
}
```

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run src/features/settings/releaseChannel.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/releaseChannel.ts src/features/settings/releaseChannel.test.ts
git commit -m "feat(settings): preview channel cookie helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Theme preference (Auto / Light / Dark)

**Files:**
- Create: `app-react/src/ui/theme.ts`, `app-react/src/ui/useTheme.ts`
- Modify: `app-react/src/ui/theme.css` (the dark block), `app-react/src/main.tsx` (apply before render), `app-react/src/layouts/mobile/MobileShell.tsx` (`useShellBackground`)
- Test: `app-react/src/ui/theme.test.ts`, `app-react/src/layouts/mobile/MobileShell.test.tsx`

**Interfaces:**
- Produces:
  - `type ThemePref = 'auto' | 'light' | 'dark'`
  - `getThemePref(): ThemePref`
  - `setThemePref(pref: ThemePref): void`, which writes or removes `localStorage['ui-theme']` and sets or removes `data-ui-theme` on `<html>`.
  - `applyThemePref(): void`, which applies the stored pref to `<html>` without writing.
  - `useTheme(): readonly [ThemePref, (p: ThemePref) => void]`

- [ ] **Step 1: Write the failing theme tests**

`app-react/src/ui/theme.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getThemePref, setThemePref, applyThemePref } from './theme'
import { useTheme } from './useTheme'

const attr = () => document.documentElement.getAttribute('data-ui-theme')

describe('theme preference', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('data-ui-theme')
  })

  it('defaults to Auto with no attribute', () => {
    expect(getThemePref()).toBe('auto')
    applyThemePref()
    expect(attr()).toBeNull()
  })

  it('Light and Dark set data-ui-theme and persist', () => {
    setThemePref('dark')
    expect(attr()).toBe('dark')
    expect(localStorage.getItem('ui-theme')).toBe('dark')
    setThemePref('light')
    expect(attr()).toBe('light')
    expect(getThemePref()).toBe('light')
  })

  it('Auto removes both', () => {
    setThemePref('dark')
    setThemePref('auto')
    expect(attr()).toBeNull()
    expect(localStorage.getItem('ui-theme')).toBeNull()
  })

  it('applyThemePref applies the stored value', () => {
    localStorage.setItem('ui-theme', 'dark')
    applyThemePref()
    expect(attr()).toBe('dark')
  })

  it('treats a junk stored value as Auto', () => {
    localStorage.setItem('ui-theme', 'purple')
    expect(getThemePref()).toBe('auto')
  })

  it('falls back to Auto when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(getThemePref()).toBe('auto')
  })

  it('setThemePref survives a throwing setItem and still applies for the session', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => setThemePref('dark')).not.toThrow()
    expect(attr()).toBe('dark')
  })

  it('useTheme reads and updates the preference', () => {
    localStorage.setItem('ui-theme', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('light')
    act(() => result.current[1]('dark'))
    expect(result.current[0]).toBe('dark')
    expect(attr()).toBe('dark')
  })
})
```

- [ ] **Step 2: Run and check it fails**

Run: `npx vitest run src/ui/theme.test.ts`
Expected: FAIL, because `./theme` can't be resolved.

- [ ] **Step 3: Implement `theme.ts` and `useTheme.ts`**

`app-react/src/ui/theme.ts`:

```ts
export type ThemePref = 'auto' | 'light' | 'dark'

const KEY = 'ui-theme'

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function applyAttr(pref: ThemePref) {
  const html = document.documentElement
  if (pref === 'auto') html.removeAttribute('data-ui-theme')
  else html.setAttribute('data-ui-theme', pref)
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // Blocked storage: the choice still applies until reload.
  }
  applyAttr(pref)
}

/** Call once before the first render so the stored theme shows without a flash. */
export function applyThemePref(): void {
  applyAttr(getThemePref())
}
```

`app-react/src/ui/useTheme.ts`:

```ts
import { useCallback, useState } from 'react'
import { getThemePref, setThemePref, type ThemePref } from './theme'

export function useTheme() {
  const [pref, setPref] = useState(getThemePref)
  const update = useCallback((p: ThemePref) => { setThemePref(p); setPref(p) }, [])
  return [pref, update] as const
}
```

- [ ] **Step 4: Run and check it passes**

Run: `npx vitest run src/ui/theme.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Make the CSS follow the override**

In `app-react/src/ui/theme.css`, replace the block that starts with `@media (prefers-color-scheme: dark) {` and `.ui-root {` with the following. Copy the token values verbatim from the current block; only the selectors change.

```css
/* Dark: an explicit choice (Settings → Theme), or the system when not forced to light.
   The token list appears twice; keep both copies identical. */
:root[data-ui-theme='dark'] .ui-root {
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

@media (prefers-color-scheme: dark) {
  :root:not([data-ui-theme='light']) .ui-root {
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
```

The light override needs no rule of its own: `[data-ui-theme='light']` turns the media block off, so the base `.ui-root` light tokens apply. Portals are covered because `UiPortal` wraps them in `.ui-root`.

Check that the two copies match:

```bash
diff <(sed -n "/^:root\[data-ui-theme='dark'\]/,/^}/p" src/ui/theme.css | grep -- '--ui-\|color-scheme' | tr -d ' ') \
     <(sed -n "/^@media (prefers-color-scheme: dark)/,/^}/p" src/ui/theme.css | grep -- '--ui-\|color-scheme' | tr -d ' ')
```
Expected: no output.

- [ ] **Step 6: Apply before the first render**

In `app-react/src/main.tsx`, add the import next to the other local imports and call it before `ReactDOM.createRoot`:

```ts
import { applyThemePref } from './ui/theme'
```

```ts
applyThemePref()

ReactDOM.createRoot(document.getElementById('root')!).render(
```

- [ ] **Step 7: Write the failing MobileShell test**

`app-react/src/layouts/mobile/MobileShell.test.tsx`. jsdom doesn't resolve CSS variables from stylesheets, so `getComputedStyle` is stubbed to return a background that depends on the attribute.

```tsx
import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MobileShell } from './MobileShell'
import { setViewportWidth } from '../../test/viewport'

const themeColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

describe('MobileShell', () => {
  beforeEach(() => {
    setViewportWidth(390)
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: () => (document.documentElement.getAttribute('data-ui-theme') === 'dark' ? '#15121D' : '#F7F4EE'),
    }) as unknown as CSSStyleDeclaration)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.removeAttribute('data-ui-theme')
  })

  it('re-reads the background when data-ui-theme changes', async () => {
    render(<MemoryRouter><MobileShell><p>content</p></MobileShell></MemoryRouter>)
    expect(themeColor()).toBe('#F7F4EE')
    document.documentElement.setAttribute('data-ui-theme', 'dark')
    await waitFor(() => expect(themeColor()).toBe('#15121D'))
    expect(document.documentElement.style.backgroundColor).toBe('rgb(21, 18, 29)')
  })
})
```

- [ ] **Step 8: Run and check it fails**

Run: `npx vitest run src/layouts/mobile/MobileShell.test.tsx`
Expected: FAIL. `theme-color` stays `#F7F4EE`, because nothing observes the attribute yet.

- [ ] **Step 9: Observe the attribute in `useShellBackground`**

In `app-react/src/layouts/mobile/MobileShell.tsx`, replace the tail of the effect (from `const scheme = …` to the end of the cleanup) with:

```ts
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    // Settings → Theme flips data-ui-theme on <html>; follow it without any wiring.
    const observer = new MutationObserver(apply)
    apply()
    scheme.addEventListener('change', apply)
    observer.observe(html, { attributes: true, attributeFilter: ['data-ui-theme'] })
    return () => {
      observer.disconnect()
      scheme.removeEventListener('change', apply)
      html.style.backgroundColor = prevBg
      if (created) meta!.remove()
    }
```

Also update the doc comment above the hook: `/** Matches the browser chrome and overscroll area to the shell's background (system scheme or theme override) while mounted. */`

- [ ] **Step 10: Run both tests and check they pass**

Run: `npx vitest run src/ui/theme.test.ts src/layouts/mobile/MobileShell.test.tsx src/features/today`
Expected: all PASS. Today still passes because its shell behaviour is unchanged.

- [ ] **Step 11: Commit**

```bash
git add src/ui/theme.ts src/ui/useTheme.ts src/ui/theme.test.ts src/ui/theme.css src/main.tsx src/layouts/mobile/MobileShell.tsx src/layouts/mobile/MobileShell.test.tsx
git commit -m "feat(ui): Auto/Light/Dark theme preference for the new shell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Settings strings (en / ru / uk)

**Files:**
- Modify: `app-react/public/locales/en/translation.json`, `…/ru/translation.json`, `…/uk/translation.json` (the `settings` object), `app-react/src/test/setup.ts` (the `settings` object)
- Test: `app-react/src/features/settings/locales.test.ts`

**Interfaces:**
- Produces these keys under `settings.*`: `userDetails`, `preferences`, `theme`, `themeAuto`, `themeLight`, `themeDark`, `previewChannel`, `previewHint`, `accountData`, `importCsv`, `support`, `helpSupport`, `aboutShort`, `updateAvailable`, `logout`. The existing keys stay, because legacy pages use them.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run and check it fails**

Run: `npx vitest run src/features/settings/locales.test.ts`
Expected: FAIL on `settings.userDetails`.

- [ ] **Step 3: Add the keys**

Append to each `settings` object (keep valid JSON, so add a comma after the current last entry, `reorderFailed`):

`en`:
```json
"userDetails": "User details",
"preferences": "Preferences",
"theme": "Theme",
"themeAuto": "Auto",
"themeLight": "Light",
"themeDark": "Dark",
"previewChannel": "Preview channel",
"previewHint": "Try new features before release",
"accountData": "Account & data",
"importCsv": "Import CSV",
"support": "Support",
"helpSupport": "Help and support",
"aboutShort": "About",
"updateAvailable": "Update available — tap to reload",
"logout": "Logout"
```

`ru`:
```json
"userDetails": "Данные профиля",
"preferences": "Параметры",
"theme": "Тема",
"themeAuto": "Авто",
"themeLight": "Светлая",
"themeDark": "Тёмная",
"previewChannel": "Ранний доступ",
"previewHint": "Пробуйте новые функции до релиза",
"accountData": "Аккаунт и данные",
"importCsv": "Импорт CSV",
"support": "Поддержка",
"helpSupport": "Помощь и поддержка",
"aboutShort": "О приложении",
"updateAvailable": "Доступно обновление — нажмите, чтобы перезагрузить",
"logout": "Выйти"
```

`uk`:
```json
"userDetails": "Дані профілю",
"preferences": "Параметри",
"theme": "Тема",
"themeAuto": "Авто",
"themeLight": "Світла",
"themeDark": "Темна",
"previewChannel": "Ранній доступ",
"previewHint": "Пробуйте нові функції до релізу",
"accountData": "Акаунт і дані",
"importCsv": "Імпорт CSV",
"support": "Підтримка",
"helpSupport": "Допомога та підтримка",
"aboutShort": "Про застосунок",
"updateAvailable": "Доступне оновлення — натисніть, щоб перезавантажити",
"logout": "Вийти"
```

Add the same English entries to the `settings: { … }` object in `src/test/setup.ts`, in TS object syntax (`userDetails: 'User details',` …).

- [ ] **Step 4: Run and check it passes**

Run: `npx vitest run src/features/settings/locales.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/locales src/test/setup.ts src/features/settings/locales.test.ts
git commit -m "feat(settings): strings for the mobile Settings hub in en/ru/uk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Mobile Settings screen

**Files:**
- Create: `app-react/src/features/settings/mobile/SettingsRow.tsx`, `…/mobile/LogoutSheet.tsx`, `…/mobile/SettingsMobile.tsx`
- Test: `app-react/src/features/settings/mobile/SettingsMobile.test.tsx`

**Interfaces:**
- Consumes:
  - `isPreview`, `setPreview` (Task 1)
  - `useTheme`, `ThemePref` (Task 2)
  - `settings.*` keys (Task 3)
  - Existing: `MobileShell`, `AppBar` (`src/layouts/mobile`); `ListGroup`, `Toggle`, `SegmentedControl`, `AnchoredMenu` + `MenuItem`, `BottomSheet` (`src/ui/primitives`); `useAuthStore` (`src/store/authStore`); `useServiceWorkerUpdate` (`src/hooks`); `common.cancel`, `auth.logout`, `settings.logoutConfirmTitle`, `settings.logoutConfirmMsg`, `settings.language`, `settings.changePassword`, `nav.settings`.
- Produces:
  - `SettingsMobile()` (content only) and `SettingsMobileScreen()` (wrapped in `MobileShell`).
  - `SettingsRow` props: `{ label: string; hint?: string; value?: string; to?: string; href?: string; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; control?: ReactNode; accent?: boolean }`.
  - `LogoutSheet({ onClose }: { onClose: () => void })`.

- [ ] **Step 1: Write the failing screen test**

`app-react/src/features/settings/mobile/SettingsMobile.test.tsx`:

```tsx
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import i18n from 'i18next'
import { SettingsMobileScreen } from './SettingsMobile'
import { setViewportWidth } from '../../../test/viewport'
import { useAuthStore } from '../../../store/authStore'
import { useServiceWorkerUpdate } from '../../../hooks/useServiceWorkerUpdate'

vi.mock('../../../hooks/useServiceWorkerUpdate', () => ({ useServiceWorkerUpdate: vi.fn() }))
const swUpdate = vi.mocked(useServiceWorkerUpdate)

const realLocation = window.location

function renderScreen(name = 'Test User') {
  useAuthStore.setState({ user: { id: '1', email: 't@e.st', token: 'tok', name }, token: 'tok' })
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsMobileScreen />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SettingsMobile', () => {
  beforeEach(() => {
    setViewportWidth(390)
    swUpdate.mockReturnValue({ updateReady: false, applyUpdate: vi.fn() })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('data-ui-theme')
    Reflect.deleteProperty(document, 'cookie')
    Object.defineProperty(window, 'location', { value: realLocation, configurable: true })
  })

  it('shows the title and a profile card linking to user details', () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    const card = screen.getByRole('link', { name: /Test User/ })
    expect(card).toHaveAttribute('href', '/settings/edit-user')
    expect(within(card).getByText('TU')).toBeInTheDocument()
    expect(within(card).getByText('User details')).toBeInTheDocument()
  })

  it.each([
    ['', '?'],
    ['   ', '?'],
    ['ada', 'A'],
    ['  ada   lovelace  byron ', 'AL'],
    ['анна мария', 'АМ'],
  ])('initials for %j are %s', (name, expected) => {
    renderScreen(name)
    expect(screen.getByTestId('avatar')).toHaveTextContent(expected)
  })

  it('links rows to their pages; About opens the site in a new tab', () => {
    renderScreen()
    expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute('href', '/settings/edit-password')
    expect(screen.getByRole('link', { name: 'Import CSV' })).toHaveAttribute('href', '/settings/import')
    expect(screen.getByRole('link', { name: 'Help and support' })).toHaveAttribute('href', '/help')
    const about = screen.getByRole('link', { name: 'About' })
    expect(about).toHaveAttribute('href', 'https://sadhana.pro')
    expect(about).toHaveAttribute('target', '_blank')
    expect(about).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('picks a language from the menu', () => {
    const change = vi.spyOn(i18n, 'changeLanguage').mockResolvedValue(undefined as never)
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /Language.*English/ }))
    const items = screen.getAllByRole('menuitemradio')
    expect(items.map((i) => i.textContent?.replace('✓', ''))).toEqual(['English', 'Русский', 'Українська'])
    expect(screen.getByRole('menuitemradio', { name: /English/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Русский/ }))
    expect(change).toHaveBeenCalledWith('ru')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('switches theme with the segmented control', () => {
    renderScreen()
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement).toHaveAttribute('data-ui-theme', 'dark')
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }))
    expect(document.documentElement).not.toHaveAttribute('data-ui-theme')
  })

  it('preview toggle writes the cookie and reloads', () => {
    const writes: string[] = []
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: (v: string) => { writes.push(v) } })
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true })
    renderScreen()
    const sw = screen.getByRole('switch', { name: 'Preview channel' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(writes).toEqual(['sadhana_release_channel=preview; Path=/; Secure; SameSite=Lax; Max-Age=2592000'])
    expect(reload).toHaveBeenCalledOnce()
  })

  it('shows the update row only when an update is ready', () => {
    const { unmount } = renderScreen()
    expect(screen.queryByRole('button', { name: /Update available/ })).toBeNull()
    unmount()
    const applyUpdate = vi.fn()
    swUpdate.mockReturnValue({ updateReady: true, applyUpdate })
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /Update available/ }))
    expect(applyUpdate).toHaveBeenCalledOnce()
  })

  it('Logout asks first; Confirm logs out and goes to /login', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    const sheet = screen.getByRole('dialog', { name: 'Log out?' })
    expect(within(sheet).getByText('Are you sure you want to log out?')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Log out' }))
    expect(useAuthStore.getState().token).toBeNull()
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('Cancel closes the sheet without logging out', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useAuthStore.getState().token).toBe('tok')
  })

  it('Escape closes the sheet without logging out', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useAuthStore.getState().token).toBe('tok')
  })
})
```

`setState` sets `token: 'tok'` but never touches `localStorage`. `logout()` removes `yew.token`, which is harmless in jsdom.

- [ ] **Step 2: Run and check it fails**

Run: `npx vitest run src/features/settings/mobile/SettingsMobile.test.tsx`
Expected: FAIL, because `./SettingsMobile` can't be resolved.

- [ ] **Step 3: Implement `SettingsRow.tsx`**

```tsx
import type { MouseEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface SettingsRowProps {
  label: string
  hint?: string
  value?: string
  to?: string
  href?: string
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  control?: ReactNode
  accent?: boolean
}

/** One row inside a ListGroup: a link (`to`), an external link (`href`), a button (`onClick`) or a control holder. */
export function SettingsRow({ label, hint, value, to, href, onClick, control, accent }: SettingsRowProps) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`text-[15px] ${accent ? 'font-bold text-ui-accent' : 'font-semibold text-ui-ink'}`}>{label}</span>
        {hint && <span className="text-xs font-medium leading-[1.4] text-ui-muted">{hint}</span>}
      </span>
      {control ?? (
        <span className="flex shrink-0 items-center gap-1.5">
          {value && <span className="text-[15px] font-medium text-ui-muted">{value}</span>}
          <span aria-hidden className="text-lg leading-none text-ui-faint2">›</span>
        </span>
      )}
    </>
  )
  const cls = `flex min-h-[52px] w-full items-center gap-3 bg-ui-surface px-4 text-left ${hint ? 'py-3' : 'py-2'}`
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>
  return <div className={cls}>{body}</div>
}
```

- [ ] **Step 4: Implement `LogoutSheet.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../../store/authStore'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'

export function LogoutSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  return (
    <BottomSheet label={t('settings.logoutConfirmTitle')} onClose={onClose}>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold text-ui-ink">{t('settings.logoutConfirmTitle')}</h2>
        <p className="text-sm text-ui-muted">{t('settings.logoutConfirmMsg')}</p>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2.5">
        <button type="button" onClick={onClose}
          className="h-[50px] rounded-[14px] border border-ui-control text-[15px] font-bold text-ui-ink">
          {t('common.cancel')}
        </button>
        <button type="button" onClick={() => { logout(); navigate('/login', { replace: true }) }}
          className="h-[50px] rounded-[14px] bg-ui-danger text-[15px] font-bold text-white">
          {t('auth.logout')}
        </button>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 5: Implement `SettingsMobile.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useServiceWorkerUpdate } from '../../../hooks/useServiceWorkerUpdate'
import { AppBar } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { useAuthStore } from '../../../store/authStore'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { ListGroup } from '../../../ui/primitives/ListGroup'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { Toggle } from '../../../ui/primitives/Toggle'
import type { ThemePref } from '../../../ui/theme'
import { useTheme } from '../../../ui/useTheme'
import { isPreview, setPreview } from '../releaseChannel'
import { LogoutSheet } from './LogoutSheet'
import { SettingsRow } from './SettingsRow'

// Native names on purpose: a user stuck in the wrong language can still find theirs.
const LANGS = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
] as const

function initials(name: string) {
  const letters = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  return letters || '?'
}

export function SettingsMobile() {
  const { t, i18n } = useTranslation()
  const name = useAuthStore((s) => s.user?.name ?? '')
  const { updateReady, applyUpdate } = useServiceWorkerUpdate()
  const [theme, setTheme] = useTheme()
  const [langAnchor, setLangAnchor] = useState<HTMLElement | null>(null)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const lang = LANGS.find((l) => l.code === i18n.resolvedLanguage?.slice(0, 2)) ?? LANGS[0]

  const themeOptions: { value: ThemePref; label: string }[] = [
    { value: 'auto', label: t('settings.themeAuto') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ]

  return (
    <>
      <AppBar title={<h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ui-ink">{t('nav.settings')}</h1>} />
      <div className="flex flex-col gap-[18px] px-4 pt-2 pb-4">
        <Link to="/settings/edit-user"
          className="flex items-center gap-3 rounded-[18px] border border-ui-hairline bg-ui-surface py-3.5 pr-3 pl-3.5">
          <span data-testid="avatar"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ui-selected text-base font-extrabold text-ui-on-selected">
            {initials(name)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[17px] font-extrabold text-ui-ink">{name}</span>
            <span className="text-[13px] text-ui-muted">{t('settings.userDetails')}</span>
          </span>
          <span aria-hidden className="text-lg text-ui-muted">›</span>
        </Link>

        <ListGroup label={t('settings.preferences')}>
          <SettingsRow label={t('settings.language')} value={lang.name} onClick={(e) => setLangAnchor(e.currentTarget)} />
          <SettingsRow label={t('settings.theme')}
            control={<SegmentedControl label={t('settings.theme')} options={themeOptions} value={theme} onChange={setTheme} />} />
          <SettingsRow label={t('settings.previewChannel')} hint={t('settings.previewHint')}
            control={<Toggle label={t('settings.previewChannel')} checked={isPreview()}
              onChange={(on) => { setPreview(on); window.location.reload() }} />} />
        </ListGroup>

        <ListGroup label={t('settings.accountData')}>
          <SettingsRow label={t('settings.changePassword')} to="/settings/edit-password" />
          <SettingsRow label={t('settings.importCsv')} to="/settings/import" />
        </ListGroup>

        <ListGroup label={t('settings.support')}>
          {updateReady && <SettingsRow label={t('settings.updateAvailable')} accent onClick={applyUpdate} />}
          <SettingsRow label={t('settings.helpSupport')} to="/help" />
          <SettingsRow label={t('settings.aboutShort')} href="https://sadhana.pro" />
        </ListGroup>

        <button type="button" onClick={() => setLogoutOpen(true)}
          className="flex min-h-[52px] items-center rounded-[18px] border border-ui-hairline bg-ui-surface px-4 text-left text-[15px] font-bold text-ui-danger">
          {t('settings.logout')}
        </button>
      </div>

      {langAnchor && (
        <AnchoredMenu anchor={langAnchor} label={t('settings.language')} onClose={() => setLangAnchor(null)}>
          {LANGS.map((l) => (
            <MenuItem key={l.code} selected={l.code === lang.code}
              onSelect={() => { setLangAnchor(null); void i18n.changeLanguage(l.code) }}>
              {l.name}
            </MenuItem>
          ))}
        </AnchoredMenu>
      )}
      {logoutOpen && <LogoutSheet onClose={() => setLogoutOpen(false)} />}
    </>
  )
}

export function SettingsMobileScreen() {
  return (
    <MobileShell>
      <SettingsMobile />
    </MobileShell>
  )
}
```

`isPreview()` is read on each render, without state. That's fine because toggling reloads the page.

- [ ] **Step 6: Run and check it passes**

Run: `npx vitest run src/features/settings`
Expected: all PASS. If the `About` link's accessible name includes `›`, check the chevron span has `aria-hidden`.

- [ ] **Step 7: Lint and type-check**

Run: `npx tsc -b && npm run lint`
Expected: no errors. `react/only-export-components` is fine because `SettingsMobile.tsx` exports only components.

- [ ] **Step 8: Commit**

```bash
git add src/features/settings/mobile
git commit -m "feat(settings): mobile Settings hub with language, theme, preview and logout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Route `/settings` through `ByLayout`, then verify

**Files:**
- Modify: `app-react/src/router.tsx`

**Interfaces:**
- Consumes: `SettingsMobileScreen` from `src/features/settings/mobile/SettingsMobile.tsx` (Task 4).

- [ ] **Step 1: Wire the route**

In `src/router.tsx`, add a lazy import next to `TodayMobileScreen`:

```ts
const SettingsMobileScreen = lazy(() => import('./features/settings/mobile/SettingsMobile').then((m) => ({ default: m.SettingsMobileScreen })))
```

Add a sibling right after the `/` route object:

```tsx
      {
        path: '/settings',
        element: <ByLayout mobile={<SettingsMobileScreen />} legacy={<AppShell />} />,
        children: [{ index: true, element: <SettingsPage /> }],
      },
```

Delete `{ path: '/settings', element: <SettingsPage /> },` from the `AppShell` children. Leave `/settings/edit-user`, `/settings/edit-password`, `/settings/language`, `/settings/import` and `/help` where they are.

- [ ] **Step 2: Full check**

Run: `npx tsc -b && npm run lint && npm test`
Expected: everything passes, including the legacy `Settings.test.tsx` (it renders the sub-pages directly, so routing doesn't affect it).

- [ ] **Step 3: Manual check at 390×844**

Run the app (`npm run dev` with the server up, as for the Today redesign) and open `/settings` in a 390×844 viewport:
- Light system: the layout matches frame 4a (profile card, three groups, red Logout card), and the Settings tab is active.
- Dark system: 1a-dark colours. Pick **Light**: the page, menu, sheet and browser chrome go light. Reload: still Light.
- Light system, pick **Dark**: everything goes dark. Pick **Auto**: back to light.
- Navigate to Today and back: the theme choice holds on Today too.
- Language: switch to ru and uk. Nothing overflows, especially the Theme segment ("Авто / Светлая / Тёмная") next to the label.
- Tap Change password, Import CSV, Help: each opens the legacy page. About opens sadhana.pro in a new tab.
- Logout → Cancel; Logout → Escape; Logout → Log out lands on `/login`.
- Tablet width (≥ the tablet breakpoint): `/settings` still shows the legacy page.

- [ ] **Step 4: Commit**

```bash
git add src/router.tsx
git commit -m "feat(settings): route mobile /settings to the redesigned screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
