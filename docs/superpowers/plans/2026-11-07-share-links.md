# Share links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one all-or-nothing public link with many named, revocable share links. Each link exposes only the reports picked for it, plus an optional opens-on date. The old `/shared/<user-id>` link keeps working until the owner switches it off.

**Architecture:** A new `share_links` table, plus `share_link_reports`, plus `users.legacy_share_enabled`. The existing public `/api/share/{id}/…` endpoints resolve `{id}` first as a link and then as a legacy user id. They filter reports, practices and diary entries to the link's reports on the server. A new authenticated `share_links` module (yatras-style layered layout) handles owner CRUD. On the React side, one Settings → Sharing page and its editor (`ui()`, same tree on every layout). The shared viewer gets small changes, and the guide's reader step is removed.

**Tech Stack:** Rust (actix-web, Diesel, Postgres), React + TypeScript (Vite, React Query, vitest, Testing Library), i18next.

**Spec:** `docs/superpowers/specs/2026-11-07-share-links-design.md`

## Global Constraints

- API changes stay backward compatible with cached React builds. Same endpoint paths, same response shapes; only new fields get added.
- `GET /api/share/{id}/user` never returns the real email (for links and legacy alike). Send `email: ""` and `token: ""`.
- Unknown link, withdrawn link, unknown user, and legacy-off user all give the same 404 (`AppError::NotFound`).
- Filtering happens on the server. A practice not used by the link's reports must never appear in `/practices` or in `/share/{id}` entries.
- No marked periods on shared pages. No new public endpoint.
- No CSV button on the page a share link opens. Legacy links keep it.
- Do not hand-edit `server/src/schema.rs`. Use `make migrate` then `make gen_schema`.
- Every new string goes in `app-react/public/locales/{en,ru,uk}/translation.json`, and `locales.test.ts` parity must pass.
- Dates are local `yyyy-mm-dd` (`toDateStr`/`fromDateStr`). Never `toISOString()`.
- `make lint` must pass (clippy `-D warnings`, eslint). DB tests run via `make test T=<name>` (see memory: DB tests run in the dev container).
- Ship order: Tasks 1–4 (server) can go to stable on their own. Tasks 5–8 go through preview.

## Review Focus

1. **A Panels report whose definition holds a practice the Graph/Grid-style walker misses** (Calc terms, Range from/to, Stat `under`, goals, sleep rows). The link must expose exactly those practices. Covered in Task 2 by a test that builds a definition with each source kind.
2. **A link holding a report the owner later deleted, or a report id belonging to someone else in a create/update body.** Deleted reports drop out silently; foreign ids get 422 and nothing is saved. Covered in Task 3.
3. **Old cached builds asking a new link for `/reports?panels=true`** (level 1). They must get only the level-1 reports in the link and no error. Covered in Task 4.
4. **A link whose reports reference an inactive practice.** The `/share/{id}` data query only returns `is_active` practices. The same filter applies, so no crash and no leak. Covered in Task 4 (`link_entries_only_for_link_practices` includes one inactive practice).
5. **Opens-on date on a month or goals report.** A month report should open on the date's month. Goals ignore the date (they always read to today). Covered in Task 7.

---

### Task 1: Migration — share links tables and legacy switch

**Files:**
- Create: `migrations/2026-11-07-000000-0000_share_links/up.sql`, `down.sql` (via `make create_migration name=share_links`, then rename to this date if needed)
- Modify: `server/src/schema.rs` (generated only)
- Modify: `server/src/app/user/model.rs:18-27` (`User` must keep loading after the new column)

**Interfaces:**
- Produces: tables `share_links(id, user_id, name, start_date, created_at, updated_at, last_opened_at)`, `share_link_reports(share_link_id, report_id)`, column `users.legacy_share_enabled`.

- [ ] **Step 1: Write `up.sql`**

```sql
ALTER TABLE users ADD COLUMN legacy_share_enabled bool NOT NULL DEFAULT false;
UPDATE users SET legacy_share_enabled = true;

CREATE TABLE share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  start_date date NULL,
  last_opened_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX share_links_user_id ON share_links(user_id);
SELECT diesel_manage_updated_at('share_links');

CREATE TABLE share_link_reports (
  share_link_id uuid NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  PRIMARY KEY (share_link_id, report_id)
);
CREATE INDEX share_link_reports_report_id ON share_link_reports(report_id);
```

