# Diary Inputs Match Rust — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Home diary inputs (`PracticeCard`) match the Rust version: Text→textarea (free text) / select (configured options); Int→plain number / select; Time→single auto-formatting `HH:MM` field; Duration→single text field + add-minutes; Bool unchanged.

**Architecture:** Extract time-string formatting/parsing into a pure, tested `inputFormat.ts`. Then rework the per-type controls in `PracticeCard.tsx`, removing the −/+ steppers, keeping the existing optimistic-save mutation and `DurationQuickAddModal`.

**Tech Stack:** React 19, TypeScript, TanStack Query, Vitest + @testing-library/react.

## Global Constraints

- No new dependencies. No backend or data-model changes.
- Preserve the existing optimistic-save mutation (`onMutate`/`onError`/`onSettled`), the flash/error border states, and `DurationQuickAddModal`.
- Keep the `<select>` dropdown for Int/Text practices that have `dropdown_variants`.
- Bool control unchanged (existing toggle).
- Empty/incomplete Time or Duration on blur → **do not save** (retain prior value); never clear an existing entry.
- Value wire shapes (serde): `{Int:n}`, `{Bool:b}`, `{Duration:minutes}`, `{Time:{h,m}}`, `{Text:s}`.

---

### Task 1: `inputFormat.ts` time helpers (pure, tested)

**Files:**
- Create: `app-react/src/pages/home/inputFormat.ts`
- Test: `app-react/src/pages/home/inputFormat.test.ts`

**Interfaces:**
- Produces: `formatTimeInput(raw: string): string`, `parseTime(display: string): { h: number; m: number } | null`

- [ ] **Step 1: Write the failing tests**

```ts
// app-react/src/pages/home/inputFormat.test.ts
import { describe, it, expect } from 'vitest'
import { formatTimeInput, parseTime } from './inputFormat'

describe('formatTimeInput', () => {
  it('inserts the colon after two hour digits', () => {
    expect(formatTimeInput('0630')).toBe('06:30')
    expect(formatTimeInput('12')).toBe('12:')
  })
  it('auto-prefixes a leading zero when the first digit is > 2', () => {
    expect(formatTimeInput('9')).toBe('09:')
    expect(formatTimeInput('2')).toBe('2')
  })
  it('clamps hours to 23 and minutes to 59', () => {
    expect(formatTimeInput('2530')).toBe('23:30')
    expect(formatTimeInput('1275')).toBe('12:59')
  })
  it('pads a minutes tens digit > 5', () => {
    expect(formatTimeInput('127')).toBe('12:07')
  })
  it('strips non-digits and empties on no digits', () => {
    expect(formatTimeInput('ab')).toBe('')
    expect(formatTimeInput('')).toBe('')
  })
})

describe('parseTime', () => {
  it('parses full and partial HH:MM', () => {
    expect(parseTime('06:30')).toEqual({ h: 6, m: 30 })
    expect(parseTime('06:')).toEqual({ h: 6, m: 0 })
  })
  it('returns null for empty', () => {
    expect(parseTime('')).toBeNull()
    expect(parseTime(':')).toBeNull()
  })
  it('clamps out-of-range', () => {
    expect(parseTime('30:90')).toEqual({ h: 23, m: 59 })
  })
})
```

- [ ] **Step 2: Run to verify fail** — `cd app-react && npx vitest run src/pages/home/inputFormat.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// app-react/src/pages/home/inputFormat.ts

/** Format raw keystrokes into a partial/full HH:MM string (adapts Rust format_time). */
export function formatTimeInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  if (d.length === 0) return ''
  if (d.length === 1) return Number(d) > 2 ? `0${d}:` : d
  let hh = d.slice(0, 2)
  if (Number(hh) > 23) hh = '23'
  const rest = d.slice(2)
  if (rest.length === 0) return `${hh}:`
  if (rest.length === 1) return Number(rest) > 5 ? `${hh}:0${rest}` : `${hh}:${rest}`
  let mm = rest.slice(0, 2)
  if (Number(mm) > 59) mm = '59'
  return `${hh}:${mm}`
}

/** Parse an HH:MM (or partial) display into clamped {h,m}, or null if empty. */
export function parseTime(display: string): { h: number; m: number } | null {
  const [hs, ms] = display.split(':')
  const h = parseInt(hs ?? '', 10)
  if (isNaN(h)) return null
  const m = parseInt(ms ?? '', 10)
  return {
    h: Math.max(0, Math.min(23, h)),
    m: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
  }
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run src/pages/home/inputFormat.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/pages/home/inputFormat.ts app-react/src/pages/home/inputFormat.test.ts
git commit -m "feat(home): time input format/parse helpers (Rust parity)"
```

