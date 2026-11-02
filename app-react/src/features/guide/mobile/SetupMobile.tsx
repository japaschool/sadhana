import { useTranslation } from 'react-i18next'
import { PrimaryButton, SecondaryButton } from '../../auth/kit'
import { KINDS } from '../guideLogic'
import type { GuideKind } from '../guideLogic'
import { GuideFrame } from '../GuideFrame'
import { SetupBody } from '../setup/SetupBody'
import { useSetup } from '../setup/useSetup'
import type { Guide } from '../useGuide'

/** One report's set up on a phone: the form, and Next in a bar that stays in view. */
export function SetupMobile({ guide, kind }: { guide: Guide; kind: GuideKind }) {
  const { t } = useTranslation()
  const setup = useSetup(guide, kind)
  return (
    <GuideFrame guide={guide}>
      <div className="flex flex-col gap-2.5 px-[22px] pt-1 pb-4">
        <span className="font-ui-mono text-xs font-semibold tracking-[.08em] text-ui-muted uppercase">{setup.position}</span>
        <div className="flex gap-1" aria-hidden>
          {guide.tracked.map((k) => (
            <span key={k} className={`h-1.5 flex-1 rounded-[3px] ${KINDS.indexOf(k) < KINDS.indexOf(kind) ? 'bg-ui-accent-fill' : k === kind ? 'bg-ui-ink' : 'bg-ui-control'}`} />
          ))}
        </div>
        <h1 className="text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-pretty">{t(`guide.kinds.${kind}.name`)}</h1>
        <p className="text-sm leading-normal text-ui-muted text-pretty">{t(`guide.setup.lead.${kind}`)}</p>
      </div>
      <div className="flex flex-col gap-[18px] px-4 pb-44">
        <SetupBody kind={kind} setup={setup} />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t border-ui-hairline bg-ui-tabbar px-4 pt-3 pb-[max(30px,env(safe-area-inset-bottom))]">
        {setup.hint && <span role="status" className="text-center text-[13px] leading-snug text-ui-muted">{setup.hint}</span>}
        {setup.retry && <SecondaryButton onClick={setup.retry}>{t('guide.setup.retry')}</SecondaryButton>}
        <PrimaryButton type="button" disabled={!setup.ready} onClick={setup.next}>{setup.nextLabel}</PrimaryButton>
      </div>
    </GuideFrame>
  )
}