`down.sql` drops both tables and the column. DB default `false` with existing rows set `true` is deliberate: stable's insert of new users keeps working, and new accounts start with the legacy link off.

- [ ] **Step 2: Run `make migrate && make redo_migrate && make gen_schema`.** Expected: `schema.rs` gains both tables, the `legacy_share_enabled -> Bool` column, and `joinable!` lines.

- [ ] **Step 3: Keep `User` loading.** `User` derives `Queryable` over all columns, and `User::find` uses `users::table.find(id).first`. Add `Selectable` with `#[diesel(table_name = users)]` and switch every `users::table` load of `User` to `.select(User::as_select())`. Find them with `grep -rn "users::table" server/src`. Don't add the new field to `User`.

- [ ] **Step 4: Run `make test`.** Expected: all existing tests pass.

- [ ] **Step 5: Commit** `feat(share): share links tables and legacy share switch`

---

### Task 2: Practices a report uses

**Files:**
- Modify: `server/src/app/report/mod.rs` (`impl ReportDefinition`)
- Test: `server/src/app/report/mod.rs` `#[cfg(test)]` (pure, no DB)

**Interfaces:**
- Consumes: `PanelsReport::practice_ids(&self) -> HashSet<Uuid>` (exists, `panels.rs:418`).
- Produces: `impl ReportDefinition { pub fn practice_ids(&self) -> HashSet<Uuid> }`. It covers Graph traces (`GraphTrace.practice`), Grid `practices`, and Panels via the existing walker.

- [ ] **Step 1: Failing tests**

```rust
#[test]
fn practice_ids_cover_every_report_kind() {
    // graph with traces a, b → {a, b}; grid [c, a] → {c, a}
    // panels: one Chart panel whose series use Source::Practice{p1}, Source::Calc{terms:[p2,p3]},
    // Source::Range{from:p4,to:p5}; a Stat with `under` using p6; Goals panel with goal p7
    // → exactly {p1..p7}
}
```

Build the panels fixture from JSON with `serde_json::from_value`, the way the existing `panels.rs` tests do, so the test doesn't depend on constructor details.

- [ ] **Step 2: Run** `cargo test -p server practice_ids_cover` — FAIL (no method).
- [ ] **Step 3: Implement** `ReportDefinition::practice_ids`.
- [ ] **Step 4: Run** — PASS. If the panels case misses a practice, fix `PanelsReport::walk`, not the test.
- [ ] **Step 5: Commit** `feat(share): practices a report uses`

---

### Task 3: Owner CRUD for share links

**Files:**
- Create: `server/src/app/share_links/{mod.rs,dto.rs,service.rs,handlers.rs}` (copy the layout of `app/marked_periods/`)
- Modify: `server/src/app/mod.rs` (`pub mod share_links;`), `server/src/routes.rs` (authenticated routes)

**Interfaces:**
- Consumes: `ReportDefinition::practice_ids` (Task 2), `Report::get_all(conn, user_id, level, months, shared)` (`report/mod.rs:29`), `UserPractice::all_user_practices`.
- Produces (dto, all `Serialize`; forms `Deserialize`):

```rust
pub struct ShareLink { pub id: Uuid, pub name: String, pub start_date: Option<NaiveDate>,
                       pub last_opened_at: Option<DateTime<Utc>>, pub report_ids: Vec<Uuid> }
pub struct ShareableReport { pub id: Uuid, pub name: String, pub kind: &'static str /* "Graph"|"Grid"|"Panels" */,
                             pub practices: Vec<String> /* practice names, user's practice order */ }
pub struct ShareLinksResponse { pub links: Vec<ShareLink>, pub reports: Vec<ShareableReport>, pub legacy_enabled: bool }
pub struct ShareLinkForm { pub name: String, pub start_date: Option<NaiveDate>, pub report_ids: Vec<Uuid> }
pub struct CreatedShareLink { pub id: Uuid }
pub struct LegacyShareForm { pub enabled: bool }
```

