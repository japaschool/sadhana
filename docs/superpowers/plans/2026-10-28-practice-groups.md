# Practice Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User-defined, reorderable practice groups that section the Today screen, are managed on the Practices settings screen (mock option A), and head the columns of Insights tables (with a per-table "Group columns" switch).

**Architecture:** A new `practice_groups` table, with `user_practices.group_id` where NULL means the default group; the default group's position is a lazily created `is_default` row. Group changes and moves go through one new `PUT /user/practices/layout` call that old builds never make, so their practice/report writes can't clobber groups. On the client, one pure module (`features/practices/groups.ts`) turns groups + practices into sections, and every screen renders from it.

**Tech Stack:** Rust (actix-web 4, Diesel 2, Postgres), React 19 + TypeScript + Vite, TanStack Query, dnd-kit, framer-motion, i18next, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-practice-groups-design.md` (read it; mock frame ids like 14a4 refer to the claude.ai/design project "Sadhana Redesign": `Groups Today.dc.html`, `Groups Settings.dc.html` option A, `Groups Insights.dc.html`).

## Global Constraints

- Backward compatible with cached React builds from before this change: their practice create/update/reorder and report create/update keep working and never change a practice's group, a report's `group_columns`, or a table's stored column order.
- Migration is additive only. Never hand-edit `server/src/schema.rs`; run `make gen_schema` after migrating.
- `group_id IS NULL` = default group. Default group shown as "Practices" (translated), can't be renamed/deleted, can be moved.
- Group names: trimmed, 1–64 chars, unique per user (duplicate → 422 via the existing `UniqueViolation` mapping in `common/src/error.rs`).
- All new strings in en/ru/uk (`app-react/public/locales/{en,ru,uk}/translation.json`).
- Dates rule unchanged: local `yyyy-mm-dd`, never `toISOString()`.
- New server code follows the layered `yatras` layout (`handlers.rs` → `service.rs` → `dto.rs`).
- Commands: server tests `make test T=<name>` (real Postgres; if the host can't reach the DB use `docker exec stoic_volhard bash -lc 'cd /workspaces/sadhana-pro && make test T=<name>'`). JS tests with Node 22: `cd app-react && npx -y -p node@22 node node_modules/vitest/vitest.mjs run <file>`. Lint: `make lint`.

## Review Focus

1. A practice whose `group_id` names a group the client doesn't have (stale persisted cache, deleted on another device) → it shows in the default group, never vanishes. Test: Task 3 `groupPractices` "unknown group falls back to default".
2. A cached old build updates or reorders a practice after the user grouped it → group unchanged. Test: Task 1 `old_update_and_reorder_keep_group`.
3. A cached old build saves a table report (rename) → `group_columns` and custom column order survive. Test: Task 2 `grid_save_without_group_columns_keeps_setting_and_order`.
4. A layout call naming another user's group or practice → rejected, nothing written. Test: Task 1 `layout_rejects_foreign_ids`.
5. A group whose practices are all hidden → no empty header on Today. Test: Task 3 `todaySections` "drops groups with no active practices".

---

### Task 1: Server — groups table, groups API, layout endpoint

**Files:**
- Create: `migrations/2026-10-28-000000-0000_practice_groups/{up,down}.sql`
- Create: `server/src/app/practice_groups/{mod.rs,handlers.rs,service.rs,dto.rs}`
- Modify: `server/src/app/mod.rs` (register module), `server/src/routes.rs:125-143` (routes), `server/src/app/user_practices.rs` (`group_id` on `UserPractice`, `NewUserPracticeForm`, `NewUserPractice`, selects), `server/src/schema.rs` (regenerated)
- Test: `#[cfg(test)] mod tests` in `server/src/app/practice_groups/service.rs`

