// Every page of the site, per language: the home page, the guides index (/help/) and one page per guide.
export const LANGS = ['en', 'ru', 'uk'] as const
export type Lang = (typeof LANGS)[number]

/** Each guide's sections, in order, and the screenshot (assets/shots/<name>.<lang>.webp) shown with it. */
export const GUIDES = {
  install: [['ios'], ['android'], ['computer'], ['offline']],
  practices: [['add', 'practices'], ['types'], ['today', 'help-practices'], ['helpChoose']],
  reports: [['find', 'overview'], ['readyMade', 'help-reports'], ['graph', 'sleep'], ['table', 'table']],
  yatras: [['what', 'group'], ['join'], ['link', 'help-yatra-links'], ['create']],
  sharing: [['link', 'help-sharing'], ['open'], ['withdraw']],
} as const satisfies Record<string, readonly (readonly [string, string?])[]>
export type Guide = keyof typeof GUIDES
export type Page = 'home' | 'help' | Guide
export const PAGES: Page[] = ['home', 'help', ...(Object.keys(GUIDES) as Guide[])]

const isGuide = (s: string | undefined): s is Guide => !!s && s in GUIDES

export function pagePath(lang: Lang, page: Page): string {
  const base = lang === 'en' ? '/' : `/${lang}/`
  return page === 'home' ? base : page === 'help' ? `${base}help/` : `${base}help/${page}/`
}

/** '/ru/help/yatras/' → { lang: 'ru', page: 'yatras' }. Anything unknown under /help/ is the index. */
export function parsePath(pathname: string): { lang: Lang; page: Page } {
  const segs = pathname.split('/').filter(Boolean)
  const lang: Lang = segs[0] === 'ru' || segs[0] === 'uk' ? (segs.shift() as Lang) : 'en'
  if (segs[0] !== 'help') return { lang, page: 'home' }
  return { lang, page: isGuide(segs[1]) ? segs[1] : 'help' }
}

export const appUrl = (lang: string) => (lang.startsWith('uk') ? 'https://mapp.sadhana.pro/' : 'https://app.sadhana.pro/')