- service:
  - `list(conn, user_id) -> Result<ShareLinksResponse, AppError>`. Links come newest first, `report_ids` in report-name order. `reports` covers all the owner's reports at level 4 with months.
  - `create(conn, user_id, &ShareLinkForm) -> Result<Uuid, AppError>`
  - `update(conn, user_id, &id, &ShareLinkForm) -> Result<(), AppError>`. It replaces the name, date and full report set in one transaction.
  - `delete(conn, user_id, &id) -> Result<(), AppError>`
  - `set_legacy(conn, user_id, enabled: bool) -> Result<(), AppError>`
- routes:
  - `GET/POST /api/share-links`
  - `PUT/DELETE /api/share-link/{id}`
  - `PUT /api/share-links/legacy` (body `LegacyShareForm`)

- [ ] **Step 1: Failing tests** in `service.rs` (helpers `run`, `new_user` copied from `marked_periods/service.rs:131-157`; reports made with `report::db::Report::create`):
  - `create_then_list`: the link's name is trimmed, `start_date` and `report_ids` round-trip, `last_opened_at` is `None`, and a stranger's list is empty.
  - `name_is_trimmed_and_limited`: `""`, `"   "` and 101 chars → `UnprocessableEntity`; 100 chars and `"я"×100` are OK.
  - `foreign_report_is_rejected`: create/update with another user's report id → `UnprocessableEntity`, and nothing changes.
  - `other_users_link_is_not_found`: update/delete by another user → `NotFound`.
  - `update_replaces_report_set`: [r1, r2] → [r2] leaves [r2].
  - `deleting_report_drops_it_from_links`
  - `deleting_user_deletes_links`
  - `list_reports_carry_kind_and_practice_names`: graph `kind == "Graph"` with its practice names.
  - `legacy_flag_round_trips`: a new user starts `false`, `set_legacy(true)` makes `list` show `true`.
- [ ] **Step 2: Run** `make test T=share_links` — FAIL.
- [ ] **Step 3: Implement** the service, dto, handlers (`auth::get_current_user(&req)?.id`, as in `marked_periods/handlers.rs`) and routes. Use `MAX_NAME_LEN = 100`. An empty `report_ids` is allowed.
- [ ] **Step 4: Run** `make test T=share_links` — PASS.
- [ ] **Step 5: Commit** `feat(share): owner CRUD for share links`

---

### Task 4: Public share endpoints resolve links and filter

**Files:**
- Modify: `server/src/app/shared.rs` (all four handlers), `server/src/routes.rs:171-178` (`/user` → a new handler in `shared.rs` instead of `user::api::user_info`), `server/src/app/report/mod.rs:66` (remove `|| (shared && p.level() >= 3)`; the `shared` parameter can go if nothing else uses it)
- Modify: `server/src/app/report/db.rs` tests `shared_never_gets_gaps` / `shared_never_gets_goals` → rename to `shared_gets_gaps_at_level_3` / `shared_gets_goals_at_level_4` and assert they're included
- Test: `server/src/app/share_links/service.rs` (resolver), `server/src/app/shared.rs` `#[cfg(test)]`

**Interfaces:**
- Consumes: Task 2, Task 3 tables.
- Produces in `share_links::service`:

```rust
pub enum Share { Link { id: Uuid, user_id: Uuid, start_date: Option<NaiveDate>, report_ids: Vec<Uuid> }, Legacy { user_id: Uuid } }
pub fn resolve(conn: &mut PgConnection, id: &Uuid) -> Result<Share, AppError>        // NotFound per Global Constraints
pub fn touch(conn: &mut PgConnection, link_id: &Uuid) -> Result<(), AppError>         // last_opened_at = now()
```

- Response of `GET /api/share/{id}/user`:
  `{ "user": { "id", "email": "", "token": "", "name" }, "kind": "link"|"legacy", "start_date": "yyyy-mm-dd"|null }`.
  The handler calls `touch` for links.
