import { useTranslation } from 'react-i18next'
import { useLayout } from '../../../layouts/useLayout'
import { PrimaryButton, SecondaryButton } from '../../auth/kit'
import { KINDS } from '../guideLogic'
import { GuideFrame } from '../GuideFrame'
import { KindHead } from '../KindHead'
import { MiniReport } from '../MiniReport'
import { PickTile } from '../PickTile'
import type { Guide } from '../useGuide'

/** Tablet (2 across) and desktop (3 across): every report at once, each tile a checkbox, all one height. */
export function ChooseWide({ guide }: { guide: Guide }) {
  const { t } = useTranslation()
  const desktop = useLayout() === 'desktop'
  const n = guide.tracked.length
  const names = guide.tracked.map((k) => t(`guide.kinds.${k}.name`)).join(', ')
  const footer = (
    <>
      {guide.canBack ? <div className="w-40"><SecondaryButton onClick={guide.back}>{t('guide.back')}</SecondaryButton></div> : <span />}
      <div className="flex flex-wrap items-center justify-end gap-4">
        <span className="max-w-[340px] text-right text-[13px] leading-snug font-semibold text-ui-muted">
          {n ? `${t('guide.chosen', { n })} · ${names}` : t('guide.chooseOne')}
        </span>
        <div className="w-40"><PrimaryButton type="button" disabled={!n} onClick={guide.next}>{t('guide.next')}</PrimaryButton></div>
      </div>
    </>
  )
  return (
    <GuideFrame guide={guide} footer={footer}>
      <div className="flex flex-col gap-6">
        <div className="flex max-w-[900px] flex-col gap-2">
          <h1 className={`${desktop ? 'text-4xl' : 'text-3xl'} leading-[1.15] font-extrabold tracking-[-0.02em] text-pretty`}>{t('guide.title')}</h1>
          <p className="text-sm leading-normal text-ui-muted text-pretty">{t('guide.intro')}</p>
        </div>
        <div className={`grid auto-rows-fr items-stretch ${desktop ? 'grid-cols-3 gap-5' : 'grid-cols-2 gap-4'}`}>
          {KINDS.map((k) => {
            const on = guide.tracked.includes(k)
            return (
              <PickTile key={k} on={on} label={t(`guide.kinds.${k}.name`)} onToggle={() => guide.toggle(k)}>
                <MiniReport kind={k} compact={desktop} on={on} head={<KindHead kind={k} />} />
              </PickTile>
            )
          })}
        </div>
      </div>
    </GuideFrame>
  )
}
