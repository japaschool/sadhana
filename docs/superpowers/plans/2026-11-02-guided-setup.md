# Guided Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the report template changes the guide needs, then build the guide: first run after sign-up, invitee practice creation, and the later entry from "Add practice".

**Architecture:** Template changes stay in the existing `panels` format, with one new panel kind. The guide is a client-side flow in `features/guide`: choices stay in memory until Finish, then a resumable runner creates everything through existing routes. The server gains only a skip-seeding flag, a `created` flag and the `guide_runs` table.

**Tech Stack:** Rust (actix-web, Diesel, Postgres), React + TypeScript, Vite, TanStack Query, zustand, Tailwind, i18next, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-guided-setup-design.md`

**Status of the spec's phases:** Phase 1 (invite fix) is merged. Phase 2 is partly shipped: Japa and Duration exist under their old names, so Part A does the rest. Part B is Phase 3, Part C is Phase 4. Each part ships on its own.

**Mockups:** `Guided Setup.dc.html` frames `17m*`, `17t*`, `17d*`. The frames are generated, so read `scraps/gs-screens.js` and `scraps/gs-lib.js` in the design project through the `claude_design` MCP: they hold every screen's structure, colours and en/ru copy. Render a frame with `render_preview` when in doubt.

**Commands:** Rust `make test T=<name>`; client, in `app-react/` on Node 22, `npm test -- <path>` and `npm run lint`. `make lint` before each ship gate.

## Global Constraints

- Older cached builds must keep working, and a person who signs up on one must still get default practices.
- All strings in en/ru/uk; `locales.test.ts` covers completeness. No new dependency: the carousel is CSS scroll-snap.
- Local `yyyy-mm-dd` dates (`toDateStr`), never `toISOString()`. Empty input saves `null`.
- No gamification, no celebration, no streaks. "Daily target starts empty." No red and no judging in Days I did it.
- Never promise a private link, an off switch, or that nothing is shared.
- Tokens through `ui-*` Tailwind colours. Three layouts through `ByLayout`. Portals through `UiPortal`.
- The guide never reactivates or changes an existing practice.
- Do not hand-edit `schema.rs`: run `make gen_schema`.

## Decisions this plan makes

- **Wire names stay.** `Template::Japa`, `Template::Duration`, their fields, the `japa`/`duration` slugs and the `/settings/charts/new/japa` URL don't change; only what people read does. No stored report needs migrating, and cached builds keep working. Existing Japa reports pick up the neutral wording, because their labels are locale keys. Their stored names ("Japa") stay.
- **A new `months=true` query flag gates Days I did it.** Cached builds since the Sleep template send `panels=true` and treat any non-Stats panel as a chart, so `panel.series.map` would crash on a `Month` panel. The server leaves out reports with a `Month` panel unless asked, the same way `panels` works.
- **The month view fetches `HalfYear`** ending at `min(end of shown month, today)`. It covers the shown month, the one before and any 90-day window. `Quarter` can come up a day short.
- **Days I did it allows at most 8 practices.** Each practice is a panel and the server's `MAX_PANELS` is 8.
- **`/guide` with no state is the non-first-run guide:** no reader question, `started_from = add_practice`. Only `state.firstRun` shows step 3, and only a new account's redirect sets it. The `NoPractices` "Help me choose" link is therefore non-first-run, so someone who left the first run isn't asked about a reader.
- **A new account only honours an invite.** `from` can be any protected page, and the spec says only a valid `next` beats the guide.

## Review Focus

1. A cached build calling `/reports?panels=true` for a user with a Days I did it report must not receive it. Pinned in Task 2.
2. A brand-new Google user who came from `/settings` (a non-invite `from`) must land in the guide, not on an empty Settings. Pinned in Task 7.
3. `onSuccess: setAuth` passes the mutation's variables as a second argument. Once `setAuth` takes `newAccount`, a Google token would make every returning user "new". Pinned in Task 7.
4. A create request that succeeds on the server while its response is lost must not produce a duplicate on retry. Pinned in Task 8.
5. A hidden practice sharing a yatra practice's name, or more than 8 Days practices, must show a message, not a raw failure. Pinned in Tasks 11 and 14.

---

## Part A: Report templates (spec Phase 2)

### Task 1: Neutral names for Daily count and Time spent

**Files:**
- Modify: `docs/superpowers/specs/2026-10-31-report-templates-design.md`
- Modify: `app-react/public/locales/{en,ru,uk}/translation.json`, `app-react/src/features/insights/ReportGlyph.tsx`
- Test: `app-react/src/features/insights/locales.test.ts`, `panels/TemplateForm.test.tsx`, `settings/mobile/ChartEditorMobile.test.tsx`

- [ ] **Step 1: Update the report templates spec.** Add a short "Superseded by guided setup" note: Japa is presented as Daily count, Duration as Time spent, Days I did it is added, and stored identifiers don't change.
- [ ] **Step 2: Write the failing test** in `locales.test.ts`: for en, ru and uk, no value under `reportPanels`, `templateForm` or `chartSettings` matches `/japa|джап|rounds|круг|кіл/i`, except `home.starters`-style practice names outside those groups. Update existing tests that find "Japa" or "Duration" by name.
- [ ] **Step 3: Change the copy.** En names: `chartSettings.japa` "Daily count", `chartSettings.duration` "Time spent", with `newChartRows` descriptions from `gs-screens.js`. Ru: "Ежедневный счёт", "Время занятий". Uk: translate to match. Slot labels per the spec: Count, Target, Part done early, How it went, and a yes/no marker. `templateForm.targetSuffix` becomes "a day". Rename `reportPanels` values (`avgRounds`, `rounds`, `totalRounds`, `morningRounds`, `japaQuality`, `attunement*`) to neutral words, keeping the keys. Stat names come from `TX` in `gs-lib.js` (`avgDay`, `onTarget`, `avgEarly`).
- [ ] **Step 4: Replace the `japa` glyph** with the `count` glyph from `repGlyph` in `gs-lib.js`. Keep `kind="japa"`.
- [ ] **Step 5: Run** `npm test -- src/features/insights`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(insights): neutral names for Daily count and Time spent`.

