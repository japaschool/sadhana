import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'
import i18n from './i18n'
import Lenis from '@studio-freight/lenis'

const lenis = new Lenis({
  smoothWheel: true,
  lerp: 0.08, // adjust for how “buttery” it feels
})

function raf(time: number) {
  lenis.raf(time)
  requestAnimationFrame(raf)
}
requestAnimationFrame(raf)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Update meta description based on current language and translations
function updateMeta() {
  const metaDescription = document.querySelector('meta[name="description"]')
  const metaOgDescription = document.querySelector('meta[property="og:description"]')
  const metaKeywords = document.querySelector('meta[name="keywords"]')
  const metaTitle = document.querySelector('title')
  const metaOgTitle = document.querySelector('meta[property="og:title"]')
  const metaOgUrl = document.querySelector('meta[property="og:url"]')
  const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null

  const desc = i18n.t('meta.description') as string
  const title = i18n.t('meta.title') as string
  const keywords = i18n.t('meta.keywords') as string

  if (metaDescription) metaDescription.setAttribute('content', desc)
  if (metaOgDescription) metaOgDescription.setAttribute('content', desc)
  document.title = title
  if (metaTitle) metaTitle.textContent = title
  if (metaOgTitle) metaOgTitle.textContent = title
  if (metaKeywords) metaKeywords.setAttribute('content', keywords)

  // update canonical link to reflect current language
  const lang = (i18n.language as string) || 'en'
  const langToPath: Record<string, string> = { en: '/', ru: '/ru/', uk: '/uk/' }
  const path = langToPath[lang] ?? `/${lang}/`
  const href = 'https://sadhana.pro' + path
  if (canonicalLink) canonicalLink.setAttribute('href', href)
  if (metaOgUrl) metaOgUrl.setAttribute('content', href)
}

// Run initially and on language change / loaded events
updateMeta()

if (i18n && typeof i18n.on === 'function') {
  i18n.on('languageChanged', () => updateMeta())
  i18n.on('loaded', () => updateMeta())
}