---

### Task 2: Int + Duration controls (drop steppers)

**Files:**
- Modify: `app-react/src/pages/home/PracticeCard.tsx` (Int block, Duration block; the `Step` component becomes unused → remove it)
- Test: `app-react/src/pages/home/PracticeCard.test.tsx`

**Interfaces:**
- Consumes: existing `save(v: PracticeValue)`, `fmtDur(min)`, `DurationQuickAddModal`, `meta`/`TYPE_META` (left icon unchanged).

- [ ] **Step 1: Replace the Int block** (the whole `{practice.data_type === 'Int' && (...)}` region) with a select-or-number control, no steppers:

```tsx
{practice.data_type === 'Int' && (
  practice.dropdown_variants ? (
    <select
      defaultValue={intVal ? String(intVal) : ''}
      aria-label={practice.practice}
      className="focus:outline-none text-sm cursor-pointer"
      style={{ ...field, width: '5rem', height: '2.25rem', padding: '0 0.5rem', textAlign: 'left', fontWeight: 500, color: intVal > 0 ? ACCENT : '#9ca3af' }}
      onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) save({ Int: n }) }}
    >
      <option value="">—</option>
      {practice.dropdown_variants.split('\n').map(v => v.trim()).filter(Boolean).map(v => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
  ) : (
    <input
      type="number" inputMode="numeric" min={0}
      defaultValue={intVal || ''}
      aria-label={practice.practice}
      placeholder="—"
      className="focus:outline-none text-sm flex-shrink-0"
      style={{ ...field, width: '4rem', height: '2.25rem', color: intVal > 0 ? ACCENT : '#9ca3af' }}
      onFocus={fieldFocus}
      onBlur={(e) => {
        fieldBlur(e)
        const n = parseInt(e.target.value, 10)
        save({ Int: isNaN(n) || n < 0 ? 0 : n })
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
)}
```

- [ ] **Step 2: Replace the Duration block** with a single text field + the existing quick-add button (no steppers). Uses `durEl`/`durRef` already declared:

```tsx
{practice.data_type === 'Duration' && (
  <>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <input
        ref={durEl}
        type="text" inputMode="numeric"
        defaultValue={fmtDur(durVal)}
        aria-label={`${practice.practice} duration`}
        placeholder="—"
        className="focus:outline-none text-sm"
        style={{ ...field, width: '5.5rem', height: '2.25rem', color: durVal > 0 ? ACCENT : '#9ca3af' }}
        onFocus={(e) => { fieldFocus(e); e.target.value = durRef.current > 0 ? String(durRef.current) : ''; setTimeout(() => e.target.select(), 0) }}
        onBlur={(e) => {
          fieldBlur(e)
          const v = parseInt(e.target.value, 10)
          durRef.current = isNaN(v) || v < 0 ? 0 : v
          e.target.value = fmtDur(durRef.current)
          e.target.style.color = durRef.current > 0 ? ACCENT : '#9ca3af'
          save({ Duration: durRef.current })
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      <button
        type="button" aria-label="Quick add minutes"
        onClick={() => setShowQuickAdd(true)}
        className="w-7 h-7 rounded-lg flex items-center justify-center select-none flex-shrink-0"
        style={{ background: 'rgba(1,163,134,0.12)', border: '1px solid rgba(1,163,134,0.25)', color: ACCENT }}
      >
        <LuZap className="w-3.5 h-3.5" />
      </button>
    </div>
    {showQuickAdd && (
      <DurationQuickAddModal
        onAdd={(minutes) => save({ Duration: durRef.current + minutes })}
        onClose={() => setShowQuickAdd(false)}
        isPending={mutation.isPending}
      />
    )}
  </>
)}
```

- [ ] **Step 3: Remove the now-unused `Step` component** (the `function Step(...)` definition) since neither Int nor Duration uses it anymore. Confirm no other references remain (`grep -n "Step" PracticeCard.tsx`).

