// Writes dist/index.html, dist/ru/index.html, dist/uk/index.html with the page
// pre-rendered and per-language head tags. Runs after the client + SSR builds.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { render } from '../dist-ssr/entry-server.js'

const SITE = 'https://sadhana.pro'
const LANGS = { en: '/', ru: '/ru/', uk: '/uk/' }
const OG_LOCALE = { en: 'en_US', ru: 'ru_RU', uk: 'uk_UA' }

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const template = readFileSync('dist/index.html', 'utf8')

for (const [lng, path] of Object.entries(LANGS)) {
  const translation = JSON.parse(readFileSync(`public/locales/${lng}/translation.json`, 'utf8'))
  const { html, title, description, keywords } = await render(lng, translation)
  const url = SITE + path
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Sadhana Pro',
    url,
    description,
    inLanguage: lng,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, iOS, Android',
    image: `${SITE}/og-image.jpg`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }).replace(/</g, '\\u003c')
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="keywords" content="${esc(keywords)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lng]}" />`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join('\n  ')

  const page = template
    .replace('<html lang="en">', () => `<html lang="${lng}">`)
    .replace('<!--app-head-->', () => head)
    .replace('<div id="root"></div>', () => `<div id="root">${html}</div>`)
  if (page === template || !page.includes(url)) throw new Error(`prerender markers missing for ${lng}`)

  mkdirSync(`dist${path}`, { recursive: true })
  writeFileSync(`dist${path}index.html`, page)
  console.log(`prerendered ${url}`)
}

rmSync('dist-ssr', { recursive: true, force: true })
