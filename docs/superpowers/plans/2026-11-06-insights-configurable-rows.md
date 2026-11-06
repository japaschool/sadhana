# Insights configurable overview rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single Total time row with one total per named practice group, let users show/hide each overview row from Settings, and store all Insights prefs per user in Postgres.

**Architecture:**
- **Server:** one new resource, `insight_prefs` (one opaque `jsonb` blob per user), in the layered `marked_periods` style.
- **Client:** `useInsightPrefs` keeps its `[prefs, setPrefs]` shape but is backed by a React Query query plus an optimistic mutation. It gains a third `ready` element and migrates the old `localStorage` key once.
- **Rows:** `insightRows` becomes group-aware and filters by a `visibility` override map. A new `/settings/overview-rows` subpage edits that map.

**Tech Stack:** Rust (actix-web 4, Diesel 2 + `serde_json`, Postgres tests), React + TypeScript, React Query (persisted), Vitest, i18next (en/ru/uk).

**Spec:** `docs/superpowers/specs/2026-11-06-insights-configurable-rows-design.md`

## Global Constraints

- Older cached clients must not break: no existing route or response shape changes. They keep using `localStorage['sadhana.insights']`.
- Row rules:
  - Named group with 2+ active Duration practices → one total row (members hidden by default).
  - Named group with exactly 1 → the practice itself, shown.
  - Default group (`groupPractices` section with `group.is_default`) → never totalled, all shown.
  - Int/Time → shown by default.
  - Sleep is unchanged and has no toggle. The global Total time row is removed.
- A group total sums **all** that group's active Duration practices, hidden or not, using the existing `count()` zero-fill.
- Visibility stores overrides only: `visibility: Record<rowKey, boolean>`. Row keys are the practice id, or `total:<groupId>`.
- Row order: the group order from `GET /user/practice-groups` (via `groupPractices`), practices in practices-query order within a group, the total right after its group's practices, Sleep last.
- Total label: en `"{{group}} · total"` (ru `"{{group}} · всего"`, uk `"{{group}} · усього"`), with the `CalculatedTag`.
- Until the prefs query has data, read `localStorage['sadhana.insights']` (else `DEFAULT_PREFS`). Keep that key until the migration PUT succeeds. Don't show first-run prompts or suggestions until ready.
- Server stores `prefs` opaquely: it rejects non-objects with 422. The body cap is actix's default JSON limit (32 KiB).
- Every new string in en, ru and uk; `locales.test.ts` passes.
- Vitest on this Mac: `cd app-react && npx -y -p node@22 node node_modules/vitest/vitest.mjs run <file>`.
- DB tests: run in the dev container, `docker exec <container> bash -lc 'cd /workspaces/sadhana-pro && make test T=insight_prefs'`.

## Review Focus

1. **Practice in a group the client doesn't know** (made on another device, groups not loaded yet): `groupPractices` puts it in the default section, so it shows individually and isn't totalled. It must not vanish. → Task 3 test `unknown_group_falls_back_to_default_section`.
2. **Server returns `prefs: null` and the migration PUT fails** (offline first launch): the local key must survive and still be read. → Task 2 test `failed_migration_keeps_local_key_and_reads_it`.
3. **A visibility override for a row that no longer exists** (deleted practice, a group that dropped to 1 Duration): it's ignored. The ex-member then shows by its new default (shown), unless an explicit `false` override exists. → Task 3 test `stale_overrides_are_ignored`.
4. **Group with 2 Duration practices where one is inactive:** counts as 1, so no total and the active one shows. → Task 3 test `inactive_duration_does_not_count_toward_total`.
5. **Save fails** (offline / 500): the toggle reverts and a `common.error` toast shows. → Task 2 test `failed_save_rolls_back`.

---

### Task 1: Server `insight_prefs` resource

**Files:**
- Create: `migrations/2026-11-06-000000-0000_insight_prefs/up.sql`, `down.sql`
- Modify: `server/src/schema.rs` (via `make gen_schema` only)
- Create: `server/src/app/insight_prefs/{mod.rs,dto.rs,service.rs,handlers.rs}`
- Modify: `server/src/app/mod.rs` (add `pub mod insight_prefs;`), `server/src/routes.rs` (inside the `/user` scope, next to `/practice-groups`)

