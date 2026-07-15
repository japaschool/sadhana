# Lander Page Redesign (DaisyUI / Spiritual Theme) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark/parallax landing page in `static-react/` with a light, calm, spiritual SaaS lander using DaisyUI v5 components and a custom warm amber/ivory theme.

**Architecture:** Install DaisyUI v5 as a Tailwind v4 `@plugin`, define a `spiritual` custom theme via CSS custom properties, then replace each section component one at a time, rewiring `App.tsx` as each new component is ready.

**Tech Stack:** React 19, Vite 7, Tailwind v4 (`@tailwindcss/vite`), DaisyUI v5, Framer Motion, react-i18next, react-icons

## Global Constraints

- All i18n keys are unchanged — use exact keys from `public/locales/en/translation.json`
- Language-aware CTA URL: `lang === 'uk'` → `https://mapp.sadhana.pro/` else `https://app.sadhana.pro/`
- Three supported languages: `en`, `ru`, `uk`
- Derive 2-letter language code: `(i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)`
- `data-theme="spiritual"` must be set on the root `<div>` in `App.tsx`
- All files are inside `static-react/src/`
- Working directory for all `npm` commands: `static-react/`
- Build command: `npm run build` (must pass TypeScript + Vite build)
- Dev command: `npm run dev`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/index.css` | Add Google Fonts, `@plugin "daisyui"`, spiritual theme CSS variables |
| Create | `src/components/Navbar.tsx` | Sticky navbar with logo, social icons, language dropdown, CTA button |
| Create | `src/components/Hero.tsx` | Full-viewport hero with headline, description, CTA button, mandala watermark |
| Create | `src/components/FeaturesGrid.tsx` | 7-feature responsive card grid with staggered animation |
| Create | `src/components/ScreenshotsCarousel.tsx` | DaisyUI CSS-scroll carousel with 8 app screenshots and dot navigation |
| Create | `src/components/TrackBanner.tsx` | Full-width amber CTA banner section |
| Modify | `src/components/Footer.tsx` | Rewrite as DaisyUI footer with social links |
| Modify | `src/App.tsx` | Compose all new components; remove old ones |
| Delete | `src/components/LandingView.tsx` | Replaced by `Hero.tsx` |
| Delete | `src/components/FloatingHeaderButtons.tsx` | Replaced by `Navbar.tsx` |
| Delete | `src/components/FloatingCTA.tsx` | CTA now in Navbar and Hero |
| Delete | `src/components/ParallaxSection.tsx` | Replaced by `FeaturesGrid.tsx` and `TrackBanner.tsx` |
| Delete | `src/components/ParallaxCarouselSection.tsx` | Replaced by `ScreenshotsCarousel.tsx` |
| Delete | `src/components/Carousel.tsx` | Replaced by `ScreenshotsCarousel.tsx` |
| Delete | `src/components/GlassBox.tsx` | No longer used |
| Delete | `src/components/Section.tsx` | No longer used |
| Delete | `src/App.css` | No longer used |

---

## Task 1: Install DaisyUI and configure the spiritual theme

**Files:**
- Modify: `src/index.css`
- No other files change in this task

**Interfaces:**
- Produces: `data-theme="spiritual"` CSS custom properties available globally; DaisyUI component classes (`.btn`, `.card`, `.navbar`, etc.) work

- [ ] **Step 1: Install DaisyUI**

```bash
cd static-react && npm install daisyui@latest
```

Expected output: `added N packages` with no errors.

- [ ] **Step 2: Rewrite `src/index.css`**

Replace the entire file with:

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap');
@import 'tailwindcss';
@plugin "daisyui";

/* Custom "spiritual" theme — warm amber/ivory palette */
[data-theme="spiritual"] {
  color-scheme: light;

  --color-primary:          oklch(67.15% 0.131 55.73);   /* #D4872A amber/gold */
  --color-primary-content:  oklch(100%  0     0);         /* #FFFFFF white */
  --color-secondary:        oklch(58.43% 0.051 144.16);  /* #7B8F6E sage green */
  --color-secondary-content: oklch(100% 0     0);
  --color-accent:           oklch(62.11% 0.101 55.16);   /* #C4733F terracotta */
  --color-accent-content:   oklch(100%  0     0);
  --color-neutral:          oklch(28.27% 0.041 46.36);   /* #3D3228 deep brown */
  --color-neutral-content:  oklch(95.5%  0.021 78.56);   /* #F5EFE3 cream */
  --color-base-100:         oklch(98.46% 0.014 80.88);   /* #FDFAF5 ivory */
  --color-base-200:         oklch(95.5%  0.021 78.56);   /* #F5EFE3 warm cream */
  --color-base-300:         oklch(91.82% 0.031 75.59);   /* #EDE5D4 cream */
  --color-base-content:     oklch(26.05% 0.047 55.48);   /* #2D2418 warm dark brown */

  --font-sans: 'Inter', sans-serif;
}

html, body, #root {
  position: relative;
}
```

