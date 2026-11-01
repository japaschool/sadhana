# Guided setup — design

Mockups (claude.ai/design project "Sadhana Redesign"): [`Guided Setup.dc.html`](https://claude.ai/design/p/cccefa4d-5554-41b1-be47-2704b1233b68?file=Guided+Setup.dc.html), frames `17m*`, `17t*` and `17d*`. Where a mockup and this spec differ on layout or visuals, the mockup wins. On behaviour, this spec wins. Known mockup slip: 17d6 still shows a Sharing step, but the guide from "Add practice" has none, so follow 17d11.

*(my call)* marks decisions I made that weren't discussed in detail.

## Intent

A new user currently gets four fixed practices that assume mantra rounds. They see no reason to prefer the app to a spreadsheet.

Guided setup opens with what the person could have: small versions of the real reports, filled with example data. They pick the reports they want, then set up the practices behind each one. It should feel like a guide and not a settings form. The same guide stays available later from "Add practice".

## What the data says

Production, 2026-11-01. These show what happens, not why. Nobody who left has said why.

- 1,057 users; 819 ever logged. 733 of those logged within an hour of signing up, so getting a first log isn't the problem.
- 385 logged exactly one day. Coming back is the problem.
- Sign-ups from the last 24 months, leaving out the last 30 days (409): 294 (72%) ever logged, 124 (30%) logged a second day within 7 days of their first, and 65 (16%) reached 7 logged days.
- Of people who signed up more than 60 days ago and logged, 36% of those who added a practice on day one reached 7 logged days, against 17% of those who added none in their first week. Motivated people may just do both, so this doesn't show setup causes staying.
- 59% of yatra members who logged reached 7 logged days, against 20% of others. Same caution. Only 1 of the last 45 sign-ups is in a yatra.
- About 90% of loggers who still have a default practice filled in rounds. That reflects who the app reaches today.
- Of 1,343 added practices, 423 are yes/no, 357 duration, 221 number, 176 time and 166 text. Reading is the clearest theme, and names are scattered.
- About 13 sign-ups a month.

## Hypotheses

The guide tests two guesses: **no visible benefit** (people don't see why this beats a spreadsheet) and **setup hurdle** (people can't get it matching what they do). The product owner's reading is that keeping a chart is a habit to develop, and many people try it and decide it isn't for them. The guide doesn't solve that habit alone.

One group has a specific need: people whose mentor reads their chart about once a month. Today they could send a spreadsheet link. The app's answer is a link to a shared report page, which shows the month as charts.

## Goals

- First screen shows mini versions of real reports, with example data clearly marked.
- People choose reports, then set up the practices behind them, renaming on the spot and setting aims.
- Reports and practices exist when the guide ends, and the person lands where they can log straight away.
- People with a reader get a working share link at the end.
- The guide also opens by choice from "Add practice", next to adding one by hand.
- Invited new users get through to their yatra with its practices ready.
- Tradition-neutral. Works for someone tracking plain habits.
- Mobile, tablet and desktop, light and dark, en/ru/uk.
- Older cached clients keep working.

## Non-goals

- Notifications, and collecting anything for them. A preferred logging time was considered and left out until notifications exist.
- Setting up practice groups. Guide practices go in the default group. People can arrange them later.
- Reports for text or dropdown practices.
- Replacing the generic chart editor or the manual practice form.
- A/B testing. Volume is too low.
- Spreadsheet import inside the guide. The existing Settings import stays where it is.
- Changing shared pages, which are being reworked separately.
- Fixing the habit itself: reminders, nudges, or return prompts.

## Anti-goals (failures even if it "works")

- An existing user is pushed through the guide, or their data changes because of it.
- Example data can be mistaken for the person's own.
- The guide assumes a tradition, for example a preset of 16 rounds.
- Gamification: scores, badges, celebration, or streaks.
- A guess about why someone practises, or a promise that charts will change anything.
- Someone can't leave at any step.
- An older cached build breaks, or a person who signs up on one ends up with no practices.
- Mini reports drift from the real ones.

## Dependencies

Report templates (`2026-10-31-report-templates-design.md`) must ship first, **with two additions decided here**. That spec and `docs/superpowers/plans/2026-11-01-report-templates.md` need updating before that work starts.

Also rename the **Duration** template to **Time spent**, so the guide and the New chart sheet use one name.

1. **Daily count** replaces the Japa template. It's the same report with neutral naming, so a count can be rounds, pages or push-ups. Its inputs become: **Count** (Int, required), **Target** (required), **Part done early** (Int, optional), **How it went** (optional, same rule as Japa quality) and the yes/no marker (Bool, optional). Every label is neutral.
2. **Days I did it** is a new template. Inputs: one or more Bool practices. Each practice gets its own section: this month's count, last month's count, the last 90 days' count and a month grid, all for that practice alone. There's no combined total. *(my call)* A true value is a done day. False and empty look the same, with no red and no judging. The grid is a new panel kind in the generic `panels` format, so the generic editor can reach it later. Weeks start on Monday. The report shows one month, with back and forward arrows in place of the usual range controls. Mockups: 17m23, 17m24, 17t15, 17t16 and 17d15.

Personal Insights (`2026-11-01-personal-insights-design.md`) comes after the guide and needs no change. Its Sleep lookup already uses a Sleep report's practices, so people who take the Sleep report skip that question.

Practice groups are already live. The guide doesn't use them.

## The flow

### 1. Report carousel

Heading: "What would you like to see about your days?" with a line explaining that this is how each looks after a few weeks.

Four reports: **Sleep**, **Daily count**, **Time spent**, **Days I did it**. Each is a full mini report: title, summary figures, charts and legend. Each is marked "Example".

- **Mobile:** a carousel of one report at a time, with the next one peeking in at the edge. Each has **Track this** and **Skip**, and either moves to the next. Swiping works too. A position indicator shows where they are, and they can go back to change a choice.
- **Tablet and desktop:** all four at once in a grid, each with a toggle, and one **Next** button. *(my call)*
- **Exit:** "Build my own list" is available throughout. It ends the guide and opens Today's empty state.
- If they reach the end with nothing chosen, they can track a report directly, look through the examples again, or build their own list (17m5).
- Once a report has been set up, "Build my own list" asks for confirmation first, as those choices won't be saved (17m28).

### 2. Setup, one screen per chosen report

Each shows what feeds the report. Every practice can be renamed in place. Every optional practice has a tick. Mobile shows one report per screen; wider layouts may show a live preview beside the form, as the template forms do. *(layout is the builder's and the mock's)*

| Report | Required | Optional | Aim |
|---|---|---|---|
| Sleep | Bedtime (Time), Wake-up (Time) | Nap (Duration) | Minimum 6h and maximum 9h, each editable and clearable |
| Daily count | One count (Int): pick a suggestion or name your own | Part done early (Int), How it went (dropdown with options 1 to 5) | Daily target, required, starts empty |
| Time spent | One or more (Duration): pick suggestions or name your own | None | Daily goal, optional |
| Days I did it | One or more (Bool): pick suggestions or name your own | None | None |

Suggestions, all in en/ru/uk, tradition-neutral as a set:

- Daily count: Mantra rounds, Prayers, Pages read, Push-ups.
- Time spent: Reading, Meditation, Exercise, Listening, Study, Service.
- Days I did it: Morning prayer, Evening prayer, Group gathering, Journaling, Walk.

The exact list is the builder's, and should be reviewed with the product owner. Report names default to the template's name in the user's language.

- **Aims never assume a tradition.** The Daily count target starts empty.
- **Names:** can't be empty, and must be unique among the person's practices, hidden ones included. The server rejects exact duplicates, so the client checks first. An active practice of a compatible type can be used as it is. A hidden practice or one of another type can't, so the person is asked for a different name. The guide never reactivates or changes an existing practice. *(my call)*

### 3. "Does anyone else read this chart?"

First run only, shown once. **Yes, someone reads it** or **No, it's just for me**. Neutral wording: "a mentor, a teacher, a friend" is fine as an example. Neither answer starts selected, because this is how we count people with a reader. *(my call: asked after setup, so it doesn't delay the benefit)*