### Task 2: `Month` panel and `Days` template on the server

**Files:**
- Modify: `server/src/app/report/panels.rs`, `server/src/app/report/mod.rs`, `server/src/app/shared.rs`, `app-react/src/api/charts.ts`
- Test: `server/src/app/report/db.rs` tests, `app-react/src/api/charts.test.ts`

**Interfaces:**
- Produces (Rust): `Panel::Month { practice: Uuid }`; `Template::Days(DaysTemplate { practices: Vec<Uuid> })`; `PanelsReport::has_month(&self) -> bool`; `ReportsQuery.months: bool`; `Report::get_all(conn, user_id, panels, months)`.
- Produces (TS): `Panel` gains `{ kind: 'Month'; practice: string }`; `Template` gains `{ Days: DaysTemplate }`; `DaysTemplate { practices: string[] }`; `getReports` and `getSharedReports` send `months: true`.

- [ ] **Step 1: Write failing tests** in `report/db.rs`:

```rust
// days_report_is_hidden_without_months
// get_all(.., panels=true, months=false) leaves out a report with a Month panel,
// keeps a Sleep one; months=true returns both.
// days_validate: an empty practices list is rejected; 9 Month panels are rejected
// (MAX_PANELS); a practice not in `allowed` is rejected.
```

- [ ] **Step 2: Run** `make test T=days_`. Expected: FAIL.
- [ ] **Step 3: Implement.** `walk` handles `Panel::Month` (insert `practice`) and `Template::Days` (non-empty, `out.extend`). In `Report::get_all`, after deserialising, skip a report when `!months && definition.has_month()`. Pass `query.months` from `get_reports` and from `shared.rs:65`. Serde default `false`, as `panels` has.
- [ ] **Step 4: Update the client's `charts.test.ts`** for the `months: true` param.
- [ ] **Step 5: Run** `make test T=report` and `npm test -- src/api`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(reports): Month panel and Days template, hidden from older clients`.

### Task 3: Draw the month panel

**Files:**
- Create: `app-react/src/features/insights/panels/MonthPanelView.tsx`, `app-react/src/features/insights/mobile/MonthNav.tsx`
- Modify: `panels/panelLogic.ts`, `panels/PanelsReportView.tsx`, `useInsights.ts`, `mobile/InsightsMobile.tsx`, `tablet/InsightsTablet.tsx`, `desktop/InsightsDesktop.tsx`, `features/shared/SharedReports.tsx`, `features/shared/parts.tsx`, locales
- Test: `panels/panelLogic.test.ts`, `panels/PanelsReportView.test.tsx`, `useInsights.test.tsx`, `features/shared/SharedReports.test.tsx`

**Interfaces:**
- Produces: `monthCells(month: string /* yyyy-mm */, todayCob: string): { blanks: number; days: { cob: string; future: boolean }[] }` (Monday first); `monthCounts(practice, month, end: string, l: Lookup): { thisMonth: number; lastMonth: number; last90: number; done: Set<string> }`; `useInsights` returns `month: string | null` (`null` unless the report has a `Month` panel) and `setMonth(month: string)`.

- [ ] **Step 1: Write failing tests** in `panelLogic.test.ts`:

```ts
it('starts weeks on Monday', () => { expect(monthCells('2026-10', '2026-10-24').blanks).toBe(3) }) // 1 Oct 2026 is a Thursday
it('counts only true days', () => {
  // true on 1, 2 Oct; false on 3 Oct; nothing on 4 Oct
  expect(monthCounts(id, '2026-10', '2026-10-24', l).thisMonth).toBe(2)
})
it('counts last month and 90 days separately, ending at `end`', () => { /* true on 30 Sep, 28 Jul, 26 Jul */
  const c = monthCounts(id, '2026-10', '2026-10-24', l)
  expect([c.lastMonth, c.last90]).toEqual([1, 2])
})
it('drops a month panel whose practice is hidden, or no longer yes/no', () => { /* visiblePanels */ })
it('reports a hidden practice as missing', () => { /* missingRequired, via panelSources */ })
```

- [ ] **Step 2: Run** `npm test -- src/features/insights/panels`. Expected: FAIL.
- [ ] **Step 3: Implement the logic.** Done means `l.value(...) > 0`. `visiblePanels` keeps a Month panel only when `l.available(practice, 'Bool')`. `panelSources` must handle `Month`, as its ternary currently assumes Chart. Narrow the three `kind` branches in `visiblePanels`, `panelSources` and `charted` so Month never reaches `.series`.
- [ ] **Step 4: Implement `MonthPanelView`** from `daySection`, `monthGrid` and `daysLegend` in `gs-lib.js`/`gs-screens.js`. Weekday letters and month names from `Intl.DateTimeFormat` with the user's language. Future days outlined, today ringed, false and empty identical. Heading is the practice's name. The legend sits once at the end of the report, in `PanelsReportView`. Give the grid a text alternative: `aria-label` "{name}: {n} days done in {month}".
- [ ] **Step 5: Implement `useInsights` month mode.** With a Month panel: `endCob = min(last day of month, todayCob)`, `duration = 'HalfYear'`, `previous` disabled, and `logDate` ignored. `month` defaults to the current month and resets on `select`. Add `month`, `todayCob` to `PanelsReportView`'s props.
- [ ] **Step 6: Implement `MonthNav`** per `monthNav` in `gs-screens.js`; forward disabled on the current month. Each of the four screens shows it in place of `SegmentedControl` and `EndDateControl` when `ins.month` is set. This is the only shared-page change, because the report can't render there without it.
- [ ] **Step 7: Write tests** for the swap in `InsightsMobile.test.tsx` and `SharedReports.test.tsx`: range control gone, arrows move the month and request `HalfYear` ending at that month's last day.
- [ ] **Step 8: Run** `npm test -- src/features/insights src/features/shared`. Expected: PASS.
- [ ] **Step 9: Commit** `feat(insights): draw month panels with month navigation`.

### Task 4: Days I did it template

**Files:**
- Modify: `panels/templates.ts`, `panels/TemplateForm.tsx`, `settings/mobile/NewChartSheet.tsx`, `ReportGlyph.tsx`, locales
- Test: `panels/templates.test.ts`, `panels/TemplateForm.test.tsx`

**Interfaces:**
- Produces: `daysPanels(t: DaysTemplate): PanelsReport`; `DAYS_SLOT: Slot`, types `['Bool']`, `many: true`; `MAX_DAYS = 8`; `templateSlug` returns `'days'`; `NEW_DRAFTS.days`; `TemplateDraft` kind `'Days'`.

- [ ] **Step 1: Write failing tests:** `daysPanels` gives `version: 1`, `template: { Days }`, one `required` per practice and one Month panel per practice in order, with no Stats panel; `draftProblem` returns `'required'` for none and `'tooMany'` for 9; `draftOf` drops hidden or retyped practices; the New chart sheet lists Days I did it fourth.
- [ ] **Step 2: Run** `npm test -- src/features/insights/panels`. Expected: FAIL.
- [ ] **Step 3: Implement.** Generalise `PracticeChecks` to take a `slot`, `max` and hint/none keys rather than copying it. `KindGlyph` gains `days` from `repGlyph`. Add `days`, `daysDesc`, `daysSubtitle`, `daysName`, `newDays`, `readyDays`, `needsDays`, `noneBool`, `onlyDaysHint` in en/ru/uk. Ru name "Отмеченные дни". Form per `daysForm` (17m24).
- [ ] **Step 4: Run** `npm test -- src/features/insights`. Expected: PASS.
- [ ] **Step 5: Check by hand** with the `run` skill: create a Days report, move months, view it on `/shared/{id}`, in ru and dark, on all three layouts.
- [ ] **Step 6: Commit** `feat(insights): add the Days I did it template`.
- [ ] **Step 7: Ship gate.** `make lint`, full `make test`, `npm test`. Stop for a ship decision. Part B starts after this is live, so the guide's reports exist for every client.

---

## Part B: First-run guide (spec Phase 3)

Part B ships as one release: Task 7 removes default practices for new accounts, so nothing here may go out before Tasks 8 to 14 are done.

### Task 5: Skip seeding and the `created` flag

**Files:**
- Modify: `server/src/app/user/request.rs`, `api.rs`, `model.rs`, `response.rs`, `server/src/app/oauth.rs`
- Test: `server/src/app/user/model.rs` tests

**Interfaces:**
- Produces: `SignupUser.skip_defaults: bool` and `GoogleBody.skip_defaults: bool`, both `#[serde(default)]`; `User::signup(.., lang, skip_defaults)`; `User::signin_oauth(.., lang, skip_defaults) -> Result<(User, Token, bool), AppError>`, the bool being "created"; `AuthUser.created: Option<bool>`, `#[serde(skip_serializing_if = "Option::is_none")]`, set only by Google.

