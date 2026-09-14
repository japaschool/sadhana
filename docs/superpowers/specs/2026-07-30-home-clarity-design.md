# Sadhana Pro — Home Page Clarity Design Spec

**Date:** 2026-07-30
**Scope:** Three targeted clarity improvements to the home page practice card area

---

## Context

The home page shows practice cards for whichever date is selected in the WeekCalendar. Currently:

- There is no visual cue distinguishing "today" from a past or future date in the cards area — only the calendar header changes.
- When navigating to a past date with no diary entries, all cards show at default/empty values, indistinguishable from "today with nothing logged yet."
- The "Required" / "Optional" section divider labels are 10px all-caps white — barely readable.

All three changes are confined to `app-react/src/pages/home/HomePage.tsx` and its test file.

---

## Change 1 — Date Context Label

**Location:** Between `<WeekCalendar>` and the practice cards `<div>` in `HomePage.tsx`.

**When shown:** Always (today, past, and future dates alike).

**Content:**

| Condition | Text |
|---|---|
| `dateStr === todayStr` | "Today" |
| `dateStr === yesterday` | "Yesterday" |
| `dateStr === tomorrow` | "Tomorrow" |
| Any other past/future | e.g. "Wed, Jul 28" — `date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })` |

**Styling:** Same translucent-white aesthetic as the existing section labels — `text-[11px] font-semibold uppercase tracking-widest`, `color: rgba(255,255,255,0.70)`, no background, no border. Sits flush left (`px-1`), 4px gap below calendar.

**Implementation:**

```tsx
function DateContextLabel({ dateStr }: { dateStr: string }) {
  const todayStr = toDateStr(new Date())
  const yesterday = toDateStr(new Date(Date.now() - 86_400_000))
  const tomorrow  = toDateStr(new Date(Date.now() + 86_400_000))
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'

  let label: string
  if (dateStr === todayStr)   label = t('home.today')
  else if (dateStr === yesterday) label = t('home.yesterday')
  else if (dateStr === tomorrow)  label = t('home.tomorrow')
  else {
    const d = new Date(dateStr + 'T00:00:00')
    label = d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest px-1"
       style={{ color: 'rgba(255,255,255,0.70)' }}>
      {label}
    </p>
  )
}
```

**i18n:** Two new keys required:
- `home.yesterday` — "Yesterday"
- `home.tomorrow` — "Tomorrow"

(`home.today` already exists.)

---

## Change 2 — Past Date "Nothing Logged" Banner

**Location:** Above the practice cards list in `HomePage.tsx`, inside the cards `<div>`.

**When shown:** All three must be true:
1. `dateStr < todayStr` (date is in the past)
2. `(diaryQuery.data ?? []).length === 0` (zero diary entries for that date)
3. `activePractices.length > 0` (the user has practices — avoids collision with the "no practices" empty state)
4. `!diaryQuery.isLoading && !diaryQuery.isError` (query has settled)

**Behaviour:** Disappears automatically when the user logs their first entry (the optimistic cache update sets diary length > 0 immediately).

**Appearance:** A small translucent amber-tinted banner, matching the existing offline banner style:

```tsx
<div
  className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
  style={{
    background: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.18)',
    color: 'rgba(255,255,255,0.75)',
  }}
>
  {t('home.nothingLogged')}
</div>
```

**i18n:** One new key:
- `home.nothingLogged` — "Nothing was logged on this day"

---

## Change 3 — Section Label: Size + Horizontal Rule

**Location:** `SectionLabel` component in `HomePage.tsx`.

**Current:**
```tsx
<p className="text-[10px] font-semibold uppercase tracking-widest px-1" style={{ color: '#ffffff' }}>
  {label}
</p>
```

**New:** Increase to `text-xs` (12px), add a flex row with a `<hr>`-like line filling remaining space:

```tsx
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <p className="text-xs font-semibold uppercase tracking-widest flex-shrink-0"
         style={{ color: 'rgba(255,255,255,0.85)' }}>
        {label}
      </p>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.20)' }} />
    </div>
  )
}
```

---

## i18n Keys Summary

All new keys go into every locale file (`en`, `ru`, and any others present):

| Key | English value |
|---|---|
| `home.yesterday` | "Yesterday" |
| `home.tomorrow` | "Tomorrow" |
| `home.nothingLogged` | "Nothing was logged on this day" |

---

## Files Changed

| File | Change |
|---|---|
| `app-react/src/pages/home/HomePage.tsx` | Add `DateContextLabel`, `nothingLogged` banner, update `SectionLabel` |
| `app-react/src/pages/home/HomePage.test.tsx` | Add tests for all three changes |
| `app-react/src/i18n/locales/en.json` (and other locales) | Add 3 new i18n keys |

---

## Testing

Three new test cases in `HomePage.test.tsx`:

1. **Date context label — today:** renders "Today" when `dateStr === todayStr`.
2. **Date context label — past date:** renders a formatted date string (not "Today") when navigated to yesterday.
3. **Nothing logged banner:** renders the banner when `isPast && diaryEntries.length === 0 && practices.length > 0`; does not render when `diaryEntries.length > 0`.
4. **Section label rule:** `SectionLabel` renders both the label text and a sibling `<div>` (the rule).
