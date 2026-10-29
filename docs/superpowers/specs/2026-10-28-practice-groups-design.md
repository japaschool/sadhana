# Practice groups — design

Mockups (claude.ai/design project "Sadhana Redesign"):
- Today: `Groups Today.dc.html` (14l1–14l6)
- Practices settings: `Groups Settings.dc.html` — **option A, "One sectioned list"** (14a1–14a10, wide 14w1–14w7, tablet 14x1–14x6). Options B and C are rejected.
- Insights tables: `Groups Insights.dc.html` (14i1–14i13)

## Intent

The Log (Today) screen shows every practice under one hardcoded "Practices" label. Users want to split it into named sections (e.g. Morning / Hearing & study / Evening) in an order they choose. That same grouping should structure the Insights table header, where today a single "Practices" label spans every column.

## Goals

- Users create, rename, delete and reorder groups, and move practices between them.
- Each practice is in exactly one group. Practices keep a user-defined order inside their group.
- Today (mobile, tablet, desktop) shows one list group per group, in group order.
- Insights table reports show one header cell per group. A per-report **Group columns** toggle (on by default) turns grouping off, and then column order is fully user-defined.
- **Backward compatible.** After deploy, any older cached React build (installed PWAs, open tabs) keeps working against the new server until it's refreshed, and its writes must never wipe group data. The Yew UI is no longer deployed, so it isn't a concern.

## Non-goals

- Groups on charts (Graph reports), shared reports, yatras, CSV import/export. Imported or seeded practices land in the default group.
- Collapsible groups, group colours or icons.

## Anti-goals (failures even if it "works")

- An old client editing a practice or a report silently resets its group, the report's Group columns setting, or its custom column order.
- An existing user opens the new version and their Today screen looks different before they create a group.
- Deleting a group loses or hides practices or their data.

## Behaviour

### The default group
- Every user has a default group, shown as "Practices" (translated: en/ru/uk). It **can't be renamed or deleted**, but it **can be moved** among the other groups.
- It's the catch-all. Practices with no group are in it: everything existing at deploy, anything created by the old UI or an old build, seeded starters, CSV imports, and practices from a deleted group. A new practice goes into it unless the editor picks another group.
- A user who has never created a group sees exactly what they see today (14l2).

### Today (14l1–14l6)
- One `ListGroup` per group, labelled with the group name (mono uppercase, one line, truncated with "…"), in group order. Practices sit inside in their order.
- A group with no visible practices isn't drawn. That includes an empty group and one whose practices are all hidden.
- Tablet: groups flow down two columns and never split across them (14l4). Desktop: the log panel stacks groups (14l5).
- The loading skeleton keeps the single "Practices" group.

