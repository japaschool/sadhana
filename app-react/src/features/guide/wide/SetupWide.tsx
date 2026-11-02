import { useTranslation } from 'react-i18next'
import { useLayout } from '../../../layouts/useLayout'
import { PrimaryButton, SecondaryButton } from '../../auth/kit'
import type { GuideKind } from '../guideLogic'
import { GuideFrame } from '../GuideFrame'
import { MiniReport } from '../MiniReport'
import { SetupBody } from '../setup/SetupBody'
import { useSetup } from '../setup/useSetup'
import type { Guide } from '../useGuide'

/** Tablet and desktop: the form beside a preview of the report with the choices so far. */
export function SetupWide({ guide, kind }: { guide: Guide; kind: GuideKind }) {
  const { t } = useTranslation()
  const desktop = useLayout() === 'desktop'
  const setup = useSetup(guide, kind)
  const footer = (
    <>
      <div className="w-40"><SecondaryButton onClick={guide.back}>{t('guide.back')}</SecondaryButton></div>
      <div className="flex flex-wrap items-center justify-end gap-4">
        {setup.hint && <span role="status" className="max-w-[340px] text-right text-[13px] leading-snug font-semibold text-ui-muted">{setup.hint}</span>}
        <div className="w-60"><PrimaryButton type="button" disabled={!setup.ready} onClick={setup.next}>{setup.nextLabel}</PrimaryButton></div>
      </div>
    </>
  )
  return (
    <GuideFrame guide={guide} footer={footer}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-8 lg:gap-12">
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2.5 pb-1">
            <span className="font-ui-mono text-xs font-semibold tracking-[.08em] text-ui-muted uppercase">{setup.position}</span>
            <h1 className={`${desktop ? 'text-4xl' : 'text-3xl'} leading-[1.15] font-extrabold tracking-[-0.02em] text-pretty`}>{t(`guide.kinds.${kind}.name`)}</h1>
            <p className="text-sm leading-normal text-ui-muted text-pretty">{t(`guide.setup.lead.${kind}`)}</p>
          </div>
          <SetupBody kind={kind} setup={setup} />
        </div>
        <div className="sticky top-6 flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
            <span className="font-ui-mono text-[11px] font-semibold tracking-[.1em] text-ui-muted uppercase">{t('guide.setup.preview')}</span>
            <span className="text-xs text-ui-muted">{t('guide.setup.previewSub')}</span>
          </div>
          <MiniReport kind={kind} compact={!desktop} applied={setup.value} />
        </div>
      </div>
    </GuideFrame>
  )
}
