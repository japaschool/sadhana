import { useTranslation } from 'react-i18next'
import { GUIDES, type Guide, type Lang, appUrl, pagePath } from '../pages'
import { shot } from '../shots'

const INK = '#1C1C1E'
const MUTED = 'rgba(28,28,28,0.58)'
const SERIF = { fontFamily: "'Playfair Display', serif", color: INK }
const guides = Object.keys(GUIDES) as Guide[]

function GuideList({ lang, except }: { lang: Lang; except?: Guide }) {
  const { t } = useTranslation()
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {guides.filter((g) => g !== except).map((g) => (
        <li key={g}>
          <a href={pagePath(lang, g)} className="block h-full rounded-2xl p-5 transition-colors hover:bg-black/[0.06]"
            style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <span className="block font-semibold" style={{ color: INK }}>{t(`help.${g}.title`)}</span>
            <span className="mt-1 block text-sm leading-relaxed" style={{ color: MUTED }}>{t(`help.${g}.summary`)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function StillStuck({ lang }: { lang: Lang }) {
  const { t } = useTranslation()
  return (
    <section className="mt-16 rounded-2xl p-6 text-center" style={{ background: '#E0DAD4' }}>
      <h2 className="text-xl font-medium" style={SERIF}>{t('help.question')}</h2>
      <p className="mt-2 text-sm" style={{ color: MUTED }}>{t('help.questionText')}</p>
      <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
        <a href="https://t.me/sadhanapro" target="_blank" rel="noreferrer" className="btn rounded-full px-6"
          style={{ background: 'rgba(28,28,28,0.10)', color: INK, border: 'none' }}>{t('help.telegram')}</a>
        <a href={appUrl(lang)} target="_blank" rel="noopener noreferrer" className="btn rounded-full px-6"
          style={{ background: '#3E8D6B', color: '#fff', border: 'none' }}>{t('cta.openNow')}</a>
      </div>
    </section>
  )
}

export function HelpIndex({ lang }: { lang: Lang }) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-3xl px-6 pt-28 pb-20">
      <h1 className="text-3xl font-medium md:text-4xl" style={SERIF}>{t('help.title')}</h1>
      <p className="mt-4 mb-10 text-lg leading-relaxed" style={{ color: MUTED }}>{t('help.intro')}</p>
      <GuideList lang={lang} />
      <StillStuck lang={lang} />
    </main>
  )
}

export function GuidePage({ lang, guide }: { lang: Lang; guide: Guide }) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-3xl px-6 pt-28 pb-20">
      <a href={pagePath(lang, 'help')} className="text-sm font-medium hover:underline" style={{ color: '#3E8D6B' }}>‹ {t('help.title')}</a>
      <h1 className="mt-3 text-3xl font-medium md:text-4xl" style={SERIF}>{t(`help.${guide}.title`)}</h1>
      <p className="mt-4 text-lg leading-relaxed" style={{ color: MUTED }}>{t(`help.${guide}.summary`)}</p>
      {GUIDES[guide].map(([step, name]: readonly [string, string?]) => {
        const src = name && shot(name, lang)
        const title = t(`help.${guide}.steps.${step}.title`)
        return (
          <section key={step} id={step} className="mt-12 flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
            <div className="flex-1">
              <h2 className="text-2xl font-medium" style={SERIF}>{title}</h2>
              {t(`help.${guide}.steps.${step}.text`).split('\n').map((p, i) => (
                <p key={i} className="mt-3 leading-relaxed" style={{ color: 'rgba(28,28,28,0.75)' }}>{p}</p>
              ))}
            </div>
            {src && (
              <img src={src} alt={title} loading="lazy" width={240} height={487}
                className="mx-auto w-[240px] shrink-0 rounded-[28px] md:mx-0"
                style={{ boxShadow: '0 0 0 6px #0A0A0A, 0 20px 50px rgba(0,0,0,0.18)' }} />
            )}
          </section>
        )
      })}
      <h2 className="mt-16 mb-5 text-xl font-medium" style={SERIF}>{t('help.more')}</h2>
      <GuideList lang={lang} except={guide} />
      <StillStuck lang={lang} />
    </main>
  )
}
