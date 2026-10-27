# Sadhana Pro — Landing Page Redesign (Giga-style, dark cinematic)

**Date:** 2026-08-10
**Scope:** Rebuild the marketing landing page in `static-react/` to match the visual structure and UX of the Giga landing page (dark, cinematic, sectioned), with **Sadhana Pro content**. Reuse the existing Vite + React 19 + Tailwind 4 + framer-motion + Lenis + i18n stack. No backend changes; `app-react/` (the dashboard) is untouched.

## Context

`static-react/` is Sadhana Pro's landing site. It already uses **Playfair Display** (serif display) + **Inter** (body), dark hero imagery with gradient overlays, framer-motion, and Lenis smooth scroll (`@studio-freight/lenis`). Existing section components (`Hero`, `Navbar`, `StatsStrip`, `FeatureRows`, `FeaturesGrid`, `TriplePhones`, `ParallaxSection`, `Footer`, …) will be replaced/reworked to match the Giga structure. Copy is i18n-driven (`landing.*` keys, locales `en`/`ru`/`uk`).

Reference: the Giga page — hero over a mountain photo, a trusted-by logo strip, a stats row, a "Built to handle complexity" feature row, three alternating split sections (Agent Canvas / Smart Insights / Voice Experience) pairing a text+step-list with a dark UI mockup or cinematic photo, a **light** customer-spotlight testimonial, a final CTA with a faint wordmark watermark, and a dark footer.

**Decisions (from brainstorming):** Giga's layout + dark look, **Sadhana content**; **replace** the current landing; **reuse existing images + CSS gradients**; **warm-neutral/amber** accent (not teal); no fake brand logos in the social strip.

## Design tokens (dark)

- Backgrounds: base `#0b0b0d`; sections layer pure black over imagery with gradient overlays; one **light** section `#f5f3ee` (testimonial).
- Text: primary `#f5f4f2`, muted `rgba(255,255,255,0.55)`; on the light section, `#1c1c1e` / `#6b6862`.
- Accent: warm amber `#c8724a` — used only for the small section-label dot and subtle hovers (Giga-like restraint).
- Type: Playfair Display for display headings; Inter for body/labels/UI (both already loaded).
- Buttons: white **pill** primary (`bg-white text-black rounded-full`), ghost/outline secondary.
- Section label pattern: `• CUSTOM AGENTS`-style — an amber dot + 11px uppercase tracked label.

## Sections (top → bottom)

Concrete English copy below is authoritative; `ru`/`uk` translations are added during implementation.

1. **Navbar** — fixed; transparent over hero, solid dark on scroll. Left: Sadhana logo (serif). Center/right: links (Features, Practices, Charts), "Sign in", white pill **Get started**. Mobile: collapses to logo + pill (hamburger optional/omitted).
2. **Hero** — full-bleed dark landscape (`1.jpg`, the current landing background) + top-to-bottom gradient. Pill badge: "New · Group yatras". Serif headline (2 lines): **"Practice with intention." / "Track what truly matters."** Subtext: "Sadhana Pro helps you build lasting spiritual habits — log daily, join group yatras, and watch your progress unfold." Primary pill **Get started**.
3. **Social strip** (dark, thin) — no fake logos: one restrained line, "Trusted by practitioners building a steady daily sadhana." (muted, centered).
4. **Stats strip** — left intro: "Everything you need to sustain a practice — from first log to long-term insight." Right: three big serif stats — **5** practice types · **3** languages · **100%** offline-first.
5. **Feature row — "Built for daily practice"** — label `• CORE`, serif heading, 4 columns: **Custom practices** ("Track anything: minutes, counts, times, notes, or simple done/not."), **Offline-first** ("Log anywhere; changes sync when you're back online."), **Group yatras** ("Practice together and see the group's stability at a glance."), **Insightful charts** ("Turn daily logs into trends that keep you going.").
6. **Split A — "Your practice canvas"** (text left / mockup right) — label `• PRACTICES`; description "Shape a practice that fits your life. Add what you want to track, mark what's required, and log it in seconds each day."; ghost button "Explore practices"; vertical step list: **Add practices · Mark what's required · Log daily · Review trends**. Right: dark mockup card = `shot-add-practice.jpg` (or `shot-home.jpg`) framed over imagery.
7. **Split B — "See your progress"** (mockup left / text right, mirrored) — label `• INSIGHTS`; description "Charts turn your daily logs into patterns — so you can see what's working and adjust."; button "Explore charts"; steps: **Pick practices · Choose a range · Read the trend · Adjust your routine**. Left mockup: `shot-charts.jpg`.
8. **Split C — "Practice together"** (text left / photo right) — label `• YATRAS`; description "Join a yatra to share the journey — see each member's consistency and encourage one another."; button "Explore yatras"; right: cinematic photo (`shot-group.jpg` or `crowded-scene-indian-city.jpg`) with a small decorative pill ("Yatra").
9. **Testimonial spotlight** (LIGHT section) — heading "How practitioners built a lasting sadhana"; one card: image (`crowded-scene-indian-city.jpg`) with a corner stat "365 days", quote "Sadhana turned scattered intentions into a steady daily rhythm — watching the streak build keeps me honest.", attribution "Illustrative — a Sadhana practitioner". (Clearly generic; no real person.)
10. **CTA** — dark; serif heading "Ready to deepen your practice?"; subtext "Start tracking today — it's free."; white pill **Get started**; faint oversized "Sadhana" serif wordmark watermark behind.
11. **Footer** — dark; logo + three link columns — **Product** (Practices, Charts, Yatras), **Company** (About, Contact), **Resources** (Help, Privacy) — and "© 2026 Sadhana Pro".

