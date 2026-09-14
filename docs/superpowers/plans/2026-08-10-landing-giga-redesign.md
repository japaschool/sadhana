# Landing Redesign (Giga-style, dark) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `static-react/` (Sadhana Pro's landing) with the Giga page's dark, cinematic, sectioned UI/UX and Sadhana content.

**Architecture:** Build the new dark section components first (the live site keeps rendering the old landing), then rewire `App.tsx` to compose them in the final task. Reuse the existing Vite/React 19/Tailwind 4/framer-motion/Lenis/i18n stack, Playfair Display + Inter fonts, and existing image assets. A reusable `SplitSection` powers the three alternating feature sections.

**Tech Stack:** React 19, TypeScript, Tailwind 4, framer-motion, `@studio-freight/lenis`, react-i18next. **No test harness** in `static-react` — verification is `npm run build` + `npm run lint` + a dev visual pass.

**Spec:** `docs/superpowers/specs/2026-08-10-landing-giga-redesign-design.md` (authoritative for copy + section content).

## Global Constraints

- Work only in `static-react/`. No changes to `app-react/`, `server/`, or `frontend/`. No new dependencies.
- Dark tokens: bg `#0b0b0d`; text `#f5f4f2` / muted `rgba(255,255,255,0.55)`; accent amber `#c8724a`; one light section `#f5f3ee` (text `#1c1c1e`). Fonts: Playfair Display (display) / Inter (body) — already loaded.
- All copy via `t('landing.*')` added to **all three** locales `public/locales/{en,ru,uk}/translation.json`; English source is in the spec; provide real ru/uk (not English placeholders).
- Reuse only existing assets in `static-react/src/assets/` (`1.jpg`, `shot-add-practice.jpg`, `shot-charts.jpg`, `shot-group.jpg`, `shot-home.jpg`, `crowded-scene-indian-city.jpg`, `logo.png`). No new images; no real third-party logos or real people.
- Each task ends green on `cd static-react && npm run build && npm run lint`.
- The site must keep building/rendering the existing landing until Task 8 rewires `App.tsx`.

---

### Task 1: Shared primitives — `Pill`, `SectionLabel`

**Files:** Create `static-react/src/components/Pill.tsx`, `static-react/src/components/SectionLabel.tsx`.

- [ ] **Step 1: `Pill.tsx`** — white/ghost pill button that renders as `<a>`.

```tsx
type PillProps = { href: string; children: React.ReactNode; variant?: 'solid' | 'ghost'; className?: string }
export function Pill({ href, children, variant = 'solid', className = '' }: PillProps) {
  const base = 'inline-flex items-center justify-center rounded-full px-5 h-10 text-sm font-medium transition-colors no-underline'
  const styles = variant === 'solid'
    ? 'bg-white text-black hover:bg-white/90'
    : 'border border-white/25 text-white hover:bg-white/10'
  return <a href={href} className={`${base} ${styles} ${className}`}>{children}</a>
}
```

- [ ] **Step 2: `SectionLabel.tsx`** — amber dot + uppercase tracked label.

```tsx
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#c8724a' }} />
      {children}
    </span>
  )
}
```

