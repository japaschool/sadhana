# Share links: choose what you share, with whom, and take it back

## Why

Today there's one public link per user, `/shared/<user-id>`. It shows every graph and table plus the level 1–2
templated reports, and it can't be turned off. It's also leakier than it looks: the shared page loads **all
diary data for all practices and all time** (`GET /api/share/{user_id}?duration=AllData`) and filters in the
browser, and `GET /api/share/{user_id}/user` returns the owner's **email**.

A user shares with specific people: a mentor (they may have several), a friend. Each person should see a
hand-picked set of charts. A friend gets Sleep and Japa but never Celibacy. Sometimes a table. Sharing must stay
"send a link, it opens with no sign-in", and you must be able to withdraw any link.

## Goals

- Many **share links** per user. Each has a private name ("who it's for"), a set of chosen reports (old-style
  Graph and Grid/table, and templated Panels reports of **any** level), and an optional **opens-on date**.
- Opening a link needs no sign-in, same as now.
- **Opens-on date:** if set, the page starts with that end date. If not, it starts on today. Either way the
  viewer can move the range and date freely. It is not a cut-off.
- **Withdraw** deletes the link. Its URL stops working for good, looking the same as an unknown link.
- **The server sends only what the link's reports need.** Diary entries and practices are limited to the practices used by the link's reports, evaluated **at request time** from
  the reports' current definitions. If the owner edits a shared report later, the link follows the edit. The
  user explicitly accepted this.
- **No CSV download** on the page a share link opens. CSV export is for the owner only and gets its own revamp
  later.
- **Old links keep working** exactly as today (full data, CSV button included) until the owner switches them
  off. There's a per-user switch, "Old public link", in Settings → Sharing.
- The public user endpoint stops returning email, for old and new links alike.

## Non-goals

- Sharing the Insights **Overview** (rhythm, me-vs-normal, streaks, year map). Left out for now.
- CSV revamp.
- Expiring links, passwords, viewer accounts, per-viewer analytics beyond "last opened".
- A date cut-off (hiding data after a date).

## Anti-goals

- Anything that makes the viewer sign in or install anything.
- Hiding a chart in the UI while its data still reaches the browser. Filtering must happen on the server.
- Breaking old cached React builds or existing `/shared/<user-id>` links before the owner turns them off.

## Data

New table `share_links` (my call on the shape):

- `id uuid` primary key, random (`gen_random_uuid()`). This is the token in the URL.
- `user_id uuid` FK → users, `on delete cascade`.
- `name text not null`: the owner's private label, never shown to the viewer.
- `start_date date null`: the opens-on date. Null means today.
- `created_at timestamptz`, `last_opened_at timestamptz null`.

Join table `share_link_reports (share_link_id, report_id)`, both FKs `on delete cascade`, so a deleted report
drops out of every link. A link left with zero reports still opens and shows the normal empty state.

`users.legacy_share_enabled bool not null`: existing rows `true` so old links keep working, new accounts
`false` (my call: nobody new should get the leaky link). Migration via `make create_migration`, then
`make gen_schema`.

## Server

Same URL shape, one resolver (my call). `/shared/:id` and `/api/share/{id}/…` stay as they are. The server
resolves `{id}` first as a share-link id, then as a user id when that user has `legacy_share_enabled`.
Otherwise it returns 404. Because the shape is unchanged, old cached React builds can open new links too.
They'll still show their CSV button, but the data behind it is already limited to the link's practices, so
that's acceptable.

Per endpoint, for a share link:

- `GET /api/share/{id}/user`: `{ user: { id, name, email: "" , token: "" } }` (same shape, email
  blanked) plus `kind: "link" | "legacy"` and `start_date`. Sets `last_opened_at` for links. For legacy,
  blank the email too.
- `GET /api/share/{id}/reports`: only the link's reports, in the owner's normal report order. The client
  capability filter (`panels` level, `months`) still applies. The privacy rule
  `shared && p.level() >= 3` in `report/mod.rs` is **removed** for links and legacy alike. Update the
  `shared_never_gets_*` tests accordingly. The levels themselves stay. They protect old cached builds that can't
  draw newer panels, which is unrelated to privacy.