**Interfaces:**
- Produces:
  - `GET /api/user/insight-prefs` → `200 {"prefs": <object> | null}`
  - `PUT /api/user/insight-prefs` with body `{"prefs": <object>}` → `200 null`, or `422` if `prefs` isn't an object
  - `service::get(conn: &mut PgConnection, user_id: &Uuid) -> Result<Option<serde_json::Value>, AppError>`
  - `service::save(conn: &mut PgConnection, user_id: &Uuid, prefs: &serde_json::Value) -> Result<(), AppError>`
  - `dto::PrefsBody { prefs: serde_json::Value }` (Deserialize), `dto::PrefsResponse { prefs: Option<serde_json::Value> }` (Serialize)

- [ ] **Step 1: Write the migration.** `up.sql` is exactly the spec's `CREATE TABLE insight_prefs …` + `SELECT diesel_manage_updated_at('insight_prefs');`. `down.sql` is `DROP TABLE insight_prefs;`. Run `make migrate` then `make gen_schema` (in the dev container if the host has no DB). Expected: `schema.rs` gains `insight_prefs (user_id)` with `prefs -> Jsonb` and the `joinable!` / `allow_tables_to_appear_in_same_query!` entries.

- [ ] **Step 2: Write failing service tests** in `service.rs` `mod tests`. Copy `new_user` / `run` / `unprocessable` from `marked_periods/service.rs` tests.

```rust
#[test] fn get_without_saved_prefs_is_none() { run(|c| { let u = new_user(c); assert_eq!(get(c, &u)?, None); Ok(()) }) }
#[test] fn save_upserts_whole_object() { run(|c| {
    let u = new_user(c);
    save(c, &u, &json!({"streaks": true}))?;
    save(c, &u, &json!({"suggest": false}))?;
    assert_eq!(get(c, &u)?, Some(json!({"suggest": false})));
    Ok(()) }) }
#[test] fn save_rejects_non_object() { run(|c| {
    let u = new_user(c);
    for bad in [json!(null), json!([1]), json!("x"), json!(3)] { unprocessable(save(c, &u, &bad)); }
    Ok(()) }) }
#[test] fn prefs_are_per_user() { run(|c| {
    let (a, b) = (new_user(c), new_user(c));
    save(c, &a, &json!({"streaks": true}))?;
    assert_eq!(get(c, &b)?, None);
    Ok(()) }) }
```

- [ ] **Step 3: Run** `make test T=insight_prefs`. Expected: compile failure / FAIL.

- [ ] **Step 4: Implement `get` and `save`.** `save` returns `AppError::UnprocessableEntity(vec!["prefs must be an object".into()])` unless `prefs.is_object()`. It upserts with `insert_into(insight_prefs::table).values(...).on_conflict(insight_prefs::user_id).do_update().set(insight_prefs::prefs.eq(prefs))`. Handlers follow `marked_periods/handlers.rs` (`get_prefs`, `save_prefs`; user from `auth::get_current_user`, DB work in `web::block`). Routes go in the `/user` scope: `.service(web::scope("/insight-prefs").route("", web::get().to(app::insight_prefs::get_prefs)).route("", web::put().to(app::insight_prefs::save_prefs)))`.

- [ ] **Step 5: Run** `make test T=insight_prefs`, then `make lint`. Expected: 4 passed, clippy clean.

- [ ] **Step 6: Commit** `feat(insights): store insight prefs per user`.

---

### Task 2: Prefs backed by the server

**Files:**
- Create: `app-react/src/api/insightPrefs.ts`
- Modify: `app-react/src/features/insights/overview/prefs.ts`, `prefs.test.tsx`
- Modify: `app-react/src/api/persister.ts` (add `'insight-prefs'` to `SAVED`)
- Modify: `app-react/src/features/insights/overview/useInsightRows.ts` (return `prefsReady`), `useOverview.ts`, `app-react/src/features/settings/MarkedPeriods.tsx` (gate on ready)
- Modify tests that seed `localStorage['sadhana.insights']`: `useOverview.test.tsx`, `SettingsLists.test.tsx`, `MarkedPeriods.test.tsx`