### Practices settings — option A
- One sectioned list mirroring Today. Each group has a header row: dots handle, name, count, and a ⋯ / tap target. The default group shows a **Default** chip and no ⋯, and its header isn't tappable, but its dots still drag (14a6).
- **+ Group** (next to + Add) opens a name sheet (max 64 chars, 14a3). The group is created at the end, empty.
- **Tap a header** opens a group sheet with rename and **Delete group…** (14a4). The confirm says "Its N practices move to the end of 'Practices'. Their logged data isn't touched." (14a5). Practices move to the end of the default group in their current order.
- **Drag a group by its dots:** the list collapses to headers while dragging (14a6).
- **Drag a practice by its dots** within or across groups. The target group is outlined and counts update live (14a7, 14a9).
- **Empty group:** a drop zone reading "No practices yet. Drag one here, or pick this group in a practice. Not shown on Today while empty." (14a2)
- **Practice editor** gets a **Group** field (a picker listing groups in order, with "+ New group", 14a8). On wide layouts it has the hint "Sets which section it's in on Today." (14w1). The new-practice form gets the same field, defaulting to "Practices". Changing the group puts the practice at the end of its new group. *(builder's call, confirm against the mock)*
- Header copy: "N practices in M groups · K hidden from Today". With only the default group: "N practices · …" plus the hint "Add a group to split Today into sections." (14a1)
- Wide (14w*) and tablet (14x*): the same list on the left. Selecting a group header opens rename/delete in the detail pane (14w2, 14x5), and delete uses a dialog on tablet (14x4).
- Long names: one line with truncation in headers. Sheets and panes show the full name and wrap it (14a10, 14w7).
- Group names are unique per user, and the server answers 422 on a duplicate, matching how practices behave. *(my call)*

### Insights tables (14i1–14i13)
- **Group columns on** (default): columns are sorted by group order. Inside a group they keep the report's column order. The top header row has one cell per group, spanning its columns, with a divider where each group starts. Narrow groups truncate their name (14i5).
- **Group columns off:** columns follow the report's column order exactly, with no group header row (14i2).
- **Table editor:** the Group columns toggle sits right above the column list. When on, the list is split by group and dragging only reorders within a group. When off, it's one flat list ordered freely (14i3, 14i4, 14i9–14i12).
- Every layout that renders the table or its editor (mobile, tablet, desktop) gets this.

## Data and API

### Today's state (relevant facts)
- `user_practices.order_key` is a global per-user order. `PUT` on a practice deserializes a whole `UserPractice` and overwrites name/active/required/dropdown. Reorder sends the whole id list.
- A table report is `ReportDefinition::Grid(GridReport { practices: HashSet<Uuid> })`, stored as `report_traces` rows with no order column. **The column order isn't stored at all today**, so "user-defined order" needs new storage.
- The React UI doesn't reject unknown JSON fields, so adding response fields is safe.

### Decided
- New table `practice_groups (id, user_id, name, order_key, is_default bool, created_at, updated_at)`, plus `user_practices.group_id uuid NULL REFERENCES practice_groups ON DELETE SET NULL`. **`group_id IS NULL` means the default group.** That's what keeps old clients correct: whatever they create lands in the default group.
- The default group's position must be stored so it can be moved. Use a row with `is_default = true` (at most one per user, with a partial unique index), whose name is ignored and shown translated. Practices never point at it; they keep `NULL`. Create it lazily when a user first needs it, e.g. on the first group create or reorder. No row means the default group is the only group.
- Inside a group, practices are ordered by the existing global `order_key`. When the new UI reorders, it writes the global order flattened in group order, so the old UI's flat list still reads sensibly.
- **Old-client safety** (old = a cached React build from before this change):
  - Practice update: `group_id` is optional on input, and **absent means unchanged**. The existing update keeps not touching it. Group changes go through a path old clients never call: a new field that's only written when present, or a dedicated endpoint.
  - Practice create without `group_id` lands in the default group.
  - The old reorder endpoint (ids only) keeps working and doesn't touch groups.
  - New report setting `reports.group_columns bool NOT NULL DEFAULT true`. A report update that doesn't carry it leaves the stored value alone.
  - Table column order: add an order column to `report_traces`. `Grid.practices` stays a JSON array of ids, so switching the server from `HashSet` to `Vec` is wire-compatible. Old builds send columns in practice order, not the user's custom order, so **a Grid save without `group_columns` keeps the stored order** for columns still in the report and appends new ones at the end. *(my call)*
- `GET` practices includes `group_id`. A new endpoint lists groups (default included, with its position). The React Query persisted cache must cope with practices that have no `group_id` field (treat as default).

### Left to the builder
- Endpoint shapes and names. Follow the newer `yatras` layered layout (`handlers.rs` → `service.rs` → `domain/` + `dto.rs`) for a new `practice_groups` module.
- Whether a cross-group drag is one atomic "layout" call (group ids + per-practice group) or a group change followed by a reorder. Prefer one transaction if it's simple.
- Where `group_columns` lives in `ReportDefinition` (e.g. an optional field on `Grid`), as long as old builds' payloads still parse.
- The drag-and-drop implementation (the Practices screen already uses dnd-kit + framer-motion).
- Offline: group edits are online-only like other settings, and the outbox only handles diary PUTs.

## Constraints
- All strings in en/ru/uk. Local dates rules unchanged.
- `make lint` is clean and tests pass (server tests hit a real Postgres).
- Don't hand-edit `schema.rs`. Regenerate it with `make gen_schema` after the migration.
- Migrations are embedded and run on startup. The migration must be additive only, since old cached builds keep talking to the new server.