- `GET /api/share/{id}/practices`: only the practices referenced by the link's reports.
- `GET /api/share/{id}?duration&end_date`: entries filtered to those practices.
- **No marked periods on shared pages** (my call, as today). Periods aren't tied to practices and their names
  are personal free text; on shared pages they'd only draw bands. Gaps/Chart panels already render without them
  (`periods = []`). No new endpoint.
- Add each new public route to `SkipAuthRoute` in `middleware/auth.rs`.

"Practices referenced by a report": Graph traces, Grid practices, and every practice id inside a Panels
definition (rows, events, goals, sleep rows). Put this in one function next to `PanelsReport` with a test, so
a new panel kind can't silently leak or miss a practice.

Owner CRUD (authenticated, layered style like `yatras`: `handlers.rs` → `service.rs` → `dto.rs`):
`GET/POST /api/share-links`, `PUT/DELETE /api/share-link/{id}`, and `PUT /api/user/legacy-share { enabled }`
(or fold that into the existing user update, builder's call). Report ids that don't belong to the owner are
rejected.

## Owner UI

Mobile sketch agreed in brainstorming (`.superpowers/brainstorm/…/sharing.html`). Tablet and desktop follow the
Settings screens' existing per-layout pattern.

**Settings → Sharing** (new section): one card per link with name, a summary ("Sleep, Japa" or "4 charts"),
"opens on today / 31 Oct", "last opened 2 days ago" when set, and a **Copy** button. Then a **+ New link**
button. At the bottom, an **Old public link** card with an on/off switch and a line saying it shows everything.
The card is always shown, so the switch can be turned back on (my call).

**Edit link**: a "Who it's for" name field. "Charts they'll see" as a checklist of all the owner's reports,
each with its kind (Template / Graph / Table) and, under it, the practice names it uses (so "Celibacy" is
visible before ticking a table). "Opens on" is a Today / date choice using a native date input. Then **Share
link…** (`navigator.share`, hidden when unsupported) and **Copy**. Last comes **Withdraw access** with a
confirm, since it can't be undone. Save behaviour (autosave vs Save button) is the builder's call, following
how Settings does it elsewhere.

**Entry points:**
- Insights "…" menu: "Copy share link" becomes **Sharing**, which simply opens Settings → Sharing. There the
  user edits an existing link, creates a new one by picking charts, or copies an existing link to send to
  someone new. No prefilled editor, no picker (user's decision).
- Guide finish step (`FinishStep.tsx`, `guide.reader`): instead of copying the legacy link, it creates a link
  holding the reports the guide just made, with a default translated name (e.g. "Shared charts"; `guide.reader`
  is only a yes/no), and copies that (my call).
- `shareUrl()` / `copyShareLink()` in `today/actions.ts` go away or take a link id.

## Viewer page

The existing `/shared/:id` page (`features/shared`). Changes:
- Initial end date = `start_date` when set.
- No CSV button when `kind === "link"`. Legacy keeps it.
- Gaps/Around/Goals panels now render on shared pages, so the shared hook asks for `panels` level 4 (no
  marked-period bands).
- Not-found (withdrawn, unknown, legacy off) stays the existing not-found state.

All new strings in en/ru/uk.

## Shipping (user's decision)

Preview and stable share one DB, and viewers have no preview cookie, so they always land on stable. Ship in two
steps:
1. **Server to stable first:** migration (`legacy_share_enabled` DB default `false`, existing rows set `true`,
   so stable inserts keep working), resolver, filtering, email blanking, the legacy switch endpoint, owner CRUD.
   Old cached clients keep working against it.
2. **Owner UI and viewer-page changes through preview**, then stable.

## Backward compatibility

- Old cached builds: same endpoints and shapes, plus extra fields. They ask for `panels=true` (level 1),
  so they never receive panels they can't draw.
- Existing `/shared/<user-id>` links work until the owner flips the switch.

## Left to the builder

Exact copy, the tablet/desktop arrangement, Save vs autosave, migration file names, ordering of links (newest
first is fine), and whether legacy-switch lives in its own endpoint.
