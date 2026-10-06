# Mobile Settings Redesign: Step 2 of the New UI

**Date:** 2026-10-06
**App:** `app-react`
**Status:** Approved (design), pending spec review
**Source design:** claude.ai/design project `cccefa4d-5554-41b1-be47-2704b1233b68`, `Sadhana Redesign.dc.html`. Frames 4a (Settings, light) and 4b (dark mode on), Turn 4. The Theme row comes from frame 2d (Settings hub, Turn 2). Builds on `2026-10-06-mobile-today-redesign-design.md`.

## Context and goal

The second redesigned screen: the **mobile Settings hub** in the new `MobileShell`. It covers the hub and its inline controls only. Rows that lead to a sub-page (user details, change password, import, help) keep opening the existing legacy pages in the legacy `AppShell`. Tablet and desktop Settings stay legacy.

## Decisions

| Topic | Decision |
|---|---|
| Scope | The hub, plus inline controls (language, theme, preview channel, logout confirm). No sub-pages are redesigned. |
| Items | The nine items from 4a: profile card, Language, Theme, Preview channel, Change password, Import CSV, Help and support, About, Logout. "My practices" is dropped; it's already in Today's ⋯ menu. |
| Theme | 2d's **Auto / Light / Dark** segmented control replaces 4a's single Dark mode toggle. Auto follows `prefers-color-scheme`. The choice applies to every new-shell screen. |
| Dark palette | The existing 1a-dark tokens. 4b's slightly different hexes (`#17151F`, `#221F2C`, `#F08A74`, …) are not adopted. Logout uses `--ui-danger`. |
| Update row | Not in the mockup but kept: an "Update available" row shows in Support only when a service-worker update is ready. Without it, users of the new shell have no way to pick up a new release. |
| Logout | Its own card, in danger red. Tapping opens a confirmation `BottomSheet`, replacing the legacy DaisyUI `ConfirmModal`. |

## Architecture

- **Router:** `/settings` moves out of the `AppShell` children into its own route, as `/` did:
  ```
  { path: '/settings', element: <ByLayout mobile={<SettingsMobileScreen/>} legacy={<AppShell/>} />,
    children: [{ index: true, element: <SettingsPage/> }] }
  ```
  `/settings/edit-user`, `/settings/edit-password`, `/settings/import`, `/settings/language` and `/help` stay under `AppShell`.
- **Files:**
  ```
  ui/
    theme.ts               read/apply/persist the theme preference
    useTheme.ts            React hook over theme.ts
    theme.css              dark tokens also apply on an explicit override
  features/settings/
    releaseChannel.ts      preview cookie read/toggle (port of frontend/src/utils/release_channel.rs)
    releaseChannel.test.ts
    mobile/
      SettingsMobile.tsx   the screen + SettingsMobileScreen (wrapped in MobileShell)
      SettingsRow.tsx      link / button / control row
      LogoutSheet.tsx
      SettingsMobile.test.tsx
  ```
- The legacy `SettingsPage` and `LanguagePage` are not modified.

## Theme preference

- Stored in `localStorage['ui-theme']` as `'light'` or `'dark'`. A missing key means Auto. Every read and write is wrapped in try/catch, so a blocked storage falls back to Auto.
- `theme.ts` exports `getThemePref(): 'auto' | 'light' | 'dark'` and `setThemePref(pref)`. `setThemePref` writes or removes the key and sets or removes `data-ui-theme` on `<html>`.
- `main.tsx` calls `applyThemePref()` once before the first render, so the stored theme shows without a flash.
- `useTheme()` returns `[pref, setPref]`. It holds the preference in state and calls `setThemePref` on change.
- **`theme.css`:** the dark token block currently sits under `@media (prefers-color-scheme: dark) { .ui-root {…} }`. It becomes:
  ```css
  :root[data-ui-theme='dark'] .ui-root { …dark tokens… }
  @media (prefers-color-scheme: dark) {
    :root:not([data-ui-theme='light']) .ui-root { …dark tokens… }
  }
  ```
  The token list is duplicated once; that's acceptable for a CSS-only switch. `color-scheme: dark` moves with it.
- **`MobileShell`:** `useShellBackground` re-applies `theme-color` and the `<html>` background when the preference changes, as well as on the media query change. It does this with a `MutationObserver` on `<html>`'s `data-ui-theme` attribute, so nothing else has to notify it.
- The legacy shell ignores `data-ui-theme`.

## Preview channel

- `releaseChannel.ts`:
  - `isPreview()` parses `document.cookie` for `sadhana_release_channel=preview`.
  - `setPreview(on)` writes `sadhana_release_channel=<preview|stable>; Path=/; Secure; SameSite=Lax; Max-Age=2592000`.
  - It matches the Yew implementation exactly, so nginx keeps routing the same way.
- Turning the toggle on or off writes the cookie and then calls `window.location.reload()`, so the request goes to the other container.

## Screen

Root: `MobileShell`. Content padding `16px`, groups `18px` apart.