- [ ] **Step 3: Add `data-theme="spiritual"` to App.tsx temporarily**

Open `src/App.tsx`. Change the root `<div>` opening tag from:

```tsx
<div className="relative font-sans bg-neutral-100 text-gray-900">
```

to:

```tsx
<div data-theme="spiritual" className="relative font-sans">
```

(Leave all existing component imports and JSX unchanged for now.)

- [ ] **Step 4: Verify dev server starts**

```bash
cd static-react && npm run dev
```

Expected: dev server starts at `http://localhost:5173` with no errors. Open the browser — the page background should appear slightly ivory-tinted (the theme is active). DaisyUI base styles are loaded.

- [ ] **Step 5: Commit**

```bash
cd static-react && cd .. && git add static-react/src/index.css static-react/src/App.tsx static-react/package.json static-react/package-lock.json
git commit -m "feat: install DaisyUI v5 and add spiritual theme"
```

---

## Task 2: Navbar component

**Files:**
- Create: `src/components/Navbar.tsx`
- Modify: `src/App.tsx` (swap `FloatingHeaderButtons` → `Navbar`)

**Interfaces:**
- Consumes: `useTranslation()` from react-i18next (keys: `cta.openNow`)
- Produces: `<Navbar />` — default export, no props

- [ ] **Step 1: Create `src/components/Navbar.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { FaTelegramPlane, FaYoutube } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

export default function Navbar() {
  const { i18n, t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const current = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2).toUpperCase()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function changeLang(l: 'en' | 'ru' | 'uk') {
    void i18n.changeLanguage(l)
    window.history.pushState({}, '', l === 'en' ? '/' : `/${l}`)
    setLangOpen(false)
  }

  return (
    <div
      className={`navbar fixed top-0 left-0 right-0 z-50 px-6 transition-all duration-300 ${
        scrolled ? 'bg-base-100/90 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="navbar-start">
        <span
          className="text-xl font-bold text-base-content select-none"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Sadhana Pro
        </span>
      </div>

      <div className="navbar-end gap-1">
        <a
          href="https://t.me/sadhanapro"
          target="_blank"
          rel="noreferrer"
          title="Telegram"
          className="btn btn-ghost btn-circle text-base-content"
        >
          <FaTelegramPlane className="w-5 h-5" />
        </a>

        <a
          href="https://www.youtube.com/@SadhanaPro"
          target="_blank"
          rel="noreferrer"
          title="YouTube"
          className="btn btn-ghost btn-circle text-base-content"
        >
          <FaYoutube className="w-5 h-5" />
        </a>

        <div ref={dropRef} className="relative">
          <button
            onClick={() => setLangOpen(v => !v)}
            className="btn btn-ghost btn-circle text-base-content font-semibold text-sm"
            aria-haspopup="menu"
            aria-expanded={langOpen}
            title="Change language"
          >
            {current}
          </button>
          {langOpen && (
            <ul className="absolute top-14 right-0 menu bg-base-100 rounded-box shadow-lg w-44 p-2 border border-base-300 z-60">
              <li><button onClick={() => changeLang('en')} className="w-full text-left">🇬🇧 English</button></li>
              <li><button onClick={() => changeLang('ru')} className="w-full text-left">🇷🇺 Русский</button></li>
              <li><button onClick={() => changeLang('uk')} className="w-full text-left">🇺🇦 Українська</button></li>
            </ul>
          )}
        </div>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm rounded-full px-5 ml-1"
        >
          {t('cta.openNow')}
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx` — swap FloatingHeaderButtons for Navbar**

Replace:
```tsx
import FloatingHeaderButtons from './components/FloatingHeaderButtons'
```
with:
```tsx
import Navbar from './components/Navbar'
```

Replace `<FloatingHeaderButtons />` with `<Navbar />`.

- [ ] **Step 3: Verify**

Open `http://localhost:5173`. The top-right floating glass buttons should be gone. A sticky navbar with "Sadhana Pro" wordmark, social icons, language picker, and amber "Open Now" button should appear. On scroll past 20px, the navbar background should blur to ivory.

- [ ] **Step 4: Commit**

```bash
git add static-react/src/components/Navbar.tsx static-react/src/App.tsx
git commit -m "feat: add Navbar component with scroll blur and language switcher"
```

---

## Task 3: Hero section

**Files:**
- Create: `src/components/Hero.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: i18n keys `landing.title`, `landing.subtitle`, `landing.description`, `cta.openNow`
- Produces: `<Hero />` — default export, no props

- [ ] **Step 1: Create `src/components/Hero.tsx`**

```tsx
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function Hero() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-base-100 pt-16">
      {/* Mandala watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <svg
          viewBox="0 0 200 200"
          className="w-[700px] h-[700px] text-primary opacity-[0.04]"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="24" fill="none" stroke="currentColor" strokeWidth="0.5" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => (
            <ellipse
              key={angle}
              cx="100"
              cy="60"
              rx="7"
              ry="22"
              opacity="0.7"
              transform={`rotate(${angle} 100 100)`}
            />
          ))}
          {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
            <ellipse
              key={`inner-${angle}`}
              cx="100"
              cy="76"
              rx="5"
              ry="14"
              opacity="0.5"
              transform={`rotate(${angle} 100 100)`}
            />
          ))}
        </svg>
      </div>

      <motion.div
        className="relative z-10 text-center px-6 md:px-12 flex flex-col items-center gap-6 max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <h1
          className="text-5xl md:text-7xl font-bold text-base-content leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {t('landing.title')}
        </h1>
        <p className="text-xl md:text-2xl text-base-content/60 font-light">
          {t('landing.subtitle')}
        </p>
        <p className="text-base md:text-lg text-base-content/50 leading-relaxed max-w-2xl">
          {t('landing.description')}
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-lg rounded-full px-12 mt-2 shadow-lg"
        >
          {t('cta.openNow')}
        </a>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx` — swap LandingView for Hero**

Replace:
```tsx
import LandingView from './components/LandingView'
```
with:
```tsx
import Hero from './components/Hero'
```

Replace `<LandingView />` with `<Hero />`.

- [ ] **Step 3: Verify**

The dark full-screen hero with nature photo should be gone. A light ivory section with large "Sadhana Pro" headline, subtitle, description and amber CTA button should appear. A faint mandala watermark should be visible centered behind the text.

- [ ] **Step 4: Commit**

```bash
git add static-react/src/components/Hero.tsx static-react/src/App.tsx
git commit -m "feat: add Hero section with mandala watermark and amber CTA"
```

---

## Task 4: Features Grid

**Files:**
- Create: `src/components/FeaturesGrid.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: i18n keys `keyFeatures.title`, `keyFeatures.customisableTitle/Description`, `keyFeatures.reportsTitle/Description`, `keyFeatures.offlineTitle/Description`, `keyFeatures.installTitle/Description`, `keyFeatures.shareTitle/Description`, `keyFeatures.groupTitle/Description`, `keyFeatures.dataTitle/Description`
- Produces: `<FeaturesGrid />` — default export, no props

- [ ] **Step 1: Create `src/components/FeaturesGrid.tsx`**

```tsx
import { motion } from 'framer-motion'
import { FaSeedling, FaChartBar, FaWifi, FaMobileAlt, FaShareAlt, FaUsers, FaFileCsv } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function FeaturesGrid() {
  const { t } = useTranslation()

  const features = [
    { icon: <FaSeedling />, title: t('keyFeatures.customisableTitle'), desc: t('keyFeatures.customisableDescription'), color: 'text-primary' },
    { icon: <FaChartBar />, title: t('keyFeatures.reportsTitle'), desc: t('keyFeatures.reportsDescription'), color: 'text-secondary' },
    { icon: <FaWifi />, title: t('keyFeatures.offlineTitle'), desc: t('keyFeatures.offlineDescription'), color: 'text-primary' },
    { icon: <FaMobileAlt />, title: t('keyFeatures.installTitle'), desc: t('keyFeatures.installDescription'), color: 'text-secondary' },
    { icon: <FaShareAlt />, title: t('keyFeatures.shareTitle'), desc: t('keyFeatures.shareDescription'), color: 'text-primary' },
    { icon: <FaUsers />, title: t('keyFeatures.groupTitle'), desc: t('keyFeatures.groupDescription'), color: 'text-secondary' },
    { icon: <FaFileCsv />, title: t('keyFeatures.dataTitle'), desc: t('keyFeatures.dataDescription'), color: 'text-primary' },
  ]

  return (
    <section className="bg-base-200 py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="text-4xl md:text-5xl font-bold text-center text-base-content mb-14"
          style={{ fontFamily: "'Playfair Display', serif" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          {t('keyFeatures.title')}
        </motion.h2>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow duration-300"
              variants={cardVariants}
            >
              <div className="card-body gap-3 p-6">
                <div className={`text-3xl ${f.color}`}>{f.icon}</div>
                <h3 className="card-title text-base-content text-lg leading-snug">{f.title}</h3>
                <p className="text-base-content/55 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx` — replace the first ParallaxSection (features) with FeaturesGrid**

Add import:
```tsx
import FeaturesGrid from './components/FeaturesGrid'
```

Remove the first `<ParallaxSection ... />` block (the one with `image={mountain}` and the features list) and replace with:
```tsx
<FeaturesGrid />
```

Also remove the now-unused imports: `mountain` image import and the FA icon imports (they are now inside FeaturesGrid.tsx).

- [ ] **Step 3: Verify**

Scrolling past the hero should reveal the features section: warm cream background, "Key Features" heading in Playfair Display, 7 cards with amber/sage icons. Cards should animate in with a stagger effect on scroll.

- [ ] **Step 4: Commit**

```bash
git add static-react/src/components/FeaturesGrid.tsx static-react/src/App.tsx
git commit -m "feat: add FeaturesGrid with staggered card animations"
```

---

## Task 5: Screenshots Carousel

**Files:**
- Create: `src/components/ScreenshotsCarousel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: i18n keys `preview.title`, `preview.slide1` through `preview.slide8`; image assets `shot-1.jpg` through `shot-8.jpg`
- Produces: `<ScreenshotsCarousel />` — default export, no props

- [ ] **Step 1: Create `src/components/ScreenshotsCarousel.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import shot1 from '../assets/shot-1.jpg'
import shot2 from '../assets/shot-2.jpg'
import shot3 from '../assets/shot-3.jpg'
import shot4 from '../assets/shot-4.jpg'
import shot5 from '../assets/shot-5.jpg'
import shot6 from '../assets/shot-6.jpg'
import shot7 from '../assets/shot-7.jpg'
import shot8 from '../assets/shot-8.jpg'

const shots = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8]

const slideKeys = [
  'preview.slide1', 'preview.slide2', 'preview.slide3', 'preview.slide4',
  'preview.slide5', 'preview.slide6', 'preview.slide7', 'preview.slide8',
] as const

export default function ScreenshotsCarousel() {
  const { t } = useTranslation()

  const slides = shots.map((img, i) => ({
    image: img,
    caption: t(slideKeys[i]),
  }))

  return (
    <section className="bg-base-100 py-24 px-6">
      <div className="max-w-2xl mx-auto">
        <h2
          className="text-4xl md:text-5xl font-bold text-center text-base-content mb-12"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {t('preview.title')}
        </h2>

        <div className="carousel w-full rounded-2xl overflow-hidden shadow-xl">
          {slides.map((slide, i) => (
            <div
              key={i}
              id={`sp-slide-${i}`}
              className="carousel-item relative w-full flex-col"
            >
              <img
                src={slide.image}
                alt={slide.caption}
                className="w-full object-cover select-none"
                draggable={false}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-neutral/60 backdrop-blur-sm text-neutral-content text-center py-3 px-4 text-sm font-light">
                {slide.caption}
              </div>
            </div>
          ))}
        </div>

        {/* Dot navigation */}
        <div className="flex justify-center gap-2 mt-5 flex-wrap">
          {slides.map((_, i) => (
            <a
              key={i}
              href={`#sp-slide-${i}`}
              className="w-2.5 h-2.5 rounded-full bg-base-300 hover:bg-primary transition-colors duration-200"
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx` — replace ParallaxCarouselSection with ScreenshotsCarousel**

Add import:
```tsx
import ScreenshotsCarousel from './components/ScreenshotsCarousel'
```

Remove the `<ParallaxCarouselSection ... />` block (with `image={showcaseBg}` and 8 slides) and replace with:
```tsx
<ScreenshotsCarousel />
```

Remove the now-unused imports: `showcaseBg`, `shot1` through `shot8`, `ParallaxCarouselSection`.

- [ ] **Step 3: Verify**

The screenshot section should show a clean rounded card carousel on an ivory background. Clicking the dots should scroll to the corresponding slide. The caption overlay at the bottom of each image should be readable. The carousel is natively swipeable on mobile via CSS scroll snap.

- [ ] **Step 4: Commit**

```bash
git add static-react/src/components/ScreenshotsCarousel.tsx static-react/src/App.tsx
git commit -m "feat: add ScreenshotsCarousel with DaisyUI scroll-snap and dot navigation"
```

---

## Task 6: Track Anything Banner

**Files:**
- Create: `src/components/TrackBanner.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: i18n keys `trackAnything`, `trackAnythingText`, `cta.openNow`
- Produces: `<TrackBanner />` — default export, no props

- [ ] **Step 1: Create `src/components/TrackBanner.tsx`**

```tsx
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function TrackBanner() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const href = lang === 'uk' ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/'

  return (
    <section className="bg-primary py-28 px-6">
      <motion.div
        className="max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <h2
          className="text-4xl md:text-5xl font-bold text-primary-content mb-6 leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {t('trackAnything')}
        </h2>
        <p className="text-primary-content/75 text-lg leading-relaxed mb-10">
          {t('trackAnythingText')}
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-lg rounded-full px-12 text-primary-content border-primary-content hover:bg-primary-content hover:text-primary"
        >
          {t('cta.openNow')}
        </a>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx` — replace the second ParallaxSection (track anything) with TrackBanner**

Add import:
```tsx
import TrackBanner from './components/TrackBanner'
```

Remove the second `<ParallaxSection ... />` block (with `image={forest}`, `title={t('trackAnything')}`) and replace with:
```tsx
<TrackBanner />
```

Remove now-unused imports: `forest` image, `ParallaxSection` (if no longer used anywhere).

Also remove `<FloatingCTA />` and its import — the CTA is now handled by Navbar and Hero.

- [ ] **Step 3: Verify**

A solid amber/gold full-width section with white text should appear after the screenshots carousel. The heading and body text should be readable. The white outline "Open Now" button should be visible and the hover state should invert to white background with amber text.

- [ ] **Step 4: Commit**

```bash
git add static-react/src/components/TrackBanner.tsx static-react/src/App.tsx
git commit -m "feat: add TrackBanner amber CTA section"
```

---

## Task 7: Footer rewrite

**Files:**
- Modify: `src/components/Footer.tsx`

**Interfaces:**
- Consumes: i18n key `footer.copyright`
- Produces: `<Footer />` — default export, no props (interface unchanged, App.tsx keeps `<Footer />`)

- [ ] **Step 1: Rewrite `src/components/Footer.tsx`**

```tsx
import { FaTelegramPlane, FaYoutube } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="bg-neutral text-neutral-content py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <a
            href="https://t.me/sadhanapro"
            target="_blank"
            rel="noreferrer"
            title="Telegram"
            className="btn btn-ghost btn-circle text-neutral-content hover:bg-neutral-content/10"
          >
            <FaTelegramPlane className="w-5 h-5" />
          </a>
          <a
            href="https://www.youtube.com/@SadhanaPro"
            target="_blank"
            rel="noreferrer"
            title="YouTube"
            className="btn btn-ghost btn-circle text-neutral-content hover:bg-neutral-content/10"
          >
            <FaYoutube className="w-5 h-5" />
          </a>
        </div>
        <p className="text-sm text-neutral-content/60">{t('footer.copyright')}</p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Verify**

The footer should have a deep brown background with cream-tinted Telegram and YouTube icon buttons plus the copyright text.

- [ ] **Step 3: Commit**

```bash
git add static-react/src/components/Footer.tsx
git commit -m "feat: rewrite Footer with DaisyUI neutral theme and social links"
```

---

## Task 8: Final cleanup and build verification

**Files:**
- Modify: `src/App.tsx` (final clean version)
- Delete: 8 old component files + `App.css`

**Interfaces:**
- Consumes: all new components from Tasks 2–7
- Produces: complete working build

- [ ] **Step 1: Write the final clean `src/App.tsx`**

Replace the entire file with:

```tsx
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FeaturesGrid from './components/FeaturesGrid'
import ScreenshotsCarousel from './components/ScreenshotsCarousel'
import TrackBanner from './components/TrackBanner'
import Footer from './components/Footer'

export default function App() {
  return (
    <div data-theme="spiritual" className="font-sans">
      <Navbar />
      <Hero />
      <FeaturesGrid />
      <ScreenshotsCarousel />
      <TrackBanner />
      <Footer />
    </div>
  )
}
```

- [ ] **Step 2: Delete old component files**

```bash
cd static-react && rm src/components/LandingView.tsx \
  src/components/FloatingHeaderButtons.tsx \
  src/components/FloatingCTA.tsx \
  src/components/ParallaxSection.tsx \
  src/components/ParallaxCarouselSection.tsx \
  src/components/Carousel.tsx \
  src/components/GlassBox.tsx \
  src/components/Section.tsx \
  src/components/LanguageSelector.tsx \
  src/App.css 2>/dev/null; true
```

(The `2>/dev/null; true` is safe — some files like `LanguageSelector.tsx` may not exist if already removed.)

- [ ] **Step 3: Verify TypeScript build passes**

```bash
cd static-react && npm run build
```

Expected: `✓ built in Xs` with no TypeScript errors and no missing import errors. If there are import errors, check `App.tsx` still has no references to deleted files.

- [ ] **Step 4: Final visual check**

```bash
cd static-react && npm run dev
```

Walk through the full page and confirm:
1. Navbar: sticky, transparent → cream on scroll, language picker works, "Open Now" links to correct URL
2. Hero: ivory background, Playfair Display headline, mandala watermark visible, amber CTA button works
3. Features Grid: cream background, 7 cards in responsive grid, icons colored amber/sage, stagger animation on scroll
4. Screenshots: white background, carousel scrolls via dots, captions readable, dark caption overlay
5. Track Banner: solid amber section, white text, outline button inverts on hover
6. Footer: deep brown, social icon buttons, copyright text

- [ ] **Step 5: Commit**

```bash
cd static-react && cd .. && git add static-react/src/App.tsx static-react/src/components/
git commit -m "feat: complete lander redesign — light spiritual SaaS layout with DaisyUI"
```