**Interfaces:**
- Produces (HTTP, all under the authenticated `/api/user` scope):
  - `GET /practice-groups` → `{ "groups": [{ "id": Uuid|null, "name": String, "is_default": bool }] }` in order. The default group always appears once with `id: null, name: ""`. With no rows it's `[default]`.
  - `POST /practice-groups` body `{ "name": String }` → `{ "id": Uuid }`. Appended last. Creates the default row first (order_key 0) if missing.
  - `PUT /practice-group/{id}` body `{ "name": String }` → `()`.
  - `DELETE /practice-group/{id}` → `()`. Its practices get `group_id = NULL` and move to the end of the global order, keeping their relative order.
  - `PUT /practices/layout` body `{ "groups": [Uuid|null], "practices": [{ "id": Uuid, "group_id": Uuid|null }] }` → `()`. One transaction: ensure the default row; set group order_keys from `groups` index (null = default row); set each listed practice's `group_id` and `order_key` from its index. Unlisted rows untouched. Any id not owned by the user → 404 (`AppError::NotFound`) and nothing written.
  - `GET /practices` and `GET /practice/{id}`: each practice gains `"group_id": Uuid|null`.
  - `POST /practices`: `user_practice.group_id` optional (`#[serde(default)]`). If set, it must be the user's group, else 404.
  - `PUT /practice/{id}`: unchanged and never writes `group_id` (the field may be present in the body and is ignored).
- Produces (Rust): `service::list(conn, user_id) -> Result<Vec<dto::Group>, AppError>`, `create(conn, user_id, name) -> Result<Uuid, AppError>`, `rename(conn, user_id, id, name)`, `delete(conn, user_id, id)`, `save_layout(conn, user_id, &dto::Layout)`.

- [ ] **Step 1: Write the migration**

`up.sql`:
```sql
CREATE TABLE practice_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_key int NOT NULL,
  is_default bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX practice_groups_one_default ON practice_groups (user_id) WHERE is_default;
CREATE UNIQUE INDEX practice_groups_unique_name ON practice_groups (user_id, name) WHERE NOT is_default;
ALTER TABLE user_practices ADD COLUMN group_id uuid NULL REFERENCES practice_groups(id) ON DELETE SET NULL;
```
Match how existing migrations generate uuids and `updated_at` triggers (copy from a recent migration in `migrations/`). `down.sql` drops the column, then the table. Run `make migrate` and `make gen_schema`.

- [ ] **Step 2: Write the failing service tests** (style: `server/src/app/diary/model.rs` tests, using `conn.test_transaction` and a helper that inserts a user plus practices A, B, C at order_keys 0–2)

```rust
#[test] fn list_without_groups_is_just_default()      // list == [Group{id:None,name:"",is_default:true}]
#[test] fn create_appends_after_default()              // create("Morning") → list ids == [None, Some(morning)]
#[test] fn duplicate_or_blank_name_is_rejected()       // create("Morning") twice → Err UnprocessableEntity; create("  ") and 65 chars → Err BadRequest (or the crate's validation variant)
#[test] fn layout_moves_practice_and_groups()          // save_layout(groups:[Some(m),None], practices:[{C,Some(m)},{A,None},{B,None}]) → list order [m, default]; C.group_id==Some(m); order_keys C=0,A=1,B=2
#[test] fn delete_returns_practices_to_end_of_default() // C in m at order 0; delete(m) → C.group_id None and C.order_key > A,B
#[test] fn layout_rejects_foreign_ids()                // another user's group id or practice id → Err NotFound; no row changed
#[test] fn old_update_and_reorder_keep_group()         // C in m; UserPractice::update(... C ...) and update_order_key([...]) → C.group_id still Some(m)
#[test] fn create_practice_with_group()                // UserPractice::create with group_id Some(m) → stored; foreign group → Err NotFound
```

- [ ] **Step 3: Run them to verify they fail**