- [ ] **Step 3: Verify** — `cd static-react && npm run build && npm run lint` → succeeds (files compile; unused until later tasks is fine — they're exported modules).
- [ ] **Step 4: Commit** — `git add static-react/src/components/Pill.tsx static-react/src/components/SectionLabel.tsx && git commit -m "feat(landing): shared Pill + SectionLabel primitives"`

---

### Task 2: `Navbar` + `Hero` (dark)

**Files:** Rework `static-react/src/components/Navbar.tsx`; rework `static-react/src/components/Hero.tsx`. Add i18n keys.

**Interfaces:** Consumes `Pill` (Task 1). Neither is wired into `App` yet.

- [ ] **Step 1: Navbar** — `fixed top-0 inset-x-0 z-50`; transparent initially, solidify on scroll via a scroll listener toggling `bg-[#0b0b0d]/80 backdrop-blur border-b border-white/10`. Left: `logo.png` (or serif "Sadhana"). Right (desktop `hidden md:flex`): links `t('landing.nav.features')`, `t('landing.nav.practices')`, `t('landing.nav.charts')` (anchor hrefs `#features`/`#practices`/`#charts`), a text "Sign in" link (`href={SIGNIN_URL}`), and `<Pill href={APP_URL}>{t('landing.nav.getStarted')}</Pill>`. Mobile: logo + Pill only. Use `APP_URL`/`SIGNIN_URL` constants at top of the file (point to the app root `/` and `/login` on the app domain, or `#` placeholders — match any existing URL the current Navbar uses).

- [ ] **Step 2: Hero** — `relative min-h-[100dvh] flex items-center` with `1.jpg` bg (`bg-cover bg-center`, keep the slow `initial scale 1.1 → 1` motion) + gradient overlay `bg-linear-to-b from-black/70 via-black/40 to-black/85`. Centered content: a pill **badge** (`inline-flex ... rounded-full border border-white/20 text-white/80 text-xs px-3 py-1` → `t('landing.hero.badge')`), a two-line Playfair headline (`font-serif text-4xl md:text-6xl lg:text-7xl leading-[1.05] text-white`) rendering `t('landing.hero.title1')` / `t('landing.hero.title2')` on separate lines, subtext (`text-white/70 max-w-xl` → `t('landing.hero.subtitle')`), and `<Pill href={APP_URL}>{t('landing.hero.cta')}</Pill>`. framer-motion fade-rise on content.

- [ ] **Step 3: i18n** — add to en/ru/uk under `landing`:
  `nav: { features, practices, charts, signIn, getStarted }`, `hero: { badge, title1, title2, subtitle, cta }`. English values from the spec (title1 "Practice with intention.", title2 "Track what truly matters.", badge "New · Group yatras", subtitle per spec, cta "Get started", nav labels "Features/Practices/Charts/Sign in/Get started"). Provide accurate ru/uk.

- [ ] **Step 4: Verify** — `npm run build && npm run lint` green.
- [ ] **Step 5: Commit** — `git commit -m "feat(landing): dark Navbar + Hero"`

---

### Task 3: `SocialStrip` + `StatsStrip` (dark)

**Files:** Create `static-react/src/components/SocialStrip.tsx`; rework `static-react/src/components/StatsStrip.tsx`. Add i18n.

- [ ] **Step 1: SocialStrip** — thin dark band (`py-8 border-y border-white/5`), one centered muted line `text-white/45 text-sm` → `t('landing.social.line')` ("Trusted by practitioners building a steady daily sadhana."). No logos.

- [ ] **Step 2: StatsStrip** — dark section `py-16`; two-column on desktop (`md:grid-cols-2`): left intro `text-white/70 max-w-sm` → `t('landing.stats.intro')`; right a `grid grid-cols-3 gap-8` of three stats, each: big serif value (`font-serif text-4xl text-white`) + small uppercase label (`text-[11px] uppercase tracking-wide text-white/50`). Values/labels: `5`/`t('landing.stats.typesLabel')` ("practice types"), `3`/`t('landing.stats.langLabel')` ("languages"), `100%`/`t('landing.stats.offlineLabel')` ("offline-first").

- [ ] **Step 3: i18n** — `social: { line }`, `stats: { intro, typesLabel, langLabel, offlineLabel }` (en/ru/uk).
- [ ] **Step 4: Verify + Commit** — build+lint green; `git commit -m "feat(landing): social strip + dark stats"`.

---

### Task 4: Feature row — "Built for daily practice"

**Files:** Create `static-react/src/components/FeatureRow.tsx` (or rework `FeaturesGrid.tsx`). Add i18n.

- [ ] **Step 1** — dark section (`id="features" py-24`): `SectionLabel` → `t('landing.features.label')` ("Core"); Playfair heading `font-serif text-3xl md:text-5xl text-white` → `t('landing.features.title')` ("Built for daily practice"); a `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8` of four columns. Each column: an icon (react-icons, e.g. `FaSeedling/FaWifi/FaUsers/FaChartBar`) in amber, a bold white title, a muted `text-white/60` description. Four items → keys `features.items.{custom,offline,yatras,charts}.{title,desc}` (copy from spec §5).

- [ ] **Step 2: i18n** — `features: { label, title, items: { custom:{title,desc}, offline:{title,desc}, yatras:{title,desc}, charts:{title,desc} } }` (en/ru/uk).
- [ ] **Step 3: Verify + Commit** — build+lint; `git commit -m "feat(landing): 'Built for daily practice' feature row"`.

---

### Task 5: `SplitSection` + three splits

**Files:** Create `static-react/src/components/SplitSection.tsx`; create `static-react/src/components/FeatureSplits.tsx` (wires the three). Add i18n.

**Interfaces:** Produces `SplitSection` with props `{ id?: string; label: string; title: string; description: string; ctaLabel: string; ctaHref: string; steps: string[]; media: React.ReactNode; reverse?: boolean }`.

- [ ] **Step 1: `SplitSection.tsx`**

```tsx
import { motion } from 'framer-motion'
import { SectionLabel } from './SectionLabel'
import { Pill } from './Pill'

type Props = {
  id?: string; label: string; title: string; description: string
  ctaLabel: string; ctaHref: string; steps: string[]; media: React.ReactNode; reverse?: boolean
}
export function SplitSection({ id, label, title, description, ctaLabel, ctaHref, steps, media, reverse }: Props) {
  return (
    <section id={id} className="py-20 md:py-28 px-6 md:px-10 max-w-6xl mx-auto">
      <div className={`grid gap-10 md:gap-14 items-center md:grid-cols-2 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5 }}
          className="flex flex-col gap-5"
        >
          <SectionLabel>{label}</SectionLabel>
          <h2 className="font-serif text-3xl md:text-4xl text-white leading-tight">{title}</h2>
          <p className="text-white/60 max-w-md">{description}</p>
          <Pill href={ctaHref} variant="ghost" className="self-start">{ctaLabel}</Pill>
          <ul className="mt-4 flex flex-col divide-y divide-white/10 border-t border-white/10">
            {steps.map((s) => (
              <li key={s} className="py-3 text-sm text-white/70">{s}</li>
            ))}
          </ul>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5, delay: 0.05 }}
        >
          {media}
        </motion.div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: `FeatureSplits.tsx`** — renders three `SplitSection`s from spec §6–8, using `t('landing.splitA/B/C.*')` and a `media` per split: a framed dark mockup card, e.g.