- For a `Link`:
  - `/reports` → `Report::get_all(…)` filtered to `report_ids`, still under the client's `panels`/`months` query.
  - `/practices` → `all_user_practices` filtered to the union of `practice_ids()` across those reports. Use all link reports at level 4 for this, independent of the query level, so a level-1 client still gets the practices of the reports it can see.
  - `/share/{id}` → entries whose `practice` name is in that set's names.
- `Legacy` behaves exactly as today, except the email is blanked and the level-3+ rule is gone.

- [ ] **Step 1: Failing tests**
  - `resolve_link_and_legacy`:
    - a link id gives `Link` with its reports
    - the user id of a legacy-on user gives `Legacy`
    - a legacy-off user gives `NotFound`
    - a random uuid gives `NotFound`
    - a deleted link gives `NotFound`
  - `touch_sets_last_opened`
  - `link_reports_only_listed` (in `shared.rs`; call the inner fns, not HTTP): a user with reports A, B and a link to [A] gets reports [A]. At level 1 a link to a Gaps report plus a graph gets just the graph, and its practices still include the graph's.
  - `link_practices_and_entries_only_for_link_practices`:
    - practices Sleep, Japa, Celibacy, and an inactive practice used by the report
    - the link's report uses Sleep, Japa and the inactive one
    - practices = {Sleep, Japa, inactive}
    - entries for a logged day contain no `Celibacy` rows
  - `user_endpoint_blanks_email` for link and legacy.

  If the handlers have no testable inner function, extract `fn shared_reports(conn, share: &Share, level, months) -> Result<Vec<Report>, AppError>`, `fn shared_practices(conn, &Share) -> Result<Vec<UserPractice>, AppError>`, and `fn shared_entries(conn, &Share, &NaiveDate, &ReportDuration) -> Result<Vec<ReportEntry>, AppError>` in `shared.rs`, and test those.
- [ ] **Step 2: Run** `make test T=shared` and `make test T=resolve` — FAIL.
- [ ] **Step 3: Implement.** No change to `SkipAuthRoute`: the paths are the same.
- [ ] **Step 4: Run** `make test` and `make lint` — PASS.
- [ ] **Step 5: Commit** `feat(share): public share endpoints serve only a link's reports`

---

### Task 5: Client API for share links

**Files:**
- Create: `app-react/src/api/shareLinks.ts`
- Modify: `app-react/src/api/charts.ts:139-150` (`getSharedUser` return type, `getSharedReports` level)
- Test: `app-react/src/api/shareLinks.test.ts` (msw, same as other api tests in `src/test/handlers`)

**Interfaces:**
- Produces:

```ts
export interface ShareLink { id: string; name: string; start_date: string | null; last_opened_at: string | null; report_ids: string[] }
export interface ShareableReport { id: string; name: string; kind: 'Graph' | 'Grid' | 'Panels'; practices: string[] }
export interface ShareLinksData { links: ShareLink[]; reports: ShareableReport[]; legacy_enabled: boolean }
export interface ShareLinkForm { name: string; start_date: string | null; report_ids: string[] }
export const SHARE_LINKS_KEY = ['share-links'] as const
export const shareLinksApi: {
  list(): Promise<ShareLinksData>
  create(f: ShareLinkForm): Promise<string>
  update(id: string, f: ShareLinkForm): Promise<void>
  remove(id: string): Promise<void>
  setLegacy(enabled: boolean): Promise<void>
}
export function useShareLinks(): { data: ShareLinksData | undefined; isLoading: boolean }   // useQuery on SHARE_LINKS_KEY
export const shareLinkUrl = (id: string) => `${window.location.origin}/shared/${id}`
```

- `chartsApi.getSharedUser(id)` → `Promise<{ id: string; name: string; kind: 'link' | 'legacy'; start_date: string | null }>`. It merges `res.data.user` with `kind`/`start_date`, and an absent `kind` (old server) defaults to `'legacy'`.
- `chartsApi.getSharedReports` sends `panels: 4`. Update the comment on `getReports` that says the shared list stays at 1.