**Interfaces:**
- Consumes: Task 1 endpoints.
- Produces:
  - `insightPrefsApi.get(): Promise<unknown | null>`: returns `res.data?.prefs ?? null`, so a test mock that answers every GET with something else reads as "never saved".
  - `insightPrefsApi.save(prefs: InsightPrefs): Promise<void>`
  - `INSIGHT_PREFS_KEY = ['insight-prefs'] as const`
  - `InsightPrefs` gains `visibility: Record<string, boolean>` (default `{}`)
  - `parsePrefs(v: unknown): InsightPrefs`: the current `parse` body, taking a value instead of a raw string, plus `visibility` (keep only boolean entries)
  - `useInsightPrefs(): [InsightPrefs, (patch: Partial<InsightPrefs>) => void, boolean]`, where the third element is `ready = query.data !== undefined`
  - `useInsightRows(...)` additionally returns `prefsReady: boolean`

- [ ] **Step 1: Rewrite `prefs.test.tsx`.**
  - Mock `../../../api/insightPrefs` (`insightPrefsApi: { get: vi.fn(), save: vi.fn() }`) and the `useToast` hook (same import path as `features/insights/mobile/MoreMenu.tsx`), so `showToast` is a spy.
  - Render hooks inside a fresh `QueryClientProvider` with `retry: false`.
  - Tests:
    - `server_prefs_win_and_local_key_is_removed`: local `{streaks:true}`, server `{suggest:false}` → prefs `{...DEFAULTS, suggest:false}`, `ready` true, local key gone, `save` not called.
    - `null_server_migrates_local_once`: local `{streaks:true}`, server `null` → `save` called once with `{...DEFAULTS, streaks:true}`, local key gone, prefs streaks true.
    - `null_server_without_local_gives_defaults_without_saving`.
    - `failed_migration_keeps_local_key_and_reads_it`: server `null`, `save` rejects → local key still present, prefs streaks true (from local), `ready` false.
    - `pending_reads_local_and_is_not_ready`: `get` never resolves → prefs from local, `ready` false.
    - `set_prefs_is_optimistic_and_saves_merged`: after ready, `setPrefs({streaks:true})` → value updates at once, `save` called with the full merged object.
    - `failed_save_rolls_back`: `save` rejects → value reverts, `showToast` called with `variant: 'error'`.
    - `shares_state_between_hooks` (kept).
    - `bad_values_fall_back`: server `{streaks:true, dismissed:5, visibility:{a:true,b:'x'}}` → `{...DEFAULTS, streaks:true, visibility:{a:true}}`.
  - `DEFAULTS` gains `visibility: {}`.