The share link is always on, needs no sign-in and can't be turned off. Copy must say so plainly and never promise a private link, an off switch, or that nothing is shared. "No" only means the guide doesn't show the link. An off switch belongs to the shared pages rework.

### 4. Finish

Practices and reports are created here, in one go. A short closing screen lists what was set up and says when each report starts filling in. Sleep needs a wake-up and the previous evening's bedtime, so it starts on the second day. Say this plainly, so an empty report tomorrow doesn't look broken.

With a reader, the screen also shows the share link with Copy and a line saying that anyone with the link can see their reports and that it updates as they log. The link is `/shared/{user id}`, the same as today. It isn't created by the guide, so it isn't part of the saving or failure states.

Then **Start logging** opens Today. The share link stays available in its usual place.

## From "Add practice"

"Add practice" (from Today and from Settings › Practices) offers two choices: **Help me choose** opens the guide; **Add one myself** opens the existing form. *(Desktop and tablet use their existing patterns for this choice.)*

- Skips step 3.
- Reports the person already has of that template aren't shown as new. They can still add another. *(my call)*
- Setup screens list the person's compatible active practices first, with a **Use** button, as the template forms do, then "You already track this" on suggestions with an exact name match. Using one doesn't rename it.
- Reports built on existing practices include their logged history at once.
- Closing screen goes back to where they came from.