- [ ] **Step 1: Failing tests**: `list` hits `GET /api/share-links`; `create` POSTs the form and returns the id; `getSharedUser` defaults `kind` to `'legacy'` when absent.
- [ ] **Step 2: Run** `cd app-react && npx vitest run src/api/shareLinks.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(share): client API for share links`

---

### Task 6: Settings → Sharing page and link editor

**Files:**
- Create: `app-react/src/features/settings/Sharing.tsx` (`Sharing` list, `ShareLinkEditor`)
- Modify: `app-react/src/router.tsx` (lazy routes `/settings/sharing`, `/settings/sharing/new`, `/settings/sharing/:id`, each wrapped in `ui()`, next to `/settings/periods` at line 134)
- Modify: `app-react/src/features/settings/sections.tsx` (`SadhanaRows`: a row `t('sharing.title')` with the link count, `to="/settings/sharing"`, after Insights)
- Modify: `app-react/public/locales/{en,ru,uk}/translation.json` (new `sharing` block)
- Test: `app-react/src/features/settings/Sharing.test.tsx`

**Interfaces:**
- Consumes: Task 5 (`useShareLinks`, `shareLinksApi`, `shareLinkUrl`, `SHARE_LINKS_KEY`), `SettingsSubpage`/`AddPill`/`ROWS` (`SettingsSubpage.tsx`), `Toggle`, `BottomSheet`, `useToast`, `formatDay`.
- Layout follows `MarkedPeriods.tsx` (one tree, `SettingsSubpage`) and the agreed sketch:
  - **List** (`/settings/sharing`):
    - intro line, then an `AddPill` reading "New link" → `/settings/sharing/new`
    - one row per link, made of a button to `/settings/sharing/:id` plus a trailing **Copy** button
    - each row shows the name and a summary: the report names joined with ", " when there are ≤2, else `sharing.charts` with count; then `sharing.opensToday` or `sharing.opensOn {date}`; then `sharing.lastOpened {date}` when set
    - after the list, an "Old public link" row that's always shown, with a `Toggle` bound to `legacy_enabled` and the hint `sharing.legacyHint` ("Shows all your charts and data to anyone with the old link.")
  - **Editor** (`new` / `:id`):
    - a name input labelled `sharing.whoFor`
    - a checklist of `reports`, each with its name, kind label (`sharing.kind.Graph|Grid|Panels`) and `practices.join(', ')` under it
    - "Opens on": a `SegmentedControl` Today / Date. Date shows a native `<input type="date">`; Today saves `null`.
    - a **Save** button. On a new link, Save creates, then replaces the URL with `/settings/sharing/:id`.
    - **Share link…** (`navigator.share({ url })`, rendered only when `'share' in navigator`) and **Copy** (`navigator.clipboard.writeText`, toast `sharing.copied`), shown only for a saved link
    - **Withdraw access** (danger), which opens a `BottomSheet` confirm (`sharing.withdrawTitle`, `sharing.withdrawMsg`, Cancel / `sharing.withdraw`). It deletes and returns to the list.
  - Save is disabled while the trimmed name is empty. Every mutation invalidates `SHARE_LINKS_KEY`.

- [ ] **Step 1: Failing tests** (mock `../../api/shareLinks`):
  - `lists links with summary and copies a link`: "Friend · Sleep, Japa · opens on …"; clicking Copy calls `clipboard.writeText('<origin>/shared/l1')`.
  - `legacy toggle calls setLegacy(false)`
  - `new link: name, tick two reports, pick a date, save → create({ name: 'Mentor', start_date: '2026-10-31', report_ids: ['a','c'] })`
  - `editor shows each report's practices` ("Rounds, Reading, Celibacy").
  - `Today saves start_date null`
  - `withdraw asks first, then remove('l1') and back to the list`
  - `Save disabled for a blank name`
- [ ] **Step 2: Run** `npx vitest run src/features/settings/Sharing.test.tsx` — FAIL.
- [ ] **Step 3: Implement** the page, editor, routes and row. Write strings in en/ru/uk with natural phrasing (Russian and Ukrainian, not machine-literal).
- [ ] **Step 4: Run** `npm test` and `npm run lint` — PASS (including `locales.test.ts`).
- [ ] **Step 5: Commit** `feat(share): Settings → Sharing with per-person links`