- [ ] **Step 1: Write failing tests:**

```rust
// signup_without_the_field_seeds:  serde default, then count user_practices > 0
// signup_with_skip_defaults_seeds_nothing: count == 0
// oauth_created_only_once: first call created=true with skip honoured,
// second call created=false and an existing user's practices are untouched
```

- [ ] **Step 2: Run** `make test T=signup`. Expected: FAIL.
- [ ] **Step 3: Implement.** The `confirmations` cleanup in `signup` must still run with `skip_defaults`: only the seed `sql_query` is conditional.
- [ ] **Step 4: Run** `make test T=signup`, `make test T=oauth`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(auth): optional skip of default practices, created flag on Google`.

### Task 6: `guide_runs`

**Files:**
- Create: `migrations/2026-11-02-000000-0000_guide_runs/{up,down}.sql`, `server/src/app/guide/{mod,handlers,service,dto}.rs`, `server/src/app/guide/domain.rs`
- Modify: `server/src/app/mod.rs`, `server/src/routes.rs`, `server/src/schema.rs` (generated)
- Test: `server/src/app/guide/service.rs`

**Interfaces:**
- Produces: `POST /api/user/guide-runs` `{ started_from }` → `{ id }`; `PUT /api/user/guide-run/{id}` `{ last_step?, outcome?, has_reader? }` → `()`. `started_from`: `signup | add_practice`. `outcome`: `finished | left`.

- [ ] **Step 1: Write the migration.** Columns per the spec's Storage section: `id`, `user_id` (cascade), `started_from`, `outcome` (nullable), `last_step`, `has_reader` (nullable), `created_at`, `updated_at`, with `CHECK`s on `started_from` and `outcome`, and `diesel_manage_updated_at`. `last_step` is `varchar(32)`.
- [ ] **Step 2: Run** `make migrate && make gen_schema`.
- [ ] **Step 3: Write failing tests:** a user can't update another's run (`NotFound`, row unchanged); deleting the user deletes the run; an update leaves unspecified fields as they were; an over-long `last_step` is `UnprocessableEntity`.
- [ ] **Step 4: Run** `make test T=guide`. Expected: FAIL.
- [ ] **Step 5: Implement** in the `yatras` layered style. Serde enums reject unknown `started_from`/`outcome` at the boundary.
- [ ] **Step 6: Run** `make test T=guide`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(guide): record guide runs`.