A person who wants one practice and no report uses "Add one myself".

## Who sees it

- **After sign-up, on a current build:** the client sends the person into the guide only when the account was just created. Email sign-up is always new. Google has one route for new and returning people, on both Login and Register, so its response gains an additive `created` flag. *(my call)* This is the only way into the first run, so no existing user can reach it.
- **Sign-up seeding:** `POST /users` and Google sign-in accept an optional field to skip the default practices. Absent means seed, so older cached builds behave as they do today. Current builds always send it. On Google it only matters when an account is created, so returning users are unaffected.
- **If they leave partway:** they have no practices. Today's existing empty state appears, with its starter practices and "add your own", plus a new **Help me choose** link to the guide. Nobody is sent back into it automatically.
- **Existing users:** never redirected. Only one user has no practices today, and they'd only see the same empty state.

## Yatra invites

**Existing bug to fix first (from reading the code; confirm with a test):** a signed-out invitee goes to Sign in with the invite held in router state. The "Sign up" link drops it, and the emailed confirmation link can't carry it. So a brand-new invitee reaches Today without joining. This is worth shipping on its own, before the guide.

**Fix:**

- Pass the destination through Login to Register.
- `POST` for the confirmation link takes an optional `next`, which goes on the emailed link as a query parameter. Accept only the exact shape `/yatra/{uuid}/join`, on the server and in the client, so it can't become an open redirect.
- After sign-up, a valid `next` takes priority over the guide.

**Invitee flow:** Sign up → join screen → link screen (`/yatra/:id/links?joined=1`). The carousel is skipped. These people sign up without default practices, as above.

- When the person has no active practices, the link screen offers **Create all and link**, which creates one practice per yatra practice, with the same name and type, and links them. Each row also has its own **Create and link** (17m21). *(my call)* It's the generic rule, so no separate invitee mode is needed. There's no undo, because everything can be changed in My practices.
- **Start logging** then takes them to Today (17m22). **Help me choose** remains available for adding reports.

Existing users joining a yatra see no change.

## Creating things

- Reuses existing routes: `POST` for practices, then read the practices back for their ids (the create route returns none), then `createReport`. No new endpoint is required for this.
- Runs in order with a clear progress state. If anything fails, show a retry that carries on from what already exists, so duplicates can't happen. A practice with no report does no harm if someone gives up.
- Needs a connection, like other settings. Show the normal offline error, and keep their choices so they can retry.
- Choices live in client state until Finish. Nothing is written earlier, so leaving creates nothing.
- New practices are appended in report order, Sleep's first, in the default group, active. *(my call)*

