import { useTranslation } from 'react-i18next'
import { PrimaryButton, SecondaryButton } from '../auth/kit'
import { GuideFrame } from './GuideFrame'
import type { Guide } from './useGuide'

function Option({ on, title, body, onPick }: { on: boolean; title: string; body: string; onPick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick}
      className={`flex items-start gap-3.5 rounded-[18px] p-[18px] text-left ${on ? 'border-[1.5px] border-ui-accent bg-ui-tint' : 'border border-ui-card-border bg-ui-card'}`}>
      <span aria-hidden className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-ui-accent' : 'border-ui-faint'}`}>
        {on && <span className="h-2.5 w-2.5 rounded-full bg-ui-accent" />}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[17px] leading-snug font-extrabold">{title}</span>
        <span className="text-sm leading-normal text-ui-ink2 text-pretty">{body}</span>
      </span>
    </button>
  )
}

/** "Does anyone else read this chart?" First run only. Neither answer starts selected: this is how people with a reader are counted. */
export function ReaderStep({ guide }: { guide: Guide }) {
  const { t } = useTranslation()
  const wide = !guide.carousel
  const answered = guide.reader !== null
  const finish = <PrimaryButton type="button" disabled={!answered} onClick={guide.next}>{t('guide.reader.finish')}</PrimaryButton>
  const note = !answered && <span role="status" className="text-center text-[13px] leading-snug font-semibold text-ui-muted">{t('guide.reader.pick')}</span>
  const footer = wide && (
    <>
      <div className="w-40"><SecondaryButton onClick={guide.back}>{t('guide.back')}</SecondaryButton></div>
      <div className="flex items-center gap-4">{note}<div className="w-60">{finish}</div></div>
    </>
  )
  return (
    <GuideFrame guide={guide} footer={footer || undefined}>
      <div className={`flex flex-col gap-4 ${wide ? 'max-w-3xl' : 'px-[22px] pt-1'}`}>
        <span className="font-ui-mono text-xs font-semibold tracking-[.08em] text-ui-muted uppercase">{t('guide.reader.label')}</span>
        <h1 className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em] text-pretty">{t('guide.reader.title')}</h1>
        <p className="text-sm leading-normal text-ui-muted text-pretty">{t('guide.reader.intro')}</p>
        <p className="text-sm leading-normal text-ui-ink2 text-pretty">{t('guide.reader.always')}</p>
        <div role="radiogroup" aria-label={t('guide.reader.title')} className={`grid gap-3 ${wide ? 'grid-cols-2' : ''}`}>
          <Option on={guide.reader === true} title={t('guide.reader.yes')} body={t('guide.reader.yesBody')} onPick={() => guide.setReader(true)} />
          <Option on={guide.reader === false} title={t('guide.reader.no')} body={t('guide.reader.noBody')} onPick={() => guide.setReader(false)} />
        </div>
        {!wide && <div className="flex flex-col gap-2 pt-2">{note}{finish}</div>}
      </div>
    </GuideFrame>
  )
}