- [ ] **Step 2: Run** `npx -y -p node@22 node node_modules/vitest/vitest.mjs run src/features/insights/overview/prefs.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement** `api/insightPrefs.ts` and the new `prefs.ts`:
  - The query `queryFn` does the migration:
    1. `server = await get()`.
    2. If `server === null`: `local = readLocal()`. If there is one, `await save(local)` (a throw fails the query and keeps the key).
    3. `removeLocal()`.
    4. Return `server === null ? (local ?? DEFAULT_PREFS) : parsePrefs(server)`.
  - `readLocal()` / `removeLocal()` wrap `localStorage` in try/catch (blocked storage → `null` / no-op).
  - `setPrefs` is a `useMutation`:
    - `onMutate` cancels the query, snapshots the previous value, writes `{...current, ...patch}` to the cache and returns the snapshot. `current` is cache data, else `readLocal() ?? DEFAULT_PREFS`.
    - `mutationFn` saves that merged object.
    - `onError` restores the snapshot and calls `showToast({ message: t('common.error'), variant: 'error' })` from `useToast()`.
  - Delete the `useSyncExternalStore` store.

- [ ] **Step 4: Run** the prefs tests. Expected: PASS.

- [ ] **Step 5: Gate on ready.**
  - In `useOverview.ts`: `askSleep`, `suggestion` and `openPeriod` also require `prefsReady`.
  - In `MarkedPeriods.tsx`: `openPeriod` is `null` until `ready`.
  - Update the three listed test files to mock `insightPrefsApi.get` (resolving to the prefs they used to seed in `localStorage`) instead of seeding the key. `MarkedPeriods.test.tsx:125` asserts on `insightPrefsApi.save` being called with `openAsked: { p1: TODAY }`.
  - Add to `useOverview.test.tsx`: `no_sleep_prompt_until_prefs_ready` (`get` never resolves, two Time practices, no sleep → `askSleep` false).

- [ ] **Step 6: Run** the full suite `npx -y -p node@22 node node_modules/vitest/vitest.mjs run` and `npm run lint`. Expected: all pass.

- [ ] **Step 7: Commit** `feat(insights): keep insight prefs on the server`.

---

### Task 3: Group totals and visibility in rows

**Files:**
- Modify: `app-react/src/features/insights/overview/series.ts`, `series.test.ts`
- Modify: `app-react/src/features/insights/overview/useInsightRows.ts` (load groups with `useQuery({ queryKey: ['practice-groups'], queryFn: practicesApi.getGroups })`, include in `isLoading`/`isError` like practices)
- Modify: `app-react/src/features/insights/overview/format.ts` (`rowName`), `MeVsNormal.tsx:26` (tag when `row.special !== null`)
- Modify: `app-react/public/locales/{en,ru,uk}/translation.json` (`insights.overview.groupTotal`; delete `totalTime` if nothing else uses it)
- Modify: any test that mocks `practicesApi` without `getGroups` (e.g. `useOverview.test.tsx:11`)

**Interfaces:**
- Consumes: `InsightPrefs.visibility` (Task 2), `groupPractices` from `features/practices/groups.ts`.
- Produces:
  - `InsightRow` gains optional `members?: string[]` (the total's Duration practice ids) and `groupName?: string`. `fingerprint.ts` is untouched.
  - `export interface OverviewRow extends InsightRow { group: PracticeGroup; defaultVisible: boolean }`. For Sleep, `group` is the default section's group.
  - `export function overviewRows(practices: UserPractice[], groups: PracticeGroup[], sleep: SleepRows | null): OverviewRow[]`: every candidate row in display order.
  - `export function insightRows(practices: UserPractice[], groups: PracticeGroup[], sleep: SleepRows | null, visibility: Record<string, boolean>): InsightRow[]` = `overviewRows(...)` filtered by `visibility[r.key] ?? r.defaultVisible`. Sleep is always kept.
  - `rowSeries` computes `special === 'total'` from `row.members` instead of all Duration practices.
  - `rowName`: `special === 'total'` → `t('insights.overview.groupTotal', { group: row.groupName })`.

- [ ] **Step 1: Write failing tests** in `series.test.ts`, with groups `A` (named), `B` (named) and the default (`id: null, is_default: true`):
  - `two_durations_in_named_group_make_a_hidden_member_total`: A has d1, d2 → rows contain `total:A` (members `[d1,d2]`, `groupName` 'A', defaultVisible true) and d1/d2 with defaultVisible false. `insightRows(..., {})` has `total:A`, not d1/d2.
  - `single_duration_in_named_group_shows_itself`: B has d3 only → d3 is defaultVisible true and there's no `total:B`.
  - `default_group_never_totals`: default has d4, d5 → both defaultVisible true, no total row.
  - `inactive_duration_does_not_count_toward_total`: A has d1 active, d2 inactive → no total, d1 shown.
  - `unknown_group_falls_back_to_default_section`: d6 with `group_id: 'gone'` plus d7 in default → both shown, no total.
  - `order_follows_groups_then_total_then_sleep`: groups `[B, default, A]` → B's rows, default's rows, A's practices, `total:A`, `sleep`.
  - `overrides_win_over_defaults`: `{ d1: true, 'total:A': false, t1: false }` → d1 present, `total:A` and t1 absent.
  - `stale_overrides_are_ignored`: `{ gone: true }` → same rows as `{}`.
  - `bool_and_text_are_not_rows`.
  - `rowSeries` → `group_total_sums_only_its_members_including_hidden`: A total = d1+d2 per day with the existing zero-fill. A Duration practice in B isn't included.

- [ ] **Step 2: Run** `… vitest.mjs run src/features/insights/overview/series.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `overviewRows` walks `groupPractices(groups, practices.filter(p => p.is_active))`.
  - Per section it emits Time/Int/Duration rows in order (Duration kind `'Duration'`, `practice: p.id`). Then, if the section isn't default and has ≥2 Durations, it emits `{ key: 'total:'+group.id, kind: 'Duration', practice: null, special: 'total', members, groupName: group.name, group, defaultVisible: true }` and marks those Duration rows `defaultVisible: false`.
  - Sleep goes last.
  - Then wire up `useInsightRows`, `rowName`, `MeVsNormal`, and the locale strings.