```tsx
const mockup = (src: string) => (
  <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/40">
    <img src={src} alt="" className="w-full h-auto block" />
  </div>
)
```
  - Split A `id="practices"`, `reverse={false}`, media `mockup(shotAddPractice)`, steps = 4 from spec.
  - Split B `id="charts"`, `reverse={true}`, media `mockup(shotCharts)`, steps = 4.
  - Split C `id="yatras"`, `reverse={false}`, media = `crowded-scene` or `shot-group` photo in a rounded frame with a small absolute "Yatra" pill; steps optional (may pass `[]` and the `<ul>` renders empty — or omit list by passing empty array; keep list for A/B only, C can pass `steps={[]}`).
  Import assets: `import shotAddPractice from '../assets/shot-add-practice.jpg'` etc.

- [ ] **Step 3: i18n** — `splitA: { label, title, description, cta, steps: string[] }`, `splitB: {…}`, `splitC: { label, title, description, cta }` (en/ru/uk). For `steps` arrays use `t('...', { returnObjects: true })` or index keys `step1..step4`; prefer explicit `step1..4` string keys to avoid array-return typing issues.

- [ ] **Step 4: Verify + Commit** — build+lint; `git commit -m "feat(landing): SplitSection + Practices/Insights/Yatras splits"`.

---

### Task 6: `TestimonialSpotlight` (light) + `CtaSection`

**Files:** Create `static-react/src/components/TestimonialSpotlight.tsx`, `static-react/src/components/CtaSection.tsx`. Add i18n.

- [ ] **Step 1: TestimonialSpotlight** — **light** section `bg-[#f5f3ee] text-[#1c1c1e] py-24 px-6`. Heading Playfair `text-3xl md:text-4xl` → `t('landing.testimonial.heading')`. One card `grid md:grid-cols-2 rounded-2xl overflow-hidden border border-black/5 bg-white`: left `crowded-scene-indian-city.jpg` (`object-cover h-full`) with a small corner stat chip "365 days"; right padding-6 with the quote (`text-lg`), attribution (`text-sm text-black/50` → `t('landing.testimonial.author')`). Copy from spec §9.

- [ ] **Step 2: CtaSection** — dark `relative py-28 text-center overflow-hidden`. Faint watermark: an absolutely-positioned Playfair "Sadhana" `text-[22vw] text-white/[0.04] select-none pointer-events-none` centered behind. Foreground: Playfair heading → `t('landing.cta.title')`, muted subtext → `t('landing.cta.subtitle')`, `<Pill href={APP_URL}>{t('landing.cta.button')}</Pill>`.

- [ ] **Step 3: i18n** — `testimonial: { heading, quote, author, stat }`, `cta: { title, subtitle, button }` (en/ru/uk).
- [ ] **Step 4: Verify + Commit** — build+lint; `git commit -m "feat(landing): testimonial spotlight + CTA"`.

---

### Task 7: `Footer` (dark, three columns)

**Files:** Rework `static-react/src/components/Footer.tsx`. Add i18n.