### Task 7: Send new accounts to the guide

**Files:**
- Modify: `app-react/src/api/auth.ts`, `src/types/api.ts`, `src/store/authStore.ts`, `src/layouts/GuestRoute.tsx`, `src/features/auth/Register.tsx`, `src/features/auth/Login.tsx`
- Test: `src/features/auth/auth.test.tsx`, `src/store/authStore.test.ts`

**Interfaces:**
- Produces: `setAuth(user: UserInfo, newAccount?: boolean)`; store field `newAccount: boolean`; `authApi.register` and `googleSignin` always send `skip_defaults: true`; `UserInfo.created?: boolean`.

- [ ] **Step 1: Write failing tests** in `auth.test.tsx`:

```ts
it('a new email account opens the guide as first run')  // location /guide, state.firstRun true
it('a new Google account opens the guide')              // created: true
it('a returning Google user goes to Today')             // created absent, token string as the mutation variable
it('a new account with an invite goes to the join screen')
it('a new Google account that came from /settings still opens the guide')
it('a returning user who came from /settings goes back to it')
```

- [ ] **Step 2: Run** `npm test -- src/features/auth`. Expected: FAIL.
- [ ] **Step 3: Implement.** `setAuth` sets `newAccount` to `newAccount === true`, and removes `created` before storing the user. Replace every bare `onSuccess: setAuth` with an explicit lambda (`Register.tsx` Google and create, `Login.tsx` sign-in): React Query passes the variables as the second argument. `GuestRoute`:

```tsx
if (isAuthenticated && newAccount) {
  const invite = invitePath(from)
  return invite ? <Navigate to={invite} replace /> : <Navigate to="/guide" state={{ firstRun: true }} replace />
}
```

- [ ] **Step 4: Run** `npm test -- src/features/auth src/store`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(auth): open the guide after sign-up`.

### Task 8: Guide logic

**Files:**
- Create: `app-react/src/features/guide/guideLogic.ts`, `guideLogic.test.ts`
- Modify: locales (`guide.suggest.*`)

**Interfaces:**
- Produces:

```ts
export type GuideKind = 'sleep' | 'count' | 'time' | 'days'
export interface Choices {
  sleep: { bedtime: string; wake: string; nap: string | null; min: number | null; max: number | null } | null
  count: { count: string; target: number | null; early: string | null; how: string | null } | null
  time: { names: string[]; goal: number | null } | null
  days: { names: string[] } | null
}
export interface PlannedPractice { name: string; data_type: PracticeDataType; dropdown_variants?: string }
export interface GuidePlan { practices: PlannedPractice[]; reports: { kind: GuideKind; name: string; slug: string; choices: Choices[GuideKind] }[] }
export type NameProblem = 'empty' | 'inUseHidden' | 'inUseOtherType' | 'twice'
export function nameProblem(name: string, slot: Slot, practices: UserPractice[], others: PlannedPractice[]): NameProblem | null
export function buildPlan(choices: Choices, practices: UserPractice[], reports: Report[], reportName: (slug: string) => string): GuidePlan
export function uniqueName(base: string, reports: Report[]): string   // "Sleep", "Sleep 2"
export interface GuideApi { getPractices(): Promise<UserPractice[]>; createPractice(p: PlannedPractice): Promise<void>; getReports(): Promise<Report[]>; createReport(name: string, d: ReportDefinition): Promise<string> }
export async function runPlan(plan: GuidePlan, api: GuideApi, onStep: (kind: GuideKind, state: 'working' | 'done') => void): Promise<void>
```

- [ ] **Step 1: Write failing tests:**

```ts
it('orders practices by report, Sleep first, no duplicates between reports')
it('plans no practice for an active compatible name')          // reused as it is
it('flags a hidden practice, another type, an empty name, and the same name used twice with two types')
it('takes the dropdown 1 to 5 for How it went')                 // Text, dropdown_variants '1,2,3,4,5'
it('leaves out unticked optionals')
it('numbers a report name that is taken')
it('resume: creates only what is missing after a failure')
it('a practice POST that failed client-side but landed creates no duplicate')
it('a report POST that failed client-side but landed creates no duplicate') // name now in getReports
it('stops at the first failure, with later reports untouched')
```

- [ ] **Step 2: Run** `npm test -- src/features/guide`. Expected: FAIL.
- [ ] **Step 3: Implement.** Report names are fixed once, in `buildPlan`, against the reports the person had. `runPlan` then treats a plan name found in `getReports()` as already created, and a plan practice found in `getPractices()` as already created, so it is safe to call again. Each report's definition goes through `draftToDefinition` with names mapped to ids: this reuses the templates' validation and builders. Compatibility uses `fits` and `JAPA_SLOTS`, `SLEEP_SLOTS`, `DURATION_SLOT`, `DAYS_SLOT`.
- [ ] **Step 4: Add suggestions** to the locales as in the spec, with ru from `CNT` in `gs-screens.js`. Uk translated. Note for the review with the product owner: the list is the builder's.
- [ ] **Step 5: Run** `npm test -- src/features/guide`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(guide): plan from choices and a resumable runner`.

