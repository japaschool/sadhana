# Sadhana Pro — Landing Page Redesign

**Date:** 2026-07-15
**Branch:** lander-page
**Scope:** `static-react/` folder only

---

## Goal

Redesign the landing page from a dark/moody full-screen parallax site to a light, calm, spiritual SaaS lander using DaisyUI components on a custom amber/ivory theme. The redesign preserves all existing copy, translations (EN/RU/UK), and app screenshot assets.

---

## Visual Direction

**Personality:** Calm & spiritual — soft, minimal, wellness-brand feel (Headspace/Calm aesthetic).

**Photography:** Removed from backgrounds. Nature photos are not used. App screenshots are the primary visual assets.

**Structure:** Classic SaaS lander (fixed navbar → hero → features → screenshots → banner → footer).

---

## Color System

Custom DaisyUI theme name: `spiritual`

| Token | Hex | Use |
|---|---|---|
| `base-100` | `#FDFAF5` | Page background (ivory) |
| `base-200` | `#F5EFE3` | Card backgrounds (warm cream) |
| `base-300` | `#EDE5D4` | Dividers, subtle borders |
| `base-content` | `#2D2418` | Body text (warm dark brown) |
| `primary` | `#D4872A` | Buttons, icons, highlights (amber/gold) |
| `primary-content` | `#FFFFFF` | Text on primary elements |
| `secondary` | `#7B8F6E` | Secondary accents (sage green) |
| `secondary-content` | `#FFFFFF` | Text on secondary elements |
| `accent` | `#C4733F` | Hover states (terracotta) |
| `neutral` | `#3D3228` | Footer background (deep brown) |
| `neutral-content` | `#F5EFE3` | Footer text |

---

## Typography

- **Headings:** Playfair Display (Google Fonts, serif) — spiritual weight and elegance
- **Body:** Inter (Google Fonts, sans-serif) — clean and readable
- Loaded via `@import` in `index.css`

---

## Page Sections

### 1. Navbar
- DaisyUI `navbar` component
- Sticky, starts transparent, blurs to cream on scroll (CSS `backdrop-blur` + scroll listener)
- Left: "Sadhana Pro" wordmark in Playfair Display
- Right: Telegram icon link, YouTube icon link, language `dropdown` (DaisyUI), "Open App" amber `btn`

### 2. Hero
- Full-width, centered layout
- Large Playfair Display headline (`landing.title`, `landing.subtitle`)
- Body paragraph (`landing.description`)
- Single amber CTA button → language-aware app URL (same logic as current `FloatingCTA`)
- Background: subtle low-opacity mandala/lotus SVG watermark (inline SVG, `opacity-5`)

### 3. Key Features Grid
- Section heading from `keyFeatures.title`
- Responsive grid: 1 col (mobile) → 2 col (tablet) → 3 col (desktop)
- 7 DaisyUI `card` components, one per feature
- Each card: icon (amber or sage tinted), bold title, light description
- Cards fade-in staggered using Framer Motion `whileInView`

### 4. App Screenshots Carousel
- Section heading from `preview.title`
- DaisyUI radio-based `carousel` with 8 slides
- Each slide: screenshot image (rounded, soft shadow) + caption text below
- Background: soft base-200 cream gradient

### 5. Track Anything Banner
- Full-width section
- Warm amber gradient background (`from-amber-500 to-amber-700` or equivalent custom tokens)
- Large centered Playfair Display quote from `trackAnything` + `trackAnythingText`
- White outline "Open App" button (language-aware URL)

### 6. Footer
- DaisyUI `footer` component
- `neutral` (deep brown) background
- Copyright text from `footer.copyright`
- Telegram + YouTube social links

---

## Animations

Framer Motion is kept but simplified — no more parallax or full-screen scroll effects:

| Element | Animation |
|---|---|
| Hero content | `opacity: 0 → 1`, `y: 20 → 0` on mount, duration 0.8s |
| Feature cards | Staggered `whileInView` fade+slide-up, `staggerChildren: 0.08s` |
| Banner content | `whileInView` fade-in, duration 0.6s |

Lenis smooth scroll is preserved.

---

## Components — File Map

| New file | Replaces |
|---|---|
| `components/Navbar.tsx` | `FloatingHeaderButtons.tsx` |
| `components/Hero.tsx` | `LandingView.tsx` |
| `components/FeaturesGrid.tsx` | `ParallaxSection.tsx` (features usage) |
| `components/ScreenshotsCarousel.tsx` | `ParallaxCarouselSection.tsx` + `Carousel.tsx` |
| `components/TrackBanner.tsx` | `ParallaxSection.tsx` (track anything usage) |
| `components/Footer.tsx` | `Footer.tsx` (rewrite in place) |

**Deleted:** `ParallaxSection.tsx`, `ParallaxCarouselSection.tsx`, `Carousel.tsx`, `GlassBox.tsx`, `Section.tsx`, `FloatingCTA.tsx`, `App.css`

`App.tsx` is rewritten to compose the new components in order.

---

## DaisyUI Installation

DaisyUI v5 is added as a Tailwind v4 CSS plugin (Tailwind v4 does not use `tailwind.config.cjs` for plugins):

```
npm install daisyui@latest
```

In `src/index.css`:
```css
@plugin "daisyui" {
  themes: ["spiritual"];
}
```

The `spiritual` theme is defined as a DaisyUI custom theme object in the same CSS file using `@plugin "daisyui/theme"` or via the inline theme config object, setting the tokens from the Color System table above.

---

## i18n

All translation keys and files remain untouched. Components use the same `useTranslation()` hooks with identical key references.

---

## Out of Scope

- No new translation keys
- No backend changes
- No routing changes
- No new pages
- Nature background photos are not deleted (kept in `/assets` in case needed later), just not referenced