- [ ] **Step 1** — dark `bg-[#0b0b0d] border-t border-white/10 py-16 px-6`. Top: logo/serif "Sadhana". Grid `grid-cols-2 md:grid-cols-4 gap-8`: brand blurb + three link columns — Product (`t('landing.footer.product.*')`: Practices/Charts/Yatras), Company (About/Contact), Resources (Help/Privacy). Bottom row: `t('landing.footer.copyright')` ("© 2026 Sadhana Pro"). Links muted `text-white/55 hover:text-white`.
- [ ] **Step 2: i18n** — `footer: { product:{title,practices,charts,yatras}, company:{title,about,contact}, resources:{title,help,privacy}, copyright }` (en/ru/uk).
- [ ] **Step 3: Verify + Commit** — build+lint; `git commit -m "feat(landing): dark three-column footer"`.

---

### Task 8: Compose in `App.tsx` + retire old sections + final verify

**Files:** Rewrite `static-react/src/App.tsx`; delete now-unused components.

- [ ] **Step 1: Rewrite `App.tsx`** — dark shell `<div className="relative font-sans bg-[#0b0b0d] text-[#f5f4f2] overflow-x-hidden">`; keep the `useEffect` that sets `document.title`/meta from `t('meta.*')`; keep the Lenis setup (if it lives here or in `main.tsx` — leave `main.tsx` untouched). Render in order: `<Navbar/> <Hero/> <SocialStrip/> <StatsStrip/> <FeatureRow/> <FeatureSplits/> <TestimonialSpotlight/> <CtaSection/> <Footer/>`. Remove imports/usage of the old sections (`ParallaxSection`, `ParallaxCarouselSection`, `FloatingCTA`, `FloatingHeaderButtons`, and their asset imports).
- [ ] **Step 2: Delete unused components** — after the rewrite, remove files no longer imported anywhere: `ParallaxSection.tsx`, `ParallaxCarouselSection.tsx`, `FloatingCTA.tsx`, `FloatingHeaderButtons.tsx`, `TriplePhones.tsx`, `PhoneCarousel.tsx`, `ScreenshotsCarousel.tsx`, `PracticeCategories.tsx`, `PhoneFrame.tsx`, `GlassBox.tsx`, `Carousel.tsx`, `TrackBanner.tsx`, `Section.tsx`, `FeaturesGrid.tsx` (if replaced), `LandingView.tsx` (replaced by Hero). **Before deleting each, `grep -rn "<Name" static-react/src` to confirm zero references.** Keep `LanguageSelector.tsx` only if still used by Navbar; otherwise remove. Leave old `landing.*`/`keyFeatures.*`/`preview.*` i18n keys in place (harmless) or prune if trivially safe.
- [ ] **Step 3: Responsive pass** — check the three splits stack (media below text) on mobile, feature row collapses 4→1, nav shows logo+pill on mobile, hero text scales.
- [ ] **Step 4: Verify** — `cd static-react && npm run build && npm run lint` green; `npm run dev` and visually confirm the full dark page top-to-bottom at desktop + mobile widths (hero, solidifying nav, splits, light testimonial, CTA watermark, footer; scroll-reveals fire; images load).
- [ ] **Step 5: Commit** — `git commit -m "feat(landing): compose dark Giga-style landing; retire old sections"`.

---

## Self-Review

**Spec coverage:** Navbar/Hero → T2; social+stats → T3; feature row → T4; three splits + SplitSection → T5; testimonial + CTA → T6; footer → T7; composition/dark shell/retire-old → T8; tokens/primitives → T1; i18n across en/ru/uk → each task adds its keys. All spec sections mapped.

**Placeholder scan:** none — reusable pieces (Pill/SectionLabel/SplitSection) have full code; section tasks give structure + classes + assets + exact i18n keys, with copy in the spec. `steps` uses explicit `step1..4` keys (no array-return typing risk).

**Type/name consistency:** `Pill`/`SectionLabel` (T1) consumed by T2/T5/T6; `SplitSection` prop shape defined in T5 and used by `FeatureSplits`; asset imports use existing filenames from the Global Constraints list; `landing.*` key namespaces are unique per section.

## Verification (end to end)
`cd static-react && npm run build && npm run lint` clean; `npm run dev` visual pass desktop + mobile per Task 8 Step 4. Confirm no leftover references to deleted components (`grep`), and the site renders the new dark landing end-to-end with real en/ru/uk copy (switch language to spot-check).

## Out of scope
`app-react`/`server`/`frontend`; new deps; real logos/people; new imagery; pixel-perfect Giga fidelity (structure/UX match, Sadhana content).