## Reusable unit

- **`SplitSection`** component powers sections 6–8: props `{ label, title, description, ctaLabel, ctaHref, steps: string[], media: ReactNode, reverse: boolean }`. Keeps the three splits DRY and independently testable-by-inspection.
- **`SectionLabel`** (amber dot + uppercase label), **`Stat`**, and **`FeatureColumn`** are small shared presentational pieces.
- **`Pill`** button (white primary / ghost) shared across hero/nav/CTA.

## Assets

Reuse only what exists in `static-react/src/assets/` (verify exact filenames before wiring): `1.jpg` (hero), `shot-add-practice.jpg`/`shot-home.jpg`, `shot-charts.jpg`, `shot-group.jpg`, `crowded-scene-indian-city.jpg` (testimonial + Split C). Dark gradient overlays (`bg-linear-to-b from-black/80 …`) supply cinematic depth. No new downloads.

## Component structure

Under `static-react/src/components/`:
- **New:** `SplitSection.tsx`, `SocialStrip.tsx`, `TestimonialSpotlight.tsx`, `CtaSection.tsx`, `SectionLabel.tsx`, `Pill.tsx` (+ small `Stat`/`FeatureColumn`, may be inline).
- **Reworked:** `Navbar.tsx` (scroll-solidify + pill), `Hero.tsx` (badge + 2-line serif + pill), `StatsStrip.tsx`, `FeatureRows.tsx`/`FeaturesGrid.tsx` → the "Built for daily practice" row, `Footer.tsx` (three columns).
- **Composition:** `App.tsx` / `LandingView.tsx` renders the new section order; keep the Lenis provider and framer-motion. Retire now-unused components (`TriplePhones`, `ParallaxSection`, `PhoneCarousel`, `ScreenshotsCarousel`, `PracticeCategories`, etc.) from the render — delete only those no longer referenced.

## Animation & responsive

- framer-motion `whileInView` fade/rise reveals on section entry (once, small `y`), consistent with the app's subtle motion; keep the hero's slow bg zoom. Lenis stays for smooth scroll.
- Fully responsive: splits stack to single column on mobile (media below text), the feature row goes 1→2→4 columns, stats stack, nav collapses to logo + pill. Mobile-first Tailwind.

## i18n

All copy under `landing.*` (nav, hero, social, stats, features, splitA/B/C, testimonial, cta, footer) added to **all three** locale files (`public/locales/{en,ru,uk}/translation.json`) with real ru/uk translations. English strings above are the source.

## Verification

`static-react/` has no unit-test harness (lint + build only):
- `cd static-react && npm run build` (tsc + vite) succeeds.
- `npm run lint` clean.
- `npm run dev` → visual pass at desktop and mobile widths: hero, sticky-solidifying nav, the three alternating splits, the light testimonial, CTA watermark, footer; scroll-reveal animations fire; images load with overlays.

## Non-goals

No backend/app-react changes; no new dependencies; no real third-party logos or real people in testimonials; no new photography (reuse existing assets). Not a pixel-perfect Giga clone — it's Giga's structure/UX with Sadhana content.