Run: `make test T=practice_groups`
Expected: compile errors / FAIL (module doesn't exist).

- [ ] **Step 4: Implement `dto.rs`, `service.rs`, `handlers.rs`, routes and the `user_practices.rs` changes**

`dto.rs`: `Group { id: Option<Uuid>, name: String, is_default: bool }` (Serialize), `GroupsResponse { groups }`, `NameForm { name: String }`, `Layout { groups: Vec<Option<Uuid>>, practices: Vec<LayoutPractice { id: Uuid, group_id: Option<Uuid> }> }` (Deserialize). Ownership checks: count the user's rows matching the given ids and compare with the number of distinct ids. Add `group_id` to every `user_practices` select tuple that builds `UserPractice` (`grep -n "user_practices::dropdown_variants" server/src`). Add it with `#[serde(default)]` on `UserPractice` so old update bodies still parse.

- [ ] **Step 5: Run tests to verify they pass**

Run: `make test T=practice_groups` then `make test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add migrations server
git commit -m "feat(groups): practice groups table, API and layout endpoint"
```

---

### Task 2: Server — table reports keep column order and a Group columns flag

**Files:**
- Create: `migrations/2026-10-28-000001-0000_report_group_columns/{up,down}.sql`
- Modify: `server/src/app/report/mod.rs:130-141` (`GridReport`), `server/src/app/report/db.rs` (`Report`, `Report::update`, `Report::get_all`, `ReportTrace::update`), `server/src/schema.rs` (regenerated)
- Test: `#[cfg(test)] mod tests` in `server/src/app/report/db.rs`

**Interfaces:**
- Produces (wire): `Grid` becomes `{ "practices": [Uuid] (ordered), "group_columns": bool }`. On input `group_columns` is optional: absent means an old client.
- Rust: `GridReport { practices: Vec<Uuid>, #[serde(default)] group_columns: Option<bool> }`. `get_all` always fills `Some(stored)`.

- [ ] **Step 1: Migration**

```sql
ALTER TABLE reports ADD COLUMN group_columns bool NOT NULL DEFAULT true;
ALTER TABLE report_traces ADD COLUMN order_key int NOT NULL DEFAULT 0;
```
Then `make migrate && make gen_schema`.

- [ ] **Step 2: Write the failing tests**

```rust
#[test] fn grid_keeps_column_order()   // create Grid [C,A,B] group_columns Some(false) → get_all practices == [C,A,B], group_columns == Some(false)
#[test] fn graph_keeps_trace_order()   // create Graph with traces [C,A] → get_all traces practice order == [C,A]
#[test] fn grid_save_without_group_columns_keeps_setting_and_order()
    // stored [B,A,C], Some(false); update with Grid{practices:[A,B,D], group_columns:None}
    // → practices == [B,A,D] (stored order for kept ids, new ids appended; C dropped); group_columns stays Some(false)
#[test] fn grid_save_with_group_columns_takes_sent_order() // update Grid{[A,C], Some(true)} → [A,C], Some(true)
```

- [ ] **Step 3: Run to verify they fail**

Run: `make test T=report`
Expected: FAIL / compile errors.

- [ ] **Step 4: Implement**

`ReportTrace::update` writes `order_key` = index for both Grid and Graph. `get_all` orders traces by `report_traces::order_key`. `Report::update` for `Grid` with `group_columns: None`: load the stored practice ids in order, keep those present in the sent set (stored order), append sent ids not stored (sent order), and don't write `reports::group_columns`. With `Some(v)`: write `v` and use the sent order. `Report::create` writes `group_columns.unwrap_or(true)`.

- [ ] **Step 5: Run tests**

Run: `make test T=report` then `make test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add migrations server
git commit -m "feat(reports): ordered table columns and group_columns flag"
```

---

### Task 3: Client — API, types, and section logic

**Files:**
- Modify: `app-react/src/types/api.ts:20-27`, `app-react/src/api/practices.ts`, `app-react/src/api/charts.ts:21-23`
- Create: `app-react/src/features/practices/groups.ts`, `app-react/src/features/practices/groups.test.ts`

**Interfaces:**
- Consumes: Task 1/2 wire shapes.
- Produces:
  - `UserPractice.group_id?: string | null`; `export interface PracticeGroup { id: string | null; name: string; is_default: boolean }`; `GridReport { practices: string[]; group_columns?: boolean }`.
  - `practicesApi.getGroups(): Promise<PracticeGroup[]>`, `createGroup(name: string): Promise<string>`, `renameGroup(id: string, name: string): Promise<void>`, `deleteGroup(id: string): Promise<void>`, `saveLayout(layout: Layout): Promise<void>`; `createUserPractice` data gains `group_id?: string | null`.
  - `groups.ts`:
    - `export interface Section { group: PracticeGroup; practices: UserPractice[] }`
    - `export interface Layout { groups: (string | null)[]; practices: { id: string; group_id: string | null }[] }`
    - `groupPractices(groups: PracticeGroup[], practices: UserPractice[]): Section[]`: one section per group in order (empty ones included), practices in input order. A `group_id` that's missing/undefined/unknown goes to the default. A default absent from `groups` (e.g. old cache) is prepended.
    - `todaySections(groups, practices): Section[]`: `groupPractices` over active practices, dropping empty sections.
    - `layoutOf(sections: Section[]): Layout`: groups' ids in order; practices flattened in section order.
    - `moveToGroupEnd(sections: Section[], practiceId: string, groupId: string | null): Section[]`
    - `groupName(g: PracticeGroup, t: TFunction): string`: `t('today.group')` for the default, otherwise `g.name`.

- [ ] **Step 1: Write failing tests in `groups.test.ts`**

```ts
it('puts practices under their groups in group order')                 // groups [m, default], A(null), B(m) → [[m,[B]], [default,[A]]]
it('unknown group falls back to default')                              // B.group_id 'gone' → B in default
it('adds a missing default group first')                               // groups [] → [[default,[A,B]]]
it('keeps empty groups')                                               // groups [default, e] → e section with []
it('todaySections drops groups with no active practices')              // m holds only an inactive practice → no m section
it('layoutOf flattens in section order')                               // → { groups:['m',null], practices:[{id:'B',group_id:'m'},{id:'A',group_id:null}] }
it('moveToGroupEnd moves a practice to the end of another group')
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd app-react && npx -y -p node@22 node node_modules/vitest/vitest.mjs run src/features/practices/groups.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the types, API methods (routes from Task 1) and `groups.ts`**

- [ ] **Step 4: Run tests**

Same command. Expected: PASS. Also `cd app-react && npx tsc -b --noEmit` (or `npm run build`) is clean.

- [ ] **Step 5: Commit**

```bash
git add app-react/src
git commit -m "feat(groups): client API and section logic"
```

---

### Task 4: Today shows one list group per group

**Files:**
- Modify: `app-react/src/features/today/useToday.ts` (add the `['practice-groups']` query; return `sections: Section[]` from `todaySections`), `today/mobile/TodayMobile.tsx:49-57`, `today/desktop/LogPanel.tsx:80-88`, `today/tablet/TodayTablet.tsx:38-47,85-93`
- Test: `today/mobile/TodayMobile.test.tsx`, `today/tablet/TodayTablet.test.tsx` (create if missing, following TodayMobile's test setup), `today/useToday.test.tsx`

**Interfaces:**
- Consumes: `todaySections`, `groupName`, `practicesApi.getGroups` (Task 3).
- Produces: `useToday(date).sections: Section[]`. `practices` stays as is (summary and keyboard nav still use the flat list, in section order: `sections.flatMap(s => s.practices)`).

- [ ] **Step 1: Failing tests**

```ts
// TodayMobile.test.tsx
it('shows one labelled list per group in group order')   // mock getGroups [m 'Morning', default]; expect group labels ['Morning','Practices'] in DOM order and B under Morning
it('shows a single Practices list when there are no groups') // getGroups → [default]; one 'Practices' label (today's behaviour)
// TodayTablet.test.tsx
it('never splits a group across the two columns')        // each group's rows are inside one element with class break-inside-avoid
```

- [ ] **Step 2: Run to verify they fail** — `npx -y -p node@22 node node_modules/vitest/vitest.mjs run src/features/today`

- [ ] **Step 3: Implement**

Mobile and desktop: map `today.sections` to `<ListGroup label={groupName(s.group, t)}>`, keyed by `s.group.id ?? 'default'`, with labels truncated on one line (`truncate`). Tablet: drop the halves; render sections in a `md:columns-2 gap-4` container, each section a `break-inside-avoid mb-4` block with its `h2` label and `CARD`. Remove the `ponytail:` comment about one hardcoded group. Loading skeletons keep the single `today.group` label.

- [ ] **Step 4: Run tests** — same command; PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(today): practices sectioned by group"`

---

### Task 5: Practices settings — sectioned list and group management (option A)

**Files:**
- Modify: `app-react/src/features/practices/usePractices.ts`, `practices/mobile/PracticesMobile.tsx` (`PracticeList`, header "+ Group"), `practices/wide/PracticesWide.tsx`, `app-react/src/router.tsx` (group routes), locales ×3
- Create: `app-react/src/features/practices/mobile/GroupSheet.tsx`, `app-react/src/features/practices/dragLayout.ts` + `dragLayout.test.ts`
- Test: `practices/mobile/PracticesMobile.test.tsx`, `practices/wide/PracticesWide.test.tsx`

**Interfaces:**
- Consumes: Task 3 API + `groupPractices`, `layoutOf`, `groupName`.
- Produces:
  - `usePractices()` adds `groups: PracticeGroup[]`, `sections: Section[]`, mutations `createGroup` (name → id), `renameGroup ({id,name})`, `deleteGroup (group)`, `saveLayout (Layout)`. `saveLayout` is optimistic: write `group_id`/order into `['practices']` and order into `['practice-groups']` in `onMutate`, refetch both on error with the `common.error` toast, and show the `practices.orderSaved` toast on success (as `reorder` does today). `create` accepts `group_id`.
  - `dragLayout.ts`: the list is one flat sortable sequence of items `hdr:<gid|default>`, `p:<practiceId>`, `empty:<gid>` (drop zone of an empty group).
    - `flatItems(sections: Section[], collapsed: boolean): string[]`: only headers when `collapsed` (a group is being dragged).
    - `dropPractice(sections, activeId, overId): Section[]`: the practice's new group is the nearest header at or above the drop position; dropping above the first header lands at the start of the first group.
    - `dropGroup(sections, activeGroupKey, overGroupKey): Section[]`
  - Routes: `/settings/practices/groups/new` (name sheet) and `/settings/practices/groups/:groupId` (rename/delete), as sheets on mobile and in the side panel on wide, mirroring practice routes. The default group has no route.

- [ ] **Step 1: Failing unit tests (`dragLayout.test.ts`)**

```ts
it('dropping a practice on another group\'s row moves it into that group, at that position')
it('dropping on an empty group\'s drop zone moves it there')
it('dropping above the first header lands first in the first group')
it('dropGroup reorders groups, including the default')
it('flatItems collapsed lists headers only')
```

- [ ] **Step 2: Failing screen tests**

```ts
// PracticesMobile.test.tsx
it('shows group headers with counts, a Default chip on the default group and no menu on it')
it('+ Group opens a name sheet; creating calls createGroup("Kirtan")')            // 14a3
it('tapping a header opens the group sheet; Save renames')                         // 14a4
it('Delete group confirms with the count and destination, then calls deleteGroup') // 14a5 copy
it('an empty group shows the drop-zone text')                                      // 14a2
it('with only the default group, the count line has no group count and shows the add-group hint') // 14a1
it('a duplicate group name shows the name-taken error')                            // 422
// PracticesWide.test.tsx
it('selecting a group header opens rename/delete in the panel')                    // 14w2
```

- [ ] **Step 3: Run to verify they fail** — `npx -y -p node@22 node node_modules/vitest/vitest.mjs run src/features/practices`

- [ ] **Step 4: Implement**

The list stays one `DndContext` + one `SortableContext` over `flatItems`. On drag start of a header, render collapsed. On drag end, call `saveLayout(layoutOf(dropX(...)))`. While dragging a practice, outline the target group and update counts live (14a7). Header row: dots handle (`aria-label` "Drag {name}"), name (one line, truncated), count, and either a "Default" chip or a ⋯ affordance; tapping the whole row (non-default) navigates to the group route. `GroupSheet.tsx` serves both name-only create (title "New group", hint "It's added at the end, empty. Empty groups don't show on Today.", button "Create group") and edit (name field + "Delete group" danger row "Its N practices move to “Practices”." + "Save changes"). It works as `BottomSheet` or `panel`, like `PracticeSheet`. Delete reuses `ConfirmSheet`: title `Delete “{name}”?`, text "Its N practices move to the end of “Practices”. Their logged data isn't touched.", confirm "Delete group". Copy for the count line, the order hint and the empty drop zone is in 14a1/14a2 (spec quotes it). Add en/ru/uk keys under `practices.*`.

- [ ] **Step 5: Run tests** — PASS, and `npm run lint` in `app-react` is clean.

- [ ] **Step 6: Commit** — `git commit -m "feat(practices): sectioned list with group management"`

---

### Task 6: Practice editor — Group field

**Files:**
- Modify: `app-react/src/features/practices/mobile/PracticeSheet.tsx` (field after Name), its callers in `PracticesMobile.tsx` / `PracticesWide.tsx`, `usePractices.ts`, locales ×3
- Test: `practices/mobile/PracticesMobile.test.tsx`

**Interfaces:**
- Consumes: `s.groups`, `s.sections`, `moveToGroupEnd`, `layoutOf`, `s.saveLayout`, `s.createGroup`, `groupName`.
- Produces: `PracticeSheet` gains props `groups: PracticeGroup[]`, `onNewGroup: () => Promise<string | null>` (opens the name sheet, resolves to the new id). `onSave` draft gains `group_id: string | null`.

- [ ] **Step 1: Failing tests**

```ts
it('the editor shows the practice\'s group and lists groups in order with + New group') // 14a8
it('saving with a new group calls update then saveLayout with the practice last in that group')
it('a new practice defaults to Practices; picking Morning creates it with group_id m')
it('saving without changing the group makes no layout call')
```

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**

The Group field is a button showing the current group name that opens an `AnchoredMenu` (wide) or a menu list (mobile) of groups plus "+ New group". On wide layouts add the hint "Sets which section it's in on Today." On save: run `update` as today; if the group changed, `saveLayout(layoutOf(moveToGroupEnd(sections, id, groupId)))`. Create passes `group_id` (the server appends it, so it lands last in its group).

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(practices): Group field in the practice editor"`

---

### Task 7: Insights tables — group header row and Group columns setting

**Files:**
- Modify: `app-react/src/features/insights/mobile/InsightsTable.tsx`, its callers (`insights/mobile/InsightsMobile.tsx`, `insights/tablet/InsightsTablet.tsx`), `insights/settings/mobile/ChartEditorMobile.tsx:444-480` (`TableColumns`), `insights/settings/mobile/NewChartSheet.tsx:46` (new Grid gets `group_columns: true`), locales ×3
- Create: `tableColumns` in `app-react/src/features/insights/insightsLogic.ts`
- Test: `insightsLogic.test.ts`, `mobile/InsightsMobile.test.tsx`, `settings/mobile/ChartEditorMobile.test.tsx`, `settings/wide/ChartEditorWide.test.tsx`

**Interfaces:**
- Consumes: `groupPractices`, `groupName`, `practicesApi.getGroups`, `GridReport.group_columns`.
- Produces: `tableColumns(ids: string[], groups: PracticeGroup[], practices: UserPractice[], grouped: boolean): { group: PracticeGroup | null; ids: string[] }[]`. When grouped: one entry per group in group order with that group's ids in `ids` order, and empty groups omitted. When not grouped: a single `{ group: null, ids }`. `InsightsTable` gains a `grouped: boolean` prop (`report.definition.Grid.group_columns ?? true`).

- [ ] **Step 1: Failing tests**

```ts
// insightsLogic.test.ts
it('tableColumns sorts by group order, keeping report order inside a group')  // ids [A(default),B(m),C(m)] groups [m,default] → [[m,[B,C]],[default,[A]]]
it('tableColumns ungrouped keeps report order in one block')
// InsightsMobile.test.tsx
it('a grouped table has one header cell per group spanning its columns')     // colSpan matches; names in group order
it('Group columns off: no group header row, report order')                   // 14i2
// ChartEditorMobile.test.tsx
it('the Group columns toggle saves group_columns:false and keeps the practices order')
it('with grouping on, the column list is split by group')                    // 14i3
it('with grouping off, the list is flat: ticked columns in report order, then unticked') // 14i4
it('dragging a ticked column saves the new practices order')
```

- [ ] **Step 2: Run to verify they fail** — `npx -y -p node@22 node node_modules/vitest/vitest.mjs run src/features/insights`

- [ ] **Step 3: Implement**

`InsightsTable`: order `cols` by `tableColumns`. When grouped, render the top row with one `th colSpan` per group (truncated name, a left divider where each group starts). When not grouped, omit the top row entirely. `TableColumns`: add a `Toggle` titled "Group columns" with hint "Columns follow your practice groups, with each group's name above its columns." when on, and "Columns follow the order below. No group row." when off, placed above the list. The list is dnd-kit sortable. Ticked practices appear first in `Grid.practices` order (inside each group when grouped), then unticked ones. Drag only moves ticked rows, and only within their group when grouped. Ticking appends to the end of `practices`. Every save sends `{ Grid: { practices, group_columns } }`. Footer hint: "Group order comes from Practices settings. Drag to reorder inside a group." when on, and "Drag by the dots to set the column order." when off. `ChartEditorWide` reuses `TableColumns`, so it gets this for free; cover it with one test.

- [ ] **Step 4: Run tests** — PASS; then the full suite `npx -y -p node@22 node node_modules/vitest/vitest.mjs run` and `make lint`.

- [ ] **Step 5: Commit** — `git commit -m "feat(insights): group header row and Group columns setting for tables"`

---

### Task 8: Local hand-off — migrated dev DB and a running build

The user tests on their local server. `.env` and the Makefile both point at the LAN dev Postgres (`192.168.68.102:5432/sadhana_pro`). `RUN_DB_MIGRATIONS` isn't set there, so migrations must be applied by hand.

- [ ] **Step 1: Confirm both migrations are applied to the dev DB**

Run: `DATABASE_URL=postgres://postgres:postgres@192.168.68.102:5432/sadhana_pro diesel migration list --migration-dir=migrations`
Expected: `[X]` next to `2026-10-28-000000-0000_practice_groups` and `2026-10-28-000001-0000_report_group_columns`. If either shows `[ ]`, run `make migrate` and re-check.

- [ ] **Step 2: Rebuild and restart the local server**

Stop any running local server (it serves localhost:8080), then run `make run` on the host (builds `app-react` into `dist/`, then starts the server).
Expected: the server starts without errors, and `curl -s -o /dev/null -w '%{http_code}' localhost:8080/api/user/practice-groups` returns `401` (route exists, auth required).

- [ ] **Step 3: Tell the user it's ready** — URL `http://localhost:8080`, with the migrations listed as applied.