## Mini reports

Draw them with the real panel renderer, so they can't drift. Each uses a fixed example definition and example data bundled with the client, so no request is needed and it works before anything exists. *(my call)*

- Example data is believable and imperfect, with gaps and missed days, because a perfect chart is discouraging. Practice names in examples stay tradition-neutral or varied.
- "Example" is visible on each report and isn't part of the data.
- Interactions such as tooltips and range controls are off.
- Every string and date format follows the user's language.
- Screen readers get a text alternative for each mini report.

## Measuring it

Before/after by sign-up date, as volume rules out a split test. Baselines are the 24-month figures above, recalculated at launch using the same queries.

- **Main measure:** share of sign-ups who log a second day within 7 days of their first. Baseline 30%.
- **Also:** share reaching 7 logged days (baseline 16%), and share of sign-ups who log at all (baseline 72%), to catch the guide putting people off.
- **Early read:** guide finished or left, and at which step. Reports picked come from the reports themselves.
- **Telling the guesses apart:** many leave during setup → setup hurdle. Most finish but don't return → no visible benefit, or a wider habit problem.
- **New knowledge:** the share with a reader, which nobody knows today.

At about 13 sign-ups a month, 6 months gives about 80 people, so only a large change will be visible, roughly 30% to 50%. Say so when reading the result, and treat smaller changes as unproven. Other changes shipping at the same time will blur it.

**Storage:** new table `guide_runs`: `user_id` (cascade on delete), `started_from` (`signup` or `add_practice`), `outcome` (nullable: `finished` or `left`), `last_step`, `has_reader` (nullable), timestamps. Write a row when the guide starts and update `last_step` at each step, so someone who simply closes the app still shows where they stopped. *(my call)* These writes are fire-and-forget and never block the guide. An authenticated route writes it. This holds no answer that identifies a practice. Read it as anonymous totals only.

## Server

Follow the layered `yatras` style for the new module.

- Optional skip-seeding field on sign-up and Google sign-in, and an additive `created` flag on the Google response.
- Optional `next` on the confirmation link, validated as above.
- `guide_runs` table and write route. Regenerate `schema.rs`. Migrations are additive and must be applied explicitly on prod.
- Template additions per Dependencies.

## Client

- New `features/guide`: logic in hooks and pure functions, components per layout, chosen with `ByLayout`.
- A route outside the main tabs, inside `ProtectedRoute`. The shell is the builder's.
- Practice names and suggestions go through i18n. `locales.test.ts` covers completeness. Russian and Ukrainian text runs longer, so check figures, buttons and the carousel with them.
- `NoPractices` gains the guide link. "Add practice" entry points gain the choice.

## Phases

1. **Invite fix.** Ships alone.
2. **Report templates**, with the two additions.
3. **First-run guide:** carousel, setup, reader question, finish, skip-seeding, `guide_runs`, and **Create all and link** for invitees, because skip-seeding would otherwise leave them nothing to link.
4. **From "Add practice".**

Phase 1 can be planned now. Phases 2 and 3 are planned in detail once the mockups exist, including those for Days I did it.

## Testing

- Pure logic: the plan built from choices, name collisions, retry resuming without duplicates.
- A sign-up without the new field still seeds. With it, nothing is seeded.
- `next` rejects anything other than the exact invite shape, on both sides.
- An existing user is never redirected. Leaving at each step creates nothing and leaves Today usable.
- An invited new user reaches the yatra with every practice linked.
- From "Add practice": existing practices offered, nothing duplicated, history shows in the new report.
- Mini reports render on all three layouts, in both themes and in all languages.
- Server (`make test`): `guide_runs` ownership and cascade delete.

## Left to the builder

Layout per screen within the mockups, carousel implementation (with no new dependency if a CSS scroll-snap version works), exact suggestion lists and wording, example data, and the `guide_runs` route shape.