- [ ] **Step 4: Update `PracticeCard.test.tsx`** — add cases (keep existing Bool optimistic tests):

```tsx
it('Int renders a plain number input with no steppers', () => {
  renderCard({ id: '1', practice: 'Pages', data_type: 'Int', is_active: true, is_required: false })
  expect(screen.getByRole('spinbutton', { name: 'Pages' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Increase by 1' })).toBeNull()
})
```

(Use the file's existing render helper/QueryClient+Router wrapper; if none, wrap in `QueryClientProvider`. Mock `practicesApi.saveDiaryEntry` as the existing tests do.)

- [ ] **Step 5: Verify** — `cd app-react && npx vitest run src/pages/home/PracticeCard.test.tsx && npx tsc -b 2>&1 | grep PracticeCard || echo "PracticeCard tsc clean"`. Expected: pass; clean.

- [ ] **Step 6: Commit**

```bash
git add app-react/src/pages/home/PracticeCard.tsx app-react/src/pages/home/PracticeCard.test.tsx
git commit -m "feat(home): Int/Duration inputs match Rust (drop steppers)"
```

---

### Task 3: Time single field + Text textarea (stacked)

**Files:**
- Modify: `app-react/src/pages/home/PracticeCard.tsx` (Time block, Text block, and the card's outer layout to allow a stacked Text card)
- Test: `app-react/src/pages/home/PracticeCard.test.tsx`

**Interfaces:**
- Consumes: `formatTimeInput`, `parseTime` from `./inputFormat`; existing `save`, `field`, `fieldFocus`, `fieldBlur`, `textVal`, `timeH`, `timeM`.

- [ ] **Step 1: Import helpers + add Time display state.** At top of `PracticeCard.tsx` add `import { formatTimeInput, parseTime } from './inputFormat'`. Inside the component, add:

```tsx
const initialTime = (timeH > 0 || timeM > 0)
  ? `${String(timeH).padStart(2, '0')}:${String(timeM).padStart(2, '0')}`
  : ''
const [timeStr, setTimeStr] = useState(initialTime)
```

- [ ] **Step 2: Replace the Time block** (the `{practice.data_type === 'Time' && (...)}` region — the two HH/MM inputs) with a single auto-formatting field:

```tsx
{practice.data_type === 'Time' && (
  <input
    type="text" inputMode="numeric"
    value={timeStr}
    aria-label={practice.practice}
    placeholder="HH:MM"
    className="focus:outline-none text-sm"
    style={{ ...field, width: '5rem', height: '2.25rem', color: timeStr ? ACCENT : '#9ca3af' }}
    onFocus={fieldFocus}
    onChange={(e) => setTimeStr(formatTimeInput(e.target.value))}
    onBlur={(e) => {
      fieldBlur(e)
      const parsed = parseTime(timeStr)
      if (parsed) save({ Time: parsed })   // empty/incomplete → no save (retain prior)
    }}
    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
  />
)}
```

- [ ] **Step 3: Replace the Text block** — keep the `<select>` branch for `dropdown_variants`; replace the free-text single-line `<input>` with a `<textarea>`:

```tsx
{practice.data_type === 'Text' && !practice.dropdown_variants && (
  <textarea
    defaultValue={textVal}
    placeholder="—"
    aria-label={practice.practice}
    rows={3}
    maxLength={1024}
    className="focus:outline-none text-sm w-full resize-none"
    style={{ ...field, textAlign: 'left', fontWeight: 500, padding: '0.5rem 0.625rem', color: textVal ? ACCENT : '#9ca3af' }}
    onFocus={fieldFocus}
    onBlur={(e) => { fieldBlur(e); save({ Text: e.target.value }) }}
  />
)}
```

(The existing `<select>` branch for `Text` with `dropdown_variants` stays unchanged.)

- [ ] **Step 4: Make the Text (free-text) card stack.** The card root is `<div className="rounded-2xl px-4 py-3.5 flex items-center gap-3 min-h-[60px] ...">`. For a free-text Text practice the textarea needs full width below the name. Compute once near the top of the component:

```tsx
const isFreeText = practice.data_type === 'Text' && !practice.dropdown_variants
```

Change the card root className to switch to a column layout for free text:

```tsx
className={`rounded-2xl px-4 py-3.5 gap-3 min-h-[60px] transition-all duration-300 ${isFreeText ? 'flex flex-col items-stretch' : 'flex items-center'}`}
```

The name `<span>` keeps `flex-1` on single-row cards; in the stacked case it sits on its own line above the textarea (acceptable as-is). Leave the left type-icon in place — for a stacked card it renders on the first line with the name (wrap the icon+name in a `<div className="flex items-center gap-3">` only if needed; if the current structure already renders icon then name then control in order, the column layout naturally puts icon+name+textarea stacked — verify visually and wrap icon+name in a row div if the icon/name should stay side-by-side).

- [ ] **Step 5: Update tests** — add:

```tsx
it('free-text Text renders a textarea and saves on blur', async () => {
  const { practicesApi } = await import('../../api/practices')
  renderCard({ id: '2', practice: 'Journal', data_type: 'Text', is_active: true, is_required: false })
  const ta = screen.getByRole('textbox', { name: 'Journal' })
  expect(ta.tagName).toBe('TEXTAREA')
})

it('Text with options renders a select', () => {
  renderCard({ id: '3', practice: 'Mood', data_type: 'Text', is_active: true, is_required: false, dropdown_variants: 'Good\nOkay\nLow' })
  expect(screen.getByRole('combobox', { name: 'Mood' })).toBeInTheDocument()
})

it('Time renders one field that formats and saves HH:MM', async () => {
  const { practicesApi } = await import('../../api/practices')
  vi.mocked(practicesApi.saveDiaryEntry).mockResolvedValue(undefined)
  renderCard({ id: '4', practice: 'Wake', data_type: 'Time', is_active: true, is_required: false })
  const input = screen.getByRole('textbox', { name: 'Wake' })
  await userEvent.type(input, '0630')
  expect((input as HTMLInputElement).value).toBe('06:30')
  input.blur()
  await waitFor(() => expect(practicesApi.saveDiaryEntry).toHaveBeenCalledWith(expect.any(String), 'Wake', { Time: { h: 6, m: 30 } }))
})
```

(Provide `renderCard` — a small wrapper rendering `<QueryClientProvider><MemoryRouter><PracticeCard practice={...} date="2026-08-08" currentValue={undefined} /></MemoryRouter></QueryClientProvider>` if the file doesn't already have one. Mock `../../api/practices` at the module boundary like the existing tests.)

- [ ] **Step 6: Verify** — `cd app-react && npm run test 2>&1 | tail -5 && npx tsc -b 2>&1 | grep -E "PracticeCard|inputFormat" || echo "clean"`. Expected: full suite green; no new tsc errors in touched files.

- [ ] **Step 7: Commit**

```bash
git add app-react/src/pages/home/PracticeCard.tsx app-react/src/pages/home/PracticeCard.test.tsx
git commit -m "feat(home): Time single-field + Text textarea match Rust"
```

---

## Self-Review

**Spec coverage:** Text textarea/select → Task 3 ✓; Int number/select no steppers → Task 2 ✓; Time single auto-format field → Task 1 helper + Task 3 ✓; Duration single field + quick-add, no steppers → Task 2 ✓; Bool unchanged → untouched ✓; empty Time → no save → Task 3 Step 2 ✓; helper extracted + tested → Task 1 ✓.

**Placeholder scan:** none — all steps carry concrete code. The one soft spot (Task 3 Step 4 "wrap icon+name if needed") is a visual verification instruction, acceptable for a layout tweak; the className change is concrete.

**Type consistency:** `formatTimeInput(string)→string` and `parseTime(string)→{h,m}|null` defined in Task 1 and consumed in Task 3; `save(PracticeValue)`, `fmtDur`, `field/fieldFocus/fieldBlur`, `durRef/durEl`, `intVal/textVal/timeH/timeM` are all existing symbols in `PracticeCard.tsx`; `DurationQuickAddModal` signature unchanged.

## Verification (end to end)
- `cd app-react && npm run test` green; `npx tsc -b` shows only pre-existing errors in untouched files; `npm run lint` no new errors.
- Manual on `localhost:5173`: Int = plain number (no ± buttons); Duration = text field + "+" opens the add-minutes modal; Time = one field typing `0630`→`06:30`, saved on blur; free-text Text = multiline textarea saved on blur; a Text practice configured with options still shows a dropdown; Bool toggle still works.
