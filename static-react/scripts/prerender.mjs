// Writes dist/<lang path><page path>index.html for every page (home, /help/, each guide) in every
// language, pre-rendered with its own head tags, and dist/sitemap.xml. Runs after the client + SSR builds.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { render, LANGS, PAGES, pagePath, parsePath } from '../dist-ssr/entry-server.js'

const SITE = 'https://sadhana.pro'
const OG_LOCALE = { en: 'en_US', ru: 'ru_RU', uk: 'uk_UA' }

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const template = readFileSync('dist/index.html', 'utf8')

const alternates = (page) => [...LANGS.map((l) => [l, l]), ['x-default', 'en']]
  .map(([hreflang, l]) => `<link rel="alternate" hreflang="${hreflang}" href="${SITE}${pagePath(l, page)}" />`)
const sitemap = []

for (const page of PAGES) for (const lng of LANGS) {
  const path = pagePath(lng, page)
  const back = parsePath(path) // the client picks its page and language from the URL this way
  if (back.lang !== lng || back.page !== page) throw new Error(`${path} parses as ${JSON.stringify(back)}`)
  const translation = JSON.parse(readFileSync(`public/locales/${lng}/translation.json`, 'utf8'))
  const { html, title, description, keywords } = await render(lng, translation, page)
  const url = SITE + path
  const ogImage = `${SITE}/og-image-${lng}.jpg`
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Sadhana Pro',
    url,
    description,
    inLanguage: lng,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, iOS, Android',
    image: ogImage,
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
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    ...alternates(page),
    ...(page === 'home' ? [`<script type="application/ld+json">${jsonLd}</script>`] : []),
  ].join('\n  ')
  sitemap.push(`  <url>\n    <loc>${url}</loc>\n    ${alternates(page).map((l) => l.replace('<link', '<xhtml:link')).join('\n    ')}\n  </url>`)

  const out = template
    .replace('<html lang="en">', () => `<html lang="${lng}">`)
    .replace('<!--app-head-->', () => head)
    .replace('<div id="root"></div>', () => `<div id="root">${html}</div>`)
  if (out === template || !out.includes(url)) throw new Error(`prerender markers missing for ${lng}`)

  mkdirSync(`dist${path}`, { recursive: true })
  writeFileSync(`dist${path}index.html`, out)
  console.log(`prerendered ${url}`)
}

writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemap.join('\n')}
</urlset>
`)
rmSync('dist-ssr', { recursive: true, force: true })