---

### Task 7: Insights menu and viewer page

**Files:**
- Modify: `app-react/src/features/insights/mobile/MoreMenu.tsx:36` (the item becomes `t('sharing.title')` → `navigate('/settings/sharing')`; tablet uses the same hook)
- Modify: `app-react/src/features/today/actions.ts` (delete `shareUrl`, `copyShareLink`; keep `downloadCsv`)
- Modify: `app-react/src/features/shared/parts.tsx` (`useShared`), `app-react/src/features/shared/SharedReports.tsx` (CSV button only when `s.kind === 'legacy'`, on all three layouts)
- Modify: `app-react/public/locales/*/translation.json` (remove `charts.shareLink` and `charts.copied` if unused), `app-react/src/test/setup.ts:250` (drop the inlined `shareLink`)
- Test: `app-react/src/features/shared/SharedReports.test.tsx`, the existing MoreMenu/Insights tests

**Interfaces:**
- Consumes: Task 5 `getSharedUser` (`kind`, `start_date`).
- `useShared` returns, in addition, `kind: 'link' | 'legacy'`. Once the user query resolves with a `start_date` that isn't today, it calls `ins.setEnd(fromDateStr(start_date))` and `ins.setMonth(start_date.slice(0, 7))` exactly once, through a ref guard so later moves by the viewer stick.

- [ ] **Step 1: Failing tests**
  - `link page has no CSV button`: `getSharedUser` → `kind: 'link'`, and the CSV button is absent on mobile, tablet and desktop.
  - `legacy page keeps CSV` (existing test stays green).
  - `opens on the link's date`: `start_date: '2026-10-31'` makes the first `getSharedReportData` call use `end_date === '2026-10-31'`. A month report opens on October 2026. The viewer can still change the date (the next call uses the new date).
  - `shows a Gaps report on a shared link`: `getSharedReports` is called with level 4 and the Gaps panel renders with no bands.
  - Insights menu: "Sharing" navigates to `/settings/sharing`.
- [ ] **Step 2: Run** `npx vitest run src/features/shared src/features/insights` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` and `npm run lint` — PASS.
- [ ] **Step 5: Commit** `feat(share): Insights links to Sharing; shared page opens on the link's date, no CSV`

---

### Task 8: Remove the guide's reader step and share block

**Files:**
- Delete: `app-react/src/features/guide/ReaderStep.tsx`
- Modify:
  - `useGuide.ts`: drop `{ at: 'reader' }` from `GuideStep`, the `reader`/`setReader` state, and the reader branches at lines 47 and 67; `finished()` takes no argument; drop `reader` from the `last_step` doc comment.
  - `useGuideRun.ts:15`: `end(outcome)` sends `{ outcome }` only.
  - `GuideScreen.tsx:11,38`: drop the reader step.
  - `GuideFrame.tsx:22`: drop `reader: 'sharing'`. If the step indicator counts steps, it now has one fewer on first run.
  - `FinishStep.tsx`: drop the `link` block (lines ~89, 134) and `guide.reader` in `finished`.
- Modify: locales (remove `guide.reader.*` and any finish-step share strings)
- Modify tests: `useGuide.test.tsx`, `GuideScreen.test.tsx`, `FinishStep.test.tsx` (remove the reader describe block and the `has_reader` expectations, and assert the new flow)
- Server: no change. It keeps accepting `has_reader` and the `reader` `last_step` value for old builds.

- [ ] **Step 1: Update tests first**:
  - `first run goes from the last setup straight to finish`
  - `finished sends { outcome: 'finished' } with no has_reader`
  - `Back from finish returns to the last setup on first run too`
  - `finish shows no share link`
- [ ] **Step 2: Run** `npx vitest run src/features/guide` — FAIL.
- [ ] **Step 3: Implement** the removals.
- [ ] **Step 4: Run** `npm test`, `npm run lint` and `make lint` — PASS. Also run `grep -rn "reader\b" app-react/src/features/guide`, which should only find "screen reader" mentions.
- [ ] **Step 5: Commit** `feat(guide): drop the reader question and the share link`
