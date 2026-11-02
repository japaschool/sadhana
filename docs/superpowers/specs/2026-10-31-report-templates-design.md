# Report templates — design

> **Superseded by guided setup** (`2026-11-01-guided-setup-design.md`, in part). Japa is presented as **Daily count** and Duration as **Time spent**, and a fourth template, **Days I did it**, is added. Stored identifiers don't change: `Template::Japa`, the `japa` and `duration` slugs and the translation keys stay as written below. Only the names people read changed.

Mockups (claude.ai/design project "Sadhana Redesign"): [`Report Templates.dc.html`](https://claude.ai/design/p/cccefa4d-5554-41b1-be47-2704b1233b68?file=Report+Templates.dc.html), frames `15m*` (mobile), `15t*` (tablet) and `15d*` (desktop). Where this spec and the mock differ on layout or visuals, the mock wins. Visual inspiration: Garmin Connect's Sleep Consistency and Sleep Duration charts.

## Intent

Wake-up and bedtime are logged every day, but the app can't say how long someone slept, and a chart can't show the night as one thing. Adding a "Total sleep" practice would duplicate data already in the diary.

Insights also makes people assemble every chart from parts. Most people want the same few answers: did I sleep enough, did I hit my rounds, how much time did this take?

**Report templates** answer those directly. The user picks practices and targets in a short form and gets a purpose-built report. A template is only a form that writes a normal report in a new, more capable format, so the generic editor can eventually do anything a template does.

## Goals

- Three templates: **Sleep**, **Japa**, **Duration**.
- A new report format with one renderer, which all templates write to. Nothing about a report's display depends on which template made it, apart from reopening its form.
- Sleep hours can be plotted, averaged and compared with a target using only the existing bedtime and wake-up practices.
- Works on mobile, tablet and desktop, and on shared report pages. All strings in en/ru/uk.
- **Backward compatible.** Older cached React builds keep working unchanged and never see the new reports.

## Non-goals

- **Derived practices.** Sleep duration exists only inside reports: not on Today, in tables, or in yatras. If those are wanted later, the same calculation definition can move into a practice.
- Marking days as out of routine. Separate feature; a later change can grey those days out and drop them from a template's stats.
- Manual sleep correction. A travel night simply looks wrong for now.
- Time-zone awareness.
- Extending the generic editor, and "Customise" (see Phases).
- Migrating existing Graph and Grid reports.
- Weekly aggregation or trend lines. Long ranges draw one bar per day.
- Changes to yatra scores or the averages in existing reports.
- The wider "insights rather than stats" rethink, which is a separate brainstorm.

## Anti-goals (failures even if it "works")

- An older cached client crashes, or its report list breaks, because of a new report.
- An existing report's content or display changes. Its position in the alphabetical list is the only change.
- A guessed sleep value: a night with a missing time showing a number, or counting towards an average.
- A template that needs a practice the user doesn't have to be created before they can see any value, other than its required practices.
- A template-only code path that the generic editor could never reach.

## Behaviour

### Creating and editing

- The New chart sheet opens on Sleep, Japa and Duration, each with one line of description. Graph and Table sit below under "Build your own" and keep their name-and-Create step (15m1).
- Each template opens a short form: name, practices and targets. A new report needs **Create**, so half-filled reports never appear in Insights. Saved reports appear with all others in the Insights report menu and Settings' chart list.
- Both lists sort **alphabetically by name, whatever the report type**, using the current language's collation. A muted type glyph before each name helps scanning, and All practices sits above a divider (15m17). This reorders existing reports too. All practices stays first in the Insights menu, as it isn't a report. On shared pages, the default report becomes the first alphabetically.
- Editing a template report reopens its form, and changes save as you go, like chart settings (15d13). Tablet and desktop show a live preview beside the form. A report can be deleted like any other.
- Forms suggest the likely practice with a **Use** button, as yatra links do, but never fill it in (15m2).
- Each practice picker lists only compatible active practices (types below), and say why the others can't be used (15m3). `get_report_data` returns active practices only, so a hidden one would have no values.

### Sleep template

Inputs: **Bedtime** (Time, required), **Wake-up** (Time, required), **Minimum** and **Maximum sleep** (optional, defaulted to 6h and 9h, each editable and clearable), **Nap** (Duration, optional).

A **night** is keyed by its wake-up date. Night D runs from the bedtime logged on D−1 to the wake-up logged on D. This matches how a bedtime is already read: 01:00 logged on the 29th means the small hours after the 29th. Today therefore shows last night as soon as the wake-up is logged. *(my call)*

Calculation, with times in minutes:

```
duration(D) = (wake(D) − bed(D−1)) mod 1440            // 23:00→07:00 = 480, 01:00→07:00 = 360
start(D)    = (bed(D−1) − 720) mod 1440                // minutes after the noon before the night
end(D)      = start(D) + duration(D)
total(D)    = duration(D) + nap(D)                     // an empty nap counts as 0
```

This replaces the 15:00/12:00 majority guess in `computeTimeOverflow` for these reports. The existing function stays as it is for Graph reports.

- A night missing either time, or with `duration = 0`, has no bar, isn't coloured and isn't counted. A nap on such a day isn't shown either. *(my call)*
- The first night in the window needs the bedtime from the day before it. Use the window's `previous` data where there is one. With All data, the earliest night has no bar.

Report contents:
1. **Summary figures:** average sleep (`total`, naps included) with the night-only average under it, average bedtime, average wake-up, and nights in range, counted against logged nights (22 of 29, not of 30). With no limits set, that figure becomes **Nights logged** (15m9). Averages use complete nights only. The range includes today, because last night is finished once the wake-up is logged.
2. **Sleep times chart:** one range bar per night from `start` to `end`. The Y axis runs top to bottom in time order, fitted to whole hours around the data (15m6). Missing nights are gaps. Solid line for average bedtime, dashed for average wake-up.
3. **Duration chart:** bars from zero showing `duration`, with `nap` stacked on top when there's a Nap practice, and the minimum and maximum as reference lines.

Bars in both charts show a state based on `total`, and "in range" is inclusive. States differ by texture as well as colour, so they read apart in greyscale and with colour blindness:

| State | Texture | Light | Dark |
|---|---|---|---|
| In range, or met | Solid | `#B9790F` (new) | `#F0B54A` |
| Under minimum, or missed | Outlined, pale fill | `#C2412D`, fill at 13% | `#F08A74`, fill at 16% |
| Over maximum | Striped | `#5F4FA3`, stripes `#A99BD6` | `#9C8CE6` (new), stripes `#3A3448` |
| No target | Solid, neutral | `#8A8174` | `#8F88A0` |

Clearing a limit removes that state, and the legend follows (15m10). With both cleared, bars are neutral (15m9).

At 1y, bars are about 1px wide and textures can't render, so states use solid colours that also differ in lightness. See 15m8 for values. The hours chart still shows the state by bar height against the limit lines.

Tooltip: date, bedtime → wake-up, night duration, nap if any, total.

### Japa template

Inputs: **Total rounds** (Int, required), **Target** (rounds, required), **Morning rounds** (Int, optional), **Japa quality** (optional), **Japa attunement** (Bool, optional).

Japa quality accepts an Int practice, or a Text practice whose `dropdown_variants` are all numeric. Text values are converted to numbers, and anything non-numeric counts as empty.

Report contents:
1. **Summary figures:** average rounds, days on target, plus average morning rounds, average quality and attunement days when those inputs are set.
2. **Rounds chart:** total-rounds bars showing the met and missed states, a target line, morning rounds overlaid, and attunement as a marker above the bars on days it's true.
3. **Quality chart**, only with a quality input: a line on its own axis.

### Duration template

Inputs: **Practices** (one or more Duration, required), **Daily goal** (optional).

Report contents:
1. **Summary figures:** average per day, and days on goal when set.
2. **Daily totals chart:** bars stacked by practice, with a goal line when set. Single-practice reports show the met and missed states. With several practices, series colours identify the practice, so only the line shows the goal. *(my call: the user asked for daily totals; multiple practices is an extension)*

Japa and Duration averages match existing Insights: today is excluded and a missing day counts as 0. Days on target count past days only.

### Missing practices

A report can reference a practice that was later deleted or hidden from Today. Hidden practices return no report data, so both cases are handled alike. The report still opens with whatever it can draw; if a required practice is missing, it shows a message with a link to the form. An optional missing practice is left out, along with its figure and chart, with no message (15m19, 15t7, 15t10). It must never crash, or show ids as names.

## Report format

Stored as JSON, typed on both sides with serde and TypeScript. The Rust type is the contract. Illustrative shape for Sleep:

```jsonc
{
  "version": 1,
  "template": { "Sleep": { "bedtime": "<uuid>", "wake": "<uuid>", "nap": null, "min": 360, "max": 540 } },
  "panels": [
    { "kind": "Stats", "stats": [...] },
    { "kind": "Chart",
      "series": [{ "label": "...", "mark": "Range",
                   "source": { "Range": { "from": { "practice": "<uuid>", "day_offset": -1 },
                                          "to":   { "practice": "<uuid>", "day_offset": 0 } } } }],
      "target": { "min": 360, "max": 540, "of": "stack" } }
  ]
}
```

The building blocks are generic:

- **Sources:** `Practice`; `Calc`, a list of `{sign, practice, day_offset}` terms, where a time-minus-time pair is taken mod 24h; `Range`, a pair of `{practice, day_offset}`.
- **Marks:** Bar, Line, Dot, Range. Series may stack or overlay, and have an axis.
- **Target:** optional min and max, over a series or the stack, drawing reference lines and optional colouring.
- **Stats:** average, count on target and count true, over a series, a stack or a Range end.

The template's form settings live in `template`. Saving the form regenerates `panels` from them, so `panels` is what the renderer draws and `template` is only used to reopen the form. A report with `template: null` is a future generic report.

The exact JSON shape is the builder's. The requirement is that the renderer reads only `panels`.

## Server

- **Storage:** extend the existing table. Add a nullable `definition jsonb` column to `reports` and a `panels` value to `report_type_enum`. A panels report has a `definition`, no `bar_layout` and no `report_traces` rows. Regenerate `schema.rs`. `ReportDefinition` gains a `Panels` variant.
- **Endpoints:** the existing create, update and delete routes accept the new variant. `GET /reports` and `GET /share/{id}/reports` return panels reports only when called with `?panels=true`, which new clients always send. A `PUT` can't change a report's type (422).
- **Old clients:** the default response of those two `GET`s doesn't change. This filter is required: `tracesFor` in `chartLogic.ts:217` treats any non-Grid report as a Graph, so a third kind reaching a layout that lists tables would throw.
- **Validation on save:** deserialisation rejects unknown shapes. Reject with 422 practices that aren't the user's, negative targets, `min > max`, and over-large definitions (panel and series limits). `version` must be 1.
- **Deleted practices:** JSON references have no foreign key. Deleting a practice doesn't touch template reports; the client handles it (see Missing practices).
- No new data endpoint. Existing `/diary/{cob}/report` and `/share/{id}` responses supply the values, and the calculation runs on the client.

## Client

- `api/charts.ts`: new types, and `getReports` and `getSharedReports` send `panels=true`. `tracesFor` and other code that assumes Grid or Graph must handle the third kind. Sort once, where the lists are read.
- Pure logic in `features/insights`, tested like `chartLogic.ts`: resolving sources (note `ReportDataEntry.practice` is a practice **name**, so map id → name via practices), night calculation, target colouring and stats.
- One renderer per panel kind, reused by the layouts. `InsightsChart` stays as it is. Reuse its tick, tooltip and formatting helpers rather than copying them. Recharts draws a Range with a `<Bar>` whose value is `[low, high]`, and per-bar states with `<Cell>`. Outlines use `stroke`, and stripes an SVG `<pattern>` fill.
- State colours are theme tokens with the light and dark values above, in `src/ui/theme.css`.
- Russian and Ukrainian spell units out, so figure tiles keep values on one line and let labels wrap. Range chips and legends wrap rather than truncate (15m22–15m27).
- Existing Insights controls (range, end date, desktop log date, shared pages) apply to template reports. Legend toggles and CSV export are the builder's call: keep them where they work without a special case, otherwise hide them.

## Phases

1. **Format, storage, renderer and the Sleep template.** Shippable alone.
2. **Japa and Duration templates.** Adjust the format where they show gaps; `version` is bumped only if stored reports must change.
3. **Generic editor catch-up, then "Customise",** which clears `template` and opens the report in that editor. Gets its own spec.

## Testing

- Sleep logic: 23:00→07:00, 01:00→07:00, a missing time on either side, nap with and without a night, `duration = 0`, the window's first night, average bedtime across midnight (23:30 and 00:30 average to 00:00), and in-range boundaries.
- States with min only, max only, both, and neither.
- Text-to-number conversion for japa quality, and non-numeric values.
- Deleted required and optional practices.
- Server (`make test`): CRUD, ownership, each validation, a type-changing `PUT` rejected, and both `GET`s returning panels reports only with `panels=true`.
- Report lists sort alphabetically across types, in each language.
- All three layouts and a shared page render a Sleep report. Translation completeness is covered by `locales.test.ts`.

## Left to the builder

The final JSON shape, stats layout per layout, component structure, and wording, within the behaviour above.
