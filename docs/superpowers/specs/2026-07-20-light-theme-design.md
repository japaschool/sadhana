---
name: light-theme-design
description: Pivot from dark glassmorphism to a light airy theme — white overlay over photo, nav links in TopBar, BottomNav removed
metadata:
  type: project
---

# Light Theme Redesign

## Goal

Pivot the Sadhana app from the current dark-photo + dark-overlay glassmorphism look to a light, airy theme inspired by InsightTimer's clean aesthetic. The background photo is kept but tinted with a white overlay so it reads as a soft watercolor wash. All navigation moves into the TopBar. The BottomNav is removed.

---

## Design Tokens

```
Light overlay:        rgba(255, 255, 255, 0.55)   — replaces bg-black/30
TopBar glass bg:      rgba(255, 255, 255, 0.70) + blur(24px)
Card glass bg:        rgba(255, 255, 255, 0.90) + blur(16px)
Card border:          1px solid rgba(255, 255, 255, 0.80)
Card shadow:          0 4px 16px rgba(0, 0, 0, 0.08)
Active nav color:     #01a386  (teal — unchanged)
Inactive nav color:   rgba(0, 0, 0, 0.40)  (gray)
Dark text (general):  text-gray-700 / text-gray-800
Muted text:           text-gray-500
Teal gradient:        linear-gradient(135deg, #02c9a3 0%, #01a386 100%)  (unchanged)
```

---

## Files Changed

| File | Action |
|------|--------|
| `src/components/layout/AppShell.tsx` | Swap dark overlay for white; remove BottomNav; remove `pb-16` |
| `src/components/layout/TopBar.tsx` | Add responsive nav links on the right |
| `src/components/layout/BottomNav.tsx` | **Delete** |
| `src/pages/home/HomePage.tsx` | Date nav text → dark; FAB position → `bottom-6`; empty state text → dark |
| `src/pages/home/PracticeCard.tsx` | Lighter glass tokens |
| Auth pages | **Untouched** — login/register keep dark overlay |

---

## AppShell

- Remove the `bg-black/30` fixed overlay div
- Add a `bg-white/55` fixed overlay div (same layer approach)
- Remove `<BottomNav />` import and usage
- Change `<main className="pt-14 pb-16">` → `<main className="pt-14">`

```tsx
export function AppShell() {
  return (
    <div className="relative">
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: 'url(/login-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="fixed inset-0 -z-10 pointer-events-none" style={{ background: 'rgba(255,255,255,0.55)' }} />
      <TopBar />
      <main className="pt-14">
        <Outlet />
      </main>
    </div>
  )
}
```

---

## TopBar

### Layout

```
[ Sadhana Pro (serif, left) ]  ···  [ Home · Charts · Yatras · Settings (right) ] [ right slot ]
```

### Responsive nav links

- **`sm:` and above (≥ 640px):** Text links — "Home", "Charts", "Yatras", "Settings"
- **Below `sm:` (< 640px):** Icons only — FaHome, FaChartBar, FaUsers, FaCog (same icons as old BottomNav)
- Active link: `color: #01a386` + `text-decoration: underline`
- Inactive link: `color: rgba(0,0,0,0.40)`

### Back-button mode

When `showBack={true}`: nav links are hidden, back chevron appears on the left (same as before).

### Right slot

The `right` prop (e.g. refresh button in HomePage) sits to the right of the nav links.

### Glass style

```
background: rgba(255, 255, 255, 0.70)
backdropFilter: blur(24px)
borderBottom: 1px solid rgba(255, 255, 255, 0.50)
```

### Implementation note

The 4 nav items live inside TopBar itself (not imported from BottomNav). Use a small inline `navItems` array identical to the old `tabs` array in BottomNav.

---

## BottomNav

Deleted. No replacement needed — navigation is now entirely in TopBar.

The `BottomNav.test.tsx` file should also be deleted (or kept with a note that the component no longer exists). Deleting it is cleaner.

---

## HomePage

- Date navigator arrows: `text-gray-500 hover:text-gray-800` (was `text-white/80`)
- Date label: `font-serif font-extralight text-gray-700 tracking-wide` (was `text-white`)
- FAB: move from `bottom-20` to `bottom-6` (no BottomNav to clear)
- Empty state text: `text-gray-500` (was `text-white/70`)
- Offline banner: already uses glass style — keep, just inherits lighter overall look

---

## PracticeCard

Updated glass tokens only — no logic or structure changes:

```
background: rgba(255, 255, 255, 0.90)   (was 0.55)
backdropFilter: blur(16px)               (was 32px)
border: 1px solid rgba(255,255,255,0.80) (was 0.75)
boxShadow: 0 4px 16px rgba(0,0,0,0.08)  (was 0 8px 32px rgba(0,0,0,0.18), inset ...)
```

All text, input controls, teal accents, and toggle styles are unchanged.

---

## Other Pages (Charts, Yatras, Settings, Help)

No changes needed — these pages render inside AppShell and automatically inherit the light overlay. Any existing content that uses `text-base-content` stays readable since the overlay is now light (bg light → dark text reads fine).

---

## Tests

- Delete `BottomNav.test.tsx` (component is gone)
- All other tests should pass unchanged
- Expected after changes: all remaining tests pass

---

## Non-Goals

- No changes to auth pages (login, register, confirmation)
- No new pages or routes
- No changes to data fetching, API, or business logic
- No animations or transitions beyond existing