### Task 9: Mini reports

**Files:**
- Create: `app-react/src/features/guide/examples.ts`, `examples.test.ts`, `MiniReport.tsx`
- Modify: `panels/PanelsReportView.tsx`, `panels/ChartPanelView.tsx`, locales
- Test: `src/features/guide/MiniReport.test.tsx`

**Interfaces:**
- Consumes: `sleepPanels`, `japaPanels`, `durationPanels`, `daysPanels`.
- Produces: `exampleReport(kind: GuideKind, todayCob: string, t: TFunction): { definition: PanelsReport; entries: ReportDataEntry[]; practices: UserPractice[] }`; `exampleSummary(kind, todayCob, t): string`; `<MiniReport kind compact />`; `PanelsReportView`/`ChartPanelView` prop `interactive = true`.

- [ ] **Step 1: Write failing tests:** every kind's example builds and has gaps (some day with no value and none perfect against its target); practice names come from i18n; dates end today; the band "Example · not your data" renders; `role="img"` with the summary as the accessible name; with `interactive={false}` no Recharts `Tooltip` renders.
- [ ] **Step 2: Run** `npm test -- src/features/guide`. Expected: FAIL.
- [ ] **Step 3: Implement.** Port the fixed `SLEEP`, `COUNT`, `DUR`, `DAYS` data from `gs-lib.js` with seeds in place of a random source, so a test sees the same values each run. Definitions come from the real builders, with the Stats panel filtered to the figures each frame shows, so they can't drift. Band per `exBand`.
- [ ] **Step 4: Run** `npm test -- src/features/guide src/features/insights/panels`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(guide): example reports drawn by the real renderer`.

### Task 10: Guide state and report choice

**Files:**
- Create: `features/guide/useGuide.ts`, `useGuideRun.ts`, `GuideScreen.tsx`, `mobile/ChooseMobile.tsx`, `wide/ChooseWide.tsx`, `GuideFrame.tsx`, `src/api/guide.ts`
- Modify: `src/router.tsx` (`/guide` inside `ProtectedRoute`, lazy, in `ui()`)
- Test: `features/guide/GuideScreen.test.tsx`, `useGuide.test.tsx`

**Interfaces:**
- Produces: `useGuide({ firstRun: boolean, back: string })` returning `{ step, tracked: GuideKind[], choices, setChoice, toggle, next, back, leave, confirmLeave }`, where `step` is `{ at: 'choose' } | { at: 'setup', kind } | { at: 'reader' } | { at: 'finish' }`; `useGuideRun(from).mark(step)`, `.end(outcome, hasReader?)`, all ignoring failures; the first request is sent once per mount.

- [ ] **Step 1: Write failing tests:** Track/Skip advance and record; going back keeps a choice; ending with nothing chosen shows the 17m5 screen; "Build my own list" goes to `/` and marks `left`; after a setup screen is completed it asks first (17m28), and Keep going stays; a `guide_runs` failure doesn't stop the guide; first-run state on a reload keeps `firstRun` (it's in history state); on wide layouts Next is disabled with nothing chosen.
- [ ] **Step 2: Run** `npm test -- src/features/guide`. Expected: FAIL.
- [ ] **Step 3: Implement.** Mobile: horizontal `overflow-x-auto snap-x snap-mandatory`, next card peeking, an `IntersectionObserver` (or `scrollLeft`) tracking the current card, and `scrollIntoView` for Track and Skip so buttons and swipes share a position. Dots per `dots`. Wide: `wideChoose` grid with `Toggle`. Header per `obTop` and `wideOB`, stepper per `stepper`. `last_step` values: `choose`, `setup_sleep`, `setup_count`, `setup_time`, `setup_days`, `reader`, `creating`, `finish`.
- [ ] **Step 4: Run** `npm test -- src/features/guide`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(guide): choose reports`.

