# Insights overview: configurable rows, group totals, prefs in the DB

## Why

The Insights overview has one "Total time" row that adds up every active Duration practice. That works for the author's own practice, but other users want to see each practice on its own, or want totals that match how they think about their practice. Practice groups (2026-10-28 spec) already say which practices belong together, so totals follow the groups. Insights prefs live in `localStorage` today, so they're lost on a new device. They move to the server.

## Goals

1. Replace the single Total time row with **one total per named practice group** that has 2+ active Duration practices.
2. Let the user **show/hide each row** (Int, Time, Duration practice, group total) from Settings.
3. Store **all Insights prefs** (the new visibility plus the existing streaks, suggest, sleep pair, dismissed suggestions, openAsked) **per user in Postgres**.

## Non-goals

- User-defined totals (picking arbitrary practices to add up). Groups are the only grouping.
- Reordering rows independently of the diary layout.
- Moving any non-Insights setting (language, release channel) to the DB.

## Anti-goals

- A practice silently disappearing with no way to get it back from Settings.
- Breaking older cached builds: they keep using their own `localStorage` prefs and must not error on the new endpoint's existence.

## Row rules (decided by the user)

The rows are computed in `insightRows` (`app-react/src/features/insights/overview/series.ts`):

- **Named group with 2+ active Duration practices:** one calculated total row, labelled from the group name. Its Duration practices are **hidden by default**, and each can be switched on.
- **Named group with exactly 1 active Duration practice:** no total; the practice is shown as itself, **visible by default**.
- **Default group** (`group_id == null`, the group whose `id` is `null` in `GET /user/practice-groups`): never totalled. All of its practices show individually, **visible by default**.
- **Int and Time practices** in any group: visible by default, can be hidden.
- The global `special: 'total'` row is removed. This applies to everyone: a user with no named groups gets one row per Duration practice and no total. That's intended (the user asked for the default group to show practices as they are), so there's no fallback total and no migration default.
- **Sleep** keeps its current behaviour (the sleep-pair choice incl. `'skip'`). It doesn't get a separate visibility toggle.

A group total is computed the same way as today's total (sum of the group's Duration practices per day, using the existing `count()` zero-fill rule), restricted to that group's active Duration practices. It sums **all** of them, hidden or not: hiding a practice row doesn't remove it from its group's total.

## Visibility model

Store **overrides only**: `visibility: Record<rowKey, boolean>`. With no entry, a row gets its default from the rules above. So a newly added practice, or one moved between groups, automatically gets the right default.

- Row keys: practice rows use the practice id; group totals use `total:<groupId>`.
- `insightRows` takes the groups and the visibility map and returns only the visible rows. A second helper (or a flag on each row) gives the full list with defaults for the Settings screen.
- **Every consumer follows the visible set:** Me vs my normal, Rhythm, Less regular, Year map, Period detail, and anything else that goes through `useInsightRows`.
- `fingerprint.ts` (period fingerprints: Int + each Duration practice) is unchanged. It's an internal comparison, not a displayed row. *(My call.)*

## Settings UI

Settings → Insights (`app-react/src/features/settings/SettingsLists.tsx`, the section with streaks/suggest/sleep) gets a new row, e.g. **"Overview rows"**, leading to a subpage (`SettingsSubpage`, like Marked periods at `/settings/periods`). On that subpage:

- Sections per practice group in the real diary layout order (`GET /user/practice-groups` order; the default group can be moved), each listing its active Int/Time/Duration practices with a `Toggle`.
- In a group that has a total, the total is listed first in that section, with its own toggle.
- Inactive practices aren't listed.
- Same on every layout (wrap in `ui()`), styled like the existing Settings subpages. No mockup exists; derive from the Settings/Today design language per CLAUDE.md.

## Labels and ordering

- Total label: the group name plus a localized suffix, e.g. en `"{{group}} · total"`, with ru/uk equivalents. It keeps the existing calculated tag treatment used for Sleep (`CalculatedTag` in `MeVsNormal.tsx`). *(Exact wording is my call; the builder may adjust.)*
- Row order follows the diary layout (group order from `GET /user/practice-groups`, then practices query order within a group): a group's rows appear together, with its total right after that group's practices. Sleep comes last, after all group rows. *(My call.)*

## Server: prefs storage

New table, newer layered module style (`server/src/app/insight_prefs/{handlers,service,dto}.rs`, following `practice_groups`):

```sql
CREATE TABLE insight_prefs (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prefs jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT diesel_manage_updated_at('insight_prefs');
```

- `GET /api/user/insight-prefs` → `{ "prefs": <object> | null }` (`null` when the user has never saved).
- `PUT /api/user/insight-prefs` with body `{ "prefs": <object> }` → upsert the whole object.
- The server treats `prefs` as an opaque JSON object: it rejects anything that isn't an object, and bodies over a small cap (e.g. 64 KiB). The client does the field-level validation it already does in `prefs.ts` `parse()`. *(My call: the shape is purely a UI concern, and opaque storage avoids a server change for every new pref.)*
- Auth via the existing middleware; the user comes from request extensions.
- Regenerate `schema.rs` with `make gen_schema`; add DB tests in the existing style.

## Client: prefs store

`prefs.ts` (`useInsightPrefs`) keeps its signature `[prefs, setPrefs(patch)]`, so call sites don't change. Under the hood:

- A React Query query `['insightPrefs']` (persisted like other queries, `gcTime: Infinity`) loads from the server and runs the result through the existing `parse()`, extended with `visibility`.
- `setPrefs` updates the query cache optimistically and PUTs the merged object. On failure it rolls back and shows the app's usual error feedback. Saving while offline therefore fails visibly rather than queueing (the service-worker outbox only handles diary PUTs). *(My call.)*
- **One-time migration:** when the server returns `prefs: null` and `localStorage['sadhana.insights']` exists, PUT the parsed local prefs and then remove the local key. If the server has prefs, they win and the local key is removed.
- **Until the server has answered successfully** (pending, or failed with nothing cached, e.g. the first launch of the new build while offline), read prefs from `localStorage['sadhana.insights']` if present, else `DEFAULT_PREFS`. Keep the local key until the migration PUT succeeds. Don't trigger first-run prompts (the sleep setup sheet, the open-period ask) in that state, so a user isn't re-asked or asked something they can't save. *(My call.)*

## Backward compatibility

Older cached React builds never call the new endpoint and keep using `localStorage`. Once a new build migrates and removes the key, an old tab that's still open falls back to defaults until it refreshes. That's acceptable. No existing endpoint changes.

## Tests

- `series.test.ts`: group totals (2+ durations → total, 1 → the practice itself, default group → never), default visibility, overrides, inactive practices, the total including hidden members.
- `prefs.test.tsx`: parse with `visibility`, migration from localStorage (server null / server has prefs), optimistic update and rollback.
- Settings subpage: toggles render per group and write overrides.
- Server: GET when nothing is saved, PUT upsert, non-object rejected, other users isolated.
- en/ru/uk strings (`locales.test.ts` covers key parity).

## Left to the builder

Component structure, exact i18n keys, the visual detail of the subpage, how the visible/all row lists are exposed from `useInsightRows`, and the size-cap value.