- [ ] **Step 4: Run** the full suite and `npm run lint`. Expected: PASS. Fix any snapshot or order expectation that assumed the old `total` key, using the new rule.

- [ ] **Step 5: Commit** `feat(insights): one total per practice group, hideable rows`.

---

### Task 4: "Overview rows" settings subpage

**Files:**
- Create: `app-react/src/features/settings/OverviewRows.tsx`, `OverviewRows.test.tsx`
- Modify: `app-react/src/features/settings/SettingsLists.tsx` (a `SettingsRow` in `InsightsPrefsRows`, before Marked periods: `label={t('insights.rows.title')} to="/settings/overview-rows"`)
- Modify: `app-react/src/router.tsx` (lazy import like `MarkedPeriods`; `{ path: '/settings/overview-rows', element: ui(<OverviewRows />) }`)
- Modify: `app-react/public/locales/{en,ru,uk}/translation.json`: `insights.rows.title` ("Overview rows" / "Строки обзора" / "Рядки огляду") and `insights.rows.intro` ("Choose what the Insights overview shows. Totals add up every time practice in their group, shown or not." with ru/uk translations)

**Interfaces:**
- Consumes:
  - `overviewRows`, `OverviewRow` (Task 3)
  - `useInsightPrefs` (Task 2)
  - `rowName` (Task 3)
  - `groupName(g, t)` from `features/practices/groups.ts`
  - `SettingsSubpage`, `ROWS` from `./SettingsSubpage`
  - `SettingsRow` from `./mobile/SettingsRow`
  - `Toggle` from `../../ui/primitives/Toggle`
- Produces: `export function OverviewRows(): JSX.Element`.

- [ ] **Step 1: Write failing tests** (pattern from `MarkedPeriods.test.tsx`: mock `apiClient` or `practicesApi` + `insightPrefsApi`, wrap in `QueryClientProvider` + `MemoryRouter`):
  - `lists_groups_with_total_first_and_toggles_reflect_defaults`: group "Morning" has d1, d2 and the default group has t1 → a "Morning" section whose first toggle is "Morning · total" (checked), then d1 and d2 (unchecked). A "Default" section has t1 (checked). Sleep isn't listed.
  - `toggling_writes_an_override`: clicking d1 → `insightPrefsApi.save` called with `visibility: { d1: true }`.
  - `inactive_practices_are_not_listed`.

- [ ] **Step 2: Run** `… vitest.mjs run src/features/settings/OverviewRows.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement `OverviewRows`.**
  - `overviewRows(practices, groups, null)` grouped by `row.group.id` in order. Pass `null` for sleep so Sleep never appears.
  - One `<section>` per group with an `<h2>` of `groupName(group, t)` and a `ROWS` list.
  - Each row is a `SettingsRow` labelled `rowName(row, practices, t)` with `control={<Toggle label={…} checked={prefs.visibility[row.key] ?? row.defaultVisible} onChange={(on) => setPrefs({ visibility: { ...prefs.visibility, [row.key]: on } })} />}`.
  - Show `UiLoading` while practices or groups load.
  - Intro paragraph styled like `MarkedPeriods`.

- [ ] **Step 4: Run** the full suite, `npm run lint` and `npm run build`. Expected: PASS.

- [ ] **Step 5: Check in the app.** Run the host server and open Settings → Insights → Overview rows at `localhost:8080`. Toggle a member on and confirm it appears on the overview; reload and confirm it persists. Check mobile and desktop widths.

- [ ] **Step 6: Commit** `feat(insights): choose overview rows in settings`.