1. **Title:** "Settings" (`nav.settings`), 28/800, tracking -0.02em. It goes in the `AppBar` title slot, with no ⋯ actions.
2. **Profile card:**
   - `--ui-surface` background, a 1px `--ui-hairline` border, r18, padding `14px 12px 14px 14px`.
   - A 48px avatar circle in `--ui-selected` / `--ui-on-selected` showing up to two initials of `user.name` (first letters of the first two words, upper-cased; `?` when empty).
   - Name 17/800, with "User details" 13 `--ui-muted` under it, and a muted chevron on the right.
   - It's a `Link` to `/settings/edit-user`.
3. **PREFERENCES** (`ListGroup`):
   - **Language:** the value is the current language's native name ("English", "Русский", "Українська") plus `›`. Tapping opens an `AnchoredMenu` with the three languages, the current one marked ✓. Picking one calls `i18n.changeLanguage(code)`.
   - **Theme:** a `SegmentedControl` with Auto / Light / Dark, bound to `useTheme()`.
   - **Preview channel:** the label sits over a 12/500 `--ui-muted` hint, "Try new features before release". A `Toggle` on the right shows `isPreview()`, and changing it calls `setPreview` and reloads.
4. **ACCOUNT & DATA:** Change password (→ `/settings/edit-password`) and Import CSV (→ `/settings/import`).
5. **SUPPORT:**
   - **Update available** (`--ui-accent`, 15/700), shown only when `useServiceWorkerUpdate().updateReady`. Tapping calls `applyUpdate()`.
   - **Help and support** → `/help`.
   - **About** → `https://sadhana.pro`, opened in a new tab (`rel="noopener noreferrer"`).
6. **Logout card:** a standalone r18 card with a 1px `--ui-hairline` border, min-height 52px, "Logout" in 15/700 `--ui-danger`. It's a button that opens the `LogoutSheet`.

### `SettingsRow`

- Min-height 52px, horizontal padding 16px, `--ui-surface` background. The label is 15/600 `--ui-ink`.
- Right side: an optional value (15/500 `--ui-muted`) and a `›` chevron (`--ui-faint2`) for navigating rows, or a control slot (toggle or segment) with no chevron.
- An optional `hint` line under the label (12/500 `--ui-muted`, line-height 1.4). Rows with a hint use 12px vertical padding.
- Renders as a router `Link` (`to`), an `<a>` (`href`, external) or a `<button>` (`onClick`). Rows that only hold a control render as a `div`.

### `LogoutSheet`

- `BottomSheet` with the title "Log out?" (20/800) and the message "Are you sure you want to log out?" (14 `--ui-muted`). These reuse `settings.logoutConfirmTitle` / `settings.logoutConfirmMsg`.
- Footer: a 1fr **Cancel** (bordered) and a 2fr **Log out** button (`--ui-danger` background, white text), both 50px r14.
- Confirm calls `useAuthStore.logout()` and then `navigate('/login', { replace: true })`. Cancel, a backdrop tap or Escape closes it.

## i18n

New keys under `settings.*` in `public/locales/{en,ru,uk}/translation.json`. The existing keys stay because the legacy pages use them.

| Key | en |
|---|---|
| `userDetails` | User details |
| `preferences` | Preferences |
| `theme` | Theme |
| `themeAuto` / `themeLight` / `themeDark` | Auto / Light / Dark |
| `previewChannel` | Preview channel |
| `previewHint` | Try new features before release |
| `accountData` | Account & data |
| `importCsv` | Import CSV |
| `support` | Support |
| `helpSupport` | Help and support |
| `aboutShort` | About |
| `updateAvailable` | Update available — tap to reload |
| `logout` | Logout |

The language names are native, not translated. Russian and Ukrainian translations are written as part of the work.

## Testing

Vitest + Testing Library, following the Today tests:
- `releaseChannel`:
  - parses a preview cookie among others;
  - a missing or other value reads as stable;
  - `setPreview` writes the exact cookie string.
- `theme.ts` / `useTheme`:
  - the default is Auto with no attribute;
  - Light/Dark set `data-ui-theme` and persist;
  - Auto removes both;
  - storage throwing falls back to Auto.
- `SettingsMobile`:
  - the profile card shows the initials and name and links to `/settings/edit-user`;
  - the rows link to their paths, and About has the external `href`;
  - the language menu lists three languages with ✓ on the current one, and picking one calls `changeLanguage`;
  - the Theme segment updates `aria-checked` and `data-ui-theme`;
  - the preview toggle writes the cookie and calls reload (mocked);
  - the update row renders only when `updateReady`;
  - Logout opens the sheet, Confirm logs out and navigates to `/login`, and Cancel doesn't.
- Manual: 390×844 in light, in dark (system), and with each override (Light while the system is dark, and the reverse), in en/ru/uk. `npm run lint` and `npm test` pass.

## Out of scope

- The redesigned sub-pages (user details, password, import, help), and tablet/desktop Settings.
- 2d's other rows (Practices/Reports/Yatras counts, Week starts on, Daily reminder, Export all data).
- Syncing the theme preference to the server.