### Task 11: Setup screens

**Files:**
- Create: `features/guide/setup/{SetupSleep,SetupCount,SetupNames,PracticeRow}.tsx`, `mobile/SetupMobile.tsx`, `wide/SetupWide.tsx`
- Modify: `panels/TemplateForm.tsx` (export `LimitField`), locales
- Test: `features/guide/setup/Setup.test.tsx`

- [ ] **Step 1: Write failing tests:**

```ts
it('renames a practice in place, and it reaches the choices')
it('blocks Next on an empty name')
it('asks for another name when a hidden practice has it')          // 17m body 'clash'
it('offers Use for an active practice of the same type')           // msg with Use / Keep editing
it('Sleep starts at 6h and 9h, each clearable, and blocks min above max')
it('Daily count needs a target, which starts empty')
it('How it went and Part done early start unticked')
it('Time spent and Days I did it need at least one practice')
it('stops at 8 Days practices with a message, 12 for Time spent')
```

- [ ] **Step 2: Run** `npm test -- src/features/guide/setup`. Expected: FAIL.
- [ ] **Step 3: Implement** from `bodySleep`, `bodyCount`, `bodyTime`, `bodyDays`, `pRow`, `chip`. `SetupNames` covers Time spent and Days I did it, with a slot and suggestion list as props. Name checks use `nameProblem`. Aims reuse `LimitField`. Wide layouts put `previewPanel` beside the form: a `MiniReport` of the example data with the current target, names and goal applied.
- [ ] **Step 4: Run** `npm test -- src/features/guide/setup`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(guide): set up practices behind each report`.

### Task 12: Reader question and Finish

**Files:**
- Create: `features/guide/ReaderStep.tsx`, `FinishStep.tsx`
- Modify: `features/today/actions.ts` (export `shareUrl()`, used by `copyShareLink`), locales
- Test: `features/guide/FinishStep.test.tsx`

- [ ] **Step 1: Write failing tests:** neither reader answer starts selected and Next waits for one; the question doesn't appear outside first run; progress shows Created, Creating… and Waiting per `progressList`; a failure shows retry and "Not saved yet", keeps the choices, and retry continues; offline shows the normal error; success invalidates `['practices']` and `REPORTS_KEY`, and marks `finished` with `has_reader`; the share card appears only after Yes and copy says anyone with the link can see the reports and that it updates as they log; Sleep's row says it starts on the second day; Start logging goes to `/`.
- [ ] **Step 2: Run** `npm test -- src/features/guide`. Expected: FAIL.
- [ ] **Step 3: Implement** per `bodyWho`, `progressList`, `sumList`, `shareCard`. Copy from `gs-screens.js`; check every string against Global Constraints on what may not be promised. The link is `/shared/{user id}`, shown whole.
- [ ] **Step 4: Run** `npm test -- src/features/guide`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(guide): reader question, creation and closing screen`.

### Task 13: Today's way back in

**Files:**
- Modify: `features/today/NoPractices.tsx`, locales
- Test: `features/today/mobile/TodayMobile.test.tsx`

- [ ] **Step 1: Write the failing test:** the empty state links to `/guide` with no `firstRun` state, and starter and add-your-own remain.
- [ ] **Step 2: Implement** per `todayEmpty` (17m*), and pass `state={{ back: '/' }}`.
- [ ] **Step 3: Run** `npm test -- src/features/today`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(today): offer the guide from the empty state`.

### Task 14: Create all and link

**Files:**
- Modify: `features/yatras/settings/useLinkPractices.ts`, `mobile/LinkPracticesMobile.tsx`, locales
- Test: `mobile/LinkPracticesMobile.test.tsx`, `linking.test.ts`

**Interfaces:**
- Produces: `useLinkPractices().createAndLink(rows: YatraPractice[]): Promise<void>`; `s.creating: boolean`.

- [ ] **Step 1: Write failing tests:**

```ts
it('offers Create all and link only with no active practices')
it('creates each practice with the yatra name and type, dropdown options included, then links them all')
it('a row creates and links just its own practice')
it('a hidden practice of the same name stops that row with a message, the rest still link')
it('joined=1 shows Start logging once all are linked, going to /')
it('an existing member with practices sees no change')
```

- [ ] **Step 2: Run** `npm test -- src/features/yatras/settings`. Expected: FAIL.
- [ ] **Step 3: Implement.** Create sequentially, skipping a name already active with that type; invalidate `['practices']`, read back, then `linkAll`. No undo toast for creation, per spec. Copy from `yatraBody`. Keep **Help me choose** on the joined screen, linking to `/guide` with `state.back` set to this page.
- [ ] **Step 4: Run** `npm test -- src/features/yatras`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(yatras): create and link a yatra's practices`.

