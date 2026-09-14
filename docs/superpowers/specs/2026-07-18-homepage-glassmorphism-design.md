---
name: homepage-glassmorphism-design
description: Glassmorphism redesign of the Home page (daily practice tracker) — frosted glass cards, photo background, glass chrome bars
metadata:
  type: project
---

# Home Page — Glassmorphism Redesign

## Goal

Bring the home page visual language in line with the auth screens (login, register, create account): same `login-bg.jpg` full-bleed background, frosted glass cards, teal accent, serif headline. The result should feel premium and calm — appropriate for a daily spiritual practice app.

---

## Scope

Files changed:

| File | Change |
|------|--------|
| `src/components/layout/AppShell.tsx` | Add background image + overlay; remove `bg-base-200` |
| `src/components/layout/TopBar.tsx` | Glass bar treatment |
| `src/components/layout/BottomNav.tsx` | Glass bar treatment |
| `src/pages/home/HomePage.tsx` | Date nav, empty state, FAB — glassmorphism |
| `src/pages/home/PracticeCard.tsx` | Glass card + glass inputs per data type |

---

## Design Tokens (inline styles, consistent with auth pages)

```
Glass card:
  background: rgba(255,255,255,0.55)
  backdropFilter: blur(32px)
  border: 1px solid rgba(255,255,255,0.75)
  boxShadow: 0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9)
  borderRadius: 1.25rem (rounded-2xl)

Glass bar (TopBar / BottomNav):
  background: rgba(255,255,255,0.45)
  backdropFilter: blur(24px)
  border-bottom/top: 1px solid rgba(255,255,255,0.35)

Glass input:
  background: rgba(255,255,255,0.6)
  border: 1px solid rgba(0,0,0,0.10)
  borderRadius: 0.75rem (rounded-xl)
  focus border: rgba(99,102,241,0.5)

Teal primary:
  gradient: linear-gradient(135deg, #02c9a3 0%, #01a386 100%)
  text on teal: #134e4a
  shadow: 0 4px 20px rgba(45,212,191,0.35)
  accent color: #01a386

Overlay:
  background: rgba(0,0,0,0.30)
```

---

## AppShell

- Remove `bg-base-200`
- Add `relative` positioning
- Mount background as a pseudo-layer:
  - `style={{ backgroundImage: 'url(/login-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}`
  - Dark overlay `<div className="absolute inset-0 bg-black/30 pointer-events-none z-0" />`
- `<main>` and fixed bars sit above `z-0`

---

## TopBar

- Replace `bg-base-100 border-b border-base-300` with glass bar styles (inline)
- "Sadhana Pro" serif text: `font-serif text-base-content` (dark on frosted glass — readable)
- Page `title` prop text: `text-base-content font-semibold`
- Back chevron and right-slot icons: `text-base-content/80`
- The bar is already `fixed top-0 z-40` — no change needed there

---

## BottomNav

- Replace `bg-base-100 border-t border-base-300` with glass bar styles (inline)
- Active tab: `#01a386` (teal) instead of current `text-primary`
- Inactive tab: `text-white/60` — legible against the blurred photo

---

## HomePage

### Layout

```
[TopBar — glass, fixed]
[scrollable content: pt-14 pb-16 px-4 py-4]
  [offline banner — if applicable]
  [date navigator]
  [practice cards list]
  [empty state — if no practices]
[FAB — fixed bottom-20 right-4]
[BottomNav — glass, fixed]
```

### Date Navigator

- Centered row: `←  Jul 18  →`
- Date label: `font-serif font-extralight text-white text-base tracking-wide` — white text readable over dark overlay
- Arrows: ghost icon buttons `text-white/70 hover:text-white`
- No card/box around it — floats naturally in the content area

### Practice Cards

Each `PracticeCard` becomes:

```
<div style={glassCard} className="rounded-2xl p-4 flex flex-col gap-3">
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-semibold text-base-content">{practice.practice}</h3>
    {hasValue && <span className="w-2 h-2 rounded-full bg-[#01a386]" />}  {/* teal dot */}
  </div>
  [input control for data_type]
</div>
```

**Input controls per data_type:**

- **Bool:** Native `<input type="checkbox">` styled as a pill toggle via Tailwind (`w-11 h-6 rounded-full appearance-none bg-black/10 checked:bg-[#01a386] relative cursor-pointer transition-colors` with a white thumb pseudo-element via `before:` utilities). This avoids DaisyUI theme dependency.
- **Int:** Two ghost circle buttons (− / +) with glass-input number field. Buttons use `text-[#01a386]`.
- **Text:** Glass input (`rounded-xl bg-white/60 border border-black/10 h-10 px-3 text-sm`)
- **Duration:** Glass input + "min" label in `text-base-content/50`
- **Time:** Two glass inputs (HH / MM) separated by a bold `:` — same style

All inputs: `focus:outline-none focus:border-indigo-400/50` (matching auth pages)

### Empty State

```
<div className="text-center py-12 flex flex-col gap-4">
  <p className="text-white/70 text-sm">{t('home.noPractices')}</p>
  <button style={tealPill} className="mx-auto px-6 h-11 rounded-full text-sm font-semibold">
    {t('home.addFirst')}
  </button>
</div>
```

### Offline Banner

- Keep alert but style: `bg-white/40 backdrop-blur-sm border border-white/30 text-base-content rounded-xl text-sm px-4 py-3`

### FAB (Floating Action Button)

- Replace `btn btn-primary btn-circle btn-lg` with:
  ```
  style={{
    background: 'linear-gradient(135deg, #02c9a3 0%, #01a386 100%)',
    boxShadow: '0 4px 24px rgba(45,212,191,0.45)',
    width: '3.5rem', height: '3.5rem',
    borderRadius: '50%',
  }}
  ```
- White `+` icon (`text-white`)
- Position: `fixed bottom-20 right-4 z-30` (unchanged)

---

## UX Considerations

- **Readability:** Dark overlay (`bg-black/30`) ensures glass cards and white text are legible over any photo region. Cards at `bg-white/55` provide sufficient contrast for dark input text.
- **Touch targets:** All interactive controls (toggle, stepper buttons, inputs) keep minimum 44px touch area.
- **Loading state:** `Spinner` replaced with a subtle teal spinner (`text-[#01a386]`) centered on the page — no card around it, just floats over the photo.
- **Debounce on save:** Existing 600ms debounce on input changes is preserved — no regression.
- **Safe area insets:** BottomNav keeps `pb-[env(safe-area-inset-bottom)]` for iOS notch.
- **Performance:** `backdropFilter` is GPU-accelerated on modern browsers/devices; fallback is opaque white at `@supports not (backdrop-filter: blur())`.

---

## Non-Goals

- No changes to other pages (Charts, Settings, Yatras) beyond what AppShell/TopBar/BottomNav automatically provides.
- No new API calls or data model changes.
- No animations or transitions beyond what already exists.