### Task 15: Part B verification and ship

- [ ] **Step 1: Run** `make lint`, `make test`, `npm test`, `npm run build`. Expected: all clean.
- [ ] **Step 2: Walk through by hand** with the `run` skill, on all three layouts, light and dark, en, ru and uk: email sign-up, leaving at each step (Today usable, nothing created), a full run, a forced failure and retry, and an invite sign-up reaching the yatra with every practice linked. Check long ru and uk strings on figures, buttons and the carousel.
- [ ] **Step 3: Check the older-client path:** `POST /users` with no `skip_defaults` still seeds, in a test against the running server.
- [ ] **Step 4: Stop for a ship decision.** The `guide_runs` migration must be applied explicitly on prod before the release. Record the baselines from the spec's Measuring section at launch.

---

## Part C: From "Add practice" (spec Phase 4)

### Task 16: The choice at "Add practice"

**Files:**
- Create: `features/guide/AddPracticeChooser.tsx`
- Modify: `features/today/mobile/TodayMobile.tsx`, `tablet/TodayTablet.tsx`, `desktop/LogPanel.tsx`, `features/practices/mobile/PracticesMobile.tsx`, `features/practices/wide/PracticesWide.tsx`, locales
- Test: `features/practices/mobile/PracticesMobile.test.tsx`, `features/today/mobile/TodayMobile.test.tsx`

**Interfaces:**
- Produces: `<AddPracticeChooser onClose back />`, a sheet on mobile and a dialog or the existing menu pattern on wide layouts.

- [ ] **Step 1: Write failing tests:** "Add practice" on Today and in Settings › Practices offers Help me choose and Add one myself; Add one myself opens `/settings/practices/new` as today; Help me choose opens `/guide` with `state.back` set to the page it came from. Direct links to `/settings/practices/new` still open the form.
- [ ] **Step 2: Run** `npm test -- src/features/practices src/features/today`. Expected: FAIL.
- [ ] **Step 3: Implement** per `chooserRows`. Desktop and tablet use their existing patterns, per spec. The empty-list Add panel on wide layouts stays a form.
- [ ] **Step 4: Run** the same tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(practices): choose between the guide and the form`.

### Task 17: Guide with existing practices

**Files:**
- Modify: `features/guide/guideLogic.ts`, `useGuide.ts`, `setup/SetupNames.tsx`, `setup/SetupSleep.tsx`, `setup/SetupCount.tsx`, `mobile/ChooseMobile.tsx`, `wide/ChooseWide.tsx`, `FinishStep.tsx`, locales
- Test: `guideLogic.test.ts`, `setup/Setup.test.tsx`, `GuideScreen.test.tsx`

- [ ] **Step 1: Write failing tests:**

```ts
it('lists compatible active practices first, with Use, and Using once picked')
it('marks a suggestion that exactly matches with "You already track this"')
it('Use keeps the name, and plans no new practice')
it('a report kind the person already has is marked, and can still be added')  // numbered name
it('skips the reader question')
it('the closing screen returns to where it came from')
it('a report on existing practices includes their logged history')            // definition holds the existing ids
it('leaves the person\'s existing practices and reports unchanged')           // no PUT or DELETE sent
```

- [ ] **Step 2: Run** `npm test -- src/features/guide`. Expected: FAIL.
- [ ] **Step 3: Implement** per `bodyTime` with `existing`. Offering practices uses `pickerGroups(...).compatible`, as the template forms do.
- [ ] **Step 4: Run** `npm test -- src/features/guide`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(guide): use existing practices from Add practice`.
- [ ] **Step 6: Ship gate.** `make lint`, `make test`, `npm test`, and a hand check that no existing user is redirected, then stop for a ship decision.
